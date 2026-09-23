const db = require("../config/database");
const crypto = require("crypto");
const { hashPassword } = require("../utils/password");
const { hashToken } = require("../utils/token");
const { getUserPermissions } = require("./authorizationService");
const { logAuthEvent } = require("./auditService");

/**
 * Normalize phone number string
 * Strips extraneous formatting characters
 */
const normalizePhone = (phone) => {
  if (!phone) return null;
  return String(phone).trim().replace(/[^\d+]/g, "");
};

/**
 * Get users list with assigned roles
 */
const getUsers = async ({ search = "", status = "", role = "", page = 1, limit = 50 } = {}) => {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const params = [];
  let whereClauses = ["u.deleted_at IS NULL"];

  if (search) {
    whereClauses.push("(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)");
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (status) {
    whereClauses.push("u.status = ?");
    params.push(status);
  }

  if (role) {
    whereClauses.push("r.name = ?");
    params.push(role);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const query = `
    SELECT 
      u.id, u.first_name, u.last_name, u.email, u.phone, 
      u.status, u.two_factor_enabled, u.last_login_at, u.created_at,
      GROUP_CONCAT(r.name) as roles
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    ${whereSql}
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
  `;

  const [rows] = await db.execute(query, params);

  return rows.map((u) => ({
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    email: u.email,
    phone: u.phone,
    status: u.status,
    twoFactorEnabled: Boolean(u.two_factor_enabled),
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
    roles: u.roles ? u.roles.split(",") : [],
  }));
};

/**
 * Get user by ID with roles and permissions
 */
const getUserById = async (id) => {
  const [rows] = await db.execute(
    `SELECT id, first_name, last_name, email, phone, status, two_factor_enabled, last_login_at, created_at
     FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id]
  );

  if (!rows || rows.length === 0) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  const user = rows[0];
  const { roles, permissions } = await getUserPermissions(user.id);

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    twoFactorEnabled: Boolean(user.two_factor_enabled),
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    roles,
    permissions,
  };
};

/**
 * Create or invite a new chambers user
 * @param {object} userData
 * @param {number} creatorId
 * @param {string} ip
 * @param {string} userAgent
 */
const createUser = async (userData, creatorId = null, ip = null, userAgent = null) => {
  const { firstName, lastName, email, phone, role, initialPassword } = userData;

  if (!firstName || !lastName || !email || !role) {
    const err = new Error("First name, last name, email, and role are required.");
    err.statusCode = 400;
    err.code = "MISSING_REQUIRED_FIELDS";
    throw err;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedPhone = normalizePhone(phone);

  // Check if email already exists
  const [existing] = await db.execute(
    `SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
    [normalizedEmail]
  );

  if (existing.length > 0) {
    const err = new Error("A user with this email address already exists.");
    err.statusCode = 409;
    err.code = "EMAIL_ALREADY_EXISTS";
    throw err;
  }

  // Verify role exists
  const [roleRows] = await db.execute(`SELECT id, name FROM roles WHERE name = ? LIMIT 1`, [role]);
  if (roleRows.length === 0) {
    const err = new Error(`Invalid role specified: ${role}`);
    err.statusCode = 400;
    err.code = "INVALID_ROLE";
    throw err;
  }
  const roleRecord = roleRows[0];

  // Password / Invitation handling
  let passwordHash = null;
  let status = "INVITED";
  let rawInvitationToken = null;

  if (initialPassword) {
    // Admin directly provided temporary/initial password
    passwordHash = await hashPassword(initialPassword);
    status = "ACTIVE";
  } else {
    // Generate secure invitation token
    rawInvitationToken = crypto.randomBytes(32).toString("hex");
  }

  // Insert user
  const [insertResult] = await db.execute(
    `INSERT INTO users (first_name, last_name, email, phone, password_hash, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [firstName.trim(), lastName.trim(), normalizedEmail, normalizedPhone, passwordHash, status]
  );

  const userId = insertResult.insertId;

  // Assign role in user_roles
  await db.execute(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, roleRecord.id]);

  // If invited, store invitation token hash
  if (rawInvitationToken) {
    const tokenHash = hashToken(rawInvitationToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db.execute(
      `INSERT INTO user_invitations (user_id, token_hash, expires_at, created_by)
       VALUES (?, ?, ?, ?)`,
      [userId, tokenHash, expiresAt, creatorId]
    );
  }

  await logAuthEvent(creatorId, "USER_CREATED", ip, userAgent, {
    createdUserId: userId,
    email: normalizedEmail,
    role: roleRecord.name,
    status,
  });

  return {
    id: userId,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    phone: normalizedPhone,
    status,
    role: roleRecord.name,
    invitationToken: rawInvitationToken || undefined,
  };
};

/**
 * Update user details (Name, Phone)
 */
const updateUser = async (id, { firstName, lastName, phone }, modifierId = null) => {
  const updates = [];
  const params = [];

  if (firstName !== undefined) {
    updates.push("first_name = ?");
    params.push(String(firstName).trim());
  }

  if (lastName !== undefined) {
    updates.push("last_name = ?");
    params.push(String(lastName).trim());
  }

  if (phone !== undefined) {
    updates.push("phone = ?");
    params.push(normalizePhone(phone));
  }

  if (updates.length === 0) {
    return await getUserById(id);
  }

  params.push(id);
  await db.execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ? AND deleted_at IS NULL`, params);

  return await getUserById(id);
};

/**
 * Update user status (ACTIVE, INACTIVE, SUSPENDED)
 */
const updateUserStatus = async (id, status, modifierId = null, ip = null, userAgent = null) => {
  const allowed = ["ACTIVE", "INACTIVE", "SUSPENDED"];
  if (!allowed.includes(status)) {
    const err = new Error(`Invalid status. Must be one of: ${allowed.join(", ")}`);
    err.statusCode = 400;
    err.code = "INVALID_STATUS";
    throw err;
  }

  // Prevent disabling self or the only OWNER
  if (parseInt(id, 10) === parseInt(modifierId, 10) && status !== "ACTIVE") {
    const err = new Error("You cannot deactivate or suspend your own account.");
    err.statusCode = 400;
    err.code = "CANNOT_DEACTIVATE_SELF";
    throw err;
  }

  await db.execute(`UPDATE users SET status = ? WHERE id = ? AND deleted_at IS NULL`, [status, id]);

  // If deactivated or suspended, revoke all active refresh tokens immediately
  if (status !== "ACTIVE") {
    await db.execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`, [id]);
  }

  await logAuthEvent(modifierId, "USER_STATUS_UPDATED", ip, userAgent, { targetUserId: id, newStatus: status });

  return await getUserById(id);
};

/**
 * Update user assigned roles
 */
const updateUserRoles = async (id, roleNames, modifierId = null, ip = null, userAgent = null) => {
  if (!Array.isArray(roleNames) || roleNames.length === 0) {
    const err = new Error("At least one valid role must be specified.");
    err.statusCode = 400;
    err.code = "INVALID_ROLES";
    throw err;
  }

  // Verify all roles exist
  const placeholders = roleNames.map(() => "?").join(",");
  const [roleRows] = await db.execute(
    `SELECT id, name FROM roles WHERE name IN (${placeholders})`,
    roleNames
  );

  if (roleRows.length !== roleNames.length) {
    const err = new Error("One or more specified roles do not exist.");
    err.statusCode = 400;
    err.code = "INVALID_ROLE";
    throw err;
  }

  // Remove existing roles and assign new ones
  await db.execute(`DELETE FROM user_roles WHERE user_id = ?`, [id]);

  for (const role of roleRows) {
    await db.execute(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [id, role.id]);
  }

  await logAuthEvent(modifierId, "USER_ROLES_UPDATED", ip, userAgent, { targetUserId: id, roles: roleNames });

  return await getUserById(id);
};

/**
 * Soft delete a user
 */
const deleteUser = async (id, modifierId = null, ip = null, userAgent = null) => {
  if (parseInt(id, 10) === parseInt(modifierId, 10)) {
    const err = new Error("You cannot delete your own account.");
    err.statusCode = 400;
    err.code = "CANNOT_DELETE_SELF";
    throw err;
  }

  await db.execute(`UPDATE users SET deleted_at = NOW(), status = 'INACTIVE' WHERE id = ?`, [id]);

  // Invalidate any active sessions
  await db.execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`, [id]);

  await logAuthEvent(modifierId, "USER_DELETED", ip, userAgent, { targetUserId: id });

  return { success: true, message: "User deleted successfully." };
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  updateUserRoles,
  deleteUser,
};
