const express = require("express");
const hearingReminderController = require("../controllers/hearingReminderController");
const authenticateToken = require("../middleware/authenticateToken");
const { requirePermission } = require("../middleware/rbacMiddleware");

const router = express.Router();

router.use(authenticateToken);

// GET /api/v1/hearings/:hearingId/reminders
router.get(
  "/:hearingId/reminders",
  requirePermission("HEARING_REMINDER_VIEW"),
  hearingReminderController.getHearingReminders
);

// POST /api/v1/hearings/:hearingId/reminders/send
router.post(
  "/:hearingId/reminders/send",
  requirePermission("HEARING_REMINDER_SEND"),
  hearingReminderController.sendManualReminder
);

// POST /api/v1/hearings/:hearingId/reminders/regenerate
router.post(
  "/:hearingId/reminders/regenerate",
  requirePermission("HEARING_REMINDER_MANAGE"),
  hearingReminderController.regenerateReminders
);

// PATCH /api/v1/hearings/:hearingId/reminders/:reminderId/cancel
router.patch(
  "/:hearingId/reminders/:reminderId/cancel",
  requirePermission("HEARING_REMINDER_MANAGE"),
  hearingReminderController.cancelReminder
);

module.exports = router;
