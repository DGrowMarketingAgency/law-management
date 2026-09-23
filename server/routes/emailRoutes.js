const express = require("express");
const emailAdminController = require("../controllers/emailAdminController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

const router = express.Router();

// All email routes require authenticated user
router.use(authenticate);

// SMTP connection diagnostics
router.get("/status", authorize("EMAIL_VIEW"), emailAdminController.getSmtpStatus);
router.post("/test", authorize("EMAIL_TEST"), emailAdminController.sendTestEmail);

// Templates administration
router.get("/templates", authorize("EMAIL_TEMPLATE_VIEW"), emailAdminController.listTemplates);
router.get("/templates/:key", authorize("EMAIL_TEMPLATE_VIEW"), emailAdminController.getTemplateByKey);
router.put("/templates/:id", authorize("EMAIL_TEMPLATE_UPDATE"), emailAdminController.updateTemplate);

// Email delivery audit logs
router.get("/logs", authorize("EMAIL_VIEW"), emailAdminController.getDeliveryLogs);

module.exports = router;
