const express = require("express");
const router = express.Router();
const deadlineRuleController = require("../controllers/deadlineRuleController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

// All deadline rule endpoints require authentication
router.use(authenticate);

// View rules (DEADLINE_RULE_VIEW)
router.get(
  "/",
  authorize("DEADLINE_RULE_VIEW"),
  deadlineRuleController.getRules
);

router.get(
  "/:id",
  authorize("DEADLINE_RULE_VIEW"),
  deadlineRuleController.getRuleById
);

// Manage rules (DEADLINE_RULE_MANAGE)
router.post(
  "/",
  authorize("DEADLINE_RULE_MANAGE"),
  deadlineRuleController.createRule
);

router.put(
  "/:id",
  authorize("DEADLINE_RULE_MANAGE"),
  deadlineRuleController.updateRule
);

router.patch(
  "/:id/toggle-active",
  authorize("DEADLINE_RULE_MANAGE"),
  deadlineRuleController.toggleRuleActive
);

module.exports = router;
