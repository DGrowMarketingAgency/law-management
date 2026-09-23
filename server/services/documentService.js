const db = require("../config/database");
const documentStorageService = require("./documentStorageService");
const fileSecurityService = require("./fileSecurityService");
const documentEncryptionService = require("./documentEncryptionService");
const keyManagementService = require("./keyManagementService");
const documentNumberService = require("./documentNumberService");
const { checkDocumentAccess } = require("./documentAccessService");
const { canViewCase } = require("./authorizationService");
const { logDocumentEvent } = require("./auditService");

class DocumentService {
  /**
   * Create a new document with initial version (v1)
   * If vaultKey is provided, encrypts with unique per-document DEK (AES-256-GCM).
   * Otherwise stores securely in unencrypted format.
   *
   * @param {number|null} caseId
   * @param {Object} metadata { title, description, category, document_type, confidentiality_level, change_summary, folder_id, document_type_id, source, status }
   * @param {Object} file { originalname, mimetype, size, buffer }
   * @param {Object} user { id, email, ... }
   * @param {Object} reqInfo { ip, userAgent }
   * @param {Buffer|null} vaultKey - Optional decrypted master Vault Key from server memory
   */
  async createDocument(
    caseId,
    metadata,
    file,
    user,
    reqInfo = {},
    vaultKey = null,
  ) {
    const isVaultEncrypted = vaultKey && Buffer.isBuffer(vaultKey);

    // 1. Validate file
    const validation = fileSecurityService.validateFile(file);
    if (!validation.valid) {
      const err = new Error(validation.error);
      err.statusCode = 422;
      throw err;
    }

    // 2. Validate category
    const validCategories = [
      "PLEADING",
      "PLEADINGS",
      "PETITION",
      "WRITTEN_STATEMENT",
      "AFFIDAVIT",
      "EVIDENCE",
      "ORDER",
      "JUDGMENT",
      "NOTICE",
      "APPLICATION",
      "LEGAL_NOTICE",
      "AGREEMENT",
      "CORRESPONDENCE",
      "CASE_DOCUMENT",
      "CLIENT_DOCUMENT",
      "OTHER",
    ];

    const category = metadata.category || "CASE_DOCUMENT";
    if (!validCategories.includes(category)) {
      const err = new Error(`Invalid category '${category}'.`);
      err.statusCode = 422;
      throw err;
    }

    // 3. Validate confidentiality level
    const validConfidentiality = [
      "NORMAL",
      "CONFIDENTIAL",
      "HIGHLY_CONFIDENTIAL",
      "ADVOCATE_ONLY",
    ];
    const confidentiality = metadata.confidentiality_level || "NORMAL";
    if (!validConfidentiality.includes(confidentiality)) {
      const err = new Error(
        `Invalid confidentiality level '${confidentiality}'.`,
      );
      err.statusCode = 422;
      throw err;
    }

    // Verify advocate-only assignment privilege if requested
    if (confidentiality === "ADVOCATE_ONLY") {
      const accessCheck = await checkDocumentAccess(
        user.id,
        { case_id: caseId, confidentiality_level: "ADVOCATE_ONLY" },
        "EDIT",
      );
      if (!accessCheck.allowed) {
        const err = new Error(
          accessCheck.reason ||
            "You are not authorized to classify documents as ADVOCATE_ONLY.",
        );
        err.statusCode = 403;
        throw err;
      }
    }

    // 4. Verify case exists if provided and obtain primary client
    let primaryClientId = metadata.client_id || null;
    if (caseId) {
      const [caseRows] = await db.execute(
        `SELECT id, primary_client_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
        [caseId],
      );
      if (caseRows.length === 0) {
        const err = new Error("Case not found or deleted.");
        err.statusCode = 404;
        throw err;
      }
      primaryClientId = caseRows[0].primary_client_id || primaryClientId;
    }

    // Check duplicate checksum warning
    const [existingChecksum] = await db.execute(
      `SELECT dv.id, d.title, d.id as document_id
       FROM document_versions dv
       JOIN documents d ON dv.document_id = d.id
       WHERE dv.checksum = ? AND d.deleted_at IS NULL
       LIMIT 1`,
      [validation.checksum],
    );
    const duplicateWarning =
      existingChecksum.length > 0
        ? `An identical file already exists in document '${existingChecksum[0].title}' (ID: ${existingChecksum[0].document_id}).`
        : null;

    // 5. Generate atomic Document Number
    const documentNumber = metadata.document_number || await documentNumberService.generateDocumentNumber();

    // 6. Handle Encryption
    let encryptedFile = null;
    let wrappedDek = null;
    if (isVaultEncrypted) {
      const dek = keyManagementService.generateDocumentKey();
      encryptedFile = documentEncryptionService.encryptBuffer(file.buffer, dek);
      wrappedDek = keyManagementService.encryptDocumentKey(dek, vaultKey);
    }

    // 7. Begin Database Transaction
    const connection = await db.getConnection();
    let savedStorageKey = null;

    try {
      await connection.beginTransaction();

      // Insert document record
      const [docResult] = await connection.execute(
        `INSERT INTO documents (
          case_id, client_id, contact_id, workforce_id, folder_id, document_type_id,
          document_number, storage_type, internal_storage_key, internal_file_name,
          internal_file_size, internal_mime_type, checksum,
          source, status, title, description, category, document_type,
          confidentiality_level, created_by, is_locked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'INTERNAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseId || null,
          primaryClientId || null,
          metadata.contact_id || null,
          metadata.workforce_id || null,
          metadata.folder_id || null,
          metadata.document_type_id || null,
          documentNumber,
          savedStorageKey,
          validation.sanitizedFilename,
          file.size,
          file.mimetype || "application/octet-stream",
          validation.checksum,
          metadata.source || "UPLOADED",
          metadata.status || "DRAFT",
          metadata.title.trim(),
          metadata.description ? metadata.description.trim() : null,
          category,
          metadata.document_type ? metadata.document_type.trim() : null,
          confidentiality,
          user.id,
          metadata.status === "APPROVED" || metadata.status === "SIGNED"
        ],
      );
      const documentId = docResult.insertId;

      // Generate unique storage key and write buffer to storage provider
      savedStorageKey = documentStorageService.generateStorageKey(
        caseId || "firm",
        documentId,
        1,
      );

      // Re-update savedStorageKey in documents if needed
      await connection.execute(
        `UPDATE documents SET internal_storage_key = ? WHERE id = ?`,
        [savedStorageKey, documentId]
      );

      if (isVaultEncrypted) {
        await documentStorageService.uploadFile(
          encryptedFile.ciphertext,
          savedStorageKey,
        );
      } else {
        await documentStorageService.uploadFile(
          file.buffer,
          savedStorageKey,
        );
      }

      // Insert version 1 record
      const [versionResult] = await connection.execute(
        `INSERT INTO document_versions (
          document_id, version_number, storage_type, internal_storage_key,
          internal_file_name, internal_file_size, internal_file_mime_type,
          storage_key, original_filename,
          mime_type, file_size, checksum, change_summary, uploaded_by,
          encryption_algorithm, encryption_version, encrypted_data_key,
          data_key_iv, data_key_auth_tag, encrypted_file_size,
          encryption_status, file_iv, file_auth_tag
        ) VALUES (?, ?, 'INTERNAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          documentId,
          1,
          savedStorageKey,
          validation.sanitizedFilename,
          file.size,
          file.mimetype || "application/octet-stream",
          savedStorageKey,
          validation.sanitizedFilename,
          file.mimetype || "application/octet-stream",
          file.size,
          validation.checksum,
          metadata.change_summary || "Initial document upload",
          user.id,
          isVaultEncrypted ? "aes-256-gcm" : "none",
          isVaultEncrypted ? 1 : 0,
          isVaultEncrypted ? wrappedDek.encryptedDataKey : null,
          isVaultEncrypted ? wrappedDek.iv : null,
          isVaultEncrypted ? wrappedDek.authTag : null,
          isVaultEncrypted ? encryptedFile.ciphertext.length : file.size,
          isVaultEncrypted ? "ENCRYPTED" : "UNENCRYPTED",
          isVaultEncrypted ? encryptedFile.iv : null,
          isVaultEncrypted ? encryptedFile.authTag : null,
        ],
      );
      const versionId = versionResult.insertId;

      // Update current_version_id on document
      await connection.execute(
        `UPDATE documents SET current_version_id = ? WHERE id = ?`,
        [versionId, documentId],
      );

      await connection.commit();

      // Audit logs
      await logDocumentEvent(
        user.id,
        "DOCUMENT_CREATED",
        documentId,
        reqInfo.ip,
        reqInfo.userAgent,
        {
          caseId,
          title: metadata.title,
          category,
          confidentiality,
        },
      );

      if (isVaultEncrypted) {
        await logDocumentEvent(
          user.id,
          "DOCUMENT_ENCRYPTED",
          documentId,
          reqInfo.ip,
          reqInfo.userAgent,
          {
            versionNumber: 1,
            encryptionAlgorithm: "aes-256-gcm",
            encryptionVersion: 1,
            encryptedFileSize: encryptedFile.ciphertext.length,
          },
        );
      }

      await logDocumentEvent(
        user.id,
        "DOCUMENT_VERSION_CREATED",
        documentId,
        reqInfo.ip,
        reqInfo.userAgent,
        {
          versionNumber: 1,
          versionId,
          filename: validation.sanitizedFilename,
          size: file.size,
          checksum: validation.checksum,
        },
      );

      if (confidentiality === "ADVOCATE_ONLY") {
        await logDocumentEvent(
          user.id,
          "ADVOCATE_ONLY_ENABLED",
          documentId,
          reqInfo.ip,
          reqInfo.userAgent,
          {
            classifiedBy: user.id,
          },
        );
      }

      return {
        id: documentId,
        case_id: caseId,
        title: metadata.title.trim(),
        category,
        confidentiality_level: confidentiality,
        current_version_id: versionId,
        version_number: 1,
        filename: validation.sanitizedFilename,
        file_size: file.size,
        checksum: validation.checksum,
        encryption_status: isVaultEncrypted ? "ENCRYPTED" : "UNENCRYPTED",
        duplicate_warning: duplicateWarning,
        document_number: documentNumber,
        status: metadata.status || "DRAFT",
      };
    } catch (err) {
      await connection.rollback();

      // Storage cleanup if file was written to disk before failure
      if (savedStorageKey) {
        try {
          await documentStorageService.deleteFile(savedStorageKey);
        } catch (cleanupErr) {
          console.error(
            `Failed to clean up orphaned storage file ${savedStorageKey}:`,
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
   * Create an external cloud-linked document (Google Drive, OneDrive, Dropbox, Other)
   * Stored as metadata and external link only; never downloaded to server.
   */
  async createExternalDocument(caseId, metadata, user, reqInfo = {}) {
    if (typeof caseId === "object" && !metadata) {
      metadata = caseId;
      caseId = metadata.caseId || metadata.case_id || null;
      user = metadata.user || user;
      reqInfo = metadata.reqInfo || reqInfo;
    }

    const externalDocumentProvider = require("../providers/storage/externalDocumentProvider");

    if (!metadata || !metadata.title || !metadata.title.trim()) {
      const err = new Error("Document title is required.");
      err.statusCode = 422;
      throw err;
    }

    // 1. Validate external URL
    const urlValidation = externalDocumentProvider.validateUrl(metadata.external_url);
    if (!urlValidation.valid) {
      const err = new Error(urlValidation.error);
      err.statusCode = 422;
      throw err;
    }
    const normalizedUrl = urlValidation.normalizedUrl;
    const provider = externalDocumentProvider.getDisplayProvider(normalizedUrl, metadata.external_provider);

    // 2. Validate category
    const validCategories = [
      "PLEADING", "PLEADINGS", "PETITION", "WRITTEN_STATEMENT", "AFFIDAVIT",
      "EVIDENCE", "ORDER", "JUDGMENT", "NOTICE", "APPLICATION", "LEGAL_NOTICE",
      "AGREEMENT", "CORRESPONDENCE", "CASE_DOCUMENT", "CLIENT_DOCUMENT", "OTHER",
    ];
    const category = metadata.category || "CASE_DOCUMENT";
    if (!validCategories.includes(category)) {
      const err = new Error(`Invalid category '${category}'.`);
      err.statusCode = 422;
      throw err;
    }

    // 3. Validate confidentiality level
    const validConfidentiality = ["NORMAL", "CONFIDENTIAL", "HIGHLY_CONFIDENTIAL", "ADVOCATE_ONLY"];
    const confidentiality = metadata.confidentiality_level || "NORMAL";
    if (!validConfidentiality.includes(confidentiality)) {
      const err = new Error(`Invalid confidentiality level '${confidentiality}'.`);
      err.statusCode = 422;
      throw err;
    }

    if (confidentiality === "ADVOCATE_ONLY") {
      const accessCheck = await checkDocumentAccess(user.id, { case_id: caseId, confidentiality_level: "ADVOCATE_ONLY" }, "EDIT");
      if (!accessCheck.allowed) {
        const err = new Error(accessCheck.reason || "You are not authorized to classify documents as ADVOCATE_ONLY.");
        err.statusCode = 403;
        throw err;
      }
    }

    // 4. Verify case exists if provided
    let primaryClientId = metadata.client_id || null;
    if (caseId) {
      const [caseRows] = await db.execute(
        `SELECT id, primary_client_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
        [caseId],
      );
      if (caseRows.length === 0) {
        const err = new Error("Case not found or deleted.");
        err.statusCode = 404;
        throw err;
      }
      primaryClientId = caseRows[0].primary_client_id || primaryClientId;
    }

    const documentNumber = metadata.document_number || await documentNumberService.generateDocumentNumber();
    const externalFileName = (metadata.external_file_name || metadata.title || "External Document").trim();

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [docResult] = await connection.execute(
        `INSERT INTO documents (
          case_id, client_id, contact_id, workforce_id, folder_id, document_type_id,
          document_number, storage_type, external_provider, external_url,
          external_file_name, external_file_size, external_mime_type, external_url_status,
          source, status, title, description, category, document_type,
          confidentiality_level, created_by, is_locked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'EXTERNAL', ?, ?, ?, ?, ?, 'NOT_CHECKED', 'EXTERNAL_LINK', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseId || null,
          primaryClientId || null,
          metadata.contact_id || null,
          metadata.workforce_id || null,
          metadata.folder_id || null,
          metadata.document_type_id || null,
          documentNumber,
          provider,
          normalizedUrl,
          externalFileName,
          metadata.external_file_size ? parseInt(metadata.external_file_size, 10) : null,
          metadata.external_mime_type ? metadata.external_mime_type.trim() : null,
          metadata.status || "DRAFT",
          metadata.title.trim(),
          metadata.description ? metadata.description.trim() : null,
          category,
          metadata.document_type ? metadata.document_type.trim() : null,
          confidentiality,
          user.id,
          metadata.status === "APPROVED" || metadata.status === "SIGNED"
        ]
      );
      const documentId = docResult.insertId;

      // Version 1 for external document
      const [versionResult] = await connection.execute(
        `INSERT INTO document_versions (
          document_id, version_number, storage_type, external_provider,
          external_url, external_file_name, external_file_size, external_mime_type,
          original_filename, file_size, mime_type,
          checksum, storage_key, change_summary, version_status, uploaded_by
        ) VALUES (?, 1, 'EXTERNAL', ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'ACTIVE', ?)`,
        [
          documentId,
          provider,
          normalizedUrl,
          externalFileName,
          metadata.external_file_size ? parseInt(metadata.external_file_size, 10) : null,
          metadata.external_mime_type ? metadata.external_mime_type.trim() : null,
          externalFileName || metadata.title.trim(),
          metadata.external_file_size ? parseInt(metadata.external_file_size, 10) : 0,
          metadata.external_mime_type ? metadata.external_mime_type.trim() : "text/uri-list",
          metadata.change_summary || "Initial external link saved",
          user.id
        ]
      );
      const versionId = versionResult.insertId;

      await connection.execute(
        `UPDATE documents SET current_version_id = ? WHERE id = ?`,
        [versionId, documentId]
      );

      await connection.commit();

      await logDocumentEvent(
        user.id,
        "DOCUMENT_CREATED",
        documentId,
        reqInfo.ip,
        reqInfo.userAgent,
        {
          caseId,
          title: metadata.title,
          category,
          storage_type: "EXTERNAL",
          external_provider: provider,
        }
      );

      return {
        id: documentId,
        document_number: documentNumber,
        title: metadata.title.trim(),
        storage_type: "EXTERNAL",
        external_provider: provider,
        external_url: normalizedUrl,
        external_file_name: externalFileName,
        status: metadata.status || "DRAFT",
        confidentiality_level: confidentiality,
        current_version_id: versionId,
        version_number: 1,
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Securely retrieve external document link and record audit event
   */
  async getExternalLink(documentId, versionId, user, reqInfo = {}) {
    if (typeof versionId === "object" && versionId !== null && (versionId.id || versionId.role)) {
      reqInfo = user || {};
      user = versionId;
      versionId = null;
    }

    const [docRows] = await db.query(
      `SELECT d.*, dv.external_url as version_external_url, dv.external_provider as version_provider, 
              dv.external_file_name as version_file_name, dv.storage_type as version_storage_type
       FROM documents d
       LEFT JOIN document_versions dv ON dv.id = ? AND dv.document_id = d.id
       WHERE d.id = ? AND d.deleted_at IS NULL`,
      [versionId || 0, documentId]
    );

    if (docRows.length === 0) {
      const err = new Error("Document not found or deleted.");
      err.statusCode = 404;
      throw err;
    }

    const doc = docRows[0];
    const access = await checkDocumentAccess(user.id, doc, "VIEW");
    if (!access.allowed) {
      const err = new Error(access.reason || "Access denied to document.");
      err.statusCode = 403;
      throw err;
    }

    const targetStorageType = doc.version_storage_type || doc.storage_type;
    if (targetStorageType !== "EXTERNAL") {
      const err = new Error("This document version is an internal file, not an external link.");
      err.statusCode = 400;
      throw err;
    }

    const targetUrl = doc.version_external_url || doc.external_url;
    if (!targetUrl) {
      const err = new Error("External URL is not available for this document version.");
      err.statusCode = 404;
      throw err;
    }

    // Audit event: DOCUMENT_EXTERNAL_LINK_OPENED
    await logDocumentEvent(
      user.id,
      "DOCUMENT_EXTERNAL_LINK_OPENED",
      documentId,
      reqInfo.ip,
      reqInfo.userAgent,
      {
        provider: doc.version_provider || doc.external_provider,
        fileName: doc.version_file_name || doc.external_file_name || doc.title,
      }
    );

    return {
      document_id: doc.id,
      document_number: doc.document_number,
      title: doc.title,
      storage_type: "EXTERNAL",
      external_provider: doc.version_provider || doc.external_provider,
      external_url: targetUrl,
      external_file_name: doc.version_file_name || doc.external_file_name || doc.title,
      status: doc.external_url_status || "NOT_CHECKED",
    };
  }

  /**
   * Search and filter documents across chambers
   * Respects case-level authorization, confidentiality, and document shares.
   */
  async getDocuments(queryParams, user) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(queryParams.limit, 10) || 20),
    );
    const offset = (page - 1) * limit;

    const conditions = ["d.deleted_at IS NULL"];
    const params = [];

    // Filter by case
    if (queryParams.case_id) {
      conditions.push("d.case_id = ?");
      params.push(parseInt(queryParams.case_id, 10));
    }

    // Filter by client
    if (queryParams.client_id) {
      conditions.push("d.client_id = ?");
      params.push(parseInt(queryParams.client_id, 10));
    }

    // Filter by category
    if (queryParams.category) {
      conditions.push("d.category = ?");
      params.push(queryParams.category);
    }

    // Filter by confidentiality
    if (queryParams.confidentiality_level) {
      conditions.push("d.confidentiality_level = ?");
      params.push(queryParams.confidentiality_level);
    }

    // Filter by created_by
    if (queryParams.created_by) {
      conditions.push("d.created_by = ?");
      params.push(parseInt(queryParams.created_by, 10));
    }

    // Filter by date range
    if (queryParams.date_from) {
      conditions.push("d.created_at >= ?");
      params.push(`${queryParams.date_from} 00:00:00`);
    }
    if (queryParams.date_to) {
      conditions.push("d.created_at <= ?");
      params.push(`${queryParams.date_to} 23:59:59`);
    }

    // Filter by status
    if (queryParams.status) {
      conditions.push("d.status = ?");
      params.push(queryParams.status);
    }

    // Filter by folder
    if (queryParams.folder_id) {
      conditions.push("d.folder_id = ?");
      params.push(parseInt(queryParams.folder_id, 10));
    }

    // Filter by document type
    if (queryParams.document_type_id) {
      conditions.push("d.document_type_id = ?");
      params.push(parseInt(queryParams.document_type_id, 10));
    }

    // Filter by source
    if (queryParams.source) {
      conditions.push("d.source = ?");
      params.push(queryParams.source);
    }

    // Metadata Search: title, description, or original_filename
    if (queryParams.search && queryParams.search.trim()) {
      const searchTerm = `%${queryParams.search.trim()}%`;
      conditions.push(
        "(d.title LIKE ? OR d.description LIKE ? OR d.document_number LIKE ? OR dv.original_filename LIKE ?)",
      );
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const selectQuery = `
      SELECT 
        d.id, d.case_id, d.client_id, d.contact_id, d.workforce_id, d.folder_id, d.document_type_id,
        d.document_number, d.source, d.status, d.is_locked, d.title, d.description, d.category,
        d.document_type, d.confidentiality_level, d.current_version_id,
        d.approved_by, d.approved_at, d.signed_at, d.archived_at,
        d.created_by, d.created_at, d.updated_at,
        c.case_number, c.title as case_title,
        dt.name as document_type_name, dt.code as document_type_code,
        df.name as folder_name,
        dv.version_number, dv.original_filename, dv.mime_type, dv.file_size,
        dv.checksum, dv.uploaded_at,
        u.first_name as creator_first_name, u.last_name as creator_last_name
      FROM documents d
      LEFT JOIN cases c ON d.case_id = c.id
      LEFT JOIN document_types dt ON d.document_type_id = dt.id
      LEFT JOIN document_folders df ON d.folder_id = df.id
      LEFT JOIN document_versions dv ON d.current_version_id = dv.id
      LEFT JOIN users u ON d.created_by = u.id
      ${whereClause}
      ORDER BY d.created_at DESC
    `;

    const [allMatchingRows] = await db.execute(selectQuery, params);

    // Apply authorization & confidentiality filter in memory
    const accessibleDocs = [];
    for (const doc of allMatchingRows) {
      const access = await checkDocumentAccess(user.id, doc, "VIEW");
      if (access.allowed) {
        accessibleDocs.push(doc);
      }
    }

    const total = accessibleDocs.length;
    const paginatedDocs = accessibleDocs.slice(offset, offset + limit);

    return {
      documents: paginatedDocs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single document by ID with case, current version, versions count, and relations
   */
  async getDocumentById(documentId, user) {
    const [rows] = await db.execute(
      `SELECT 
        d.id, d.case_id, d.client_id, d.contact_id, d.workforce_id, d.folder_id, d.document_type_id,
        d.document_number, d.source, d.status, d.is_locked, d.title, d.description, d.category,
        d.document_type, d.confidentiality_level, d.current_version_id,
        d.owner_user_id, d.approved_by, d.approved_at, d.signed_at, d.archived_at, d.retention_until, d.retention_policy,
        d.created_by, d.created_at, d.updated_at, d.deleted_at,
        c.case_number, c.title as case_title, c.cnr_number,
        dt.name as document_type_name, dt.code as document_type_code,
        df.name as folder_name,
        dv.version_number, dv.original_filename, dv.mime_type, dv.file_size,
        dv.checksum, dv.uploaded_at, dv.change_summary,
        u.first_name as creator_first_name, u.last_name as creator_last_name,
        appr.first_name as approver_first_name, appr.last_name as approver_last_name
      FROM documents d
      LEFT JOIN cases c ON d.case_id = c.id
      LEFT JOIN document_types dt ON d.document_type_id = dt.id
      LEFT JOIN document_folders df ON d.folder_id = df.id
      LEFT JOIN document_versions dv ON d.current_version_id = dv.id
      LEFT JOIN users u ON d.created_by = u.id
      LEFT JOIN users appr ON d.approved_by = appr.id
      WHERE d.id = ?`,
      [documentId],
    );

    if (rows.length === 0) {
      const err = new Error("Document not found.");
      err.statusCode = 404;
      throw err;
    }

    const doc = rows[0];

    // Check access
    const access = await checkDocumentAccess(user.id, doc, "VIEW");
    if (!access.allowed) {
      const err = new Error(access.reason || "Access denied to document.");
      err.statusCode = 403;
      throw err;
    }

    // Get total version count
    const [versionCount] = await db.execute(
      `SELECT COUNT(*) as total FROM document_versions WHERE document_id = ?`,
      [documentId],
    );
    doc.total_versions = versionCount[0].total;

    return doc;
  }

  /**
   * Update document metadata
   */
  async updateDocument(documentId, updateData, user, reqInfo = {}) {
    const doc = await this.getDocumentById(documentId, user);

    // Rule: Locked documents cannot be directly edited
    if (doc.is_locked && updateData.is_locked === undefined && !updateData.status) {
      const err = new Error(
        "Document is currently locked in review/approval/signed state and cannot be modified directly. Please create a new version.",
      );
      err.statusCode = 400;
      throw err;
    }

    const access = await checkDocumentAccess(user.id, doc, "EDIT");
    if (!access.allowed) {
      const err = new Error(
        access.reason || "You do not have permission to edit this document.",
      );
      err.statusCode = 403;
      throw err;
    }

    const updates = [];
    const params = [];
    const auditDetails = { before: {}, after: {} };

    if (updateData.title !== undefined && updateData.title.trim()) {
      auditDetails.before.title = doc.title;
      auditDetails.after.title = updateData.title.trim();
      updates.push("title = ?");
      params.push(updateData.title.trim());
    }

    if (updateData.description !== undefined) {
      updates.push("description = ?");
      params.push(
        updateData.description ? updateData.description.trim() : null,
      );
    }

    if (updateData.folder_id !== undefined) {
      updates.push("folder_id = ?");
      params.push(updateData.folder_id || null);
    }

    if (updateData.document_type_id !== undefined) {
      updates.push("document_type_id = ?");
      params.push(updateData.document_type_id || null);
    }

    if (updateData.status !== undefined) {
      updates.push("status = ?");
      params.push(updateData.status);
    }

    if (updateData.category !== undefined) {
      auditDetails.before.category = doc.category;
      auditDetails.after.category = updateData.category;
      updates.push("category = ?");
      params.push(updateData.category);
    }

    let confidentialityChanged = false;
    let oldConf = doc.confidentiality_level;
    let newConf = null;

    if (updateData.confidentiality_level !== undefined) {
      const validConf = [
        "NORMAL",
        "CONFIDENTIAL",
        "HIGHLY_CONFIDENTIAL",
        "ADVOCATE_ONLY",
      ];
      if (!validConf.includes(updateData.confidentiality_level)) {
        const err = new Error(
          `Invalid confidentiality level '${updateData.confidentiality_level}'.`,
        );
        err.statusCode = 422;
        throw err;
      }

      if (
        updateData.confidentiality_level === "ADVOCATE_ONLY" ||
        oldConf === "ADVOCATE_ONLY"
      ) {
        const advAccess = await checkDocumentAccess(
          user.id,
          { case_id: doc.case_id, confidentiality_level: "ADVOCATE_ONLY" },
          "EDIT",
        );
        if (!advAccess.allowed) {
          const err = new Error(
            advAccess.reason || "Unauthorized to alter ADVOCATE_ONLY status.",
          );
          err.statusCode = 403;
          throw err;
        }
      }

      if (updateData.confidentiality_level !== oldConf) {
        confidentialityChanged = true;
        newConf = updateData.confidentiality_level;
        auditDetails.before.confidentiality_level = oldConf;
        auditDetails.after.confidentiality_level = newConf;
        updates.push("confidentiality_level = ?");
        params.push(newConf);
      }
    }

    if (updates.length === 0) {
      return doc;
    }

    updates.push("updated_by = ?");
    params.push(user.id);
    params.push(documentId);

    await db.execute(
      `UPDATE documents SET ${updates.join(", ")} WHERE id = ?`,
      params,
    );

    await logDocumentEvent(
      user.id,
      "DOCUMENT_UPDATED",
      documentId,
      reqInfo.ip,
      reqInfo.userAgent,
      auditDetails,
    );

    return await this.getDocumentById(documentId, user);
  }

  /**
   * Archive document (Read-only retained state)
   */
  async archiveDocument(documentId, user, reqInfo = {}) {
    const doc = await this.getDocumentById(documentId, user);
    await db.execute(
      `UPDATE documents SET status = 'ARCHIVED', is_locked = TRUE, archived_at = NOW(), updated_by = ? WHERE id = ?`,
      [user.id, documentId],
    );

    await logDocumentEvent(
      user.id,
      "DOCUMENT_ARCHIVED",
      documentId,
      reqInfo.ip,
      reqInfo.userAgent,
      { title: doc.title }
    );

    return { id: documentId, status: "ARCHIVED" };
  }

  /**
   * Create document from a legal template
   */
  async createFromTemplate({
    templateId,
    caseId = null,
    clientId = null,
    folderId = null,
    title = null,
    customVariables = {},
    confidentialityLevel = "NORMAL"
  }, user, reqInfo = {}, vaultKey = null) {
    const documentTemplateService = require("./documentTemplateService");
    const tpl = await documentTemplateService.getTemplateById(templateId);

    // Contextual auto-fill variables
    const contextVars = await documentTemplateService.getContextVariables(caseId, clientId, user.id);
    const combinedVars = { ...contextVars, ...customVariables };

    // Resolve variables
    const { resolvedContent, missingVariables } = documentTemplateService.resolveVariables(tpl.content, combinedVars);

    // Generate PDF buffer from resolved text
    const docTitle = title || `${tpl.name} - Draft`;
    const pdfBuffer = await documentTemplateService.generatePdfFromText(docTitle, resolvedContent);

    const file = {
      originalname: `${docTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
      mimetype: "application/pdf",
      size: pdfBuffer.length,
      buffer: pdfBuffer
    };

    const metadata = {
      title: docTitle,
      description: `Created from template '${tpl.name}' (${tpl.template_code})`,
      category: tpl.document_type_code || "CASE_DOCUMENT",
      document_type_id: tpl.document_type_id,
      folder_id: folderId,
      source: "CREATED_FROM_TEMPLATE",
      status: "DRAFT",
      confidentiality_level: confidentialityLevel,
      change_summary: `Initial generation from template ${tpl.name}`
    };

    return await this.createDocument(caseId, metadata, file, user, reqInfo, vaultKey);
  }

  /**
   * Get aggregate counts and metrics for documents dashboard
   */
  async getDashboardStats(user) {
    const searchService = require("./documentSearchService");
    const allAccessible = await searchService.searchDocuments({ limit: 1000 }, user);

    const stats = {
      total: allAccessible.length,
      internal: allAccessible.filter(d => (d.storage_type || 'INTERNAL') === 'INTERNAL').length,
      external: allAccessible.filter(d => d.storage_type === 'EXTERNAL').length,
      draft: allAccessible.filter(d => d.status === 'DRAFT').length,
      in_review: allAccessible.filter(d => d.status === 'IN_REVIEW').length,
      changes_requested: allAccessible.filter(d => d.status === 'CHANGES_REQUESTED').length,
      approved: allAccessible.filter(d => d.status === 'APPROVED').length,
      signature_pending: allAccessible.filter(d => d.status === 'SIGNATURE_PENDING' || d.status === 'READY_FOR_SIGNATURE').length,
      signed: allAccessible.filter(d => d.status === 'SIGNED').length,
      archived: allAccessible.filter(d => d.status === 'ARCHIVED').length,
      external_breakdown: {
        google_drive: allAccessible.filter(d => d.storage_type === 'EXTERNAL' && d.external_provider === 'GOOGLE_DRIVE').length,
        onedrive: allAccessible.filter(d => d.storage_type === 'EXTERNAL' && d.external_provider === 'ONEDRIVE').length,
        dropbox: allAccessible.filter(d => d.storage_type === 'EXTERNAL' && d.external_provider === 'DROPBOX').length,
        other: allAccessible.filter(d => d.storage_type === 'EXTERNAL' && (!d.external_provider || d.external_provider === 'OTHER')).length,
      },
      recent: allAccessible.slice(0, 8),
      pending_reviews: allAccessible.filter(d => d.status === 'IN_REVIEW').slice(0, 5),
      pending_signatures: allAccessible.filter(d => d.status === 'SIGNATURE_PENDING' || d.status === 'READY_FOR_SIGNATURE').slice(0, 5)
    };

    return stats;
  }

  /**
   * Get all active document types
   */
  async getDocumentTypes() {
    const [rows] = await db.query(
      `SELECT * FROM document_types WHERE is_active = TRUE ORDER BY name ASC`
    );
    return rows;
  }

  /**
   * Soft delete document (preserves files and version history)
   */
  async softDeleteDocument(documentId, user, reqInfo = {}) {
    const doc = await this.getDocumentById(documentId, user);

    const access = await checkDocumentAccess(user.id, doc, "DELETE");
    if (!access.allowed) {
      const err = new Error(
        access.reason || "You do not have permission to delete this document.",
      );
      err.statusCode = 403;
      throw err;
    }

    await db.execute(
      `UPDATE documents SET deleted_at = NOW(), updated_by = ? WHERE id = ?`,
      [user.id, documentId],
    );

    await logDocumentEvent(
      user.id,
      "DOCUMENT_DELETED",
      documentId,
      reqInfo.ip,
      reqInfo.userAgent,
      {
        title: doc.title,
        caseId: doc.case_id,
      },
    );

    return { success: true, message: "Document moved to trash successfully." };
  }

  /**
   * Restore soft-deleted document
   */
  async restoreDocument(documentId, user, reqInfo = {}) {
    const [rows] = await db.execute(`SELECT * FROM documents WHERE id = ?`, [
      documentId,
    ]);
    if (rows.length === 0) {
      const err = new Error("Document not found.");
      err.statusCode = 404;
      throw err;
    }
    const doc = rows[0];

    const access = await checkDocumentAccess(user.id, doc, "DELETE");
    if (!access.allowed) {
      const err = new Error(
        access.reason || "You do not have permission to restore this document.",
      );
      err.statusCode = 403;
      throw err;
    }

    await db.execute(
      `UPDATE documents SET deleted_at = NULL, updated_by = ? WHERE id = ?`,
      [user.id, documentId],
    );

    await logDocumentEvent(
      user.id,
      "DOCUMENT_RESTORED",
      documentId,
      reqInfo.ip,
      reqInfo.userAgent,
      {
        title: doc.title,
        caseId: doc.case_id,
      },
    );

    return { success: true, message: "Document restored successfully." };
  }

  /**
   * Instantiates a new document from a legal template
   */
  async createFromTemplate({
    templateId,
    caseId = null,
    title,
    variables = {},
    folderId = null,
    category = "PLEADING",
    confidentialityLevel = "NORMAL",
    user,
    reqInfo = {},
    vaultKey = null
  }) {
    const documentTemplateService = require("./documentTemplateService");
    const template = await documentTemplateService.getTemplateById(templateId);

    // Auto-populate case context if caseId provided
    const context = await documentTemplateService.getContextVariables(caseId, null, user.id);
    const mergedVars = { ...context, ...variables };

    // Resolve placeholders
    const { resolvedContent } = documentTemplateService.resolveVariables(
      template.content,
      mergedVars
    );

    const docTitle =
      title ||
      `${template.name} - ${mergedVars.CLIENT_NAME || mergedVars.CASE_NUMBER || new Date().toISOString().slice(0, 10)}`;

    // Render to PDF buffer
    const pdfBuffer = await documentTemplateService.generatePdfFromText(
      docTitle,
      resolvedContent
    );

    const file = {
      buffer: pdfBuffer,
      originalname: `${docTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
      mimetype: "application/pdf",
      size: pdfBuffer.length
    };

    // Create via standard createDocument
    const doc = await this.createDocument(
      caseId,
      {
        title: docTitle,
        description: `Generated from template: ${template.name}`,
        category: category || "CASE_DOCUMENT",
        document_type: template.document_type_name || "LEGAL_DOCUMENT",
        document_type_id: template.document_type_id,
        folder_id: folderId,
        source: "GENERATED",
        status: "DRAFT",
        confidentiality_level: confidentialityLevel,
        change_summary: "Initial draft generated from template"
      },
      file,
      user,
      reqInfo,
      vaultKey
    );

    // Save plaintext content to document_text_content for full-text search
    try {
      await db.execute(
        `INSERT INTO document_text_content (document_id, version_id, extracted_text, status)
         VALUES (?, ?, ?, 'EXTRACTED')
         ON DUPLICATE KEY UPDATE extracted_text = VALUES(extracted_text), status = 'EXTRACTED'`,
        [doc.id, doc.current_version_id || 1, resolvedContent]
      );
    } catch (e) {
      console.warn("Failed to index template text content:", e.message);
    }

    return doc;
  }

  /**
   * Get KPI metrics for the document management system
   */
  async getDashboardStats(user) {
    const [counts] = await db.query(
      `SELECT
        COUNT(*) as total_documents,
        SUM(CASE WHEN storage_type = 'INTERNAL' OR storage_type IS NULL THEN 1 ELSE 0 END) as storage_internal,
        SUM(CASE WHEN storage_type = 'EXTERNAL' THEN 1 ELSE 0 END) as storage_external,
        SUM(CASE WHEN storage_type = 'EXTERNAL' AND external_provider = 'GOOGLE_DRIVE' THEN 1 ELSE 0 END) as provider_google_drive,
        SUM(CASE WHEN storage_type = 'EXTERNAL' AND external_provider = 'ONEDRIVE' THEN 1 ELSE 0 END) as provider_onedrive,
        SUM(CASE WHEN storage_type = 'EXTERNAL' AND external_provider = 'DROPBOX' THEN 1 ELSE 0 END) as provider_dropbox,
        SUM(CASE WHEN storage_type = 'EXTERNAL' AND (external_provider = 'OTHER' OR external_provider IS NULL) THEN 1 ELSE 0 END) as provider_other,
        SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as drafts,
        SUM(CASE WHEN status = 'IN_REVIEW' THEN 1 ELSE 0 END) as in_review,
        SUM(CASE WHEN status = 'CHANGES_REQUESTED' THEN 1 ELSE 0 END) as changes_requested,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'AWAITING_SIGNATURE' THEN 1 ELSE 0 END) as awaiting_signature,
        SUM(CASE WHEN status = 'SIGNED' THEN 1 ELSE 0 END) as signed,
        SUM(CASE WHEN status = 'ARCHIVED' THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN is_locked = 1 THEN 1 ELSE 0 END) as locked_documents
       FROM documents
       WHERE deleted_at IS NULL`
    );

    const [recentDocs] = await db.query(
      `SELECT d.id, d.document_number, d.title, d.status, d.created_at, d.category,
              c.case_number, c.title as case_title,
              u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM documents d
       LEFT JOIN cases c ON d.case_id = c.id
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.deleted_at IS NULL
       ORDER BY d.created_at DESC
       LIMIT 5`
    );

    const [typesCount] = await db.query(
      `SELECT dt.name, dt.code, COUNT(d.id) as count
       FROM document_types dt
       LEFT JOIN documents d ON d.document_type_id = dt.id AND d.deleted_at IS NULL
       GROUP BY dt.id
       ORDER BY count DESC
       LIMIT 6`
    );

    const overview = counts[0] || {};

    return {
      overview,
      total_documents: Number(overview.total_documents || 0),
      storage_internal: Number(overview.storage_internal || 0),
      storage_external: Number(overview.storage_external || 0),
      providers: {
        google_drive: Number(overview.provider_google_drive || 0),
        onedrive: Number(overview.provider_onedrive || 0),
        dropbox: Number(overview.provider_dropbox || 0),
        other: Number(overview.provider_other || 0),
      },
      recentDocuments: recentDocs,
      topTypes: typesCount
    };
  }

  /**
   * Archive document
   */
  async archiveDocument(documentId, user, reqInfo = {}) {
    const [rows] = await db.execute(`SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL`, [documentId]);
    if (rows.length === 0) {
      const err = new Error("Document not found.");
      err.statusCode = 404;
      throw err;
    }
    const doc = rows[0];

    const access = await checkDocumentAccess(user.id, doc, "EDIT");
    if (!access.allowed) {
      const err = new Error(access.reason || "Unauthorized to archive document.");
      err.statusCode = 403;
      throw err;
    }

    await db.execute(
      `UPDATE documents SET status = 'ARCHIVED', is_locked = 1, updated_by = ? WHERE id = ?`,
      [user.id, documentId]
    );

    await logDocumentEvent(user.id, "DOCUMENT_ARCHIVED", documentId, reqInfo.ip, reqInfo.userAgent, {
      title: doc.title,
      documentNumber: doc.document_number
    });

    return { id: documentId, status: 'ARCHIVED', is_locked: 1, success: true };
  }

  /**
   * Get all active document types
   */
  async getDocumentTypes() {
    const [rows] = await db.query(
      `SELECT * FROM document_types WHERE is_active = TRUE ORDER BY category ASC, name ASC`
    );
    return rows;
  }
}

module.exports = new DocumentService();
