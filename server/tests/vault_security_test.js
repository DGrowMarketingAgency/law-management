/**
 * Prompt 7A: Comprehensive Vault Security & Encryption Test Suite
 */

const assert = require("assert");
const crypto = require("crypto");
const pool = require("../config/database");
const env = require("../config/env");
const documentEncryptionService = require("../services/documentEncryptionService");
const keyManagementService = require("../services/keyManagementService");
const vaultService = require("../services/vaultService");
const documentService = require("../services/documentService");
const documentVersionService = require("../services/documentVersionService");
const { checkDocumentAccess } = require("../services/documentAccessService");

async function runTests() {
  console.log(
    "==================================================================",
  );
  console.log("Starting Prompt 7A Vault & Document Encryption Test Suite");
  console.log(
    "==================================================================",
  );

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    -> ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // 1. AES-256-GCM & Cryptography Unit Tests
  // -------------------------------------------------------------
  console.log("\n[1. AES-256-GCM & Envelope Encryption Tests]");

  await test("DEK Generation & AES-256-GCM Buffer Encryption/Decryption", async () => {
    const originalText = "CONFIDENTIAL LEGAL OPINION - SUPREME COURT OF INDIA";
    const plaintextBuffer = Buffer.from(originalText, "utf8");
    const dek = documentEncryptionService.generateDataEncryptionKey();
    assert.strictEqual(dek.length, 32, "DEK must be 32 bytes");

    const enc = documentEncryptionService.encryptBuffer(plaintextBuffer, dek);
    assert.notStrictEqual(
      enc.ciphertext.toString("utf8"),
      originalText,
      "Ciphertext must not be plaintext",
    );
    assert.strictEqual(
      enc.iv.length,
      24,
      "IV hex length must be 24 (12 bytes)",
    );
    assert.strictEqual(
      enc.authTag.length,
      32,
      "AuthTag hex length must be 32 (16 bytes)",
    );

    const decrypted = documentEncryptionService.decryptBuffer(
      enc.ciphertext,
      dek,
      enc.iv,
      enc.authTag,
    );
    assert.strictEqual(
      decrypted.toString("utf8"),
      originalText,
      "Decrypted buffer must match original plaintext",
    );
  });

  await test("Fail-Closed on Tampered Ciphertext (Integrity Check)", async () => {
    const plaintext = Buffer.from("Sensitive Contract Agreement", "utf8");
    const dek = documentEncryptionService.generateDataEncryptionKey();
    const enc = documentEncryptionService.encryptBuffer(plaintext, dek);

    // Tamper with ciphertext byte
    const tamperedCiphertext = Buffer.from(enc.ciphertext);
    tamperedCiphertext[0] ^= 0xff;

    assert.throws(
      () => {
        documentEncryptionService.decryptBuffer(
          tamperedCiphertext,
          dek,
          enc.iv,
          enc.authTag,
        );
      },
      /Decryption failed|AUTH_TAG_VERIFICATION_FAILED/i,
      "Tampered ciphertext must fail authentication and fail closed",
    );
  });

  await test("Fail-Closed on Tampered Authentication Tag", async () => {
    const plaintext = Buffer.from("High Court Bail Application", "utf8");
    const dek = documentEncryptionService.generateDataEncryptionKey();
    const enc = documentEncryptionService.encryptBuffer(plaintext, dek);

    const tamperedTag = "00000000000000000000000000000000";

    assert.throws(
      () => {
        documentEncryptionService.decryptBuffer(
          enc.ciphertext,
          dek,
          enc.iv,
          tamperedTag,
        );
      },
      /Decryption failed|AUTH_TAG_VERIFICATION_FAILED/i,
      "Tampered auth tag must fail closed",
    );
  });

  await test("Envelope Encryption Key Wrapping (Vault Key wrapping DEK)", async () => {
    const vaultKey = keyManagementService.generateVaultKey();
    const dek = keyManagementService.generateDocumentKey();

    const wrappedDek = keyManagementService.encryptDocumentKey(dek, vaultKey);
    assert.ok(wrappedDek.encryptedDataKey, "Encrypted DEK exists");
    assert.ok(wrappedDek.iv, "IV exists");
    assert.ok(wrappedDek.authTag, "AuthTag exists");

    const unwrappedDek = keyManagementService.decryptDocumentKey(
      wrappedDek.encryptedDataKey,
      vaultKey,
      wrappedDek.iv,
      wrappedDek.authTag,
    );
    assert.deepStrictEqual(
      unwrappedDek,
      dek,
      "Unwrapped DEK must match original DEK",
    );
  });

  await test("Password-Based Key Derivation (scrypt KEK deriving Master Vault Key)", async () => {
    const password = "StrongChambersVault@2026";
    const salt = keyManagementService.generateSalt(32);
    const kek = keyManagementService.deriveKeyEncryptionKey(
      password,
      salt,
      "scrypt",
    );
    assert.strictEqual(kek.length, 32, "Derived KEK must be 32 bytes");

    const vaultKey = keyManagementService.generateVaultKey();
    const wrappedVaultKey = keyManagementService.encryptVaultKey(vaultKey, kek);

    const unwrappedVaultKey = keyManagementService.decryptVaultKey(
      wrappedVaultKey.encryptedVaultKey,
      kek,
      wrappedVaultKey.iv,
      wrappedVaultKey.authTag,
    );
    assert.deepStrictEqual(
      unwrappedVaultKey,
      vaultKey,
      "Unwrapped Vault Key must match master Vault Key",
    );
  });

  // -------------------------------------------------------------
  // 2. Vault Service & Session Lifecycle Tests
  // -------------------------------------------------------------
  console.log("\n[2. Vault Service Lifecycle & Session Tests]");

  // Setup a test user for vault testing
  const testEmail = `vault_test_${Date.now()}@chambers.local`;
  const [userResult] = await pool.execute(
    `INSERT INTO users (email, password_hash, first_name, last_name, status)
     VALUES (?, 'hash', 'Vault', 'Tester', 'ACTIVE')`,
    [testEmail],
  );
  const testUserId = userResult.insertId;

  await test("Vault Setup with Weak Password Rejection", async () => {
    await assert.rejects(
      async () => {
        await vaultService.setupVault(testUserId, "123");
      },
      /at least 8 characters/i,
      "Weak password (<8 chars) must be rejected",
    );
  });

  await test("Vault Setup Succeeded for Eligible User", async () => {
    const res = await vaultService.setupVault(
      testUserId,
      "ChambersVaultPass#123",
      { ip: "127.0.0.1" },
    );
    assert.strictEqual(res.success, true);

    const [rows] = await pool.execute(
      `SELECT * FROM user_vaults WHERE user_id = ?`,
      [testUserId],
    );
    assert.strictEqual(rows.length, 1, "user_vaults row created");
    assert.strictEqual(rows[0].kdf_algorithm, "scrypt");
    assert.ok(rows[0].kdf_salt, "Salt stored");
    assert.ok(rows[0].encrypted_vault_key, "Encrypted vault key stored");
  });

  await test("Duplicate Vault Setup Rejected", async () => {
    await assert.rejects(
      async () => {
        await vaultService.setupVault(testUserId, "AnotherPassword#456");
      },
      /already configured/i,
      "Duplicate setup must be rejected",
    );
  });

  await test("Vault Status Inspection (Locked before unlock)", async () => {
    const status = await vaultService.getVaultStatus(testUserId, null);
    assert.strictEqual(status.configured, true);
    assert.strictEqual(status.locked, true);
  });

  await test("Vault Unlock with Incorrect Password increments failed_attempts", async () => {
    await assert.rejects(
      async () => {
        await vaultService.unlockVault(testUserId, "WrongPassword!999", {
          ip: "127.0.0.1",
        });
      },
      /Unable to unlock vault/i,
      "Wrong password must be rejected",
    );

    const [rows] = await pool.execute(
      `SELECT failed_attempts FROM user_vaults WHERE user_id = ?`,
      [testUserId],
    );
    assert.strictEqual(
      rows[0].failed_attempts,
      1,
      "Failed attempts incremented",
    );
  });

  let activeSessionToken = null;
  await test("Vault Unlock with Correct Password creates Session Token and In-Memory Key", async () => {
    const res = await vaultService.unlockVault(
      testUserId,
      "ChambersVaultPass#123",
      { ip: "127.0.0.1" },
    );
    assert.ok(res.sessionToken, "Opaque session token returned");
    activeSessionToken = res.sessionToken;

    const [rows] = await pool.execute(
      `SELECT failed_attempts FROM user_vaults WHERE user_id = ?`,
      [testUserId],
    );
    assert.strictEqual(
      rows[0].failed_attempts,
      0,
      "Failed attempts reset to 0 on success",
    );

    const status = await vaultService.getVaultStatus(
      testUserId,
      activeSessionToken,
    );
    assert.strictEqual(status.locked, false, "Vault status shows unlocked");
  });

  await test("Vault Session Validation & Memory Key Retrieval", async () => {
    const check = await vaultService.validateVaultSession(
      testUserId,
      activeSessionToken,
      { ip: "127.0.0.1" },
    );
    assert.strictEqual(check.valid, true);
    assert.ok(
      Buffer.isBuffer(check.vaultKey),
      "Vault key buffer available in server memory",
    );
    assert.strictEqual(check.vaultKey.length, 32);
  });

  await test("Vault Password Change (Key Re-wrapping without file re-encryption)", async () => {
    const res = await vaultService.changeVaultPassword(
      testUserId,
      "ChambersVaultPass#123",
      "NewStrongVaultPassword#2026",
      { ip: "127.0.0.1" },
    );
    assert.strictEqual(res.success, true);

    // Old password must now fail
    await assert.rejects(
      async () => {
        await vaultService.unlockVault(testUserId, "ChambersVaultPass#123");
      },
      /Unable to unlock vault/i,
      "Old password must fail after change",
    );

    // New password succeeds
    const unlockRes = await vaultService.unlockVault(
      testUserId,
      "NewStrongVaultPassword#2026",
    );
    assert.ok(unlockRes.sessionToken);
    activeSessionToken = unlockRes.sessionToken;
  });

  await test("Lock Vault revokes active session", async () => {
    const lockRes = await vaultService.lockVault(
      testUserId,
      activeSessionToken,
      { ip: "127.0.0.1" },
    );
    assert.strictEqual(lockRes.success, true);

    const check = await vaultService.validateVaultSession(
      testUserId,
      activeSessionToken,
    );
    assert.strictEqual(
      check.valid,
      false,
      "Session must be invalid after manual lock",
    );
  });

  // -------------------------------------------------------------
  // 3. Multi-Layer RBAC + Document Access Tests
  // -------------------------------------------------------------
  console.log(
    "\n[3. Multi-Layer RBAC + Case Authorization + Vault Protection Tests]",
  );

  const testCaseId = 1;

  // Unlock vault for test user
  const unlockResult = await vaultService.unlockVault(
    testUserId,
    "NewStrongVaultPassword#2026",
  );
  const validVaultSession = await vaultService.validateVaultSession(
    testUserId,
    unlockResult.sessionToken,
  );

  let createdDocId = null;

  await test("Create & Encrypt Document with Active Vault Session", async () => {
    const docPayload = {
      title: "Encrypted Writ Petition Draft",
      category: "PETITION",
      confidentiality_level: "NORMAL",
      change_summary: "Initial filing draft",
    };
    const samplePdfBuffer = Buffer.from(
      "%PDF-1.5 Sample encrypted legal document content",
      "utf8",
    );
    const fileObj = {
      originalname: "writ_petition.pdf",
      mimetype: "application/pdf",
      size: samplePdfBuffer.length,
      buffer: samplePdfBuffer,
    };

    const newDoc = await documentService.createDocument(
      testCaseId,
      docPayload,
      fileObj,
      { id: testUserId, email: testEmail },
      { ip: "127.0.0.1" },
      validVaultSession.vaultKey,
    );

    assert.ok(newDoc.id, "Document created");
    assert.strictEqual(newDoc.encryption_status, "ENCRYPTED");
    createdDocId = newDoc.id;

    // Verify DB stores encryption metadata and NOT plaintext DEK
    const [vRows] = await pool.execute(
      `SELECT * FROM document_versions WHERE document_id = ?`,
      [createdDocId],
    );
    assert.strictEqual(vRows.length, 1);
    assert.strictEqual(vRows[0].encryption_algorithm, "aes-256-gcm");
    assert.strictEqual(vRows[0].encryption_status, "ENCRYPTED");
    assert.ok(vRows[0].encrypted_data_key, "Encrypted DEK stored in DB");
    assert.ok(vRows[0].file_iv, "File IV stored in DB");
    assert.ok(vRows[0].file_auth_tag, "File Auth Tag stored in DB");
  });

  await test("Locked Vault Denies Document Download (Fail-Closed)", async () => {
    // Attempt download without vaultKey (simulating locked vault)
    await assert.rejects(
      async () => {
        await documentVersionService.prepareDownload(
          createdDocId,
          null,
          { id: 1, isOwner: true, roles: ["OWNER"] },
          { ip: "127.0.0.1" },
          null, // Locked vault
        );
      },
      /Document Vault is locked/i,
      "Download must fail when vault is locked",
    );
  });

  await test("Unlocked Vault Successfully Decrypts and Verifies Plaintext Checksum", async () => {
    const download = await documentVersionService.prepareDownload(
      createdDocId,
      null,
      { id: 1, isOwner: true, roles: ["OWNER"] },
      { ip: "127.0.0.1" },
      validVaultSession.vaultKey,
    );

    assert.strictEqual(download.filename, "writ_petition.pdf");

    // Read full stream into buffer
    const chunks = [];
    for await (const chunk of download.stream) {
      chunks.push(chunk);
    }
    const decryptedBuffer = Buffer.concat(chunks);
    assert.strictEqual(
      decryptedBuffer.toString("utf8"),
      "%PDF-1.5 Sample encrypted legal document content",
      "Decrypted content must exactly match original uploaded plaintext",
    );
  });

  // -------------------------------------------------------------
  // Cleanup Test Data
  // -------------------------------------------------------------
  try {
    if (createdDocId) {
      await pool.execute(`DELETE FROM documents WHERE id = ?`, [createdDocId]);
    }
    await pool.execute(`DELETE FROM users WHERE id = ?`, [testUserId]);
  } catch (cleanErr) {
    // ignore
  }

  console.log(
    "\n==================================================================",
  );
  console.log(`Test Suite Finished: ${passed} passed, ${failed} failed.`);
  console.log(
    "==================================================================",
  );

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
