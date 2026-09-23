const db = require("../config/database");
const { getUserPermissions, canViewCase } = require("./authorizationService");

/**
 * Check if a user has an active, valid share for a document
 * @param {number} userId
 * @param {number} documentId
 * @param {'VIEW'|'DOWNLOAD'|'EDIT'} requiredPermission
 * @returns {Promise<boolean>}
 */
const hasActiveDocumentShare = async (userId, documentId, requiredPermission = "VIEW") => {
  const permHierarchy = {
    VIEW: ["VIEW", "DOWNLOAD", "EDIT"],
    DOWNLOAD: ["DOWNLOAD", "EDIT"],
    EDIT: ["EDIT"],
  };

  const allowedPerms = permHierarchy[requiredPermission] || ["VIEW"];
  const placeholders = allowedPerms.map(() => "?").join(",");

  const [rows] = await db.execute(
    `SELECT id FROM document_shares
     WHERE document_id = ? 
       AND shared_with_user_id = ?
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
       AND permission IN (${placeholders})
     LIMIT 1`,
    [documentId, userId, ...allowedPerms]
  );

  return rows.length > 0;
};

/**
 * Check if a user or user's roles have explicit document permissions
 * @param {number} userId
 * @param {string[]} userRoleNames
 * @param {number} documentId
 * @param {'VIEW'|'DOWNLOAD'|'EDIT'|'UPLOAD_VERSION'|'DELETE'|'SHARE'} requiredAction
 * @returns {Promise<boolean>}
 */
const hasExplicitDocumentPermission = async (userId, userRoleNames, documentId, requiredAction) => {
  // Get role IDs for user's roles
  let roleIds = [];
  if (userRoleNames && userRoleNames.length > 0) {
    const rolePlaceholders = userRoleNames.map(() => "?").join(",");
    const [roleRows] = await db.execute(
      `SELECT id FROM roles WHERE name IN (${rolePlaceholders})`,
      userRoleNames
    );
    roleIds = roleRows.map((r) => r.id);
  }

  let query = `
    SELECT id FROM document_permissions
    WHERE document_id = ?
      AND permission = ?
      AND (
        user_id = ?
        ${roleIds.length > 0 ? `OR role_id IN (${roleIds.map(() => "?").join(",")})` : ""}
      )
    LIMIT 1
  `;

  const params = [documentId, requiredAction, userId, ...roleIds];
  const [rows] = await db.execute(query, params);
  return rows.length > 0;
};

/**
 * Check if a user can access a document based on:
 * 1. Base system permission (DOCUMENT_VIEW / DOCUMENT_DOWNLOAD / etc.)
 * 2. Case-level authorization (User must have access to document's case)
 * 3. Confidentiality level (NORMAL, CONFIDENTIAL, HIGHLY_CONFIDENTIAL, ADVOCATE_ONLY)
 * 4. Granular document permissions & internal shares
 *
 * @param {number} userId
 * @param {Object} document - Document row or metadata object { id, case_id, confidentiality_level, created_by }
 * @param {'VIEW'|'DOWNLOAD'|'EDIT'|'UPLOAD_VERSION'|'DELETE'|'SHARE'} action
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
const checkDocumentAccess = async (userId, document, action = "VIEW") => {
  if (!document) {
    return { allowed: false, reason: "Document not found." };
  }

  const { roles, permissions, isOwner } = await getUserPermissions(userId);

  // 1. OWNER has full unrestricted access
  if (isOwner) {
    return { allowed: true };
  }

  // 2. Base system permission check
  const actionPermMap = {
    VIEW: "DOCUMENT_VIEW",
    DOWNLOAD: "DOCUMENT_DOWNLOAD",
    EDIT: "DOCUMENT_UPDATE",
    UPLOAD_VERSION: "DOCUMENT_UPLOAD_VERSION",
    DELETE: "DOCUMENT_DELETE",
    SHARE: "DOCUMENT_SHARE",
  };

  const requiredSysPerm = actionPermMap[action];
  if (requiredSysPerm && !permissions.includes(requiredSysPerm)) {
    return { allowed: false, reason: `Missing required permission ${requiredSysPerm}.` };
  }

  // 3. Document creator check (if creator is accessing their own document within case)
  const isCreator = document.created_by === userId;

  // 4. Case-level access check
  const hasCaseAccess = await canViewCase(userId, document.case_id);
  if (!hasCaseAccess) {
    // If user does not have case access, check if an explicit valid share exists
    const hasShare = await hasActiveDocumentShare(userId, document.id, action === "DOWNLOAD" ? "DOWNLOAD" : "VIEW");
    if (!hasShare) {
      return { allowed: false, reason: "You do not have access to the case associated with this document." };
    }
  }

  // 5. Confidentiality Level Enforcement
  const confLevel = document.confidentiality_level || "NORMAL";

  // ADVOCATE_ONLY: Strictly reserved for OWNER or users with ADVOCATE_ONLY_DOCUMENT permission (e.g. Senior Advocates)
  if (confLevel === "ADVOCATE_ONLY") {
    const isAdvocate = permissions.includes("ADVOCATE_ONLY_DOCUMENT");
    if (!isAdvocate) {
      return {
        allowed: false,
        reason: "Access denied. This document is classified as ADVOCATE_ONLY and requires senior advocate authorization.",
      };
    }
  }

  // HIGHLY_CONFIDENTIAL: Explicit permission or creator or owner required
  if (confLevel === "HIGHLY_CONFIDENTIAL") {
    if (!isCreator && !roles.includes("OWNER") && !roles.includes("SENIOR_ASSOCIATE")) {
      const hasExplicit = await hasExplicitDocumentPermission(userId, roles, document.id, action);
      const hasShare = await hasActiveDocumentShare(userId, document.id, action === "DOWNLOAD" ? "DOWNLOAD" : "VIEW");
      if (!hasExplicit && !hasShare) {
        return {
          allowed: false,
          reason: "Access denied. HIGHLY_CONFIDENTIAL document requires explicit document permission.",
        };
      }
    }
  }

  // CONFIDENTIAL: Requires case access and cannot be accessed by external/client roles
  if (confLevel === "CONFIDENTIAL") {
    if (roles.includes("CLIENT")) {
      return { allowed: false, reason: "Clients cannot access CONFIDENTIAL legal work products." };
    }
  }

  // 6. Granular action restrictions (DELETE, SHARE, MANAGE_PERMISSION)
  if (action === "SHARE" && !permissions.includes("DOCUMENT_SHARE")) {
    return { allowed: false, reason: "You do not have permission to share documents." };
  }

  if (action === "DELETE" && !permissions.includes("DOCUMENT_DELETE")) {
    return { allowed: false, reason: "You do not have permission to delete documents." };
  }

  return { allowed: true };
};

module.exports = {
  checkDocumentAccess,
  hasActiveDocumentShare,
  hasExplicitDocumentPermission,
};
