const db = require("../config/database");

/**
 * Get limitation rules with filtering
 * @param {object} filters
 */
const getRules = async (filters = {}) => {
  const {
    search,
    proceeding_type,
    trigger_type,
    is_active,
    limit = 50,
    offset = 0,
  } = filters;

  const where = [];
  const params = [];

  if (search) {
    where.push(
      "(dr.act_name LIKE ? OR dr.article_reference LIKE ? OR dr.section_reference LIKE ? OR dr.description LIKE ?)"
    );
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  if (proceeding_type) {
    where.push("dr.proceeding_type = ?");
    params.push(proceeding_type);
  }

  if (trigger_type) {
    where.push("dr.trigger_type = ?");
    params.push(trigger_type);
  }

  if (is_active !== undefined && is_active !== null && is_active !== "") {
    where.push("dr.is_active = ?");
    params.push(is_active === "true" || is_active === true || is_active === 1 || is_active === "1" ? 1 : 0);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await db.query(
    `SELECT dr.*, 
            CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
     FROM deadline_rules dr
     LEFT JOIN users u ON dr.created_by = u.id
     ${whereClause}
     ORDER BY dr.act_name ASC, dr.article_reference ASC, dr.id DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit, 10), parseInt(offset, 10)]
  );

  const [countResult] = await db.query(
    `SELECT COUNT(*) AS total FROM deadline_rules dr ${whereClause}`,
    params
  );

  return {
    rules: rows,
    total: countResult[0]?.total || 0,
  };
};

/**
 * Get rule by ID
 * @param {number} id
 */
const getRuleById = async (id) => {
  const [rows] = await db.execute(
    `SELECT dr.*,
            CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
     FROM deadline_rules dr
     LEFT JOIN users u ON dr.created_by = u.id
     WHERE dr.id = ?`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Create a new limitation rule
 * @param {object} data
 * @param {number} userId
 */
const createRule = async (data, userId) => {
  const {
    act_name,
    act_version = "1963",
    section_reference = null,
    article_reference = null,
    proceeding_type,
    description = null,
    limitation_days = null,
    limitation_months = null,
    limitation_years = null,
    trigger_type,
    exclusion_notes = null,
    source_reference = null,
    effective_from = null,
    effective_to = null,
    is_active = true,
  } = data;

  const [result] = await db.execute(
    `INSERT INTO deadline_rules (
      act_name, act_version, section_reference, article_reference,
      proceeding_type, description, limitation_days, limitation_months, limitation_years,
      trigger_type, exclusion_notes, source_reference, effective_from, effective_to,
      is_active, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      act_name,
      act_version,
      section_reference,
      article_reference,
      proceeding_type,
      description,
      limitation_days ? parseInt(limitation_days, 10) : null,
      limitation_months ? parseInt(limitation_months, 10) : null,
      limitation_years ? parseInt(limitation_years, 10) : null,
      trigger_type,
      exclusion_notes,
      source_reference,
      effective_from || null,
      effective_to || null,
      is_active ? 1 : 0,
      userId,
    ]
  );

  return await getRuleById(result.insertId);
};

/**
 * Update an existing limitation rule
 * @param {number} id
 * @param {object} data
 * @param {number} userId
 */
const updateRule = async (id, data, userId) => {
  const existing = await getRuleById(id);
  if (!existing) {
    return null;
  }

  const {
    act_name = existing.act_name,
    act_version = existing.act_version,
    section_reference = existing.section_reference,
    article_reference = existing.article_reference,
    proceeding_type = existing.proceeding_type,
    description = existing.description,
    limitation_days = existing.limitation_days,
    limitation_months = existing.limitation_months,
    limitation_years = existing.limitation_years,
    trigger_type = existing.trigger_type,
    exclusion_notes = existing.exclusion_notes,
    source_reference = existing.source_reference,
    effective_from = existing.effective_from,
    effective_to = existing.effective_to,
    is_active = existing.is_active,
  } = data;

  await db.execute(
    `UPDATE deadline_rules SET
      act_name = ?, act_version = ?, section_reference = ?, article_reference = ?,
      proceeding_type = ?, description = ?, limitation_days = ?, limitation_months = ?, limitation_years = ?,
      trigger_type = ?, exclusion_notes = ?, source_reference = ?, effective_from = ?, effective_to = ?,
      is_active = ?, updated_by = ?
     WHERE id = ?`,
    [
      act_name,
      act_version,
      section_reference,
      article_reference,
      proceeding_type,
      description,
      limitation_days !== null && limitation_days !== undefined ? parseInt(limitation_days, 10) : null,
      limitation_months !== null && limitation_months !== undefined ? parseInt(limitation_months, 10) : null,
      limitation_years !== null && limitation_years !== undefined ? parseInt(limitation_years, 10) : null,
      trigger_type,
      exclusion_notes,
      source_reference,
      effective_from || null,
      effective_to || null,
      is_active ? 1 : 0,
      userId,
      id,
    ]
  );

  return await getRuleById(id);
};

/**
 * Toggle rule active status
 * @param {number} id
 * @param {boolean} isActive
 * @param {number} userId
 */
const toggleRuleActive = async (id, isActive, userId) => {
  await db.execute(
    `UPDATE deadline_rules SET is_active = ?, updated_by = ? WHERE id = ?`,
    [isActive ? 1 : 0, userId, id]
  );
  return await getRuleById(id);
};

module.exports = {
  getRules,
  getRuleById,
  createRule,
  updateRule,
  toggleRuleActive,
};
