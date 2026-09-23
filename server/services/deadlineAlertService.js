const db = require("../config/database");
const {
  addCalendarDays,
  diffCalendarDays,
  getTodayDateString,
} = require("../utils/dateUtils");
const { sendDeadlineAlert } = require("./deadlineNotificationService");

const ALERT_OFFSETS = [
  { type: "D30", daysBefore: 30 },
  { type: "D15", daysBefore: 15 },
  { type: "D7", daysBefore: 7 },
  { type: "D1", daysBefore: 1 },
];

/**
 * Schedule 30, 15, 7, 1 day limitation alerts for a deadline.
 * Only schedules alerts for dates that are today or in the future.
 * If effective deadline is already past, creates a single OVERDUE alert.
 * Can receive an existing database connection/transaction.
 * @param {object} connection - MySQL connection or pool
 * @param {number} deadlineId
 * @param {string} effectiveDeadline - YYYY-MM-DD
 * @param {number|null} recipientId
 */
const scheduleDeadlineAlerts = async (
  connection,
  deadlineId,
  effectiveDeadline,
  recipientId = null
) => {
  const runner = connection || db;
  const today = getTodayDateString();
  const diffFromToday = diffCalendarDays(effectiveDeadline, today);

  const scheduledAlerts = [];

  // Check if already overdue
  if (diffFromToday < 0) {
    // Schedule an immediate OVERDUE alert for today if not already present
    await runner.execute(
      `INSERT IGNORE INTO deadline_alerts (deadline_id, alert_type, scheduled_for, status, recipient_id)
       VALUES (?, 'OVERDUE', ?, 'PENDING', ?)`,
      [deadlineId, today, recipientId]
    );
    scheduledAlerts.push({ type: "OVERDUE", scheduledFor: today });
    return scheduledAlerts;
  }

  for (const { type, daysBefore } of ALERT_OFFSETS) {
    const alertDate = addCalendarDays(effectiveDeadline, -daysBefore);
    // Only schedule if alert date is today or in the future
    if (diffCalendarDays(alertDate, today) >= 0) {
      await runner.execute(
        `INSERT IGNORE INTO deadline_alerts (deadline_id, alert_type, scheduled_for, status, recipient_id)
         VALUES (?, ?, ?, 'PENDING', ?)`,
        [deadlineId, type, alertDate, recipientId]
      );
      scheduledAlerts.push({ type, scheduledFor: alertDate });
    }
  }

  return scheduledAlerts;
};

/**
 * Regenerate alerts when a deadline is overridden.
 * Preserves past sent alert history and cancels un-sent pending alerts.
 * @param {object} connection - MySQL connection or pool
 * @param {number} deadlineId
 * @param {string} newEffectiveDeadline - YYYY-MM-DD
 * @param {number|null} recipientId
 */
const regenerateAlertsOnOverride = async (
  connection,
  deadlineId,
  newEffectiveDeadline,
  recipientId = null
) => {
  const runner = connection || db;

  // 1. Cancel existing PENDING alerts (preserving SENT history)
  await runner.execute(
    `UPDATE deadline_alerts 
     SET status = 'CANCELLED' 
     WHERE deadline_id = ? AND status = 'PENDING'`,
    [deadlineId]
  );

  // 2. Schedule new pending alerts according to new effective deadline
  return await scheduleDeadlineAlerts(runner, deadlineId, newEffectiveDeadline, recipientId);
};

/**
 * Daily or on-demand alert processor.
 * Finds all PENDING alerts due on or before today for active, uncompleted, unwaived deadlines.
 * Marks SENT or FAILED.
 * @returns {Promise<{ processed: number, sent: number, failed: number, alerts: object[] }>}
 */
const processPendingDeadlineAlerts = async () => {
  const today = getTodayDateString();

  const [alerts] = await db.query(
    `SELECT 
       da.id AS alert_id,
       da.deadline_id,
       da.alert_type,
       da.scheduled_for,
       da.recipient_id,
       cd.effective_deadline,
       cd.title AS deadline_title,
       cd.status AS deadline_status,
       c.id AS case_id,
       c.case_number,
       c.title AS case_title
     FROM deadline_alerts da
     JOIN case_deadlines cd ON da.deadline_id = cd.id
     JOIN cases c ON cd.case_id = c.id
     WHERE da.status = 'PENDING'
       AND da.scheduled_for <= ?
       AND cd.status NOT IN ('COMPLETED', 'WAIVED')
     ORDER BY da.scheduled_for ASC`,
    [today]
  );

  let sent = 0;
  let failed = 0;
  const processedResults = [];

  for (const alert of alerts) {
    try {
      const dispatchResult = await sendDeadlineAlert({
        deadlineId: alert.deadline_id,
        alertType: alert.alert_type,
        scheduledFor: alert.scheduled_for,
        recipientId: alert.recipient_id,
        effectiveDeadline: alert.effective_deadline,
        caseId: alert.case_id,
        caseNumber: alert.case_number,
        caseTitle: alert.case_title,
        deadlineTitle: alert.deadline_title,
      });

      if (dispatchResult.success) {
        await db.execute(
          `UPDATE deadline_alerts 
           SET status = 'SENT', sent_at = NOW(), error_message = NULL 
           WHERE id = ?`,
          [alert.alert_id]
        );
        sent++;
        processedResults.push({ id: alert.alert_id, status: "SENT" });
      } else {
        throw new Error(dispatchResult.error || "Internal delivery failed");
      }
    } catch (err) {
      await db.execute(
        `UPDATE deadline_alerts 
         SET status = 'FAILED', error_message = ? 
         WHERE id = ?`,
        [err.message.slice(0, 255), alert.alert_id]
      );
      failed++;
      processedResults.push({ id: alert.alert_id, status: "FAILED", error: err.message });
    }
  }

  return {
    processed: alerts.length,
    sent,
    failed,
    alerts: processedResults,
  };
};

/**
 * Get all alerts with filtering and pagination
 * @param {object} filters
 */
const getAlerts = async (filters = {}) => {
  const { status, alert_type, deadline_id, limit = 50, offset = 0 } = filters;
  const where = [];
  const params = [];

  if (status) {
    where.push("da.status = ?");
    params.push(status);
  }

  if (alert_type) {
    where.push("da.alert_type = ?");
    params.push(alert_type);
  }

  if (deadline_id) {
    where.push("da.deadline_id = ?");
    params.push(parseInt(deadline_id, 10));
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await db.query(
    `SELECT 
       da.*,
       cd.title AS deadline_title,
       cd.effective_deadline,
       cd.status AS deadline_status,
       c.id AS case_id,
       c.case_number,
       c.title AS case_title
     FROM deadline_alerts da
     JOIN case_deadlines cd ON da.deadline_id = cd.id
     JOIN cases c ON cd.case_id = c.id
     ${whereClause}
     ORDER BY da.scheduled_for DESC, da.id DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit, 10), parseInt(offset, 10)]
  );

  return rows;
};

module.exports = {
  scheduleDeadlineAlerts,
  regenerateAlertsOnOverride,
  processPendingDeadlineAlerts,
  getAlerts,
};
