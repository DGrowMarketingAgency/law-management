const express = require("express");
const { getSettings, updateSettings } = require("../controllers/paymentSettingsController");
const authenticateToken = require("../middleware/authenticateToken");
const { requirePermission } = require("../middleware/rbacMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/", requirePermission("PAYMENT_VIEW"), getSettings);
router.patch("/", requirePermission("PAYMENT_GATEWAY_CONFIG"), updateSettings);

module.exports = router;
