const db = require("../config/database");
const { logCaseEvent } = require("./auditService");

const ALLOWED_PARTY_ROLES = [
  "PLAINTIFF",
  "DEFENDANT",
  "PETITIONER",
  "RESPONDENT",
  "APPELLANT",
  "APPEALANT",
  "COMPLAINANT",
  "ACCUSED",
  "APPLICANT",
  "OPPOSITE_PARTY",
  "OTHER",
];

const getPartiesByCaseId = async (caseId) => {
  const query = `
    SELECT cp.*, c.first_name, c.last_name, c.display_name, c.email, c.phone, c.organization_name
    FROM case_parties cp
    JOIN contacts c ON cp.contact_id = c.id
    WHERE cp.case_id = ?
    ORDER BY cp.is_primary DESC, cp.id ASC
  `;
  const [rows] = await db.execute(query, [caseId]);
  return rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    contactId: r.contact_id,
    displayName: r.display_name,
    partyRole: r.party_role,
    partyDescription: r.party_description,
    isPrimary: Boolean(r.is_primary),
    email: r.email,
    phone: r.phone,
    organization: r.organization_name,
  }));
};

const addParty = async (caseId, { contact_id, party_role, party_description, is_primary }, creatorId = null, ip = null, userAgent = null) => {
  if (!contact_id || !party_role) {
    const err = new Error("Contact and Party Role are required.");
    err.statusCode = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (!ALLOWED_PARTY_ROLES.includes(party_role)) {
    const err = new Error(`Invalid party_role: ${party_role}`);
    err.statusCode = 422;
    err.code = "INVALID_PARTY_ROLE";
    throw err;
  }

  // Verify contact exists
  const [cnt] = await db.execute(`SELECT id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [contact_id]);
  if (cnt.length === 0) {
    const err = new Error("Contact not found in directory.");
    err.statusCode = 422;
    err.code = "CONTACT_NOT_FOUND";
    throw err;
  }

  // Duplicate check (same contact + same role in this case)
  const [existing] = await db.execute(
    `SELECT id FROM case_parties WHERE case_id = ? AND contact_id = ? AND party_role = ? LIMIT 1`,
    [caseId, contact_id, party_role]
  );
  if (existing.length > 0) {
    const err = new Error("This contact is already associated with this case under the same party role.");
    err.statusCode = 409;
    err.code = "DUPLICATE_PARTY";
    throw err;
  }

  const query = `
    INSERT INTO case_parties (case_id, contact_id, party_role, party_description, is_primary)
    VALUES (?, ?, ?, ?, ?)
  `;

  const [res] = await db.execute(query, [
    caseId,
    contact_id,
    party_role,
    party_description || null,
    is_primary ? 1 : 0,
  ]);

  await logCaseEvent(creatorId, "PARTY_ADDED", "CASE", caseId, ip, userAgent, {
    contactId: contact_id,
    partyRole: party_role,
    partyId: res.insertId,
  });

  return (await getPartiesByCaseId(caseId)).find((p) => p.id === res.insertId);
};

const updateParty = async (caseId, partyId, { party_role, party_description, is_primary }, modifierId = null, ip = null, userAgent = null) => {
  const setClauses = [];
  const params = [];

  if (party_role !== undefined) {
    if (!ALLOWED_PARTY_ROLES.includes(party_role)) {
      const err = new Error(`Invalid party_role: ${party_role}`);
      err.statusCode = 422;
      throw err;
    }
    setClauses.push("party_role = ?");
    params.push(party_role);
  }

  if (party_description !== undefined) {
    setClauses.push("party_description = ?");
    params.push(party_description || null);
  }

  if (is_primary !== undefined) {
    setClauses.push("is_primary = ?");
    params.push(is_primary ? 1 : 0);
  }

  if (setClauses.length > 0) {
    params.push(partyId, caseId);
    await db.execute(`UPDATE case_parties SET ${setClauses.join(", ")} WHERE id = ? AND case_id = ?`, params);
    await logCaseEvent(modifierId, "PARTY_UPDATED", "CASE", caseId, ip, userAgent, { partyId });
  }

  return (await getPartiesByCaseId(caseId)).find((p) => p.id === parseInt(partyId, 10));
};

const removeParty = async (caseId, partyId, modifierId = null, ip = null, userAgent = null) => {
  await db.execute(`DELETE FROM case_parties WHERE id = ? AND case_id = ?`, [partyId, caseId]);
  await logCaseEvent(modifierId, "PARTY_REMOVED", "CASE", caseId, ip, userAgent, { partyId });
  return { success: true, message: "Party removed from case." };
};

module.exports = {
  getPartiesByCaseId,
  addParty,
  updateParty,
  removeParty,
  ALLOWED_PARTY_ROLES,
};
