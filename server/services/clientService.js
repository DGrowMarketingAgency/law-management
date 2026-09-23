const db = require("../config/database");
const { logCrmEvent } = require("./auditService");

const ALLOWED_CLIENT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"];
const ALLOWED_CONSENT_TYPES = ["DATA_PROCESSING", "COMMUNICATION", "WHATSAPP", "DOCUMENT_SHARING"];

/**
 * Generate sequential client code: CL-000001
 */
const generateClientCode = async (connection = db) => {
  const [rows] = await connection.execute(
    `SELECT client_code FROM clients ORDER BY id DESC LIMIT 1`
  );

  if (rows.length === 0 || !rows[0].client_code) {
    return "CL-000001";
  }

  const lastCode = rows[0].client_code;
  const match = lastCode.match(/^CL-(\d+)$/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `CL-${String(nextNum).padStart(6, "0")}`;
  }

  return `CL-${Date.now().toString().slice(-6)}`;
};

/**
 * Onboard a contact as a Client
 */
const createClient = async ({ contact_id, client_source = "DIRECT", notes }, creatorId = null, ip = null, userAgent = null, externalConn = null) => {
  const conn = externalConn || db;

  if (!contact_id) {
    const err = new Error("contact_id is required.");
    err.statusCode = 400;
    err.code = "MISSING_CONTACT_ID";
    throw err;
  }

  // 1. Verify contact exists & not deleted
  const [contactRows] = await conn.execute(
    `SELECT id, display_name, contact_type FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [contact_id]
  );

  if (contactRows.length === 0) {
    const err = new Error("Contact not found or has been deleted.");
    err.statusCode = 404;
    err.code = "CONTACT_NOT_FOUND";
    throw err;
  }

  // 2. Check if already a client
  const [existingClient] = await conn.execute(
    `SELECT id, client_code FROM clients WHERE contact_id = ? LIMIT 1`,
    [contact_id]
  );

  if (existingClient.length > 0) {
    const err = new Error("This contact is already registered as an active or historical client.");
    err.statusCode = 409;
    err.code = "CLIENT_ALREADY_EXISTS";
    err.details = { client_id: existingClient[0].id, client_code: existingClient[0].client_code };
    throw err;
  }

  // 3. Generate unique sequential client code
  const clientCode = await generateClientCode(conn);

  // 4. Insert Client record
  const [res] = await conn.execute(
    `INSERT INTO clients (contact_id, client_code, client_source, status, notes, created_by)
     VALUES (?, ?, ?, 'ACTIVE', ?, ?)`,
    [contact_id, clientCode, client_source || "DIRECT", notes || null, creatorId]
  );

  const clientId = res.insertId;

  // 5. Update contact_type to 'CLIENT'
  await conn.execute(`UPDATE contacts SET contact_type = 'CLIENT' WHERE id = ?`, [contact_id]);

  await logCrmEvent(creatorId, "CLIENT_CREATED", "CLIENT", clientId, ip, userAgent, {
    contactId: contact_id,
    clientCode,
    source: client_source,
  });

  return await getClientById(clientId, conn);
};

/**
 * List clients with joined contact info, search, status filter, and pagination
 */
const getClients = async ({ page = 1, limit = 20, search = "", status = "" } = {}) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const whereClauses = ["c.deleted_at IS NULL"];
  const params = [];

  if (status && ALLOWED_CLIENT_STATUSES.includes(status)) {
    whereClauses.push("cl.status = ?");
    params.push(status);
  }

  if (search) {
    whereClauses.push(
      "(cl.client_code LIKE ? OR c.display_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.organization_name LIKE ?)"
    );
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countQuery = `
    SELECT COUNT(*) as total 
    FROM clients cl
    JOIN contacts c ON cl.contact_id = c.id
    ${whereSql}
  `;
  const [countRows] = await db.execute(countQuery, params);
  const total = countRows[0]?.total || 0;
  const total_pages = Math.ceil(total / safeLimit);

  const dataQuery = `
    SELECT 
      cl.id, cl.client_code, cl.client_source, cl.status, cl.notes, cl.created_at, cl.updated_at,
      c.id as contact_id, c.display_name, c.email, c.phone, c.organization_name
    FROM clients cl
    JOIN contacts c ON cl.contact_id = c.id
    ${whereSql}
    ORDER BY cl.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
  `;

  const [rows] = await db.execute(dataQuery, params);

  const items = rows.map((r) => ({
    id: r.id,
    clientCode: r.client_code,
    clientSource: r.client_source,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    contact: {
      id: r.contact_id,
      displayName: r.display_name,
      email: r.email,
      phone: r.phone,
      organizationName: r.organization_name,
    },
  }));

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      total_pages,
    },
  };
};

/**
 * Get Client Details
 */
const getClientById = async (id, connection = db) => {
  const query = `
    SELECT 
      cl.id, cl.contact_id, cl.client_code, cl.client_source, cl.status, cl.notes, cl.created_at, cl.updated_at,
      c.first_name, c.last_name, c.display_name, c.email, c.phone, c.alternate_phone, c.organization_name, c.contact_type
    FROM clients cl
    JOIN contacts c ON cl.contact_id = c.id
    WHERE cl.id = ? AND c.deleted_at IS NULL
    LIMIT 1
  `;

  const [rows] = await connection.execute(query, [id]);
  if (!rows || rows.length === 0) {
    const err = new Error("Client not found.");
    err.statusCode = 404;
    err.code = "CLIENT_NOT_FOUND";
    throw err;
  }

  const client = rows[0];

  // Consents
  const [consents] = await connection.execute(
    `SELECT cc.*, u.first_name as rec_first, u.last_name as rec_last
     FROM client_consents cc
     LEFT JOIN users u ON cc.recorded_by = u.id
     WHERE cc.client_id = ?
     ORDER BY cc.consented_at DESC`,
    [id]
  );

  return {
    id: client.id,
    clientCode: client.client_code,
    clientSource: client.client_source,
    status: client.status,
    notes: client.notes,
    createdAt: client.created_at,
    updatedAt: client.updated_at,
    contact: {
      id: client.contact_id,
      firstName: client.first_name,
      lastName: client.last_name,
      displayName: client.display_name,
      email: client.email,
      phone: client.phone,
      alternatePhone: client.alternate_phone,
      organizationName: client.organization_name,
      contactType: client.contact_type,
    },
    consents: consents.map((c) => ({
      id: c.id,
      consentType: c.consent_type,
      consentText: c.consent_text,
      consentVersion: c.consent_version,
      consentedAt: c.consented_at,
      withdrawnAt: c.withdrawn_at,
      recordedByName: c.rec_first ? `${c.rec_first} ${c.rec_last}` : "System",
    })),
  };
};

/**
 * Update Client Status (ACTIVE, INACTIVE, ARCHIVED)
 */
const updateClientStatus = async (id, status, modifierId = null, ip = null, userAgent = null) => {
  if (!ALLOWED_CLIENT_STATUSES.includes(status)) {
    const err = new Error(`Invalid status: ${status}. Allowed: ${ALLOWED_CLIENT_STATUSES.join(", ")}`);
    err.statusCode = 400;
    err.code = "INVALID_STATUS";
    throw err;
  }

  await db.execute(`UPDATE clients SET status = ? WHERE id = ?`, [status, id]);

  await logCrmEvent(modifierId, "CLIENT_STATUS_CHANGED", "CLIENT", id, ip, userAgent, { newStatus: status });

  return await getClientById(id);
};

/**
 * Record Client Consent (Immutable log)
 */
const recordClientConsent = async (clientId, consentData, recorderId = null, ip = null) => {
  const { consent_type, consent_text, consent_version = "v1.0" } = consentData;

  if (!consent_type || !ALLOWED_CONSENT_TYPES.includes(consent_type)) {
    const err = new Error(`Invalid consent_type: ${consent_type}`);
    err.statusCode = 400;
    err.code = "INVALID_CONSENT_TYPE";
    throw err;
  }

  if (!consent_text) {
    const err = new Error("consent_text is required for legal compliance recording.");
    err.statusCode = 400;
    err.code = "MISSING_CONSENT_TEXT";
    throw err;
  }

  const query = `
    INSERT INTO client_consents (client_id, consent_type, consent_text, consent_version, ip_address, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const [res] = await db.execute(query, [
    clientId,
    consent_type,
    consent_text.trim(),
    consent_version.trim(),
    ip,
    recorderId,
  ]);

  await logCrmEvent(recorderId, "CONSENT_RECORDED", "CONSENT", res.insertId, ip, null, {
    clientId,
    consentType: consent_type,
  });

  return { id: res.insertId, clientId, consent_type, consent_version, consented_at: new Date() };
};

/**
 * Withdraw Client Consent
 */
const withdrawClientConsent = async (clientId, consentId, modifierId = null, ip = null) => {
  await db.execute(
    `UPDATE client_consents SET withdrawn_at = NOW() WHERE id = ? AND client_id = ?`,
    [consentId, clientId]
  );

  await logCrmEvent(modifierId, "CONSENT_WITHDRAWN", "CONSENT", consentId, ip, null, { clientId });

  return { success: true, message: "Client consent marked as withdrawn." };
};

module.exports = {
  createClient,
  getClients,
  getClientById,
  updateClientStatus,
  recordClientConsent,
  withdrawClientConsent,
};
