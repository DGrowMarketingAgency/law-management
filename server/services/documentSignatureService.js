const crypto = require('crypto');
const db = require('../config/database');
const esignProviderFactory = require('../providers/esign/esignProviderFactory');
const documentNumberService = require('./documentNumberService');
const documentStorageService = require('./documentStorageService');
const { logDocumentEvent } = require('./auditService');
const emailService = require('./emailService');
const whatsappService = require('./whatsappService');

class DocumentSignatureService {
  /**
   * Create e-signature request for an approved document
   */
  async createSignatureRequest(arg1, arg2, arg3 = {}, reqInfo = {}) {
    let documentId, versionId, signers, signingOrder, providerName, expiryDays, requestedBy;
    if (typeof arg1 === 'object' && arg1 !== null) {
      documentId = arg1.documentId;
      versionId = arg1.versionId || null;
      signers = arg1.signers || [];
      signingOrder = arg1.signingOrder || 'PARALLEL';
      providerName = arg1.providerName || arg1.provider || 'MOCK';
      expiryDays = arg1.expiryDays || 7;
      requestedBy = arg1.requestedBy || (arg2 && typeof arg2 === 'object' ? arg2.id : arg2);
    } else {
      documentId = arg1;
      requestedBy = typeof arg2 === 'object' && arg2 !== null ? arg2.id : arg2;
      signers = arg3.signers || [];
      signingOrder = arg3.signingOrder || 'PARALLEL';
      providerName = arg3.provider || arg3.providerName || 'MOCK';
      expiryDays = arg3.expiryDays || 7;
      versionId = arg3.versionId || null;
    }

    if (!signers || signers.length === 0) {
      const err = new Error('At least one signer is required for an e-signature request.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Fetch document and verify approval status
    const [docRows] = await db.query(
      `SELECT d.*, dv.id as latest_version_id, dv.storage_key, dv.original_filename, dv.version_number
       FROM documents d
       LEFT JOIN document_versions dv ON d.current_version_id = dv.id
       WHERE d.id = ? AND d.deleted_at IS NULL`,
      [documentId]
    );

    if (docRows.length === 0) {
      const err = new Error('Document not found.');
      err.statusCode = 404;
      throw err;
    }

    const doc = docRows[0];
    const targetVersionId = versionId || doc.latest_version_id;

    if (doc.status !== 'APPROVED' && doc.status !== 'READY_FOR_SIGNATURE') {
      const err = new Error(`Cannot request e-signatures for document in '${doc.status}' status. Document must be APPROVED first.`);
      err.statusCode = 400;
      throw err;
    }

    // Rule: External linked documents cannot be directly sent for eSign
    if (doc.storage_type === 'EXTERNAL' || (!doc.storage_key && !doc.internal_storage_key)) {
      const err = new Error('External linked documents cannot be directly sent for eSign. Upload a supported file within the 10 MB limit if eSign is required.');
      err.statusCode = 400;
      throw err;
    }

    // Check duplicate active request
    const [activeReqs] = await db.query(
      `SELECT id, request_code, status FROM document_signature_requests 
       WHERE document_id = ? AND status IN ('PENDING', 'REQUESTED', 'SENT', 'VIEWED', 'PARTIALLY_SIGNED')`,
      [documentId]
    );
    if (activeReqs.length > 0) {
      const err = new Error(`An active signature request (${activeReqs[0].request_code}) is already pending for this document.`);
      err.statusCode = 409;
      throw err;
    }

    // 2. Generate atomic Request Code
    const requestCode = await documentNumberService.generateSignatureRequestCode();
    const provider = esignProviderFactory.getProvider(providerName);

    // Read current file buffer if accessible for provider
    let fileBuffer = null;
    try {
      const stream = documentStorageService.getFileStream(doc.storage_key);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      fileBuffer = Buffer.concat(chunks);
    } catch (e) {
      // If encrypted or stream unavailable, proceed with metadata
    }

    // 3. Delegate to provider
    const providerRes = await provider.createSignatureRequest({
      documentId,
      versionNumber: doc.version_number,
      fileName: doc.original_filename,
      fileBuffer,
      signers,
      signingOrder,
      expiryDays
    });

    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    // 4. Save Signature Request in DB
    const [reqResult] = await db.query(
      `INSERT INTO document_signature_requests (
        request_code, document_id, document_version_id, requested_by, status,
        provider, provider_request_id, signing_order, expires_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestCode,
        documentId,
        targetVersionId,
        requestedBy,
        providerRes.status || 'SENT',
        provider.name,
        providerRes.providerRequestId,
        signingOrder,
        expiresAt,
        JSON.stringify(providerRes.metadata || {})
      ]
    );
    const signatureRequestId = reqResult.insertId;

    // 5. Insert Signers
    for (let idx = 0; idx < signers.length; idx++) {
      const s = signers[idx];
      const pSigner = (providerRes.signers || []).find(ps => ps.email === s.email) || {};

      await db.query(
        `INSERT INTO document_signature_signers (
          signature_request_id, contact_id, user_id, client_id, name, email, phone, role, signing_order, status, signature_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          signatureRequestId,
          s.contact_id || null,
          s.user_id || null,
          s.client_id || null,
          s.name,
          s.email,
          s.phone || null,
          s.role || 'CLIENT',
          signingOrder === 'SEQUENTIAL' ? (s.signingOrder || idx + 1) : 1,
          pSigner.status || 'SENT',
          pSigner.signatureUrl || null
        ]
      );
    }

    // Update document status to SIGNATURE_PENDING
    await db.query(
      `UPDATE documents SET status = 'SIGNATURE_PENDING', is_locked = TRUE WHERE id = ?`,
      [documentId]
    );

    // Audit event
    await logDocumentEvent(requestedBy, 'DOCUMENT_SIGNATURE_REQUESTED', documentId, reqInfo.ip, reqInfo.userAgent, {
      signatureRequestId,
      requestCode,
      provider: provider.name,
      providerRequestId: providerRes.providerRequestId,
      signersCount: signers.length
    });

    // Send notifications to signers where emails/phones are available (non-blocking)
    try {
      for (const s of signers) {
        if (s.email && typeof emailService?.sendEmail === 'function') {
          emailService.sendEmail({
            to: s.email,
            subject: 'Signature Required: ' + doc.title,
            text: `You have been requested to review and electronically sign: ${doc.title}.`
          }).catch(() => {});
        }
        if (s.phone && typeof whatsappService?.sendTemplateMessage === 'function') {
          whatsappService.sendTemplateMessage(
            s.phone,
            'signature_request',
            [doc.title]
          ).catch(() => {});
        }
      }
    } catch (notifErr) {
      // Non-blocking
    }

    return {
      signatureRequestId,
      requestCode,
      providerRequestId: providerRes.providerRequestId,
      status: providerRes.status || 'SENT',
      provider: provider.name,
      signers: providerRes.signers
    };
  }

  /**
   * Get signature request details with all signers
   */
  async getSignatureRequest(signatureRequestId) {
    const [rows] = await db.query(
      `SELECT sr.*, d.title as document_title, d.case_id, u.first_name as requester_first_name, u.last_name as requester_last_name
       FROM document_signature_requests sr
       JOIN documents d ON sr.document_id = d.id
       JOIN users u ON sr.requested_by = u.id
       WHERE sr.id = ?`,
      [signatureRequestId]
    );

    if (rows.length === 0) {
      const err = new Error('Signature request not found.');
      err.statusCode = 404;
      throw err;
    }

    const request = rows[0];
    const [signers] = await db.query(
      `SELECT * FROM document_signature_signers WHERE signature_request_id = ? ORDER BY signing_order ASC, id ASC`,
      [signatureRequestId]
    );

    request.signers = signers;
    return request;
  }

  async getSignatureRequestDetails(signatureRequestId) {
    return this.getSignatureRequest(signatureRequestId);
  }

  /**
   * Download signed document artifact
   */
  async downloadSignedDocument(signatureRequestId) {
    const [rows] = await db.query(
      `SELECT sr.*, d.title as document_title, dv.storage_key, dv.original_filename
       FROM document_signature_requests sr
       JOIN documents d ON sr.document_id = d.id
       JOIN document_versions dv ON d.current_version_id = dv.id
       WHERE sr.id = ?`,
      [signatureRequestId]
    );

    if (rows.length === 0) {
      const err = new Error('Signature request not found.');
      err.statusCode = 404;
      throw err;
    }

    const req = rows[0];
    if (req.status !== 'SIGNED') {
      const err = new Error('Document is not yet signed.');
      err.statusCode = 400;
      throw err;
    }

    // Read signed buffer from storage
    const stream = documentStorageService.getFileStream(req.storage_key);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return {
      buffer,
      filename: req.original_filename || `Signed_${req.request_code}.pdf`,
      contentType: 'application/pdf'
    };
  }

  /**
   * Get active or latest signature request for a document
   */
  async getSignatureRequestByDocument(documentId) {
    const [rows] = await db.query(
      `SELECT sr.*, u.first_name as requester_first_name, u.last_name as requester_last_name
       FROM document_signature_requests sr
       JOIN users u ON sr.requested_by = u.id
       WHERE sr.document_id = ?
       ORDER BY sr.id DESC LIMIT 1`,
      [documentId]
    );

    if (rows.length === 0) {
      return null;
    }

    const request = rows[0];
    const [signers] = await db.query(
      `SELECT * FROM document_signature_signers WHERE signature_request_id = ? ORDER BY signing_order ASC`,
      [request.id]
    );
    request.signers = signers;
    return request;
  }

  /**
   * Cancel an active signature request
   */
  async cancelSignatureRequest(signatureRequestId, reason = 'Cancelled by advocate', userId, reqInfo = {}) {
    const [rows] = await db.query(`SELECT * FROM document_signature_requests WHERE id = ?`, [signatureRequestId]);
    if (rows.length === 0) {
      const err = new Error('Signature request not found.');
      err.statusCode = 404;
      throw err;
    }

    const req = rows[0];
    if (['SIGNED', 'CANCELLED', 'EXPIRED'].includes(req.status)) {
      const err = new Error(`Signature request is already in '${req.status}' state.`);
      err.statusCode = 400;
      throw err;
    }

    const provider = esignProviderFactory.getProvider(req.provider);
    try {
      await provider.cancelSignatureRequest(req.provider_request_id, reason);
    } catch (e) {
      // proceed with local cancellation
    }

    await db.query(
      `UPDATE document_signature_requests SET status = 'CANCELLED', cancelled_at = NOW(), failure_reason = ? WHERE id = ?`,
      [reason, signatureRequestId]
    );

    await db.query(
      `UPDATE documents SET status = 'APPROVED' WHERE id = ?`,
      [req.document_id]
    );

    await logDocumentEvent(userId, 'DOCUMENT_SIGNATURE_CANCELLED', req.document_id, reqInfo.ip, reqInfo.userAgent, {
      signatureRequestId,
      reason
    });

    return { signatureRequestId, status: 'CANCELLED' };
  }

  /**
   * Handle incoming eSign webhook with idempotency, signature verification, and signed artifact registration
   */
  async handleWebhook(providerName, payload, signature, headers = {}) {
    const provider = esignProviderFactory.getProvider(providerName);

    // 1. Verify webhook signature
    const isValid = provider.verifyWebhook(payload, signature, headers);
    if (!isValid) {
      const err = new Error('Invalid e-signature webhook signature.');
      err.statusCode = 401;
      throw err;
    }

    // 2. Normalize event
    const event = provider.handleWebhook(payload, headers);
    const { providerRequestId, status, signerEmail, signedAt } = event;

    // 3. Find target signature request
    const [reqRows] = await db.query(
      `SELECT sr.*, d.id as document_id, d.title as document_title, d.case_id, dv.version_number
       FROM document_signature_requests sr
       JOIN documents d ON sr.document_id = d.id
       JOIN document_versions dv ON sr.document_version_id = dv.id
       WHERE sr.provider_request_id = ?`,
      [providerRequestId]
    );

    if (reqRows.length === 0) {
      // Unknown request - acknowledge without error for provider
      return { success: false, reason: 'Request not found' };
    }

    const sigReq = reqRows[0];

    // Idempotency: If already signed, return success without duplicate version creation
    if (sigReq.status === 'SIGNED') {
      return { success: true, message: 'Already processed as SIGNED' };
    }

    // Update individual signer status if present
    if (signerEmail) {
      await db.query(
        `UPDATE document_signature_signers SET status = ?, signed_at = COALESCE(?, signed_at)
         WHERE signature_request_id = ? AND email = ?`,
        [status === 'SIGNED' ? 'SIGNED' : 'SENT', signedAt || new Date(), sigReq.id, signerEmail]
      );
    }

    // If fully completed/signed by provider
    if (status === 'SIGNED') {
      // 4. Download signed artifact from provider
      const artifact = await provider.downloadSignedDocument(providerRequestId);
      const sha256Checksum = crypto.createHash('sha256').update(artifact.buffer).digest('hex');

      // 5. Store signed artifact securely in permanent storage
      const nextVersionNumber = (sigReq.version_number || 1) + 1;
      const signedStorageKey = documentStorageService.generateStorageKey(
        sigReq.case_id || 'firm',
        sigReq.document_id,
        nextVersionNumber
      );

      await documentStorageService.uploadFile(artifact.buffer, signedStorageKey);

      // 6. Begin Transaction for atomic version creation & document update
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // Insert new immutable signed document version
        const [verRes] = await connection.query(
          `INSERT INTO document_versions (
            document_id, version_number, storage_key, original_filename,
            mime_type, file_size, checksum, change_summary, uploaded_by, encryption_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNENCRYPTED')`,
          [
            sigReq.document_id,
            nextVersionNumber,
            signedStorageKey,
            artifact.fileName || `Signed_${sigReq.document_title}.pdf`,
            artifact.mimeType || 'application/pdf',
            artifact.buffer.length,
            sha256Checksum,
            `Digitally signed legal artifact via ${providerName} (Ref: ${providerRequestId})`,
            sigReq.requested_by
          ]
        );
        const newVersionId = verRes.insertId;

        // Update signature request record
        await connection.query(
          `UPDATE document_signature_requests SET 
             status = 'SIGNED', 
             completed_at = NOW() 
           WHERE id = ?`,
          [sigReq.id]
        );

        // Update document record to SIGNED and point to new version
        await connection.query(
          `UPDATE documents SET 
             status = 'SIGNED', 
             signed_at = NOW(), 
             current_version_id = ?,
             is_locked = TRUE
           WHERE id = ?`,
          [newVersionId, sigReq.document_id]
        );

        await connection.commit();

        // Audit log
        await logDocumentEvent(sigReq.requested_by, 'DOCUMENT_SIGNATURE_COMPLETED', sigReq.document_id, '127.0.0.1', 'Webhook', {
          signatureRequestId: sigReq.id,
          providerRequestId,
          newVersionNumber: nextVersionNumber,
          checksum: sha256Checksum
        });

      } catch (txnErr) {
        await connection.rollback();
        throw txnErr;
      } finally {
        connection.release();
      }
    } else if (status === 'DECLINED' || status === 'FAILED' || status === 'EXPIRED') {
      await db.query(
        `UPDATE document_signature_requests SET status = ?, failure_reason = ? WHERE id = ?`,
        [status, `Status transition from provider webhook: ${status}`, sigReq.id]
      );
      await db.query(
        `UPDATE documents SET status = 'APPROVED' WHERE id = ?`,
        [sigReq.document_id]
      );
    }

    return { success: true, status };
  }

  async processWebhookEvent(providerName, payload, signature, headers = {}) {
    return this.handleWebhook(providerName, payload, signature, headers);
  }
}

module.exports = new DocumentSignatureService();
