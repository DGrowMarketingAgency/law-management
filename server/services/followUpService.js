const db = require("../config/database");
const { logCrmEvent } = require("./auditService");

const ALLOWED_TYPES = ["CALL", "WHATSAPP", "EMAIL", "MEETING", "PAYMENT", "OTHER"];
const ALLOWED_STATUSES = ["PENDING", "COMPLETED", "CANCELLED", "SKIPPED"];

/**
 * Create a new Follow-up
 */
const createFollowUp = async (data, creatorId = null, ip = null, userAgent = null) => {
  const {
    contact_id,
    client_id,
    lead_id,
    title,
    description,
    follow_up_type = "CALL",
    scheduled_for,
    assigned_to,
  } = data;

  if (!contact_id && !client_id && !lead_id) {
    const err = new Error("At least one related entity (contact_id, client_id, or lead_id) must be specified.");
    err.statusCode = 400;
    err.code = "MISSING_ENTITY_RELATION";
    throw err;
  }

  if (!title || String(title).trim().length === 0) {
    const err = new Error("Follow-up title is required.");
    err.statusCode = 400;
    err.code = "MISSING_TITLE";
    throw err;
  }

  if (!scheduled_for || isNaN(new Date(scheduled_for).getTime())) {
    const err = new Error("A valid scheduled_for date/time is required.");
    err.statusCode = 400;
    err.code = "INVALID_SCHEDULED_DATE";
    throw err;
  }

  if (!assigned_to) {
    const err = new Error("assigned_to is required.");
    err.statusCode = 400;
    err.code = "MISSING_ASSIGNED_USER";
    throw err;
  }

  if (!ALLOWED_TYPES.includes(follow_up_type)) {
    const err = new Error(`Invalid follow_up_type: ${follow_up_type}`);
    err.statusCode = 400;
    err.code = "INVALID_TYPE";
    throw err;
  }

  const query = `
    INSERT INTO follow_ups 
      (contact_id, client_id, lead_id, title, description, follow_up_type, status, scheduled_for, assigned_to, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
  `;

  const [res] = await db.execute(query, [
    contact_id || null,
    client_id || null,
    lead_id || null,
    title.trim(),
    description ? description.trim() : null,
    follow_up_type,
    new Date(scheduled_for),
    assigned_to,
    creatorId,
  ]);

  const followUpId = res.insertId;

  await logCrmEvent(creatorId, "FOLLOWUP_CREATED", "FOLLOW_UP", followUpId, ip, userAgent, {
    title,
    scheduledFor: scheduled_for,
    assignedTo: assigned_to,
  });

  return await getFollowUpById(followUpId);
};

/**
 * List Follow-ups
 */
const getFollowUps = async ({
  status = "",
  assigned_to = "",
  contact_id = "",
  client_id = "",
  lead_id = "",
  page = 1,
  limit = 20,
} = {}) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const whereClauses = [];
  const params = [];

  if (status && ALLOWED_STATUSES.includes(status)) {
    whereClauses.push("fu.status = ?");
    params.push(status);
  }

  if (assigned_to) {
    whereClauses.push("fu.assigned_to = ?");
    params.push(assigned_to);
  }

  if (contact_id) {
    whereClauses.push("fu.contact_id = ?");
    params.push(contact_id);
  }

  if (client_id) {
    whereClauses.push("fu.client_id = ?");
    params.push(client_id);
  }

  if (lead_id) {
    whereClauses.push("fu.lead_id = ?");
    params.push(lead_id);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countQuery = `SELECT COUNT(*) as total FROM follow_ups fu ${whereSql}`;
  const [countRows] = await db.execute(countQuery, params);
  const total = countRows[0]?.total || 0;
  const total_pages = Math.ceil(total / safeLimit);

  const query = `
    SELECT 
      fu.*,
      c.display_name as contact_name, c.email as contact_email, c.phone as contact_phone,
      cl.client_code,
      u.first_name as assigned_first, u.last_name as assigned_last
    FROM follow_ups fu
    LEFT JOIN contacts c ON fu.contact_id = c.id
    LEFT JOIN clients cl ON fu.client_id = cl.id
    JOIN users u ON fu.assigned_to = u.id
    ${whereSql}
    ORDER BY fu.scheduled_for ASC
    LIMIT ${safeLimit} OFFSET ${offset}
  `;

  const [rows] = await db.execute(query, params);

  const items = rows.map((r) => ({
    id: r.id,
    contactId: r.contact_id,
    clientId: r.client_id,
    leadId: r.lead_id,
    title: r.title,
    description: r.description,
    followUpType: r.follow_up_type,
    status: r.status,
    scheduledFor: r.scheduled_for,
    completedAt: r.completed_at,
    contactName: r.contact_name || null,
    clientCode: r.client_code || null,
    assignedTo: {
      id: r.assigned_to,
      name: `${r.assigned_first} ${r.assigned_last}`,
    },
    createdAt: r.created_at,
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
 * Get single Follow-up
 */
const getFollowUpById = async (id) => {
  const query = `
    SELECT 
      fu.*,
      c.display_name as contact_name, c.phone as contact_phone,
      cl.client_code,
      u.first_name as assigned_first, u.last_name as assigned_last
    FROM follow_ups fu
    LEFT JOIN contacts c ON fu.contact_id = c.id
    LEFT JOIN clients cl ON fu.client_id = cl.id
    JOIN users u ON fu.assigned_to = u.id
    WHERE fu.id = ?
    LIMIT 1
  `;

  const [rows] = await db.execute(query, [id]);
  if (!rows || rows.length === 0) {
    const err = new Error("Follow-up not found.");
    err.statusCode = 404;
    err.code = "FOLLOWUP_NOT_FOUND";
    throw err;
  }

  const r = rows[0];
  return {
    id: r.id,
    contactId: r.contact_id,
    clientId: r.client_id,
    leadId: r.lead_id,
    title: r.title,
    description: r.description,
    followUpType: r.follow_up_type,
    status: r.status,
    scheduledFor: r.scheduled_for,
    completedAt: r.completed_at,
    contactName: r.contact_name,
    clientCode: r.client_code,
    assignedTo: {
      id: r.assigned_to,
      name: `${r.assigned_first} ${r.assigned_last}`,
    },
    createdAt: r.created_at,
  };
};

/**
 * Update Follow-up
 */
const updateFollowUp = async (id, updates, modifierId = null, ip = null, userAgent = null) => {
  const current = await getFollowUpById(id);

  const { title, description, follow_up_type, status, scheduled_for, assigned_to } = updates;

  const setClauses = [];
  const params = [];

  if (title !== undefined) {
    setClauses.push("title = ?");
    params.push(String(title).trim());
  }

  if (description !== undefined) {
    setClauses.push("description = ?");
    params.push(description ? String(description).trim() : null);
  }

  if (follow_up_type !== undefined) {
    if (!ALLOWED_TYPES.includes(follow_up_type)) {
      const err = new Error(`Invalid follow_up_type: ${follow_up_type}`);
      err.statusCode = 400;
      err.code = "INVALID_TYPE";
      throw err;
    }
    setClauses.push("follow_up_type = ?");
    params.push(follow_up_type);
  }

  if (scheduled_for !== undefined) {
    setClauses.push("scheduled_for = ?");
    params.push(new Date(scheduled_for));
  }

  if (assigned_to !== undefined) {
    setClauses.push("assigned_to = ?");
    params.push(assigned_to);
  }

  if (status !== undefined) {
    if (!ALLOWED_STATUSES.includes(status)) {
      const err = new Error(`Invalid status: ${status}`);
      err.statusCode = 400;
      err.code = "INVALID_STATUS";
      throw err;
    }
    setClauses.push("status = ?");
    params.push(status);

    // Automatic completed_at management
    if (status === "COMPLETED" && current.status !== "COMPLETED") {
      setClauses.push("completed_at = NOW()");
    } else if (status !== "COMPLETED" && current.status === "COMPLETED") {
      setClauses.push("completed_at = NULL");
    }
  }

  if (setClauses.length === 0) {
    return current;
  }

  params.push(id);
  await db.execute(`UPDATE follow_ups SET ${setClauses.join(", ")} WHERE id = ?`, params);

  await logCrmEvent(modifierId, "FOLLOWUP_UPDATED", "FOLLOW_UP", id, ip, userAgent, updates);

  return await getFollowUpById(id);
};

/**
 * Delete Follow-up
 */
const deleteFollowUp = async (id, modifierId = null, ip = null, userAgent = null) => {
  await db.execute(`DELETE FROM follow_ups WHERE id = ?`, [id]);
  await logCrmEvent(modifierId, "FOLLOWUP_DELETED", "FOLLOW_UP", id, ip, userAgent);
  return { success: true };
};

/**
 * Follow-up Dashboard (SQL Aggregation by Today, Overdue, Upcoming, Completed)
 */
const getFollowUpsDashboard = async (userId = null, isOwner = false) => {
  let userFilter = "";
  const params = [];

  if (!isOwner && userId) {
    userFilter = "AND fu.assigned_to = ?";
    params.push(userId);
  }

  // 1. Today's Pending Follow-ups
  const [todayRows] = await db.execute(
    `SELECT fu.*, c.display_name as contact_name, u.first_name as assigned_first, u.last_name as assigned_last
     FROM follow_ups fu
     LEFT JOIN contacts c ON fu.contact_id = c.id
     JOIN users u ON fu.assigned_to = u.id
     WHERE fu.status = 'PENDING' AND DATE(fu.scheduled_for) = CURDATE() ${userFilter}
     ORDER BY fu.scheduled_for ASC`,
    params
  );

  // 2. Overdue Pending Follow-ups (scheduled before today)
  const [overdueRows] = await db.execute(
    `SELECT fu.*, c.display_name as contact_name, u.first_name as assigned_first, u.last_name as assigned_last
     FROM follow_ups fu
     LEFT JOIN contacts c ON fu.contact_id = c.id
     JOIN users u ON fu.assigned_to = u.id
     WHERE fu.status = 'PENDING' AND DATE(fu.scheduled_for) < CURDATE() ${userFilter}
     ORDER BY fu.scheduled_for ASC`,
    params
  );

  // 3. Upcoming Pending Follow-ups (next 7 days)
  const [upcomingRows] = await db.execute(
    `SELECT fu.*, c.display_name as contact_name, u.first_name as assigned_first, u.last_name as assigned_last
     FROM follow_ups fu
     LEFT JOIN contacts c ON fu.contact_id = c.id
     JOIN users u ON fu.assigned_to = u.id
     WHERE fu.status = 'PENDING' AND DATE(fu.scheduled_for) > CURDATE() AND DATE(fu.scheduled_for) <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) ${userFilter}
     ORDER BY fu.scheduled_for ASC`,
    params
  );

  // 4. Recently Completed
  const [completedRows] = await db.execute(
    `SELECT fu.*, c.display_name as contact_name, u.first_name as assigned_first, u.last_name as assigned_last
     FROM follow_ups fu
     LEFT JOIN contacts c ON fu.contact_id = c.id
     JOIN users u ON fu.assigned_to = u.id
     WHERE fu.status = 'COMPLETED' ${userFilter}
     ORDER BY fu.completed_at DESC LIMIT 10`,
    params
  );

  const formatItem = (r) => ({
    id: r.id,
    contactId: r.contact_id,
    clientId: r.client_id,
    leadId: r.lead_id,
    title: r.title,
    description: r.description,
    followUpType: r.follow_up_type,
    status: r.status,
    scheduledFor: r.scheduled_for,
    completedAt: r.completed_at,
    contactName: r.contact_name,
    assignedToName: `${r.assigned_first} ${r.assigned_last}`,
  });

  return {
    today: todayRows.map(formatItem),
    overdue: overdueRows.map(formatItem),
    upcoming: upcomingRows.map(formatItem),
    completed: completedRows.map(formatItem),
    summary: {
      todayCount: todayRows.length,
      overdueCount: overdueRows.length,
      upcomingCount: upcomingRows.length,
      completedCount: completedRows.length,
    },
  };
};

/**
 * Complete Follow-up
 */
const completeFollowUp = async (id, outcomeNotes = null, modifierId = null, ip = null, userAgent = null) => {
  const current = await getFollowUpById(id);
  const updatedDesc = outcomeNotes 
    ? (current.description ? `${current.description}\n[Outcome]: ${outcomeNotes}` : `[Outcome]: ${outcomeNotes}`)
    : current.description;

  await db.execute(
    `UPDATE follow_ups SET status = 'COMPLETED', completed_at = NOW(), description = ? WHERE id = ?`,
    [updatedDesc, id]
  );

  await logCrmEvent(modifierId, "FOLLOWUP_COMPLETED", "FOLLOW_UP", id, ip, userAgent, { outcomeNotes });
  return await getFollowUpById(id);
};

module.exports = {
  createFollowUp,
  getFollowUps,
  getFollowUpById,
  updateFollowUp,
  completeFollowUp,
  deleteFollowUp,
  getFollowUpsDashboard,
};
