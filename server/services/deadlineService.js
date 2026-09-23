const db = require("../config/database");
const {
  isValidDateString,
  getTodayDateString,
  diffCalendarDays,
} = require("../utils/dateUtils");
const {
  calculateDeadline,
  determineDeadlineStatus,
  MANDATORY_DISCLAIMER,
} = require("./limitationService");
const {
  scheduleDeadlineAlerts,
  regenerateAlertsOnOverride,
} = require("./deadlineAlertService");
const { getRuleById } = require("./deadlineRuleService");
const { logCaseEvent } = require("./auditService");
const { getUserPermissions } = require("./authorizationService");

/**
 * Get all deadlines for a case with filtering and pagination
 * @param {number} caseId
 * @param {object} filters
 */
const getCaseDeadlines = async (caseId, filters = {}) => {
  const { status, priority, limit = 50, offset = 0 } = filters;
  const where = ["cd.case_id = ?"];
  const params = [caseId];

  if (status) {
    where.push("cd.status = ?");
    params.push(status);
  }

  if (priority) {
    where.push("cd.priority = ?");
    params.push(priority);
  }

  const whereClause = `WHERE ${where.join(" AND ")}`;

  const [rows] = await db.query(
    `SELECT 
       cd.*,
       dr.act_name,
       dr.article_reference,
       dr.section_reference,
       dr.proceeding_type,
       CONCAT(u_ob.first_name, ' ', u_ob.last_name) AS overridden_by_name,
       CONCAT(u_cb.first_name, ' ', u_cb.last_name) AS completed_by_name,
       CONCAT(u_wb.first_name, ' ', u_wb.last_name) AS waived_by_name
     FROM case_deadlines cd
     LEFT JOIN deadline_rules dr ON cd.deadline_rule_id = dr.id
     LEFT JOIN users u_ob ON cd.overridden_by = u_ob.id
     LEFT JOIN users u_cb ON cd.completed_by = u_cb.id
     LEFT JOIN users u_wb ON cd.waived_by = u_wb.id
     ${whereClause}
     ORDER BY cd.effective_deadline ASC, cd.id DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit, 10), parseInt(offset, 10)]
  );

  const [countResult] = await db.query(
    `SELECT COUNT(*) AS total FROM case_deadlines cd ${whereClause}`,
    params
  );

  return {
    deadlines: rows.map((r) => ({
      ...r,
      disclaimer: MANDATORY_DISCLAIMER,
    })),
    total: countResult[0]?.total || 0,
    disclaimer: MANDATORY_DISCLAIMER,
  };
};

/**
 * Get single deadline by case and deadline ID
 * @param {number} caseId
 * @param {number} deadlineId
 */
const getDeadlineById = async (caseId, deadlineId) => {
  const [rows] = await db.execute(
    `SELECT 
       cd.*,
       dr.act_name,
       dr.article_reference,
       dr.section_reference,
       dr.proceeding_type,
       dr.exclusion_notes,
       c.case_number,
       c.title AS case_title,
       CONCAT(u_ob.first_name, ' ', u_ob.last_name) AS overridden_by_name,
       CONCAT(u_cb.first_name, ' ', u_cb.last_name) AS completed_by_name,
       CONCAT(u_wb.first_name, ' ', u_wb.last_name) AS waived_by_name
     FROM case_deadlines cd
     JOIN cases c ON cd.case_id = c.id
     LEFT JOIN deadline_rules dr ON cd.deadline_rule_id = dr.id
     LEFT JOIN users u_ob ON cd.overridden_by = u_ob.id
     LEFT JOIN users u_cb ON cd.completed_by = u_cb.id
     LEFT JOIN users u_wb ON cd.waived_by = u_wb.id
     WHERE cd.case_id = ? AND cd.id = ?`,
    [caseId, deadlineId]
  );

  if (!rows.length) return null;

  const deadline = rows[0];

  // Fetch alert schedule
  const [alerts] = await db.execute(
    `SELECT * FROM deadline_alerts WHERE deadline_id = ? ORDER BY scheduled_for ASC`,
    [deadlineId]
  );

  return {
    ...deadline,
    alerts,
    disclaimer: MANDATORY_DISCLAIMER,
  };
};

/**
 * Create a case limitation deadline (Rule-based calculation or Manual entry)
 * Executed in a database transaction.
 * @param {number} caseId
 * @param {object} data
 * @param {number} userId
 */
const createCaseDeadline = async (caseId, data, userId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      deadline_rule_id,
      title,
      trigger_type = "CAUSE_OF_ACTION",
      trigger_date,
      priority = "HIGH",
      notes = "",
      is_manual = false,
      manual_deadline,
      manual_reason,
    } = data;

    let calculatedDeadline = null;
    let effectiveDeadline = null;
    let calculationSnapshot = null;
    let calculationMethod = null;
    let status = "UPCOMING";
    let ruleRecord = null;

    if (is_manual || !deadline_rule_id) {
      // Manual Fallback Entry
      if (!manual_deadline || !isValidDateString(manual_deadline)) {
        throw new Error("A valid manual deadline date (YYYY-MM-DD) is required when creating a manual deadline.");
      }
      if (!manual_reason || manual_reason.trim() === "") {
        throw new Error("A justification / reason is mandatory for manual deadline entries.");
      }

      effectiveDeadline = manual_deadline;
      calculationMethod = "MANUAL_ENTRY";
      status = "MANUAL_REVIEW_REQUIRED";
      calculationSnapshot = {
        mode: "MANUAL_ENTRY",
        manual_deadline,
        manual_reason,
        entered_by: userId,
        entered_at: new Date().toISOString(),
      };
    } else {
      // Rule-based Calculation
      ruleRecord = await getRuleById(deadline_rule_id);
      if (!ruleRecord) {
        throw new Error("Applicable limitation rule not configured. Manual deadline entry is required.");
      }

      const calcResult = calculateDeadline(trigger_date, ruleRecord, notes);
      calculatedDeadline = calcResult.calculated_deadline;
      effectiveDeadline = calcResult.calculated_deadline;
      calculationSnapshot = calcResult.calculation_snapshot;
      calculationMethod = calcResult.calculation_method;
      status = determineDeadlineStatus(effectiveDeadline, false, false, false);
    }

    const deadlineTitle =
      title ||
      (ruleRecord
        ? `${ruleRecord.act_name} - ${ruleRecord.proceeding_type}`
        : "Manual Limitation Deadline");

    const [insertResult] = await conn.execute(
      `INSERT INTO case_deadlines (
        case_id, deadline_rule_id, title, trigger_type, trigger_date,
        calculated_deadline, overridden_deadline, effective_deadline,
        is_manual_override, calculation_snapshot, calculation_method,
        status, priority, is_manual, manual_reason, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, FALSE, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        deadline_rule_id || null,
        deadlineTitle,
        trigger_type,
        trigger_date,
        calculatedDeadline,
        effectiveDeadline,
        JSON.stringify(calculationSnapshot),
        calculationMethod,
        status,
        priority,
        is_manual ? 1 : 0,
        manual_reason || null,
        notes || null,
        userId,
      ]
    );

    const deadlineId = insertResult.insertId;

    // Schedule 30/15/7/1-day alerts
    await scheduleDeadlineAlerts(conn, deadlineId, effectiveDeadline, userId);

    // Audit log
    await logCaseEvent(
      userId,
      "DEADLINE_CREATED",
      "CASE_DEADLINE",
      deadlineId,
      null,
      null,
      {
        caseId,
        deadlineId,
        effectiveDeadline,
        calculationMethod,
        isManual: is_manual,
      }
    );

    await conn.commit();

    return await getDeadlineById(caseId, deadlineId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Manually override a case deadline
 * Preserves original calculation snapshot and calculated deadline.
 * Cancels old pending alerts and regenerates new alerts.
 * @param {number} caseId
 * @param {number} deadlineId
 * @param {object} overrideData
 * @param {number} userId
 */
const overrideCaseDeadline = async (caseId, deadlineId, overrideData, userId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { override_deadline, reason, notes } = overrideData;

    if (!override_deadline || !isValidDateString(override_deadline)) {
      throw new Error("A valid override deadline (YYYY-MM-DD) is required.");
    }

    if (!reason || reason.trim() === "") {
      throw new Error("A professional legal justification / reason is mandatory for manual overrides.");
    }

    const [existingRows] = await conn.execute(
      `SELECT * FROM case_deadlines WHERE case_id = ? AND id = ?`,
      [caseId, deadlineId]
    );

    if (!existingRows.length) {
      throw new Error("Case deadline not found.");
    }

    const existing = existingRows[0];

    if (existing.status === "COMPLETED" || existing.status === "WAIVED") {
      throw new Error(`Cannot override a deadline with status ${existing.status}.`);
    }

    const newStatus = determineDeadlineStatus(override_deadline, false, false, false);

    await conn.execute(
      `UPDATE case_deadlines SET
        overridden_deadline = ?,
        effective_deadline = ?,
        is_manual_override = TRUE,
        override_reason = ?,
        overridden_by = ?,
        overridden_at = NOW(),
        status = ?,
        notes = COALESCE(?, notes),
        updated_by = ?
       WHERE id = ?`,
      [
        override_deadline,
        override_deadline,
        reason,
        userId,
        newStatus,
        notes || null,
        userId,
        deadlineId,
      ]
    );

    // Cancel old pending alerts and schedule new ones
    await regenerateAlertsOnOverride(conn, deadlineId, override_deadline, userId);

    // Audit log
    await logCaseEvent(
      userId,
      "DEADLINE_OVERRIDDEN",
      "CASE_DEADLINE",
      deadlineId,
      null,
      null,
      {
        caseId,
        deadlineId,
        previousEffective: existing.effective_deadline,
        newEffective: override_deadline,
        reason,
      }
    );

    await conn.commit();

    return await getDeadlineById(caseId, deadlineId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Mark a deadline as COMPLETED
 * @param {number} caseId
 * @param {number} deadlineId
 * @param {object} completionData
 * @param {number} userId
 */
const completeCaseDeadline = async (caseId, deadlineId, completionData, userId) => {
  const [existingRows] = await db.execute(
    `SELECT * FROM case_deadlines WHERE case_id = ? AND id = ?`,
    [caseId, deadlineId]
  );

  if (!existingRows.length) {
    throw new Error("Case deadline not found.");
  }

  const existing = existingRows[0];
  if (existing.status === "COMPLETED") {
    throw new Error("Deadline is already marked as completed.");
  }

  const { completed_at, notes } = completionData;
  const completedDate = completed_at && isValidDateString(completed_at) ? completed_at : getTodayDateString();

  await db.execute(
    `UPDATE case_deadlines SET
      status = 'COMPLETED',
      completed_at = ?,
      completed_by = ?,
      completion_notes = ?,
      updated_by = ?
     WHERE id = ?`,
    [completedDate, userId, notes || null, userId, deadlineId]
  );

  // Cancel any remaining PENDING alerts
  await db.execute(
    `UPDATE deadline_alerts SET status = 'CANCELLED' WHERE deadline_id = ? AND status = 'PENDING'`,
    [deadlineId]
  );

  await logCaseEvent(userId, "DEADLINE_COMPLETED", "CASE_DEADLINE", deadlineId, null, null, {
    caseId,
    deadlineId,
    completedAt: completedDate,
    notes,
  });

  return await getDeadlineById(caseId, deadlineId);
};

/**
 * Waive a deadline with mandatory justification
 * @param {number} caseId
 * @param {number} deadlineId
 * @param {object} waiverData
 * @param {number} userId
 */
const waiveCaseDeadline = async (caseId, deadlineId, waiverData, userId) => {
  const { reason } = waiverData;
  if (!reason || reason.trim() === "") {
    throw new Error("A justification reason is mandatory to waive a limitation deadline.");
  }

  const [existingRows] = await db.execute(
    `SELECT * FROM case_deadlines WHERE case_id = ? AND id = ?`,
    [caseId, deadlineId]
  );

  if (!existingRows.length) {
    throw new Error("Case deadline not found.");
  }

  const existing = existingRows[0];
  if (existing.status === "WAIVED") {
    throw new Error("Deadline is already marked as waived.");
  }

  await db.execute(
    `UPDATE case_deadlines SET
      status = 'WAIVED',
      waived_at = NOW(),
      waived_by = ?,
      waiver_reason = ?,
      updated_by = ?
     WHERE id = ?`,
    [userId, reason, userId, deadlineId]
  );

  // Cancel any remaining PENDING alerts
  await db.execute(
    `UPDATE deadline_alerts SET status = 'CANCELLED' WHERE deadline_id = ? AND status = 'PENDING'`,
    [deadlineId]
  );

  await logCaseEvent(userId, "DEADLINE_WAIVED", "CASE_DEADLINE", deadlineId, null, null, {
    caseId,
    deadlineId,
    waiverReason: reason,
  });

  return await getDeadlineById(caseId, deadlineId);
};

/**
 * Get comprehensive chambers deadlines dashboard
 * Scoped strictly by case-level RBAC for Junior Associates.
 * @param {number} userId
 * @param {object} filters
 */
const getDeadlinesDashboard = async (userId, filters = {}) => {
  const { roles, permissions, isOwner } = await getUserPermissions(userId);

  let caseAccessJoin = "";
  const queryParams = [];

  // Junior Associate is scoped strictly to assigned cases
  if (!isOwner && !roles.includes("SENIOR_ASSOCIATE")) {
    caseAccessJoin = `JOIN case_assignments ca ON ca.case_id = cd.case_id AND ca.user_id = ? AND ca.is_active = TRUE`;
    queryParams.push(userId);
  }

  const today = getTodayDateString();

  // Metrics aggregation query
  const [metricsRows] = await db.query(
    `SELECT
       COUNT(*) AS total_deadlines,
       SUM(CASE WHEN cd.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
       SUM(CASE WHEN cd.status = 'WAIVED' THEN 1 ELSE 0 END) AS waived_count,
       SUM(CASE WHEN cd.status = 'MANUAL_REVIEW_REQUIRED' THEN 1 ELSE 0 END) AS manual_review_count,
       SUM(CASE WHEN cd.status NOT IN ('COMPLETED', 'WAIVED') AND cd.effective_deadline < ? THEN 1 ELSE 0 END) AS overdue_count,
       SUM(CASE WHEN cd.status NOT IN ('COMPLETED', 'WAIVED') AND cd.effective_deadline = ? THEN 1 ELSE 0 END) AS due_today_count,
       SUM(CASE WHEN cd.status NOT IN ('COMPLETED', 'WAIVED') AND cd.effective_deadline > ? AND cd.effective_deadline <= DATE_ADD(?, INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS due_7_days_count,
       SUM(CASE WHEN cd.status NOT IN ('COMPLETED', 'WAIVED') AND cd.effective_deadline > ? AND cd.effective_deadline <= DATE_ADD(?, INTERVAL 15 DAY) THEN 1 ELSE 0 END) AS due_15_days_count,
       SUM(CASE WHEN cd.status NOT IN ('COMPLETED', 'WAIVED') AND cd.effective_deadline > ? AND cd.effective_deadline <= DATE_ADD(?, INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS due_30_days_count
     FROM case_deadlines cd
     JOIN cases c ON cd.case_id = c.id
     ${caseAccessJoin}`,
    [
      ...queryParams,
      today,
      today,
      today,
      today,
      today,
      today,
      today,
      today,
    ]
  );

  // Urgent upcoming & overdue list (Top 25)
  const [urgentRows] = await db.query(
    `SELECT 
       cd.*,
       c.case_number,
       c.title AS case_title,
       ct.name AS court_name,
       dr.act_name,
       dr.article_reference,
       dr.proceeding_type
     FROM case_deadlines cd
     JOIN cases c ON cd.case_id = c.id
     LEFT JOIN courts ct ON c.court_id = ct.id
     LEFT JOIN deadline_rules dr ON cd.deadline_rule_id = dr.id
     ${caseAccessJoin}
     WHERE cd.status NOT IN ('COMPLETED', 'WAIVED')
     ORDER BY cd.effective_deadline ASC, cd.priority DESC
     LIMIT 25`,
    queryParams
  );

  // Breakdown by Court
  const [courtBreakdown] = await db.query(
    `SELECT 
       ct.id AS court_id,
       ct.name AS court_name,
       COUNT(cd.id) AS deadline_count
     FROM case_deadlines cd
     JOIN cases c ON cd.case_id = c.id
     JOIN courts ct ON c.court_id = ct.id
     ${caseAccessJoin}
     WHERE cd.status NOT IN ('COMPLETED', 'WAIVED')
     GROUP BY ct.id, ct.name
     ORDER BY deadline_count DESC`,
    queryParams
  );

  const metrics = metricsRows[0] || {};

  return {
    metrics: {
      total: parseInt(metrics.total_deadlines || 0, 10),
      dueToday: parseInt(metrics.due_today_count || 0, 10),
      due7Days: parseInt(metrics.due_7_days_count || 0, 10),
      due15Days: parseInt(metrics.due_15_days_count || 0, 10),
      due30Days: parseInt(metrics.due_30_days_count || 0, 10),
      overdue: parseInt(metrics.overdue_count || 0, 10),
      manualReviewRequired: parseInt(metrics.manual_review_count || 0, 10),
      completed: parseInt(metrics.completed_count || 0, 10),
      waived: parseInt(metrics.waived_count || 0, 10),
    },
    urgentDeadlines: urgentRows.map((r) => ({
      ...r,
      disclaimer: MANDATORY_DISCLAIMER,
    })),
    courtBreakdown,
    disclaimer: MANDATORY_DISCLAIMER,
  };
};

module.exports = {
  getCaseDeadlines,
  getDeadlineById,
  createCaseDeadline,
  overrideCaseDeadline,
  completeCaseDeadline,
  waiveCaseDeadline,
  getDeadlinesDashboard,
};
