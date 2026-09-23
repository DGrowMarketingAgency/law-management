const express = require("express");
const whatsappController = require("../controllers/whatsappController");
const authenticateToken = require("../middleware/authenticateToken");
const { requirePermission } = require("../middleware/rbacMiddleware");

const router = express.Router();

router.use(authenticateToken);

// WhatsApp Configuration Health & Status
router.get(
  "/status",
  requirePermission("WHATSAPP_SETTINGS_VIEW"),
  whatsappController.getStatus
);

router.get(
  "/aisensy/status",
  requirePermission("WHATSAPP_SETTINGS_VIEW"),
  whatsappController.getStatus
);

// WhatsApp Reminder Timing & Settings
router.get(
  "/settings",
  requirePermission("WHATSAPP_SETTINGS_VIEW"),
  whatsappController.getSettings
);

router.patch(
  "/settings",
  requirePermission("WHATSAPP_SETTINGS_UPDATE"),
  whatsappController.updateSettings
);

// POST /api/v1/whatsapp/aisensy/test (Admin/Owner Test Connection)
router.post(
  "/aisensy/test",
  requirePermission("WHATSAPP_SETTINGS_UPDATE"),
  whatsappController.testAiSensyConnection
);

module.exports = router;
