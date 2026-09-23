/**
 * Encrypt Existing Documents Migration Utility
 *
 * Scans for legacy unencrypted document files in the repository,
 * encrypts them with unique Data Encryption Keys (DEKs) using AES-256-GCM,
 * wraps the DEKs with the authorized user's Vault Key,
 * updates MySQL document_versions metadata, and validates roundtrip decryption.
 *
 * Safety Rules:
 * 1. Default DOCUMENT_MIGRATION_DELETE_PLAINTEXT=false (Never silently destroy files).
 * 2. Plaintext files are only removed if explicitly set to 'true' AND decryption verification passes.
 *
 * Usage:
 * node scripts/encrypt-existing-documents.js --userId=1 --vaultPassword="YourVaultPassword"
 */

const fs = require("fs");
const path = require("path");
const db = require("../config/database");
const env = require("../config/env");
const keyManagementService = require("../services/keyManagementService");
const documentEncryptionService = require("../services/documentEncryptionService");
const documentStorageService = require("../services/documentStorageService");
const { logDocumentEvent } = require("../services/auditService");

// Parse CLI arguments
const args = process.argv.slice(2);
const params = {};
args.forEach((arg) => {
  const match = arg.match(/^--([^=]+)=(.*)$/);
  if (match) {
    params[match[1]] = match[2];
  }
});

const deletePlaintextConfig =
  (process.env.DOCUMENT_MIGRATION_DELETE_PLAINTEXT || "false").toLowerCase() ===
  "true";

async function runMigration() {
  console.log(
    "==================================================================",
  );
  console.log("Starting Document Encryption Migration Utility (Prompt 7A)");
  console.log(`DOCUMENT_MIGRATION_DELETE_PLAINTEXT: ${deletePlaintextConfig}`);
  console.log(
    "==================================================================",
  );

  const userId = parseInt(params.userId || process.env.MIGRATION_USER_ID, 10);
  const vaultPassword =
    params.vaultPassword || process.env.MIGRATION_VAULT_PASSWORD;

  if (!userId || isNaN(userId)) {
    console.error("Error: --userId=<number> is required.");
    process.exit(1);
  }

  if (!vaultPassword) {
    console.error(
      "Error: --vaultPassword=<string> is required to unlock the master Vault Key.",
    );
    process.exit(1);
  }

  // 1. Fetch user's vault configuration
  const [vaultRows] = await db.execute(
    `SELECT * FROM user_vaults WHERE user_id = ?`,
    [userId],
  );
  if (vaultRows.length === 0) {
    console.error(
      `Error: No Document Vault found for user ID ${userId}. Please configure the vault first.`,
    );
    process.exit(1);
  }

  const vault = vaultRows[0];

  // 2. Unwrap Vault Key using provided vault password
  let kdfParams = {};
  try {
    kdfParams =
      typeof vault.kdf_parameters === "string"
        ? JSON.parse(vault.kdf_parameters)
        : vault.kdf_parameters;
  } catch {
    kdfParams = {};
  }

  let vaultKey = null;
  try {
    const kek = keyManagementService.deriveKeyEncryptionKey(
      vaultPassword,
      vault.kdf_salt,
      vault.kdf_algorithm || "scrypt",
      kdfParams,
    );

    vaultKey = keyManagementService.decryptVaultKey(
      vault.encrypted_vault_key,
      kek,
      vault.vault_key_iv,
      vault.vault_key_auth_tag,
    );
    console.log(
      "✓ Vault password verified & Master Vault Key decrypted in memory.",
    );
  } catch (err) {
    console.error(
      "Error: Invalid vault password. Failed to decrypt Master Vault Key.",
    );
    process.exit(1);
  }

  // 3. Find unencrypted document versions
  const [unencryptedVersions] = await db.execute(
    `SELECT dv.*, d.case_id, d.title as doc_title
     FROM document_versions dv
     JOIN documents d ON dv.document_id = d.id
     WHERE dv.encryption_status = 'UNENCRYPTED' 
        OR dv.encrypted_data_key IS NULL 
        OR dv.encrypted_data_key = ''`,
  );

  console.log(
    `Found ${unencryptedVersions.length} unencrypted document version(s) to migrate.\n`,
  );

  if (unencryptedVersions.length === 0) {
    console.log("All documents are already encrypted. Migration complete.");
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;

  for (const version of unencryptedVersions) {
    console.log(
      `Processing Version ID ${version.id} (Doc: '${version.doc_title}', File: ${version.original_filename})...`,
    );

    try {
      const exists = await documentStorageService.fileExists(
        version.storage_key,
      );
      if (!exists) {
        console.warn(
          `  [SKIPPED] Physical file does not exist at key: ${version.storage_key}`,
        );
        failCount++;
        continue;
      }

      // Read plaintext file buffer from storage
      const plaintextBuffer =
        await documentStorageService.provider.getFileBuffer(
          version.storage_key,
        );

      // Verify original checksum
      const initialChecksum =
        documentEncryptionService.calculateChecksum(plaintextBuffer);
      if (initialChecksum !== version.checksum) {
        console.warn(
          `  [WARNING] Checksum mismatch on unencrypted original file (DB: ${version.checksum}, File: ${initialChecksum}). Proceeding with file checksum.`,
        );
      }

      // Generate unique DEK and encrypt buffer
      const dek = keyManagementService.generateDocumentKey();
      const encrypted = documentEncryptionService.encryptBuffer(
        plaintextBuffer,
        dek,
      );
      const wrappedDek = keyManagementService.encryptDocumentKey(dek, vaultKey);

      // Verification: Perform roundtrip in-memory decryption test
      const testDek = keyManagementService.decryptDocumentKey(
        wrappedDek.encryptedDataKey,
        vaultKey,
        wrappedDek.iv,
        wrappedDek.authTag,
      );
      const testPlaintext = documentEncryptionService.decryptBuffer(
        encrypted.ciphertext,
        testDek,
        encrypted.iv,
        encrypted.authTag,
      );
      const testChecksum =
        documentEncryptionService.calculateChecksum(testPlaintext);

      if (testChecksum !== initialChecksum) {
        throw new Error(
          `Roundtrip decryption verification failed! Checksum mismatch.`,
        );
      }

      // If storage key is currently plaintext, we can either overwrite with ciphertext or write to new key
      const isPlaintextBackupNeeded = !deletePlaintextConfig;
      if (isPlaintextBackupNeeded) {
        // Keep plaintext backup as .plaintext_bak
        const resolvedPath = documentStorageService.provider._resolvePath(
          version.storage_key,
        );
        const bakPath = `${resolvedPath}.plaintext_bak`;
        if (!fs.existsSync(bakPath)) {
          fs.copyFileSync(resolvedPath, bakPath);
          console.log(
            `  - Preserved plaintext backup at: ${path.basename(bakPath)}`,
          );
        }
      }

      // Overwrite the primary storage file with CIPHERTEXT
      await documentStorageService.uploadFile(
        encrypted.ciphertext,
        version.storage_key,
      );

      // Update DB record
      await db.execute(
        `UPDATE document_versions SET 
          encryption_algorithm = 'aes-256-gcm',
          encryption_version = 1,
          encrypted_data_key = ?,
          data_key_iv = ?,
          data_key_auth_tag = ?,
          encrypted_file_size = ?,
          encryption_status = 'ENCRYPTED',
          file_iv = ?,
          file_auth_tag = ?,
          checksum = ?
        WHERE id = ?`,
        [
          wrappedDek.encryptedDataKey,
          wrappedDek.iv,
          wrappedDek.authTag,
          encrypted.ciphertext.length,
          encrypted.iv,
          encrypted.authTag,
          initialChecksum,
          version.id,
        ],
      );

      // If delete plaintext is explicitly true, remove backup
      if (deletePlaintextConfig) {
        const resolvedPath = documentStorageService.provider._resolvePath(
          version.storage_key,
        );
        const bakPath = `${resolvedPath}.plaintext_bak`;
        if (fs.existsSync(bakPath)) {
          fs.unlinkSync(bakPath);
        }
      }

      // Audit log
      await logDocumentEvent(
        userId,
        "DOCUMENT_ENCRYPTION_MIGRATION",
        version.document_id,
        null,
        "CLI_MIGRATION",
        {
          versionId: version.id,
          encryptionAlgorithm: "aes-256-gcm",
          encryptedFileSize: encrypted.ciphertext.length,
        },
      );

      console.log(`  ✓ Successfully encrypted Version ID ${version.id}`);
      successCount++;
    } catch (err) {
      console.error(
        `  ✗ Failed to migrate Version ID ${version.id}:`,
        err.message,
      );
      failCount++;
    }
  }

  console.log(
    "\n==================================================================",
  );
  console.log(
    `Migration Summary: ${successCount} succeeded, ${failCount} failed.`,
  );
  console.log(
    "==================================================================",
  );
  process.exit(failCount > 0 ? 1 : 0);
}

runMigration().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
