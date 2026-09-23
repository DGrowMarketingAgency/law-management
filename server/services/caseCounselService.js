const db = require("../config/database");
const { logCaseEvent } = require("./auditService");

const ALLOWED_COUNSEL_TYPES = ["OUR_COUNSEL", "OPPOSING_COUNSEL", "OTHER_COUNSEL"];

const getCounselByCaseId = async (caseId) => {
  const query = `
    SELECT ccsl.*, c.first_name, c.last_name, c.display_name, c.email, c.phone, c.organization_name
    FROM case_counsel ccsl
    JOIN contacts c ON ccsl.contact_id = c.id
    WHERE ccsl.case_id = ?
    ORDER BY ccsl.id ASC
  `;
  const [rows] = await db.execute(query, [caseId]);
  return rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    contactId: r.contact_id,
    displayName: r.display_name,
    counselType: r.counsel_type,
    notes: r.notes,
    email: r.email,
    phone: r.phone,
    organization: r.organization_name,
  }));
};

const addCounsel = async (caseId, { contact_id, counsel_type, notes }, creatorId = null, ip = null, userAgent = null) => {
  if (!contact_id || !counsel_type) {
    const err = new Error("Contact and Counsel Type are required.");
    err.statusCode = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (!ALLOWED_COUNSEL_TYPES.includes(counsel_type)) {
    const err = new Error(`Invalid counsel_type: ${counsel_type}`);
    err.statusCode = 422;
    throw err;
  }

  const [cnt] = await db.execute(`SELECT id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [contact_id]);
  if (cnt.length === 0) {
    const err = new Error("Contact not found in directory.");
    err.statusCode = 422;
    throw err;
  }

  const [existing] = await db.execute(
    `SELECT id FROM case_counsel WHERE case_id = ? AND contact_id = ? AND counsel_type = ? LIMIT 1`,
    [caseId, contact_id, counsel_type]
  );
  if (existing.length > 0) {
    const err = new Error("This contact is already recorded as counsel for this case.");
    err.statusCode = 409;
    err.code = "DUPLICATE_COUNSEL";
    throw err;
  }

  const query = `
    INSERT INTO case_counsel (case_id, contact_id, counsel_type, notes)
    VALUES (?, ?, ?, ?)
  `;

  const [res] = await db.execute(query, [caseId, contact_id, counsel_type, notes || null]);

  await logCaseEvent(creatorId, "COUNSEL_ADDED", "CASE", caseId, ip, userAgent, {
    contactId: contact_id,
    counselType: counsel_type,
    counselId: res.insertId,
  });

  return (await getCounselByCaseId(caseId)).find((c) => c.id === res.insertId);
};

const updateCounsel = async (caseId, counselId, { counsel_type, notes }, modifierId = null, ip = null, userAgent = null) => {
  const setClauses = [];
  const params = [];

  if (counsel_type !== undefined) {
    if (!ALLOWED_COUNSEL_TYPES.includes(counsel_type)) {
      const err = new Error(`Invalid counsel_type: ${counsel_type}`);
      err.statusCode = 422;
      throw err;
    }
    setClauses.push("counsel_type = ?");
    params.push(counsel_type);
  }

  if (notes !== undefined) {
    setClauses.push("notes = ?");
    params.push(notes || null);
  }

  if (setClauses.length > 0) {
    params.push(counselId, caseId);
    await db.execute(`UPDATE case_counsel SET ${setClauses.join(", ")} WHERE id = ? AND case_id = ?`, params);
    await logCaseEvent(modifierId, "COUNSEL_UPDATED", "CASE", caseId, ip, userAgent, { counselId });
  }

  return (await getCounselByCaseId(caseId)).find((c) => c.id === parseInt(counselId, 10));
};

const removeCounsel = async (caseId, counselId, modifierId = null, ip = null, userAgent = null) => {
  await db.execute(`DELETE FROM case_counsel WHERE id = ? AND case_id = ?`, [counselId, caseId]);
  await logCaseEvent(modifierId, "COUNSEL_REMOVED", "CASE", caseId, ip, userAgent, { counselId });
  return { success: true, message: "Counsel removed from case." };
};

module.exports = {
  getCounselByCaseId,
  addCounsel,
  updateCounsel,
  removeCounsel,
  ALLOWED_COUNSEL_TYPES,
};
