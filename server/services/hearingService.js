const db = require("../config/database");
const { logCaseEvent } = require("./auditService");
const { updateNextHearingDate } = require("./caseDateService");
const hearingReminderService = require("./whatsapp/hearingReminderService");

const ALLOWED_HEARING_STATUSES = ["SCHEDULED", "COMPLETED", "ADJOURNED", "CANCELLED"];

/**
 * List Hearings for a Case
 */
const getHearingsByCaseId = async (caseId, { date_from = "", date_to = "", status = "" } = {}) => {
  const whereClauses = ["ch.case_id = ?"];
  const params = [caseId];

  if (status && ALLOWED_HEARING_STATUSES.includes(status)) {
    whereClauses.push("ch.status = ?");
    params.push(status);
  }

  if (date_from) {
    whereClauses.push("ch.hearing_date >= ?");
    params.push(date_from);
  }

  if (date_to) {
    whereClauses.push("ch.hearing_date <= ?");
    params.push(date_to);
  }

  const query = `
    SELECT 
      ch.*,
      crt.name as court_name, crt.court_type, crt.city as court_city,
      u.first_name as creator_first, u.last_name as creator_last
    FROM case_hearings ch
    LEFT JOIN courts crt ON ch.court_id = crt.id
    LEFT JOIN users u ON ch.created_by = u.id
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY ch.hearing_date ASC, (ch.hearing_time IS NULL) ASC, ch.hearing_time ASC
  `;

  const [rows] = await db.execute(query, params);

  return rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    courtId: r.court_id,
    courtName: r.court_name,
    hearingDate: r.hearing_date,
    hearingTime: r.hearing_time,
    hearingType: r.hearing_type,
    courtroom: r.courtroom,
    judge: r.judge,
    purpose: r.purpose,
    status: r.status,
    remarks: r.remarks,
    source: r.source,
    createdBy: r.creator_first ? `${r.creator_first} ${r.creator_last}` : "Chambers",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};

/**
 * Get Hearing by ID
 */
const getHearingById = async (id) => {
  const query = `
    SELECT 
      ch.*,
      crt.name as court_name,
      cs.case_number, cs.title as case_title
    FROM case_hearings ch
    LEFT JOIN courts crt ON ch.court_id = crt.id
    JOIN cases cs ON ch.case_id = cs.id
    WHERE ch.id = ?
    LIMIT 1
  `;
  const [rows] = await db.execute(query, [id]);
  if (rows.length === 0) {
    const err = new Error("Hearing not found.");
    err.statusCode = 404;
    err.code = "HEARING_NOT_FOUND";
    throw err;
  }
  const r = rows[0];
  return {
    id: r.id,
    caseId: r.case_id,
    caseNumber: r.case_number,
    caseTitle: r.case_title,
    courtId: r.court_id,
    courtName: r.court_name,
    hearingDate: r.hearing_date,
    hearingTime: r.hearing_time,
    hearingType: r.hearing_type,
    courtroom: r.courtroom,
    judge: r.judge,
    purpose: r.purpose,
    status: r.status,
    remarks: r.remarks,
    source: r.source,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

/**
 * Create Hearing
 */
const createHearing = async (caseId, data, creatorId = null, ip = null, userAgent = null) => {
  const {
    court_id,
    hearing_date,
    hearing_time,
    hearing_type,
    courtroom,
    judge,
    purpose,
    status = "SCHEDULED",
    remarks,
  } = data;

  if (!hearing_date) {
    const err = new Error("Hearing date is required.");
    err.statusCode = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (!ALLOWED_HEARING_STATUSES.includes(status)) {
    const err = new Error(`Invalid hearing status: ${status}`);
    err.statusCode = 422;
    err.code = "INVALID_STATUS";
    throw err;
  }

  const query = `
    INSERT INTO case_hearings (
      case_id, court_id, hearing_date, hearing_time, hearing_type,
      courtroom, judge, purpose, status, remarks, source, created_by, updated_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', ?, ?)
  `;

  const [res] = await db.execute(query, [
    caseId,
    court_id || null,
    new Date(hearing_date),
    hearing_time || null,
    hearing_type || null,
    courtroom || null,
    judge || null,
    purpose || null,
    status,
    remarks || null,
    creatorId,
    creatorId,
  ]);

  const hearingId = res.insertId;

  // Synchronize next_hearing_date on cases table
  await updateNextHearingDate(caseId);

  // Automatically schedule WhatsApp hearing reminders if status is SCHEDULED
  if (status === "SCHEDULED") {
    try {
      await hearingReminderService.generateHearingReminders(hearingId, creatorId);
    } catch (err) {
      console.error("[HearingReminder] Automatic generation on create error:", err.message);
    }
  }

  await logCaseEvent(creatorId, "HEARING_CREATED", "HEARING", hearingId, ip, userAgent, {
    caseId,
    hearingDate: hearing_date,
    status,
  });

  return await getHearingById(hearingId);
};

/**
 * Update Hearing with Lifecycle Validation
 */
const updateHearing = async (id, updates, modifierId = null, ip = null, userAgent = null) => {
  const current = await getHearingById(id);

  const {
    court_id,
    hearing_date,
    hearing_time,
    hearing_type,
    courtroom,
    judge,
    purpose,
    status,
    remarks,
  } = updates;

  // Lifecycle check
  if (status && status !== current.status) {
    if (!ALLOWED_HEARING_STATUSES.includes(status)) {
      const err = new Error(`Invalid status: ${status}`);
      err.statusCode = 422;
      err.code = "INVALID_STATUS";
      throw err;
    }

    // Prohibit invalid transitions e.g. CANCELLED -> COMPLETED
    if (current.status === "CANCELLED" && status === "COMPLETED") {
      const err = new Error("Cannot transition a cancelled hearing directly to completed.");
      err.statusCode = 422;
      err.code = "INVALID_LIFECYCLE_TRANSITION";
      throw err;
    }
  }

  const setClauses = [];
  const params = [];

  if (court_id !== undefined) {
    setClauses.push("court_id = ?");
    params.push(court_id || null);
  }

  if (hearing_date !== undefined) {
    setClauses.push("hearing_date = ?");
    params.push(new Date(hearing_date));
  }

  if (hearing_time !== undefined) {
    setClauses.push("hearing_time = ?");
    params.push(hearing_time || null);
  }

  if (hearing_type !== undefined) {
    setClauses.push("hearing_type = ?");
    params.push(hearing_type || null);
  }

  if (courtroom !== undefined) {
    setClauses.push("courtroom = ?");
    params.push(courtroom || null);
  }

  if (judge !== undefined) {
    setClauses.push("judge = ?");
    params.push(judge || null);
  }

  if (purpose !== undefined) {
    setClauses.push("purpose = ?");
    params.push(purpose || null);
  }

  if (status !== undefined) {
    setClauses.push("status = ?");
    params.push(status);
  }

  if (remarks !== undefined) {
    setClauses.push("remarks = ?");
    params.push(remarks || null);
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_by = ?");
    params.push(modifierId);

    params.push(id);
    await db.execute(`UPDATE case_hearings SET ${setClauses.join(", ")} WHERE id = ?`, params);

    // Synchronize next_hearing_date
    await updateNextHearingDate(current.caseId);

    // Lifecycle reminder management:
    // If date/time changed: cancel old and reschedule new
    if (hearing_date !== undefined || hearing_time !== undefined) {
      try {
        await hearingReminderService.rescheduleHearingReminders(id, modifierId);
      } catch (err) {
        console.error("[HearingReminder] Reschedule hook error:", err.message);
      }
    } else if (status === "CANCELLED") {
      try {
        await hearingReminderService.cancelHearingReminders(id, "HEARING_CANCELLED", modifierId);
      } catch (err) {
        console.error("[HearingReminder] Cancel hook error:", err.message);
      }
    } else if (status === "COMPLETED") {
      try {
        await hearingReminderService.cancelHearingReminders(id, "HEARING_COMPLETED", modifierId);
      } catch (err) {
        console.error("[HearingReminder] Complete hook error:", err.message);
      }
    }

    await logCaseEvent(modifierId, "HEARING_UPDATED", "HEARING", id, ip, userAgent, updates);
  }

  return await getHearingById(id);
};

/**
 * Adjourn Hearing (Atomic MySQL Transaction)
 */
const adjournHearing = async (hearingId, { new_date, new_time, reason, requested_by }, modifierId = null, ip = null, userAgent = null) => {
  if (!new_date || !reason) {
    const err = new Error("New adjourned hearing date and reason are required.");
    err.statusCode = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const current = await getHearingById(hearingId);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Record Adjournment in case_adjournments
    const adjSql = `
      INSERT INTO case_adjournments (case_id, hearing_id, previous_date, new_date, reason, requested_by, approved_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [adjRes] = await connection.execute(adjSql, [
      current.caseId,
      hearingId,
      current.hearingDate,
      new Date(new_date),
      String(reason).trim(),
      requested_by || null,
      modifierId,
    ]);

    // 2. Update current hearing: Status ADJOURNED
    await connection.execute(
      `UPDATE case_hearings 
       SET status = 'ADJOURNED', remarks = CONCAT(COALESCE(remarks, ''), ' [Adjourned to: ', ?, '. Reason: ', ?, ']')
       WHERE id = ?`,
      [new_date, reason, hearingId]
    );

    // 3. Schedule next hearing record
    const nextHearingSql = `
      INSERT INTO case_hearings (
        case_id, court_id, hearing_date, hearing_time, hearing_type,
        courtroom, judge, purpose, status, remarks, source, created_by, updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, 'MANUAL', ?, ?)
    `;
    const [newHearingRes] = await connection.execute(nextHearingSql, [
      current.caseId,
      current.courtId,
      new Date(new_date),
      new_time || current.hearingTime || null,
      current.hearingType,
      current.courtroom,
      current.judge,
      `Adjourned from ${new Date(current.hearingDate).toLocaleDateString()}: ${current.purpose || 'Next step'}`,
      `Adjournment note: ${reason}`,
      modifierId,
      modifierId,
    ]);

    // 4. Synchronize next_hearing_date on cases table
    await updateNextHearingDate(current.caseId, connection);

    await connection.commit();

    // 5. Update WhatsApp Reminders for adjourned hearing and new hearing
    try {
      await hearingReminderService.cancelHearingReminders(hearingId, "HEARING_ADJOURNED", modifierId);
      await hearingReminderService.generateHearingReminders(newHearingRes.insertId, modifierId);
    } catch (err) {
      console.error("[HearingReminder] Adjournment reminder synchronization error:", err.message);
    }

    await logCaseEvent(modifierId, "CASE_ADJOURNED", "HEARING", hearingId, ip, userAgent, {
      caseId: current.caseId,
      previousDate: current.hearingDate,
      newDate: new_date,
      reason,
      adjournmentId: adjRes.insertId,
      newHearingId: newHearingRes.insertId,
    });

    const updatedCurrent = await getHearingById(hearingId);
    const newScheduled = await getHearingById(newHearingRes.insertId);

    return {
      adjournedHearing: updatedCurrent,
      newScheduledHearing: newScheduled,
      adjournmentId: adjRes.insertId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Delete / Cancel Hearing
 */
const deleteHearing = async (id, modifierId = null, ip = null, userAgent = null) => {
  const current = await getHearingById(id);
  await db.execute(`UPDATE case_hearings SET status = 'CANCELLED' WHERE id = ?`, [id]);
  await updateNextHearingDate(current.caseId);

  try {
    await hearingReminderService.cancelHearingReminders(id, "HEARING_CANCELLED", modifierId);
  } catch (err) {
    console.error("[HearingReminder] Cancellation hook error:", err.message);
  }

  await logCaseEvent(modifierId, "HEARING_CANCELLED", "HEARING", id, ip, userAgent);
  return { success: true, message: "Hearing marked as cancelled." };
};

module.exports = {
  getHearingsByCaseId,
  getHearingById,
  createHearing,
  updateHearing,
  adjournHearing,
  deleteHearing,
};
