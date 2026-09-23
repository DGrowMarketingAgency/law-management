const express = require("express");
const securityController = require("../controllers/securityController");
const authenticate = require("../middleware/authenticate");

const router = express.Router();

// All security routes require authenticated user
router.use(authenticate);

router.get("/overview", securityController.getSecurityOverview);
router.get("/audit-logs", securityController.getAuditLogs);

module.exports = router;
