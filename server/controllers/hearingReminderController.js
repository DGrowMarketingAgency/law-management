const hearingReminderService = require("../services/whatsapp/hearingReminderService");
const db = require("../config/database");

/**
 * Controller for Case Hearing WhatsApp Reminders
 */

// GET /api/v1/hearings/:hearingId/reminders
const getHearingReminders = async (req, res, next) => {
  try {
    const { hearingId } = req.params;
    const data = await hearingReminderService.getRemindersForHearing(hearingId);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/hearings/:hearingId/reminders/send
const sendManualReminder = async (req, res, next) => {
  try {
    const { hearingId } = req.params;
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const result = await hearingReminderService.sendManualReminder(
      hearingId,
      req.user?.id,
      ip,
      userAgent
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      providerMessageId: result.providerMessageId,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/hearings/:hearingId/reminders/regenerate
const regenerateReminders = async (req, res, next) => {
  try {
    const { hearingId } = req.params;
    const result = await hearingReminderService.rescheduleHearingReminders(
      hearingId,
      req.user?.id
    );

    const updated = await hearingReminderService.getRemindersForHearing(hearingId);

    return res.status(200).json({
      success: true,
      message: "Hearing reminders regenerated successfully.",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/hearings/:hearingId/reminders/:reminderId/cancel
const cancelReminder = async (req, res, next) => {
  try {
    const { hearingId, reminderId } = req.params;

    const [rows] = await db.query(
      `SELECT id, status FROM hearing_reminders WHERE id = ? AND hearing_id = ? LIMIT 1`,
      [reminderId, hearingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found for this hearing.",
      });
    }

    if (rows[0].status !== "SCHEDULED") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel reminder with status: ${rows[0].status}`,
      });
    }

    await db.query(
      `UPDATE hearing_reminders 
       SET status = 'CANCELLED', failure_reason = 'MANUALLY_CANCELLED_BY_STAFF', updated_at = NOW() 
       WHERE id = ?`,
      [reminderId]
    );

    const updated = await hearingReminderService.getRemindersForHearing(hearingId);

    return res.status(200).json({
      success: true,
      message: "Reminder cancelled successfully.",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHearingReminders,
  sendManualReminder,
  regenerateReminders,
  cancelReminder,
};
