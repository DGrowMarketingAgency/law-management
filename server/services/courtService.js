const db = require("../config/database");
const { logCaseEvent } = require("./auditService");

const ALLOWED_COURT_TYPES = [
  "SUPREME_COURT",
  "HIGH_COURT",
  "DISTRICT_COURT",
  "SESSIONS_COURT",
  "MAGISTRATE_COURT",
  "FAMILY_COURT",
  "CIVIL_COURT",
  "CRIMINAL_COURT",
  "TRIBUNAL",
  "OTHER",
];

/**
 * List courts with pagination, search, filters, sorting
 */
const getCourts = async ({
  page = 1,
  limit = 20,
  search = "",
  court_type = "",
  city = "",
  state = "",
  is_active = "",
} = {}) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const whereClauses = ["c.deleted_at IS NULL"];
  const params = [];

  if (search) {
    whereClauses.push("(c.name LIKE ? OR c.code LIKE ? OR c.city LIKE ? OR c.state LIKE ?)");
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (court_type && ALLOWED_COURT_TYPES.includes(court_type)) {
    whereClauses.push("c.court_type = ?");
    params.push(court_type);
  }

  if (city) {
    whereClauses.push("c.city = ?");
    params.push(city.trim());
  }

  if (state) {
    whereClauses.push("c.state = ?");
    params.push(state.trim());
  }

  if (is_active !== "" && is_active !== undefined) {
    whereClauses.push("c.is_active = ?");
    params.push(is_active === "true" || is_active === true || is_active === "1" ? 1 : 0);
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const countQuery = `SELECT COUNT(*) as total FROM courts c ${whereSql}`;
  const [countRows] = await db.execute(countQuery, params);
  const total = countRows[0]?.total || 0;
  const total_pages = Math.ceil(total / safeLimit);

  const query = `
    SELECT c.*
    FROM courts c
    ${whereSql}
    ORDER BY c.name ASC
    LIMIT ${safeLimit} OFFSET ${offset}
  `;

  const [rows] = await db.execute(query, params);

  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      courtType: r.court_type,
      location: r.location,
      city: r.city,
      state: r.state,
      address: r.address,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      total_pages,
    },
  };
};

/**
 * Get Court by ID
 */
const getCourtById = async (id) => {
  const [rows] = await db.execute(`SELECT * FROM courts WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [id]);
  if (!rows || rows.length === 0) {
    const err = new Error("Court not found in registry.");
    err.statusCode = 404;
    err.code = "COURT_NOT_FOUND";
    throw err;
  }
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    courtType: r.court_type,
    location: r.location,
    city: r.city,
    state: r.state,
    address: r.address,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

/**
 * Create Court
 */
const createCourt = async (data, creatorId = null, ip = null, userAgent = null) => {
  const { name, code, court_type, location, city, state, address, is_active } = data;

  if (!name || !city || !state) {
    const err = new Error("Court name, city, and state are required.");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const cleanType = court_type || "DISTRICT_COURT";
  if (!ALLOWED_COURT_TYPES.includes(cleanType)) {
    const err = new Error(`Invalid court_type: ${cleanType}. Allowed: ${ALLOWED_COURT_TYPES.join(", ")}`);
    err.statusCode = 400;
    err.code = "INVALID_COURT_TYPE";
    throw err;
  }

  const cleanCode = code ? String(code).trim().toUpperCase() : null;
  if (cleanCode) {
    const [existing] = await db.execute(`SELECT id FROM courts WHERE code = ? AND deleted_at IS NULL LIMIT 1`, [cleanCode]);
    if (existing.length > 0) {
      const err = new Error(`A court with code "${cleanCode}" already exists.`);
      err.statusCode = 409;
      err.code = "DUPLICATE_COURT_CODE";
      throw err;
    }
  }

  const query = `
    INSERT INTO courts (name, code, court_type, location, city, state, address, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [res] = await db.execute(query, [
    String(name).trim(),
    cleanCode,
    cleanType,
    location ? String(location).trim() : null,
    String(city).trim(),
    String(state).trim(),
    address ? String(address).trim() : null,
    is_active !== undefined ? (is_active ? 1 : 0) : 1,
  ]);

  const courtId = res.insertId;
  await logCaseEvent(creatorId, "COURT_CREATED", "COURT", courtId, ip, userAgent, { name, code: cleanCode, court_type: cleanType });

  return await getCourtById(courtId);
};

/**
 * Update Court
 */
const updateCourt = async (id, updates, modifierId = null, ip = null, userAgent = null) => {
  const current = await getCourtById(id);

  const { name, code, court_type, location, city, state, address, is_active } = updates;
  const setClauses = [];
  const params = [];

  if (name !== undefined) {
    setClauses.push("name = ?");
    params.push(String(name).trim());
  }

  if (code !== undefined) {
    const cleanCode = code ? String(code).trim().toUpperCase() : null;
    if (cleanCode) {
      const [existing] = await db.execute(
        `SELECT id FROM courts WHERE code = ? AND id != ? AND deleted_at IS NULL LIMIT 1`,
        [cleanCode, id]
      );
      if (existing.length > 0) {
        const err = new Error(`A court with code "${cleanCode}" already exists.`);
        err.statusCode = 409;
        err.code = "DUPLICATE_COURT_CODE";
        throw err;
      }
    }
    setClauses.push("code = ?");
    params.push(cleanCode);
  }

  if (court_type !== undefined) {
    if (!ALLOWED_COURT_TYPES.includes(court_type)) {
      const err = new Error(`Invalid court_type: ${court_type}`);
      err.statusCode = 400;
      err.code = "INVALID_COURT_TYPE";
      throw err;
    }
    setClauses.push("court_type = ?");
    params.push(court_type);
  }

  if (location !== undefined) {
    setClauses.push("location = ?");
    params.push(location ? String(location).trim() : null);
  }

  if (city !== undefined) {
    setClauses.push("city = ?");
    params.push(String(city).trim());
  }

  if (state !== undefined) {
    setClauses.push("state = ?");
    params.push(String(state).trim());
  }

  if (address !== undefined) {
    setClauses.push("address = ?");
    params.push(address ? String(address).trim() : null);
  }

  if (is_active !== undefined) {
    setClauses.push("is_active = ?");
    params.push(is_active ? 1 : 0);
  }

  if (setClauses.length === 0) {
    return current;
  }

  params.push(id);
  await db.execute(`UPDATE courts SET ${setClauses.join(", ")} WHERE id = ?`, params);
  await logCaseEvent(modifierId, "COURT_UPDATED", "COURT", id, ip, userAgent, updates);

  return await getCourtById(id);
};

/**
 * Delete Court (Deactivate if cases depend on it, otherwise soft delete)
 */
const deleteCourt = async (id, modifierId = null, ip = null, userAgent = null) => {
  const [caseRows] = await db.execute(`SELECT id FROM cases WHERE court_id = ? AND deleted_at IS NULL LIMIT 1`, [id]);
  if (caseRows.length > 0) {
    // Cannot delete if cases depend on it: Deactivate instead
    await db.execute(`UPDATE courts SET is_active = 0 WHERE id = ?`, [id]);
    await logCaseEvent(modifierId, "COURT_DEACTIVATED", "COURT", id, ip, userAgent, { reason: "Cases depend on court" });
    return { success: true, deactivated: true, message: "Court has active cases and was deactivated instead of deleted." };
  }

  await db.execute(`UPDATE courts SET deleted_at = NOW(), is_active = 0 WHERE id = ?`, [id]);
  await logCaseEvent(modifierId, "COURT_DELETED", "COURT", id, ip, userAgent);
  return { success: true, message: "Court removed from registry." };
};

module.exports = {
  getCourts,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt,
  ALLOWED_COURT_TYPES,
};
