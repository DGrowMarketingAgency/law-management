const db = require("../config/database");

/**
 * Basic Conflict-of-Interest Checking Service
 * Searches existing contacts for matching name, phone, email, or organization.
 * Note: Foundation name/entity matching tool for intake review.
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.phone
 * @param {string} params.email
 * @param {string} params.organization
 * @param {number} [params.excludeContactId]
 * @returns {Promise<Array<object>>}
 */
const checkContactConflict = async ({ name = "", phone = "", email = "", organization = "", excludeContactId = null }) => {
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPhone = String(phone || "").trim().replace(/[^\d+]/g, "");
  const cleanOrg = String(organization || "").trim();

  // If all parameters are empty, return no matches
  if (!cleanName && !cleanEmail && !cleanPhone && !cleanOrg) {
    return [];
  }

  const conditions = [];
  const params = [];

  if (cleanEmail) {
    conditions.push("c.email = ?");
    params.push(cleanEmail);
  }

  if (cleanPhone) {
    conditions.push("c.phone = ? OR c.alternate_phone = ?");
    params.push(cleanPhone, cleanPhone);
  }

  if (cleanName) {
    conditions.push("c.display_name LIKE ? OR CONCAT(c.first_name, ' ', c.last_name) LIKE ?");
    params.push(`%${cleanName}%`, `%${cleanName}%`);
  }

  if (cleanOrg) {
    conditions.push("c.organization_name LIKE ?");
    params.push(`%${cleanOrg}%`);
  }

  let excludeSql = "";
  if (excludeContactId) {
    excludeSql = "AND c.id != ?";
    params.push(excludeContactId);
  }

  const query = `
    SELECT 
      c.id, c.first_name, c.last_name, c.display_name, c.email, c.phone, 
      c.organization_name, c.contact_type, c.created_at,
      cl.id as client_id, cl.client_code, cl.status as client_status
    FROM contacts c
    LEFT JOIN clients cl ON c.id = cl.contact_id
    WHERE c.deleted_at IS NULL AND (${conditions.join(" OR ")}) ${excludeSql}
    LIMIT 20
  `;

  const [rows] = await db.execute(query, params);

  return rows.map((row) => {
    const reasons = [];
    if (cleanEmail && row.email && row.email.toLowerCase() === cleanEmail) {
      reasons.push("Exact email match");
    }
    if (cleanPhone && (row.phone === cleanPhone || row.alternate_phone === cleanPhone)) {
      reasons.push("Exact phone match");
    }
    if (cleanName && row.display_name.toLowerCase().includes(cleanName.toLowerCase())) {
      reasons.push("Name match");
    }
    if (cleanOrg && row.organization_name && row.organization_name.toLowerCase().includes(cleanOrg.toLowerCase())) {
      reasons.push("Organization match");
    }

    return {
      contactId: row.id,
      displayName: row.display_name,
      contactType: row.contact_type,
      email: row.email,
      phone: row.phone,
      organizationName: row.organization_name,
      isExistingClient: Boolean(row.client_id),
      clientCode: row.client_code || null,
      matchReasons: reasons,
    };
  });
};

module.exports = {
  checkContactConflict,
};
