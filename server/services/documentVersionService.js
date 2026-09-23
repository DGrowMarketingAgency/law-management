const { Readable } = require("stream");
const db = require("../config/database");
const documentStorageService = require("./documentStorageService");
const fileSecurityService = require("./fileSecurityService");
const documentEncryptionService = require("./documentEncryptionService");
const keyManagementService = require("./keyManagementService");
const { checkDocumentAccess } = require("./documentAccessService");
const { logDocumentEvent } = require("./auditService");

class DocumentVersionService {
  /**
   * Upload a new revision (version) to an existing document.
   * Encrypts file buffer with a unique per-version DEK (AES-256-GCM) and wraps DEK with Vault Key.
   * Auto-generates version number (v2, v3...), stores ciphertext securely,
   * updates documents.current_version_id, and handles rollback.
   *
   * @param {number} documentId
   * @param {Object} file
   * @param {string} changeSummary
   * @param {Object} user
   * @param {Object} reqInfo
   * @param {Buffer} vaultKey - Decrypted master Vault Key from server memory
   */
  async uploadNewVersion(
    documentId,
    file,
    changeSummary,
    user,
    reqInfo = {},
    vaultKey = null,
  ) {
    if (!vaultKey || !Buffer.isBuffer(vaultKey)) {
      const err = new Error(
        "Document Vault is locked. An active unlocked vault session is required to upload revisions.",
      );
      err.statusCode = 423;
      throw err;
    }

    // 1. Validate file
    const validation = fileSecurityService.validateFile(file);
    if (!validation.valid) {
      const err = new Error(validation.error);
      err.statusCode = 422;
      throw err;
    }

    // 2. Fetch document and verify access
    const [docRows] = await db.execute(
      `SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL`,
      [documentId],
    );
    if (docRows.length === 0) {
      const err = new Error("Document not found or deleted.");
      err.statusCode = 404;
      throw err;
    }
    const document = docRows[0];

    const access = await checkDocumentAccess(
      user.id,
      document,
      "UPLOAD_VERSION",
    );
    if (!access.allowed) {
      const err = new Error(
        access.reason ||
          "You do not have permission to upload new versions to this document.",
      );
      err.statusCode = 403;
      throw err;
    }

    // Check duplicate checksum warning
    const [existingChecksum] = await db.execute(
      `SELECT version_number FROM document_versions WHERE document_id = ? AND checksum = ? LIMIT 1`,
      [documentId, validation.checksum],
    );
    const duplicateWarning =
      existingChecksum.length > 0
        ? `An identical file was already uploaded as version ${existingChecksum[0].version_number}.`
        : null;

    // 3. Envelope Encryption: Generate unique DEK & Encrypt file buffer BEFORE saving to disk
    const dek = keyManagementService.generateDocumentKey();
    const encryptedFile = documentEncryptionService.encryptBuffer(
      file.buffer,
      dek,
    );
    const wrappedDek = keyManagementService.encryptDocumentKey(dek, vaultKey);

    // 4. Begin Transaction with Row-Level Locking
    const connection = await db.getConnection();
    let savedStorageKey = null;

    try {
      await connection.beginTransaction();

      // Lock document row and compute next version number atomically
      const [lockRows] = await connection.execute(
        `SELECT id FROM documents WHERE id = ? FOR UPDATE`,
        [documentId],
      );
      if (lockRows.length === 0) {
        throw new Error("Document lock failed.");
      }

      const [maxVersionRows] = await connection.execute(
        `SELECT COALESCE(MAX(version_number), 0) as max_version FROM document_versions WHERE document_id = ?`,
        [documentId],
      );
      const nextVersionNumber = maxVersionRows[0].max_version + 1;

      // Generate unique storage key and write CIPHERTEXT to storage
      savedStorageKey = documentStorageService.generateStorageKey(
        document.case_id,
        documentId,
        nextVersionNumber,
      );
      await documentStorageService.uploadFile(
        encryptedFile.ciphertext,
        savedStorageKey,
      );

      // Insert version record with encryption metadata
      const [versionResult] = await connection.execute(
        `INSERT INTO document_versions (
          document_id, version_number, storage_key, original_filename,
          mime_type, file_size, checksum, change_summary, uploaded_by,
          encryption_algorithm, encryption_version, encrypted_data_key,
          data_key_iv, data_key_auth_tag, encrypted_file_size,
          encryption_status, file_iv, file_auth_tag
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          documentId,
          nextVersionNumber,
          savedStorageKey,
          validation.sanitizedFilename,
          file.mimetype || "application/octet-stream",
          file.size,
          validation.checksum,
          changeSummary
            ? changeSummary.trim()
            : `Version ${nextVersionNumber} revision`,
          user.id,
          "aes-256-gcm",
          1,
          wrappedDek.encryptedDataKey,
          wrappedDek.iv,
          wrappedDek.authTag,
          encryptedFile.ciphertext.length,
          "ENCRYPTED",
          encryptedFile.iv,
          encryptedFile.authTag,
        ],
      );
      const versionId = versionResult.insertId;

      // Update current_version_id on document
      await connection.execute(
        `UPDATE documents SET current_version_id = ?, updated_by = ? WHERE id = ?`,
        [versionId, user.id, documentId],
      );

      await connection.commit();

      // Audit events
      await logDocumentEvent(
        user.id,
        "VERSION_ENCRYPTED",
        documentId,
        reqInfo.ip,
        reqInfo.userAgent,
        {
          versionNumber: nextVersionNumber,
          versionId,
          encryptionAlgorithm: "aes-256-gcm",
          encryptedFileSize: encryptedFile.ciphertext.length,
        },
      );

      await logDocumentEvent(
        user.id,
        "DOCUMENT_VERSION_CREATED",
        documentId,
        reqInfo.ip,
        reqInfo.userAgent,
        {
          versionNumber: nextVersionNumber,
          versionId,
          filename: validation.sanitizedFilename,
          size: file.size,
          checksum: validation.checksum,
          changeSummary,
        },
      );

      return {
        id: versionId,
        document_id: documentId,
        version_number: nextVersionNumber,
        original_filename: validation.sanitizedFilename,
        mime_type: file.mimetype,
        file_size: file.size,
        checksum: validation.checksum,
        change_summary: changeSummary,
        encryption_status: "ENCRYPTED",
        uploaded_at: new Date().toISOString(),
        duplicate_warning: duplicateWarning,
      };
    } catch (err) {
      await connection.rollback();
      if (savedStorageKey) {
        try {
          await documentStorageService.deleteFile(savedStorageKey);
        } catch (cleanupErr) {
          console.error(
            `Failed to clean up orphaned version storage file ${savedStorageKey}:`,
            cleanupErr,
          );
        }
      }
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Get all versions of a document (Metadata only)
   */
  async getDocumentVersions(documentId, user) {
    const [docRows] = await db.execute(`SELECT * FROM documents WHERE id = ?`, [
      documentId,
    ]);
    if (docRows.length === 0) {
      const err = new Error("Document not found.");
      err.statusCode = 404;
      throw err;
    }
    const document = docRows[0];

    const access = await checkDocumentAccess(user.id, document, "VIEW");
    if (!access.allowed) {
      const err = new Error(
        access.reason || "Access denied to document versions.",
      );
      err.statusCode = 403;
      throw err;
    }

    const [versions] = await db.execute(
      `SELECT 
        dv.id, dv.document_id, dv.version_number, dv.original_filename,
        dv.mime_type, dv.file_size, dv.checksum, dv.change_summary,
        dv.encryption_algorithm, dv.encryption_status, dv.encrypted_file_size,
        dv.uploaded_at, dv.uploaded_by,
        u.first_name as uploader_first_name, u.last_name as uploader_last_name,
        (dv.id = d.current_version_id) as is_current
      FROM document_versions dv
      JOIN documents d ON dv.document_id = d.id
      LEFT JOIN users u ON dv.uploaded_by = u.id
      WHERE dv.document_id = ?
      ORDER BY dv.version_number DESC`,
      [documentId],
    );

    return versions;
  }

  /**
   * Prepare document or specific version for secure streaming download / preview.
   * Verifies access, unwraps DEK using Vault Key, decrypts AES-256-GCM ciphertext,
   * verifies plaintext SHA-256 checksum and auth tag, and streams decrypted buffer.
   *
   * @param {number} documentId
   * @param {number|null} versionId
   * @param {Object} user
   * @param {Object} reqInfo
   * @param {Buffer|null} vaultKey - Decrypted master Vault Key from server memory
   */
  async prepareDownload(
    documentId,
    versionId = null,
    user,
    reqInfo = {},
    vaultKey = null,
  ) {
    const [docRows] = await db.execute(
      `SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL`,
      [documentId],
    );
    if (docRows.length === 0) {
      const err = new Error("Document not found or deleted.");
      err.statusCode = 404;
      throw err;
    }
    const document = docRows[0];

    // Authorization & Confidentiality check
    const access = await checkDocumentAccess(user.id, document, "DOWNLOAD");
    if (!access.allowed) {
      const err = new Error(
        access.reason || "You are not authorized to download this document.",
      );
      err.statusCode = 403;
      throw err;
    }

    // Determine target version
    let versionQuery = `SELECT * FROM document_versions WHERE document_id = ?`;
    const params = [documentId];

    if (versionId) {
      versionQuery += ` AND id = ?`;
      params.push(versionId);
    } else {
      versionQuery += ` AND id = ?`;
      params.push(document.current_version_id);
    }

    const [vRows] = await db.execute(versionQuery, params);
    if (vRows.length === 0) {
      const err = new Error("Requested document version not found.");
      err.statusCode = 404;
      throw err;
    }
    const version = vRows[0];

    if (version.storage_type === "EXTERNAL") {
      const err = new Error(
        "This document version is stored as an external link and cannot be downloaded directly. Please use Open External Document."
      );
      err.statusCode = 400;
      throw err;
    }

    // Check physical file existence on storage provider
    const exists = await documentStorageService.fileExists(version.storage_key);
    if (!exists) {
      const err = new Error(
        "Physical document file is missing from secure storage.",
      );
      err.statusCode = 404;
      throw err;
    }

    let downloadStream = null;

    if (version.encryption_status === "ENCRYPTED") {
      if (!vaultKey || !Buffer.isBuffer(vaultKey)) {
        const err = new Error(
          "Document Vault is locked. An active unlocked vault session is required to decrypt and view documents.",
        );
        err.statusCode = 423;
        throw err;
      }

      // Read ciphertext buffer from storage
      const ciphertextBuffer =
        await documentStorageService.provider.getFileBuffer(
          version.storage_key,
        );

      // Unwrap DEK using Vault Key
      let dek = null;
      try {
        dek = keyManagementService.decryptDocumentKey(
          version.encrypted_data_key,
          vaultKey,
          version.data_key_iv,
          version.data_key_auth_tag,
        );
      } catch (dekErr) {
        console.error(
          `[Vault Security Error]: Failed to unwrap DEK for version ${version.id}:`,
          dekErr.message,
        );
        const err = new Error(
          "Unable to decrypt document key. Authentication failed.",
        );
        err.statusCode = 422;
        throw err;
      }

      // Decrypt file ciphertext using DEK
      let plaintextBuffer = null;
      try {
        plaintextBuffer = documentEncryptionService.decryptBuffer(
          ciphertextBuffer,
          dek,
          version.file_iv,
          version.file_auth_tag,
        );
      } catch (decryptErr) {
        console.error(
          `[Vault Security Error]: Failed to decrypt document ciphertext for version ${version.id}:`,
          decryptErr.message,
        );
        const err = new Error(
          "Unable to decrypt document content. Ciphertext integrity verification failed.",
        );
        err.statusCode = 422;
        throw err;
      }

      // Plaintext SHA-256 Checksum Verification
      const calculatedChecksum =
        documentEncryptionService.calculateChecksum(plaintextBuffer);
      if (calculatedChecksum !== version.checksum) {
        console.error(
          `[Vault Security Error]: Checksum mismatch for version ${version.id}. Expected: ${version.checksum}, Got: ${calculatedChecksum}`,
        );
        const err = new Error(
          "Document integrity verification failed: Checksum mismatch.",
        );
        err.statusCode = 422;
        throw err; // FAIL CLOSED
      }

      // Audit logs
      await logDocumentEvent(
        user.id,
        "DOCUMENT_DECRYPTED",
        documentId,
        reqInfo.ip,
        reqInfo.userAgent,
        {
          versionId: version.id,
          versionNumber: version.version_number,
        },
      );

      downloadStream = Readable.from(plaintextBuffer);
    } else {
      // Legacy unencrypted document
      downloadStream = documentStorageService.getFileStream(
        version.storage_key,
      );
    }

    // Audit log DOCUMENT_DOWNLOADED
    await logDocumentEvent(
      user.id,
      "DOCUMENT_DOWNLOADED",
      documentId,
      reqInfo.ip,
      reqInfo.userAgent,
      {
        versionId: version.id,
        versionNumber: version.version_number,
        filename: version.original_filename,
        size: version.file_size,
      },
    );

    return {
      stream: downloadStream,
      filename: version.original_filename,
      mimeType: version.mime_type,
      size: version.file_size,
    };
  }

  /**
   * Add a new external cloud-linked revision to an existing document
   */
  async createExternalVersion(documentId, data, user, reqInfo = {}) {
    if (data && data.user && !user) {
      user = data.user;
      reqInfo = data.reqInfo || reqInfo;
    }

    const externalDocumentProvider = require("../providers/storage/externalDocumentProvider");

    if (!data || !data.external_url || !data.external_url.trim()) {
      const err = new Error("External URL is required for external revision.");
      err.statusCode = 422;
      throw err;
    }

    const urlValidation = externalDocumentProvider.validateUrl(data.external_url);
    if (!urlValidation.valid) {
      const err = new Error(urlValidation.error);
      err.statusCode = 422;
      throw err;
    }
    const normalizedUrl = urlValidation.normalizedUrl;
    const provider = externalDocumentProvider.getDisplayProvider(normalizedUrl, data.external_provider);

    const [docRows] = await db.execute(
      `SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL`,
      [documentId]
    );
    if (docRows.length === 0) {
      const err = new Error("Document not found or deleted.");
      err.statusCode = 404;
      throw err;
    }
    const document = docRows[0];

    const access = await checkDocumentAccess(user.id, document, "UPLOAD_VERSION");
    if (!access.allowed) {
      const err = new Error(access.reason || "You do not have permission to add revisions to this document.");
      err.statusCode = 403;
      throw err;
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [maxVersionRows] = await connection.execute(
        `SELECT COALESCE(MAX(version_number), 0) as max_version FROM document_versions WHERE document_id = ?`,
        [documentId]
      );
      const nextVersionNumber = maxVersionRows[0].max_version + 1;
      const externalFileName = (data.external_file_name || document.title).trim();

      const [versionResult] = await connection.execute(
        `INSERT INTO document_versions (
          document_id, version_number, storage_type, external_provider,
          external_url, external_file_name, external_file_size, external_mime_type,
          original_filename, file_size, mime_type,
          checksum, storage_key, change_summary, version_status, uploaded_by
        ) VALUES (?, ?, 'EXTERNAL', ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'ACTIVE', ?)`,
        [
          documentId,
          nextVersionNumber,
          provider,
          normalizedUrl,
          externalFileName,
          data.external_file_size ? parseInt(data.external_file_size, 10) : null,
          data.external_mime_type ? data.external_mime_type.trim() : null,
          externalFileName || document.title,
          data.external_file_size ? parseInt(data.external_file_size, 10) : 0,
          data.external_mime_type ? data.external_mime_type.trim() : "text/uri-list",
          data.change_summary ? data.change_summary.trim() : `Version ${nextVersionNumber} revision (External Link)`,
          user.id
        ]
      );
      const versionId = versionResult.insertId;

      await connection.execute(
        `UPDATE documents SET 
          current_version_id = ?,
          storage_type = 'EXTERNAL',
          external_provider = ?,
          external_url = ?,
          external_file_name = ?,
          external_file_size = ?,
          external_mime_type = ?,
          updated_by = ?,
          status = 'DRAFT',
          is_locked = 0
         WHERE id = ?`,
        [
          versionId,
          provider,
          normalizedUrl,
          externalFileName,
          data.external_file_size ? parseInt(data.external_file_size, 10) : null,
          data.external_mime_type ? data.external_mime_type.trim() : null,
          user.id,
          documentId
        ]
      );

      await connection.commit();

      await logDocumentEvent(
        user.id,
        "DOCUMENT_VERSION_CREATED",
        documentId,
        reqInfo.ip,
        reqInfo.userAgent,
        {
          versionNumber: nextVersionNumber,
          versionId,
          storage_type: "EXTERNAL",
          external_provider: provider,
          changeSummary: data.change_summary,
        }
      );

      return {
        id: versionId,
        document_id: documentId,
        version_number: nextVersionNumber,
        storage_type: "EXTERNAL",
        external_provider: provider,
        external_url: normalizedUrl,
        external_file_name: externalFileName,
        change_summary: data.change_summary,
        uploaded_at: new Date().toISOString(),
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

module.exports = new DocumentVersionService();
