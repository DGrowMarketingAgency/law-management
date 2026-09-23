const db = require("../config/database");

/**
 * Get all role names assigned to a user
 * @param {number} userId
 * @returns {Promise<string[]>}
 */
const getUserRoles = async (userId) => {
  const [rows] = await db.execute(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ?`,
    [userId]
  );
  return rows.map((r) => r.name);
};

/**
 * Resolve all distinct permission names for a user based on their roles
 * Note: If user has role 'OWNER', they have full administrative access across all permissions.
 * @param {number} userId
 * @returns {Promise<{ roles: string[], permissions: string[], isOwner: boolean }>}
 */
const getUserPermissions = async (userId) => {
  const roles = await getUserRoles(userId);
  const isOwner = roles.includes("OWNER");

  if (isOwner) {
    // Owner has all permissions in the system
    const [allPermRows] = await db.execute(`SELECT name FROM permissions`);
    return {
      roles,
      permissions: allPermRows.map((p) => p.name),
      isOwner: true,
    };
  }

  // Resolve specific permissions from assigned roles
  const [permRows] = await db.execute(
    `SELECT DISTINCT p.name
     FROM user_roles ur
     JOIN role_permissions rp ON ur.role_id = rp.role_id
     JOIN permissions p ON rp.permission_id = p.id
     WHERE ur.user_id = ?`,
    [userId]
  );

  return {
    roles,
    permissions: permRows.map((p) => p.name),
    isOwner: false,
  };
};

/**
 * Check if a user has a specific permission or any/all of an array of permissions
 * Centralized OWNER override: Returns true immediately if user is OWNER.
 * @param {number} userId
 * @param {string|string[]} requiredPermissions
 * @param {'ANY'|'ALL'} matchMode
 * @returns {Promise<boolean>}
 */
const hasPermission = async (userId, requiredPermissions, matchMode = "ANY") => {
  const { permissions, isOwner } = await getUserPermissions(userId);

  // Centralized Owner override
  if (isOwner) {
    return true;
  }

  const permsToCheck = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  if (matchMode === "ALL") {
    return permsToCheck.every((p) => permissions.includes(p));
  } else {
    return permsToCheck.some((p) => permissions.includes(p));
  }
};

/**
 * =======================================================
 * CASE-LEVEL AUTHORIZATION FOUNDATION
 * Two-layer access control:
 * Layer 1: Permission check (e.g. CASE_VIEW)
 * Layer 2: Resource ownership / assignment check
 * =======================================================
 */

/**
 * Verify if a user is assigned to a specific case
 * @param {number} userId
 * @param {number} caseId
 * @returns {Promise<boolean>}
 */
const isUserAssignedToCase = async (userId, caseId) => {
  const [rows] = await db.execute(
    `SELECT id FROM case_assignments WHERE user_id = ? AND case_id = ? LIMIT 1`,
    [userId, caseId]
  );
  return rows.length > 0;
};

/**
 * Can user view a specific case?
 * OWNER: Can view all cases.
 * SENIOR_ASSOCIATE / JUNIOR_ASSOCIATE: Must have CASE_VIEW permission AND be assigned to the case.
 * CLIENT: Must have CASE_VIEW permission AND be linked to the case.
 * @param {number} userId
 * @param {number} caseId
 * @returns {Promise<boolean>}
 */
/**
 * Can user view a specific case?
 * OWNER: Can view all cases.
 * SENIOR_ASSOCIATE: Can view all cases if has CASE_VIEW (chambers senior oversight), or assigned cases.
 * JUNIOR_ASSOCIATE: Strict assignment policy - MUST be assigned to case.
 * CLIENT: No internal case view.
 * @param {number} userId
 * @param {number} caseId
 * @returns {Promise<boolean>}
 */
const canViewCase = async (userId, caseId) => {
  const { roles, permissions, isOwner } = await getUserPermissions(userId);

  // Layer 1: Check baseline permission
  if (!isOwner && !permissions.includes("CASE_VIEW")) {
    return false;
  }

  // Layer 2: Centralized Owner override for resource access
  if (isOwner) {
    return true;
  }

  // Senior associate has chambers case overview if permitted
  if (roles.includes("SENIOR_ASSOCIATE") && permissions.includes("CASE_VIEW")) {
    return true;
  }

  // Junior Associate strictly requires explicit assignment
  return await isUserAssignedToCase(userId, caseId);
};

/**
 * Can user edit a specific case?
 * OWNER: Can edit all cases.
 * SENIOR_ASSOCIATE: Can edit all cases with CASE_UPDATE.
 * JUNIOR_ASSOCIATE: Must have CASE_UPDATE AND be assigned to the case.
 * CLIENT: Cannot edit cases.
 * @param {number} userId
 * @param {number} caseId
 * @returns {Promise<boolean>}
 */
const canEditCase = async (userId, caseId) => {
  const { roles, permissions, isOwner } = await getUserPermissions(userId);

  // Layer 1: Check baseline permission
  if (!isOwner && !permissions.includes("CASE_UPDATE")) {
    return false;
  }

  // Layer 2: Centralized Owner override
  if (isOwner) {
    return true;
  }

  if (roles.includes("CLIENT")) {
    return false;
  }

  if (roles.includes("SENIOR_ASSOCIATE") && permissions.includes("CASE_UPDATE")) {
    return true;
  }

  // Junior associates strictly require assignment
  return await isUserAssignedToCase(userId, caseId);
};

/**
 * Can user access a specific note type in a case?
 * STRATEGY & INTERNAL notes require OWNER or SENIOR_ASSOCIATE role.
 * Junior associates cannot view or create INTERNAL/STRATEGY notes.
 */
const canAccessCaseNote = async (userId, caseId, noteType) => {
  const canView = await canViewCase(userId, caseId);
  if (!canView) return false;

  const { roles, isOwner } = await getUserPermissions(userId);
  if (isOwner || roles.includes("OWNER") || roles.includes("SENIOR_ASSOCIATE")) {
    return true;
  }

  // Restricted types
  if (["STRATEGY", "INTERNAL"].includes(noteType)) {
    return false;
  }

  return true;
};

/**
 * Can user download a case document?
 * OWNER: All documents.
 * ASSOCIATES / CLIENTS: Must have DOCUMENT_DOWNLOAD permission AND access to the case.
 * @param {number} userId
 * @param {number} documentId
 * @param {number} caseId
 * @returns {Promise<boolean>}
 */
const canDownloadCaseDocument = async (userId, documentId, caseId) => {
  const { permissions, isOwner } = await getUserPermissions(userId);

  // Layer 1: Check baseline permission
  if (!isOwner && !permissions.includes("DOCUMENT_DOWNLOAD")) {
    return false;
  }

  // Layer 2: Check case accessibility
  return await canViewCase(userId, caseId);
};

module.exports = {
  getUserRoles,
  getUserPermissions,
  hasPermission,
  isUserAssignedToCase,
  canViewCase,
  canEditCase,
  canAccessCaseNote,
  canDownloadCaseDocument,
};
