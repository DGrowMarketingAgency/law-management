const db = require("../config/database");
const { getUserPermissions } = require("./authorizationService");
const { logDocumentEvent } = require("./auditService");

class DocumentPermissionService {
  /**
   * List explicit permissions on a document
   */
  async getDocumentPermissions(documentId, user) {
    // Check if user has access to document
    const [docRows] = await db.execute(
      `SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL`,
      [documentId]
    );
    if (docRows.length === 0) {
      const err = new Error("Document not found.");
      err.statusCode = 404;
      throw err;
    }

    const [perms] = await db.execute(
      `SELECT 
        dp.id, dp.document_id, dp.user_id, dp.role_id, dp.permission,
        dp.granted_by, dp.created_at,
        u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email,
        r.name as role_name,
        g.first_name as granter_first_name, g.last_name as granter_last_name
      FROM document_permissions dp
      LEFT JOIN users u ON dp.user_id = u.id
      LEFT JOIN roles r ON dp.role_id = r.id
      LEFT JOIN users g ON dp.granted_by = g.id
      WHERE dp.document_id = ?
      ORDER BY dp.created_at DESC`,
      [documentId]
    );

    return perms;
  }

  /**
   * Grant permission on a document to a specific user or role
   */
  async grantDocumentPermission(documentId, permissionData, user, reqInfo = {}) {
    const { target_user_id, target_role_id, permission } = permissionData;

    if (!target_user_id && !target_role_id) {
      const err = new Error("Either target_user_id or target_role_id must be provided.");
      err.statusCode = 422;
      throw err;
    }

    const validPerms = ["VIEW", "DOWNLOAD", "EDIT", "UPLOAD_VERSION", "DELETE", "SHARE"];
    if (!validPerms.includes(permission)) {
      const err = new Error(`Invalid permission action '${permission}'.`);
      err.statusCode = 422;
      throw err;
    }

    // Verify requester has DOCUMENT_MANAGE_PERMISSION or is OWNER
    const { permissions, isOwner } = await getUserPermissions(user.id);
    if (!isOwner && !permissions.includes("DOCUMENT_MANAGE_PERMISSION")) {
      const err = new Error("You do not have permission to manage document permissions.");
      err.statusCode = 403;
      throw err;
    }

    // Insert permission
    const [result] = await db.execute(
      `INSERT INTO document_permissions (document_id, user_id, role_id, permission, granted_by)
       VALUES (?, ?, ?, ?, ?)`,
      [documentId, target_user_id || null, target_role_id || null, permission, user.id]
    );

    await logDocumentEvent(user.id, "DOCUMENT_PERMISSION_CREATED", documentId, reqInfo.ip, reqInfo.userAgent, {
      permissionId: result.insertId,
      targetUserId: target_user_id,
      targetRoleId: target_role_id,
      permission,
    });

    return {
      id: result.insertId,
      document_id: documentId,
      user_id: target_user_id,
      role_id: target_role_id,
      permission,
      granted_by: user.id,
    };
  }

  /**
   * Revoke explicit permission
   */
  async revokeDocumentPermission(documentId, permissionId, user, reqInfo = {}) {
    const { permissions, isOwner } = await getUserPermissions(user.id);
    if (!isOwner && !permissions.includes("DOCUMENT_MANAGE_PERMISSION")) {
      const err = new Error("You do not have permission to manage document permissions.");
      err.statusCode = 403;
      throw err;
    }

    const [existing] = await db.execute(
      `SELECT * FROM document_permissions WHERE id = ? AND document_id = ?`,
      [permissionId, documentId]
    );
    if (existing.length === 0) {
      const err = new Error("Document permission record not found.");
      err.statusCode = 404;
      throw err;
    }

    await db.execute(
      `DELETE FROM document_permissions WHERE id = ?`,
      [permissionId]
    );

    await logDocumentEvent(user.id, "DOCUMENT_PERMISSION_REVOKED", documentId, reqInfo.ip, reqInfo.userAgent, {
      permissionId,
    });

    return { success: true, message: "Document permission revoked successfully." };
  }
}

module.exports = new DocumentPermissionService();
