const express = require("express");
const router = express.Router();
const deadlineController = require("../controllers/deadlineController");
const deadlineAlertController = require("../controllers/deadlineAlertController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

router.use(authenticate);

// Limitation calculation preview (assistive tool)
router.post(
  "/calculate",
  authorize("DEADLINE_VIEW"),
  deadlineController.calculateLimitation
);

// Chambers deadlines dashboard
router.get(
  "/dashboard",
  authorize("DEADLINE_VIEW"),
  deadlineController.getDeadlinesDashboard
);

// Alert schedule & processing
router.get(
  "/alerts",
  authorize("DEADLINE_VIEW"),
  deadlineAlertController.getAlerts
);

router.post(
  "/alerts/process",
  authorize("DEADLINE_VIEW"),
  deadlineAlertController.processPendingAlerts
);

module.exports = router;
