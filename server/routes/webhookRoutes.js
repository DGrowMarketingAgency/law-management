const express = require("express");
const { handleRazorpayWebhook, handlePayUWebhook } = require("../controllers/webhookController");
const documentSignatureController = require("../controllers/documentSignatureController");
const whatsappController = require("../controllers/whatsappController");

const router = express.Router();

// NOTE: Webhooks intentionally bypass JWT auth middleware.
// Security is enforced strictly via provider HMAC / Hash signature validation.
router.post("/razorpay", handleRazorpayWebhook);
router.post("/payu", handlePayUWebhook);
router.post("/esign/:provider", documentSignatureController.handleWebhook);

// WhatsApp Business Platform Cloud API Webhooks
router.get("/whatsapp", whatsappController.verifyWebhook);
router.post("/whatsapp", whatsappController.handleWebhook);

module.exports = router;
