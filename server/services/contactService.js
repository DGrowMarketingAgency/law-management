const db = require("../config/database");
const { logCrmEvent } = require("./auditService");

const ALLOWED_CONTACT_TYPES = [
  "CLIENT",
  "LEAD",
  "OPPOSING_COUNSEL",
  "WITNESS",
  "REFERRAL_SOURCE",
  "OTHER",
];

const ALLOWED_ADDRESS_TYPES = ["HOME", "OFFICE", "COURT", "OTHER"];

const SORT_WHITELIST = {
  created_at: "c.created_at",
  updated_at: "c.updated_at",
  display_name: "c.display_name",
  email: "c.email",
};

/**
 * Normalize phone string
 */
const normalizePhone = (phone) => {
  if (!phone) return null;
  return String(phone).trim().replace(/[^\d+]/g, "");
};

/**
 * Check for likely duplicates based on normalized email and phone
 */
const findDuplicateContact = async (email, phone, excludeId = null) => {
  const conditions = [];
  const params = [];

  if (email) {
    conditions.push("email = ?");
    params.push(email);
  }

  if (phone) {
    conditions.push("phone = ? OR alternate_phone = ?");
    params.push(phone, phone);
  }

  if (conditions.length === 0) return null;

  let excludeSql = "";
  if (excludeId) {
    excludeSql = "AND id != ?";
    params.push(excludeId);
  }

  const query = `
    SELECT id, display_name, email, phone, contact_type
    FROM contacts
    WHERE deleted_at IS NULL AND (${conditions.join(" OR ")}) ${excludeSql}
    LIMIT 1
  `;

  const [rows] = await db.execute(query, params);
  return rows[0] || null;
};

/**
 * Create a new Contact
 */
const createContact = async (data, creatorId = null, ip = null, userAgent = null) => {
  const {
    first_name,
    last_name,
    display_name,
    email,
    phone,
    alternate_phone,
    organization_name,
    contact_type,
    notes,
  } = data;

  const type = contact_type || 'LEAD';
  if (!ALLOWED_CONTACT_TYPES.includes(type)) {
    const err = new Error(`Invalid contact_type. Allowed types: ${ALLOWED_CONTACT_TYPES.join(", ")}`);
    err.statusCode = 400;
    err.code = "INVALID_CONTACT_TYPE";
    throw err;
  }

  const cleanFirst = first_name ? String(first_name).trim() : null;
  const cleanLast = last_name ? String(last_name).trim() : null;
  let cleanDisplay = display_name ? String(display_name).trim() : "";

  if (!cleanDisplay) {
    if (cleanFirst || cleanLast) {
      cleanDisplay = [cleanFirst, cleanLast].filter(Boolean).join(" ");
    } else {
      const err = new Error("Either first_name or display_name is required.");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
  }

  const cleanEmail = email ? String(email).trim().toLowerCase() : null;
  const cleanPhone = normalizePhone(phone);
  const cleanAltPhone = normalizePhone(alternate_phone);
  const cleanOrg = organization_name ? String(organization_name).trim() : null;
  const cleanNotes = notes ? String(notes).trim() : null;

  // Duplicate Check
  const duplicate = await findDuplicateContact(cleanEmail, cleanPhone);
  if (duplicate) {
    const err = new Error("A possible duplicate contact already exists with the same email or phone.");
    err.statusCode = 409;
    err.code = "DUPLICATE_CONTACT";
    err.details = { existing_contact_id: duplicate.id, duplicate_type: duplicate.contact_type, name: duplicate.display_name };
    throw err;
  }

  const query = `
    INSERT INTO contacts 
      (first_name, last_name, display_name, email, phone, alternate_phone, organization_name, contact_type, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [res] = await db.execute(query, [
    cleanFirst,
    cleanLast,
    cleanDisplay,
    cleanEmail,
    cleanPhone,
    cleanAltPhone,
    cleanOrg,
    type,
    cleanNotes,
    creatorId,
  ]);

  const newId = res.insertId;

  await logCrmEvent(creatorId, "CONTACT_CREATED", "CONTACT", newId, ip, userAgent, {
    displayName: cleanDisplay,
    contactType: contact_type,
  });

  return await getContactById(newId);
};

/**
 * List contacts with search, type filter, sorting, and pagination
 */
const getContacts = async ({
  page = 1,
  limit = 20,
  search = "",
  contact_type = "",
  sort = "created_at",
  order = "DESC",
} = {}) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const whereClauses = ["c.deleted_at IS NULL"];
  const params = [];

  if (search) {
    whereClauses.push(
      "(c.first_name LIKE ? OR c.last_name LIKE ? OR c.display_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.organization_name LIKE ?)"
    );
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (contact_type && ALLOWED_CONTACT_TYPES.includes(contact_type)) {
    whereClauses.push("c.contact_type = ?");
    params.push(contact_type);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Sort whitelist
  const sortCol = SORT_WHITELIST[sort] || "c.created_at";
  const sortOrder = String(order).toUpperCase() === "ASC" ? "ASC" : "DESC";

  // Count total matching
  const countQuery = `SELECT COUNT(*) as total FROM contacts c ${whereSql}`;
  const [countRows] = await db.execute(countQuery, params);
  const total = countRows[0]?.total || 0;
  const total_pages = Math.ceil(total / safeLimit);

  // Fetch paginated records with tags and client status
  const dataQuery = `
    SELECT 
      c.id, c.first_name, c.last_name, c.display_name, c.email, c.phone, 
      c.alternate_phone, c.organization_name, c.contact_type, c.notes,
      c.created_at, c.updated_at,
      cl.id as client_id, cl.client_code, cl.status as client_status,
      GROUP_CONCAT(DISTINCT ct.name) as tag_names
    FROM contacts c
    LEFT JOIN clients cl ON c.id = cl.contact_id
    LEFT JOIN contact_tag_map ctm ON c.id = ctm.contact_id
    LEFT JOIN contact_tags ct ON ctm.tag_id = ct.id
    ${whereSql}
    GROUP BY c.id
    ORDER BY ${sortCol} ${sortOrder}
    LIMIT ${safeLimit} OFFSET ${offset}
  `;

  const [rows] = await db.execute(dataQuery, params);

  const items = rows.map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    displayName: r.display_name,
    email: r.email,
    phone: r.phone,
    alternatePhone: r.alternate_phone,
    organizationName: r.organization_name,
    contactType: r.contact_type,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    isClient: Boolean(r.client_id),
    clientCode: r.client_code || null,
    clientStatus: r.client_status || null,
    tags: r.tag_names ? r.tag_names.split(",") : [],
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
 * Get full contact details
 */
const getContactById = async (id) => {
  const [contactRows] = await db.execute(
    `SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id]
  );

  if (!contactRows || contactRows.length === 0) {
    const err = new Error("Contact not found.");
    err.statusCode = 404;
    err.code = "CONTACT_NOT_FOUND";
    throw err;
  }

  const contact = contactRows[0];

  // Addresses
  const [addresses] = await db.execute(
    `SELECT * FROM contact_addresses WHERE contact_id = ? ORDER BY is_primary DESC, created_at ASC`,
    [id]
  );

  // Tags
  const [tags] = await db.execute(
    `SELECT ct.id, ct.name, ct.color 
     FROM contact_tag_map ctm
     JOIN contact_tags ct ON ctm.tag_id = ct.id
     WHERE ctm.contact_id = ?`,
    [id]
  );

  // Client record if linked
  const [clients] = await db.execute(
    `SELECT id, client_code, client_source, status, created_at FROM clients WHERE contact_id = ? LIMIT 1`,
    [id]
  );

  // Leads if linked
  const [leads] = await db.execute(
    `SELECT id, source, status, not_converted_reason, converted_at, created_at FROM leads WHERE contact_id = ? ORDER BY created_at DESC`,
    [id]
  );

  // Follow-ups
  const [followUps] = await db.execute(
    `SELECT fu.*, u.first_name as assigned_first, u.last_name as assigned_last
     FROM follow_ups fu
     JOIN users u ON fu.assigned_to = u.id
     WHERE fu.contact_id = ?
     ORDER BY fu.scheduled_for ASC LIMIT 10`,
    [id]
  );

  // Appointments
  const [appointments] = await db.execute(
    `SELECT a.*, u.first_name as assigned_first, u.last_name as assigned_last
     FROM appointments a
     JOIN users u ON a.assigned_to = u.id
     WHERE a.contact_id = ?
     ORDER BY a.appointment_date DESC, a.start_time DESC LIMIT 10`,
    [id]
  );

  return {
    id: contact.id,
    firstName: contact.first_name,
    lastName: contact.last_name,
    displayName: contact.display_name,
    email: contact.email,
    phone: contact.phone,
    alternatePhone: contact.alternate_phone,
    organizationName: contact.organization_name,
    contactType: contact.contact_type,
    notes: contact.notes,
    createdAt: contact.created_at,
    updatedAt: contact.updated_at,
    addresses: addresses.map((a) => ({
      id: a.id,
      addressType: a.address_type,
      addressLine1: a.address_line_1,
      addressLine2: a.address_line_2,
      city: a.city,
      district: a.district,
      state: a.state,
      country: a.country,
      postalCode: a.postal_code,
      isPrimary: Boolean(a.is_primary),
    })),
    tags,
    client: clients[0] ? {
      id: clients[0].id,
      clientCode: clients[0].client_code,
      clientSource: clients[0].client_source,
      status: clients[0].status,
      createdAt: clients[0].created_at,
    } : null,
    leads: leads.map((l) => ({
      id: l.id,
      source: l.source,
      status: l.status,
      notConvertedReason: l.not_converted_reason,
      convertedAt: l.converted_at,
      createdAt: l.created_at,
    })),
    followUps: followUps.map((f) => ({
      id: f.id,
      title: f.title,
      type: f.follow_up_type,
      status: f.status,
      scheduledFor: f.scheduled_for,
      completedAt: f.completed_at,
      assignedToName: `${f.assigned_first} ${f.assigned_last}`,
    })),
    appointments: appointments.map((apt) => ({
      id: apt.id,
      title: apt.title,
      type: apt.appointment_type,
      status: apt.status,
      date: apt.appointment_date,
      startTime: apt.start_time,
      endTime: apt.end_time,
      location: apt.location,
      assignedToName: `${apt.assigned_first} ${apt.assigned_last}`,
    })),
    // Business placeholders per Prompt 4 specs
    cases: [],
    invoices: [],
  };
};

/**
 * Update contact
 */
const updateContact = async (id, updates, modifierId = null, ip = null, userAgent = null) => {
  const allowedFields = [
    "first_name",
    "last_name",
    "display_name",
    "email",
    "phone",
    "alternate_phone",
    "organization_name",
    "contact_type",
    "notes",
  ];

  const setClauses = [];
  const params = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      if (field === "contact_type" && !ALLOWED_CONTACT_TYPES.includes(updates[field])) {
        const err = new Error(`Invalid contact_type: ${updates[field]}`);
        err.statusCode = 400;
        err.code = "INVALID_CONTACT_TYPE";
        throw err;
      }

      let val = updates[field];
      if (field === "email") val = val ? String(val).trim().toLowerCase() : null;
      if (field === "phone" || field === "alternate_phone") val = normalizePhone(val);

      setClauses.push(`${field} = ?`);
      params.push(val);
    }
  }

  if (setClauses.length === 0) {
    return await getContactById(id);
  }

  params.push(id);
  await db.execute(
    `UPDATE contacts SET ${setClauses.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
    params
  );

  await logCrmEvent(modifierId, "CONTACT_UPDATED", "CONTACT", id, ip, userAgent, updates);

  return await getContactById(id);
};

/**
 * Soft delete contact
 */
const deleteContact = async (id, modifierId = null, ip = null, userAgent = null) => {
  // Check if contact has linked client
  const [clients] = await db.execute(`SELECT id FROM clients WHERE contact_id = ? LIMIT 1`, [id]);
  if (clients.length > 0) {
    const err = new Error("Cannot delete contact linked to an active client record.");
    err.statusCode = 400;
    err.code = "LINKED_CLIENT_EXISTS";
    throw err;
  }

  // Check if contact has leads
  const [leads] = await db.execute(`SELECT id FROM leads WHERE contact_id = ? LIMIT 1`, [id]);
  if (leads.length > 0) {
    const err = new Error("Cannot delete contact with historical lead records.");
    err.statusCode = 400;
    err.code = "LINKED_LEAD_EXISTS";
    throw err;
  }

  await db.execute(`UPDATE contacts SET deleted_at = NOW() WHERE id = ?`, [id]);

  await logCrmEvent(modifierId, "CONTACT_DELETED", "CONTACT", id, ip, userAgent);

  return { success: true, message: "Contact deleted successfully." };
};

/**
 * Add Address to Contact
 */
const addContactAddress = async (contactId, addressData) => {
  const {
    address_type = "OFFICE",
    address_line_1,
    address_line_2,
    city,
    district,
    state,
    country = "India",
    postal_code,
    is_primary = false,
  } = addressData;

  if (!address_line_1 || !city || !state || !postal_code) {
    const err = new Error("Address line 1, city, state, and postal code are required.");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (!ALLOWED_ADDRESS_TYPES.includes(address_type)) {
    const err = new Error(`Invalid address_type: ${address_type}`);
    err.statusCode = 400;
    err.code = "INVALID_ADDRESS_TYPE";
    throw err;
  }

  // If marked primary, reset other primary addresses for this contact
  if (is_primary) {
    await db.execute(`UPDATE contact_addresses SET is_primary = FALSE WHERE contact_id = ?`, [contactId]);
  }

  const query = `
    INSERT INTO contact_addresses 
      (contact_id, address_type, address_line_1, address_line_2, city, district, state, country, postal_code, is_primary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [res] = await db.execute(query, [
    contactId,
    address_type,
    address_line_1.trim(),
    address_line_2 ? address_line_2.trim() : null,
    city.trim(),
    district ? district.trim() : null,
    state.trim(),
    country.trim(),
    postal_code.trim(),
    Boolean(is_primary),
  ]);

  return { id: res.insertId, contactId, ...addressData };
};

/**
 * Remove Address from Contact
 */
const deleteContactAddress = async (contactId, addressId) => {
  await db.execute(`DELETE FROM contact_addresses WHERE id = ? AND contact_id = ?`, [addressId, contactId]);
  return { success: true };
};

/**
 * Tag Management
 */
const addContactTag = async (contactId, tagId) => {
  await db.execute(
    `INSERT IGNORE INTO contact_tag_map (contact_id, tag_id) VALUES (?, ?)`,
    [contactId, tagId]
  );
  return { success: true };
};

const removeContactTag = async (contactId, tagId) => {
  await db.execute(
    `DELETE FROM contact_tag_map WHERE contact_id = ? AND tag_id = ?`,
    [contactId, tagId]
  );
  return { success: true };
};

const getAllTags = async () => {
  const [rows] = await db.execute(`SELECT * FROM contact_tags ORDER BY name ASC`);
  return rows;
};

const createTag = async (name, color = "#1e3a8a") => {
  const [res] = await db.execute(
    `INSERT INTO contact_tags (name, color) VALUES (?, ?) ON DUPLICATE KEY UPDATE color = VALUES(color)`,
    [name.trim(), color]
  );
  return { id: res.insertId, name: name.trim(), color };
};

/**
 * Unified Contact Timeline
 * Combines chronological relationship events:
 * - Contact created
 * - Client created
 * - Lead created & converted
 * - Lead activities
 * - Follow-ups created/completed
 * - Appointments scheduled/completed
 * - Consents recorded
 */
const getContactTimeline = async (contactId) => {
  const timeline = [];

  // 1. Contact Creation
  const [cRows] = await db.execute(
    `SELECT c.created_at, c.display_name, c.contact_type, u.first_name, u.last_name
     FROM contacts c
     LEFT JOIN users u ON c.created_by = u.id
     WHERE c.id = ?`,
    [contactId]
  );
  if (cRows[0]) {
    timeline.push({
      type: "CONTACT_CREATED",
      title: "Contact Record Created",
      description: `Registered as ${cRows[0].contact_type}`,
      date: cRows[0].created_at,
      actor: cRows[0].first_name ? `${cRows[0].first_name} ${cRows[0].last_name}` : "System",
      entity_id: contactId,
    });
  }

  // 2. Client Profile
  const [clRows] = await db.execute(
    `SELECT cl.id, cl.client_code, cl.client_source, cl.created_at, u.first_name, u.last_name
     FROM clients cl
     LEFT JOIN users u ON cl.created_by = u.id
     WHERE cl.contact_id = ?`,
    [contactId]
  );
  if (clRows[0]) {
    timeline.push({
      type: "CLIENT_ONBOARDED",
      title: `Client Onboarded (${clRows[0].client_code})`,
      description: `Client relationship established via ${clRows[0].client_source || "Direct"}`,
      date: clRows[0].created_at,
      actor: clRows[0].first_name ? `${clRows[0].first_name} ${clRows[0].last_name}` : "Chambers",
      entity_id: clRows[0].id,
    });

    // Client Consents
    const [consentRows] = await db.execute(
      `SELECT cc.id, cc.consent_type, cc.consented_at, cc.withdrawn_at
       FROM client_consents cc
       WHERE cc.client_id = ?`,
      [clRows[0].id]
    );
    for (const consent of consentRows) {
      timeline.push({
        type: "CONSENT_RECORDED",
        title: `Client Consent: ${consent.consent_type}`,
        description: consent.withdrawn_at ? "Consent recorded (subsequently withdrawn)" : "Consent legally recorded",
        date: consent.consented_at,
        actor: "Client",
        entity_id: consent.id,
      });
    }
  }

  // 3. Leads & Lead Activities
  const [lRows] = await db.execute(
    `SELECT l.id, l.source, l.status, l.created_at, l.converted_at, u.first_name, u.last_name
     FROM leads l
     LEFT JOIN users u ON l.created_by = u.id
     WHERE l.contact_id = ?`,
    [contactId]
  );
  for (const lead of lRows) {
    timeline.push({
      type: "LEAD_INQUIRY",
      title: `Lead Inquiry Recorded`,
      description: `Inquiry source: ${lead.source}. Initial status: ${lead.status}`,
      date: lead.created_at,
      actor: lead.first_name ? `${lead.first_name} ${lead.last_name}` : "Chambers",
      entity_id: lead.id,
    });

    if (lead.converted_at) {
      timeline.push({
        type: "LEAD_RETAINED",
        title: "Lead Converted to Retained Client",
        description: "Advocate retained following consultation.",
        date: lead.converted_at,
        actor: "Chambers",
        entity_id: lead.id,
      });
    }

    // Lead Activities
    const [actRows] = await db.execute(
      `SELECT la.id, la.activity_type, la.subject, la.activity_date, u.first_name, u.last_name
       FROM lead_activities la
       LEFT JOIN users u ON la.created_by = u.id
       WHERE la.lead_id = ?`,
      [lead.id]
    );
    for (const act of actRows) {
      timeline.push({
        type: "LEAD_ACTIVITY",
        title: `${act.activity_type}: ${act.subject}`,
        description: `Activity logged under inquiry #${lead.id}`,
        date: act.activity_date,
        actor: act.first_name ? `${act.first_name} ${act.last_name}` : "Associate",
        entity_id: act.id,
      });
    }
  }

  // 4. Follow-Ups
  const [fuRows] = await db.execute(
    `SELECT fu.id, fu.title, fu.follow_up_type, fu.status, fu.scheduled_for, fu.completed_at
     FROM follow_ups fu
     WHERE fu.contact_id = ?`,
    [contactId]
  );
  for (const fu of fuRows) {
    timeline.push({
      type: "FOLLOW_UP",
      title: `Follow-up: ${fu.title}`,
      description: `Type: ${fu.follow_up_type}. Status: ${fu.status}`,
      date: fu.completed_at || fu.scheduled_for,
      actor: "Chambers",
      entity_id: fu.id,
    });
  }

  // 5. Appointments
  const [aptRows] = await db.execute(
    `SELECT a.id, a.title, a.appointment_type, a.status, a.appointment_date, a.start_time
     FROM appointments a
     WHERE a.contact_id = ?`,
    [contactId]
  );
  for (const apt of aptRows) {
    const aptDate = new Date(`${apt.appointment_date}T${apt.start_time}`);
    timeline.push({
      type: "APPOINTMENT",
      title: `Appointment: ${apt.title}`,
      description: `Type: ${apt.appointment_type}. Status: ${apt.status}`,
      date: isNaN(aptDate.getTime()) ? apt.appointment_date : aptDate,
      actor: "Chambers",
      entity_id: apt.id,
    });
  }

  // Sort newest first
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  return timeline;
};

module.exports = {
  createContact,
  getContacts,
  getContactById,
  updateContact,
  deleteContact,
  addContactAddress,
  deleteContactAddress,
  getAllTags,
  createTag,
  addContactTag,
  removeContactTag,
  getContactTimeline,
};
