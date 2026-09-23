const db = require("../config/database");
const { logCrmEvent } = require("./auditService");

const ALLOWED_APPOINTMENT_TYPES = ["CONSULTATION", "CLIENT_MEETING", "COURT_RELATED", "OTHER"];
const ALLOWED_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"];

/**
 * Check if the assigned user has an overlapping scheduled appointment on that date
 * Overlap condition: (new_start < existing_end) AND (new_end > existing_start)
 */
const checkAppointmentConflict = async (assignedTo, appointmentDate, startTime, endTime, excludeId = null) => {
  let excludeSql = "";
  const params = [assignedTo, appointmentDate, startTime, endTime];

  if (excludeId) {
    excludeSql = "AND id != ?";
    params.push(excludeId);
  }

  const query = `
    SELECT id, title, appointment_date, start_time, end_time
    FROM appointments
    WHERE assigned_to = ? 
      AND appointment_date = ? 
      AND status NOT IN ('CANCELLED')
      AND (? < end_time AND ? > start_time)
      ${excludeSql}
    LIMIT 1
  `;

  const [rows] = await db.execute(query, params);
  return rows[0] || null;
};

/**
 * Create a new Appointment
 */
const createAppointment = async (data, creatorId = null, ip = null, userAgent = null) => {
  const {
    contact_id,
    client_id,
    title,
    appointment_type = "CONSULTATION",
    appointment_date,
    start_time,
    end_time,
    location,
    description,
    assigned_to,
  } = data;

  if (!title || !appointment_date || !start_time || !end_time || !assigned_to) {
    const err = new Error("Title, appointment_date, start_time, end_time, and assigned_to are required.");
    err.statusCode = 400;
    err.code = "MISSING_REQUIRED_FIELDS";
    throw err;
  }

  // Validate start_time < end_time
  if (start_time >= end_time) {
    const err = new Error("end_time must be strictly greater than start_time.");
    err.statusCode = 400;
    err.code = "INVALID_TIME_RANGE";
    throw err;
  }

  if (!ALLOWED_APPOINTMENT_TYPES.includes(appointment_type)) {
    const err = new Error(`Invalid appointment_type: ${appointment_type}`);
    err.statusCode = 400;
    err.code = "INVALID_TYPE";
    throw err;
  }

  // Conflict Check
  const conflict = await checkAppointmentConflict(assigned_to, appointment_date, start_time, end_time);
  if (conflict) {
    const err = new Error("Assigned advocate already has an overlapping appointment during this time window.");
    err.statusCode = 409;
    err.code = "APPOINTMENT_CONFLICT";
    err.details = {
      conflictingAppointmentId: conflict.id,
      title: conflict.title,
      startTime: conflict.start_time,
      endTime: conflict.end_time,
    };
    throw err;
  }

  const query = `
    INSERT INTO appointments 
      (contact_id, client_id, title, appointment_type, status, appointment_date, start_time, end_time, location, description, assigned_to, created_by)
    VALUES (?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?)
  `;

  const [res] = await db.execute(query, [
    contact_id || null,
    client_id || null,
    title.trim(),
    appointment_type,
    appointment_date,
    start_time,
    end_time,
    location ? location.trim() : null,
    description ? description.trim() : null,
    assigned_to,
    creatorId,
  ]);

  const appointmentId = res.insertId;

  await logCrmEvent(creatorId, "APPOINTMENT_CREATED", "APPOINTMENT", appointmentId, ip, userAgent, {
    title,
    date: appointment_date,
    assignedTo: assigned_to,
  });

  return await getAppointmentById(appointmentId);
};

/**
 * List Appointments with date, assigned user, status filters, and pagination
 */
const getAppointments = async ({
  date = "",
  start_date = "",
  end_date = "",
  assigned_to = "",
  status = "",
  page = 1,
  limit = 20,
} = {}) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const whereClauses = [];
  const params = [];

  if (date) {
    whereClauses.push("a.appointment_date = ?");
    params.push(date);
  }

  if (start_date) {
    whereClauses.push("a.appointment_date >= ?");
    params.push(start_date);
  }

  if (end_date) {
    whereClauses.push("a.appointment_date <= ?");
    params.push(end_date);
  }

  if (assigned_to) {
    whereClauses.push("a.assigned_to = ?");
    params.push(assigned_to);
  }

  if (status && ALLOWED_STATUSES.includes(status)) {
    whereClauses.push("a.status = ?");
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countQuery = `SELECT COUNT(*) as total FROM appointments a ${whereSql}`;
  const [countRows] = await db.execute(countQuery, params);
  const total = countRows[0]?.total || 0;
  const total_pages = Math.ceil(total / safeLimit);

  const query = `
    SELECT 
      a.*,
      c.display_name as contact_name, c.phone as contact_phone,
      cl.client_code,
      u.first_name as assigned_first, u.last_name as assigned_last
    FROM appointments a
    LEFT JOIN contacts c ON a.contact_id = c.id
    LEFT JOIN clients cl ON a.client_id = cl.id
    JOIN users u ON a.assigned_to = u.id
    ${whereSql}
    ORDER BY a.appointment_date ASC, a.start_time ASC
    LIMIT ${safeLimit} OFFSET ${offset}
  `;

  const [rows] = await db.execute(query, params);

  const items = rows.map((r) => ({
    id: r.id,
    contactId: r.contact_id,
    clientId: r.client_id,
    title: r.title,
    appointmentType: r.appointment_type,
    status: r.status,
    appointmentDate: r.appointment_date,
    startTime: r.start_time,
    endTime: r.end_time,
    location: r.location,
    description: r.description,
    contactName: r.contact_name,
    clientCode: r.client_code,
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
 * Get single Appointment
 */
const getAppointmentById = async (id) => {
  const query = `
    SELECT 
      a.*,
      c.display_name as contact_name, c.phone as contact_phone,
      cl.client_code,
      u.first_name as assigned_first, u.last_name as assigned_last
    FROM appointments a
    LEFT JOIN contacts c ON a.contact_id = c.id
    LEFT JOIN clients cl ON a.client_id = cl.id
    JOIN users u ON a.assigned_to = u.id
    WHERE a.id = ?
    LIMIT 1
  `;

  const [rows] = await db.execute(query, [id]);
  if (!rows || rows.length === 0) {
    const err = new Error("Appointment not found.");
    err.statusCode = 404;
    err.code = "APPOINTMENT_NOT_FOUND";
    throw err;
  }

  const r = rows[0];
  return {
    id: r.id,
    contactId: r.contact_id,
    clientId: r.client_id,
    title: r.title,
    appointmentType: r.appointment_type,
    status: r.status,
    appointmentDate: r.appointment_date,
    startTime: r.start_time,
    endTime: r.end_time,
    location: r.location,
    description: r.description,
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
 * Update Appointment
 */
const updateAppointment = async (id, updates, modifierId = null, ip = null, userAgent = null) => {
  const current = await getAppointmentById(id);

  const {
    title,
    appointment_type,
    status,
    appointment_date,
    start_time,
    end_time,
    location,
    description,
    assigned_to,
  } = updates;

  const targetDate = appointment_date || current.appointmentDate;
  const targetStart = start_time || current.startTime;
  const targetEnd = end_time || current.endTime;
  const targetAssigned = assigned_to || current.assignedTo.id;

  if (targetStart >= targetEnd) {
    const err = new Error("end_time must be strictly greater than start_time.");
    err.statusCode = 400;
    err.code = "INVALID_TIME_RANGE";
    throw err;
  }

  // Conflict Check if date, time, or assigned advocate is modified
  if (
    appointment_date !== undefined ||
    start_time !== undefined ||
    end_time !== undefined ||
    assigned_to !== undefined
  ) {
    const conflict = await checkAppointmentConflict(targetAssigned, targetDate, targetStart, targetEnd, id);
    if (conflict) {
      const err = new Error("Assigned advocate already has an overlapping appointment during this updated time window.");
      err.statusCode = 409;
      err.code = "APPOINTMENT_CONFLICT";
      throw err;
    }
  }

  const setClauses = [];
  const params = [];

  if (title !== undefined) {
    setClauses.push("title = ?");
    params.push(String(title).trim());
  }

  if (appointment_type !== undefined) {
    if (!ALLOWED_APPOINTMENT_TYPES.includes(appointment_type)) {
      const err = new Error(`Invalid appointment_type: ${appointment_type}`);
      err.statusCode = 400;
      err.code = "INVALID_TYPE";
      throw err;
    }
    setClauses.push("appointment_type = ?");
    params.push(appointment_type);
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
  }

  if (appointment_date !== undefined) {
    setClauses.push("appointment_date = ?");
    params.push(appointment_date);
  }

  if (start_time !== undefined) {
    setClauses.push("start_time = ?");
    params.push(start_time);
  }

  if (end_time !== undefined) {
    setClauses.push("end_time = ?");
    params.push(end_time);
  }

  if (location !== undefined) {
    setClauses.push("location = ?");
    params.push(location ? String(location).trim() : null);
  }

  if (description !== undefined) {
    setClauses.push("description = ?");
    params.push(description ? String(description).trim() : null);
  }

  if (assigned_to !== undefined) {
    setClauses.push("assigned_to = ?");
    params.push(assigned_to);
  }

  if (setClauses.length === 0) {
    return current;
  }

  params.push(id);
  await db.execute(`UPDATE appointments SET ${setClauses.join(", ")} WHERE id = ?`, params);

  await logCrmEvent(modifierId, "APPOINTMENT_UPDATED", "APPOINTMENT", id, ip, userAgent, updates);

  return await getAppointmentById(id);
};

/**
 * Delete Appointment
 */
const deleteAppointment = async (id, modifierId = null, ip = null, userAgent = null) => {
  await db.execute(`DELETE FROM appointments WHERE id = ?`, [id]);
  await logCrmEvent(modifierId, "APPOINTMENT_DELETED", "APPOINTMENT", id, ip, userAgent);
  return { success: true };
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  checkAppointmentConflict,
};
