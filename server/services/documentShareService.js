const db = require("../config/database");
const { getUserPermissions } = require("./authorizationService");
const { logDocumentEvent } = require("./auditService");

class DocumentShareService {
  /**
   * Get all active and past internal shares for a document
   */
  async getDocumentShares(documentId, user) {
    const [shares] = await db.execute(
      `SELECT 
        ds.id, ds.document_id, ds.shared_with_user_id, ds.permission,
        ds.expires_at, ds.created_by, ds.revoked_at, ds.created_at,
        u.first_name as recipient_first_name, u.last_name as recipient_last_name, u.email as recipient_email,
        c.first_name as sharer_first_name, c.last_name as sharer_last_name,
        (ds.revoked_at IS NULL AND (ds.expires_at IS NULL OR ds.expires_at > NOW())) as is_active
      FROM document_shares ds
      JOIN users u ON ds.shared_with_user_id = u.id
      JOIN users c ON ds.created_by = c.id
      WHERE ds.document_id = ?
      ORDER BY ds.created_at DESC`,
      [documentId]
    );

    return shares;
  }

  /**
   * Create an internal document share with an authenticated chamber colleague
   * Enforces that shares must never be anonymous or public.
   */
  async createDocumentShare(documentId, shareData, user, reqInfo = {}) {
    const { shared_with_user_id, permission, expires_at } = shareData;

    if (!shared_with_user_id) {
      const err = new Error("shared_with_user_id is required.");
      err.statusCode = 422;
      throw err;
    }

    const validPerms = ["VIEW", "DOWNLOAD", "EDIT"];
    const grantedPerm = permission || "VIEW";
    if (!validPerms.includes(grantedPerm)) {
      const err = new Error(`Invalid share permission '${grantedPerm}'.`);
      err.statusCode = 422;
      throw err;
    }

    // Verify requester has DOCUMENT_SHARE or is OWNER
    const { permissions, isOwner } = await getUserPermissions(user.id);
    if (!isOwner && !permissions.includes("DOCUMENT_SHARE")) {
      const err = new Error("You do not have permission to share documents.");
      err.statusCode = 403;
      throw err;
    }

    // Verify recipient user exists and is active
    const [recipientRows] = await db.execute(
      `SELECT id, first_name, last_name, email FROM users WHERE id = ? AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [shared_with_user_id]
    );
    if (recipientRows.length === 0) {
      const err = new Error("Recipient colleague not found or is inactive.");
      err.statusCode = 404;
      throw err;
    }

    // Check if duplicate active share exists
    const [existingShare] = await db.execute(
      `SELECT id FROM document_shares 
       WHERE document_id = ? AND shared_with_user_id = ? AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
      [documentId, shared_with_user_id]
    );
    if (existingShare.length > 0) {
      const err = new Error("An active share already exists with this user.");
      err.statusCode = 409;
      throw err;
    }

    const [result] = await db.execute(
      `INSERT INTO document_shares (document_id, shared_with_user_id, permission, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [documentId, shared_with_user_id, grantedPerm, expires_at || null, user.id]
    );

    await logDocumentEvent(user.id, "DOCUMENT_SHARED", documentId, reqInfo.ip, reqInfo.userAgent, {
      shareId: result.insertId,
      sharedWithUserId: shared_with_user_id,
      permission: grantedPerm,
      expiresAt: expires_at || null,
    });

    return {
      id: result.insertId,
      document_id: documentId,
      shared_with_user_id,
      permission: grantedPerm,
      expires_at,
      created_by: user.id,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Revoke an internal share
   */
  async revokeDocumentShare(documentId, shareId, user, reqInfo = {}) {
    const { permissions, isOwner } = await getUserPermissions(user.id);
    if (!isOwner && !permissions.includes("DOCUMENT_SHARE")) {
      const err = new Error("You do not have permission to manage document shares.");
      err.statusCode = 403;
      throw err;
    }

    const [existing] = await db.execute(
      `SELECT * FROM document_shares WHERE id = ? AND document_id = ?`,
      [shareId, documentId]
    );
    if (existing.length === 0) {
      const err = new Error("Share record not found.");
      err.statusCode = 404;
      throw err;
    }

    await db.execute(
      `UPDATE document_shares SET revoked_at = NOW() WHERE id = ?`,
      [shareId]
    );

    await logDocumentEvent(user.id, "DOCUMENT_SHARE_REVOKED", documentId, reqInfo.ip, reqInfo.userAgent, {
      shareId,
    });

    return { success: true, message: "Share revoked successfully." };
  }
}

module.exports = new DocumentShareService();
