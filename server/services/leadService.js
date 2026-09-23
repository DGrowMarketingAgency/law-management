const db = require("../config/database");
const { createClient } = require("./clientService");
const { logCrmEvent } = require("./auditService");

const ALLOWED_LEAD_STATUSES = [
  "INQUIRY",
  "CONSULTATION_SCHEDULED",
  "CONSULTATION_DONE",
  "RETAINED",
  "NOT_CONVERTED",
];

const ALLOWED_ACTIVITY_TYPES = ["CALL", "MESSAGE", "EMAIL", "MEETING", "NOTE", "OTHER"];

// Enforced state transition matrix
const ALLOWED_TRANSITIONS = {
  INQUIRY: ["CONSULTATION_SCHEDULED", "NOT_CONVERTED"],
  CONSULTATION_SCHEDULED: ["CONSULTATION_DONE", "NOT_CONVERTED"],
  CONSULTATION_DONE: ["RETAINED", "NOT_CONVERTED"],
  RETAINED: [], // Terminal state
  NOT_CONVERTED: ["INQUIRY"], // Reopen inquiry allowed
};

/**
 * Create a new Lead inquiry
 * Always starts in 'INQUIRY' status.
 */
const createLead = async (data, creatorId = null, ip = null, userAgent = null) => {
  const { contact_id, source = "DIRECT", assigned_to, notes } = data;

  if (!contact_id) {
    const err = new Error("contact_id is required.");
    err.statusCode = 400;
    err.code = "MISSING_CONTACT_ID";
    throw err;
  }

  // Verify contact exists
  const [contactRows] = await db.execute(
    `SELECT id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [contact_id]
  );
  if (contactRows.length === 0) {
    const err = new Error("Contact not found or has been deleted.");
    err.statusCode = 404;
    err.code = "CONTACT_NOT_FOUND";
    throw err;
  }

  const query = `
    INSERT INTO leads (contact_id, source, status, assigned_to, notes, created_by)
    VALUES (?, ?, 'INQUIRY', ?, ?, ?)
  `;

  const [res] = await db.execute(query, [
    contact_id,
    source || "DIRECT",
    assigned_to || null,
    notes || null,
    creatorId,
  ]);

  const leadId = res.insertId;

  await logCrmEvent(creatorId, "LEAD_CREATED", "LEAD", leadId, ip, userAgent, {
    contactId: contact_id,
    source,
  });

  return await getLeadById(leadId);
};

/**
 * List leads with contact info, status filter, and pagination
 */
const getLeads = async ({ page = 1, limit = 20, status = "", assigned_to = "", search = "" } = {}) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const whereClauses = ["c.deleted_at IS NULL"];
  const params = [];

  if (status && ALLOWED_LEAD_STATUSES.includes(status)) {
    whereClauses.push("l.status = ?");
    params.push(status);
  }

  if (assigned_to) {
    whereClauses.push("l.assigned_to = ?");
    params.push(assigned_to);
  }

  if (search) {
    whereClauses.push("(c.display_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR l.source LIKE ?)");
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countQuery = `
    SELECT COUNT(*) as total
    FROM leads l
    JOIN contacts c ON l.contact_id = c.id
    ${whereSql}
  `;
  const [countRows] = await db.execute(countQuery, params);
  const total = countRows[0]?.total || 0;
  const total_pages = Math.ceil(total / safeLimit);

  const dataQuery = `
    SELECT 
      l.id, l.source, l.status, l.not_converted_reason, l.converted_client_id, l.converted_at,
      l.notes, l.created_at, l.updated_at,
      c.id as contact_id, c.display_name, c.email, c.phone, c.organization_name,
      u.id as assigned_id, u.first_name as assigned_first, u.last_name as assigned_last
    FROM leads l
    JOIN contacts c ON l.contact_id = c.id
    LEFT JOIN users u ON l.assigned_to = u.id
    ${whereSql}
    ORDER BY l.created_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
  `;

  const [rows] = await db.execute(dataQuery, params);

  const items = rows.map((r) => ({
    id: r.id,
    source: r.source,
    status: r.status,
    notConvertedReason: r.not_converted_reason,
    convertedClientId: r.converted_client_id,
    convertedAt: r.converted_at,
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
    assignedTo: r.assigned_id
      ? {
          id: r.assigned_id,
          name: `${r.assigned_first} ${r.assigned_last}`,
        }
      : null,
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
 * Get lead details with activities and follow-ups
 */
const getLeadById = async (id, connection = db) => {
  const query = `
    SELECT 
      l.*,
      c.first_name, c.last_name, c.display_name, c.email, c.phone, c.alternate_phone, c.organization_name,
      u.first_name as assigned_first, u.last_name as assigned_last
    FROM leads l
    JOIN contacts c ON l.contact_id = c.id
    LEFT JOIN users u ON l.assigned_to = u.id
    WHERE l.id = ? AND c.deleted_at IS NULL
    LIMIT 1
  `;

  const [rows] = await connection.execute(query, [id]);
  if (!rows || rows.length === 0) {
    const err = new Error("Lead not found.");
    err.statusCode = 404;
    err.code = "LEAD_NOT_FOUND";
    throw err;
  }

  const lead = rows[0];

  // Activities
  const [activities] = await connection.execute(
    `SELECT la.*, u.first_name as act_first, u.last_name as act_last
     FROM lead_activities la
     LEFT JOIN users u ON la.created_by = u.id
     WHERE la.lead_id = ?
     ORDER BY la.activity_date DESC`,
    [id]
  );

  return {
    id: lead.id,
    source: lead.source,
    status: lead.status,
    notConvertedReason: lead.not_converted_reason,
    convertedClientId: lead.converted_client_id,
    convertedAt: lead.converted_at,
    notes: lead.notes,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    contact: {
      id: lead.contact_id,
      firstName: lead.first_name,
      lastName: lead.last_name,
      displayName: lead.display_name,
      email: lead.email,
      phone: lead.phone,
      alternatePhone: lead.alternate_phone,
      organizationName: lead.organization_name,
    },
    assignedTo: lead.assigned_to
      ? {
          id: lead.assigned_to,
          name: `${lead.assigned_first} ${lead.assigned_last}`,
        }
      : null,
    activities: activities.map((a) => ({
      id: a.id,
      activityType: a.activity_type,
      subject: a.subject,
      description: a.description,
      activityDate: a.activity_date,
      createdAt: a.created_at,
      createdByName: a.act_first ? `${a.act_first} ${a.act_last}` : "Chambers",
    })),
  };
};

/**
 * Update Lead Status (Enforcing Transition Rules)
 */
const updateLead = async (id, updates, modifierId = null, ip = null, userAgent = null) => {
  const current = await getLeadById(id);

  const { status, not_converted_reason, assigned_to, notes, source } = updates;

  // Status transition validation
  if (status && status !== current.status) {
    if (!ALLOWED_LEAD_STATUSES.includes(status)) {
      const err = new Error(`Invalid status: ${status}`);
      err.statusCode = 400;
      err.code = "INVALID_STATUS";
      throw err;
    }

    // Direct transition to RETAINED must use the convert endpoint
    if (status === "RETAINED") {
      const err = new Error("Direct transition to RETAINED is not permitted. Please use the lead conversion flow (/leads/:id/convert).");
      err.statusCode = 400;
      err.code = "USE_CONVERSION_FLOW";
      throw err;
    }

    const allowedNext = ALLOWED_TRANSITIONS[current.status] || [];
    if (!allowedNext.includes(status)) {
      const err = new Error(`Invalid status transition from ${current.status} to ${status}. Allowed: [${allowedNext.join(", ")}]`);
      err.statusCode = 400;
      err.code = "INVALID_STATUS_TRANSITION";
      throw err;
    }

    if (status === "NOT_CONVERTED") {
      if (!not_converted_reason || String(not_converted_reason).trim().length === 0) {
        const err = new Error("not_converted_reason is mandatory when marking a lead as NOT_CONVERTED.");
        err.statusCode = 400;
        err.code = "MISSING_NOT_CONVERTED_REASON";
        throw err;
      }
    }
  }

  const setClauses = [];
  const params = [];

  if (status !== undefined) {
    setClauses.push("status = ?");
    params.push(status);
  }

  if (not_converted_reason !== undefined) {
    setClauses.push("not_converted_reason = ?");
    params.push(not_converted_reason ? String(not_converted_reason).trim() : null);
  }

  if (assigned_to !== undefined) {
    setClauses.push("assigned_to = ?");
    params.push(assigned_to || null);
  }

  if (notes !== undefined) {
    setClauses.push("notes = ?");
    params.push(notes ? String(notes).trim() : null);
  }

  if (source !== undefined) {
    setClauses.push("source = ?");
    params.push(source);
  }

  if (setClauses.length === 0) {
    return current;
  }

  params.push(id);
  await db.execute(`UPDATE leads SET ${setClauses.join(", ")} WHERE id = ?`, params);

  await logCrmEvent(modifierId, "LEAD_UPDATED", "LEAD", id, ip, userAgent, updates);

  return await getLeadById(id);
};

/**
 * Convert Lead to Client (Database Transaction)
 * Transition: CONSULTATION_DONE -> RETAINED
 */
const convertLeadToClient = async (leadId, creatorId = null, ip = null, userAgent = null) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch Lead
    const [leadRows] = await connection.execute(
      `SELECT * FROM leads WHERE id = ? FOR UPDATE`,
      [leadId]
    );

    if (leadRows.length === 0) {
      const err = new Error("Lead not found.");
      err.statusCode = 404;
      err.code = "LEAD_NOT_FOUND";
      throw err;
    }

    const lead = leadRows[0];

    // Verify status: must be CONSULTATION_DONE
    if (lead.status !== "CONSULTATION_DONE") {
      const err = new Error(`Cannot convert lead with status ${lead.status}. Lead must complete consultation (CONSULTATION_DONE) before retention.`);
      err.statusCode = 400;
      err.code = "INVALID_LEAD_STATUS_FOR_CONVERSION";
      throw err;
    }

    // 2. Create Client using shared connection
    const client = await createClient(
      {
        contact_id: lead.contact_id,
        client_source: lead.source,
        notes: `Converted from Lead #${lead.id}: ${lead.notes || ""}`,
      },
      creatorId,
      ip,
      userAgent,
      connection
    );

    // 3. Update Lead status to RETAINED
    await connection.execute(
      `UPDATE leads 
       SET status = 'RETAINED', converted_client_id = ?, converted_at = NOW() 
       WHERE id = ?`,
      [client.id, leadId]
    );

    await connection.commit();

    await logCrmEvent(creatorId, "LEAD_CONVERTED", "LEAD", leadId, ip, userAgent, {
      clientId: client.id,
      clientCode: client.clientCode,
    });

    return {
      success: true,
      message: "Lead successfully converted to retained client.",
      client,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Add Activity to Lead (Call, Email, Meeting, etc.)
 */
const addLeadActivity = async (leadId, activityData, creatorId = null) => {
  const { activity_type, subject, description, activity_date } = activityData;

  if (!activity_type || !ALLOWED_ACTIVITY_TYPES.includes(activity_type)) {
    const err = new Error(`Invalid activity_type. Allowed: ${ALLOWED_ACTIVITY_TYPES.join(", ")}`);
    err.statusCode = 400;
    err.code = "INVALID_ACTIVITY_TYPE";
    throw err;
  }

  if (!subject) {
    const err = new Error("subject is required.");
    err.statusCode = 400;
    err.code = "MISSING_SUBJECT";
    throw err;
  }

  const query = `
    INSERT INTO lead_activities (lead_id, activity_type, subject, description, activity_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const [res] = await db.execute(query, [
    leadId,
    activity_type,
    subject.trim(),
    description ? description.trim() : null,
    activity_date ? new Date(activity_date) : new Date(),
    creatorId,
  ]);

  await logCrmEvent(creatorId, "LEAD_ACTIVITY_CREATED", "LEAD_ACTIVITY", res.insertId, null, null, {
    leadId,
    type: activity_type,
  });

  return { id: res.insertId, leadId, ...activityData, createdAt: new Date() };
};

module.exports = {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  convertLeadToClient,
  addLeadActivity,
};
