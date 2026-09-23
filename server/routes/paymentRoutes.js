const express = require("express");
const paymentController = require("../controllers/paymentController");
const gatewayController = require("../controllers/gatewayPaymentController");
const authenticateToken = require("../middleware/authenticateToken");
const { requirePermission } = require("../middleware/rbacMiddleware");

const router = express.Router();

router.use(authenticateToken);

// --- 1. Reconciliation (Placed before /:id parameter) ---
router.get("/reconciliation", requirePermission("PAYMENT_RECONCILE"), gatewayController.getReconciliation);

// --- 2. Razorpay Gateway Routes ---
router.post("/razorpay/order", requirePermission("PAYMENT_RECORD"), gatewayController.createRazorpayOrder);
router.post("/razorpay/verify", requirePermission("PAYMENT_RECORD"), gatewayController.verifyRazorpayPayment);
router.post("/razorpay/payment-links", requirePermission("PAYMENT_LINK_CREATE"), gatewayController.createRazorpayPaymentLink);
router.get("/razorpay/:id/status", requirePermission("PAYMENT_VIEW"), gatewayController.getRazorpayPaymentStatus);

// --- 3. PayU Gateway Routes ---
router.post("/payu/order", requirePermission("PAYMENT_RECORD"), gatewayController.createPayUOrder);
router.post("/payu/verify", requirePermission("PAYMENT_RECORD"), gatewayController.verifyPayUPayment);
router.post("/payu/payment-links", requirePermission("PAYMENT_LINK_CREATE"), gatewayController.createPayUPaymentLink);
router.get("/payu/:id/status", requirePermission("PAYMENT_VIEW"), gatewayController.getPayUPaymentStatus);

// --- 4. Manual & Offline Payments ---
router.post("/manual", requirePermission("PAYMENT_RECORD"), gatewayController.recordManualPayment);
router.post("/:id/verify", requirePermission("PAYMENT_VERIFY"), gatewayController.verifyManualPayment);
router.post("/:id/reject", requirePermission("PAYMENT_VERIFY"), gatewayController.rejectManualPayment);

// --- 5. Core Payments Management ---
router.get("/", requirePermission("PAYMENT_VIEW"), paymentController.getPayments);
router.post("/", requirePermission("PAYMENT_RECORD"), paymentController.recordPayment);
router.get("/:id", requirePermission("PAYMENT_VIEW"), paymentController.getPaymentById);
router.get("/:id/status", requirePermission("PAYMENT_VIEW"), paymentController.getPaymentById);
router.get("/:id/receipt", requirePermission("PAYMENT_VIEW"), paymentController.downloadReceiptPdf);
router.post("/:id/refund", requirePermission("PAYMENT_REFUND"), paymentController.refundPayment);

module.exports = router;
