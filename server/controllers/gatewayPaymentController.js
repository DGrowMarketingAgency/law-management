const paymentService = require("../services/paymentService");
const { reconcilePayments } = require("../services/paymentReconciliationService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Razorpay Order Creation
 */
const createRazorpayOrder = async (req, res, next) => {
  try {
    const { invoice_id, amount } = req.body;
    if (!invoice_id) {
      return errorResponse(res, "invoice_id is required.", "VALIDATION_ERROR", null, 422);
    }
    const order = await paymentService.createGatewayOrder(
      { invoiceId: invoice_id, amount, provider: "RAZORPAY" },
      req.user
    );
    return successResponse(res, "Razorpay order initiated successfully.", order, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Razorpay Payment Verification
 */
const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const result = await paymentService.verifyAndCaptureGatewayPayment(
      "RAZORPAY",
      req.body,
      req.user?.id,
      req.ip,
      req.headers["user-agent"]
    );
    return successResponse(res, "Razorpay payment verified and captured successfully.", result);
  } catch (err) {
    next(err);
  }
};

/**
 * Razorpay Payment Link Creation
 */
const createRazorpayPaymentLink = async (req, res, next) => {
  try {
    const { invoice_id, amount, description, expiry_date, allow_partial } = req.body;
    if (!invoice_id) {
      return errorResponse(res, "invoice_id is required.", "VALIDATION_ERROR", null, 422);
    }
    const link = await paymentService.createPaymentLink(
      {
        invoiceId: invoice_id,
        amount,
        description,
        expiryDate: expiry_date,
        allowPartial: Boolean(allow_partial),
        provider: "RAZORPAY",
      },
      req.user?.id
    );
    return successResponse(res, "Razorpay payment link generated successfully.", link, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Razorpay Status Inquiry
 */
const getRazorpayPaymentStatus = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    return successResponse(res, "Payment status fetched.", payment);
  } catch (err) {
    next(err);
  }
};

/**
 * PayU Order Creation
 */
const createPayUOrder = async (req, res, next) => {
  try {
    const { invoice_id, amount, return_url, failure_url } = req.body;
    if (!invoice_id) {
      return errorResponse(res, "invoice_id is required.", "VALIDATION_ERROR", null, 422);
    }
    const order = await paymentService.createGatewayOrder(
      {
        invoiceId: invoice_id,
        amount,
        provider: "PAYU",
        returnUrl: return_url,
        failureUrl: failure_url,
      },
      req.user
    );
    return successResponse(res, "PayU order initiated successfully.", order, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PayU Payment Verification
 */
const verifyPayUPayment = async (req, res, next) => {
  try {
    const result = await paymentService.verifyAndCaptureGatewayPayment(
      "PAYU",
      req.body,
      req.user?.id,
      req.ip,
      req.headers["user-agent"]
    );
    return successResponse(res, "PayU payment verified and captured successfully.", result);
  } catch (err) {
    next(err);
  }
};

/**
 * PayU Payment Link Creation
 */
const createPayUPaymentLink = async (req, res, next) => {
  try {
    const { invoice_id, amount, description, expiry_date, allow_partial } = req.body;
    if (!invoice_id) {
      return errorResponse(res, "invoice_id is required.", "VALIDATION_ERROR", null, 422);
    }
    const link = await paymentService.createPaymentLink(
      {
        invoiceId: invoice_id,
        amount,
        description,
        expiryDate: expiry_date,
        allowPartial: Boolean(allow_partial),
        provider: "PAYU",
      },
      req.user?.id
    );
    return successResponse(res, "PayU payment link generated successfully.", link, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PayU Status Inquiry
 */
const getPayUPaymentStatus = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    return successResponse(res, "Payment status fetched.", payment);
  } catch (err) {
    next(err);
  }
};

/**
 * Record Manual Payment (PENDING_VERIFICATION)
 */
const recordManualPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.recordManualPayment(
      req.body,
      req.user?.id,
      req.ip,
      req.headers["user-agent"]
    );
    return successResponse(res, "Manual payment recorded and submitted for verification.", payment, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Verify Manual Payment
 */
const verifyManualPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.verifyManualPayment(
      parseInt(req.params.id, 10),
      req.user?.id,
      req.ip,
      req.headers["user-agent"]
    );
    return successResponse(res, "Manual payment verified successfully and receipt generated.", payment);
  } catch (err) {
    next(err);
  }
};

/**
 * Reject Manual Payment
 */
const rejectManualPayment = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const payment = await paymentService.rejectManualPayment(
      parseInt(req.params.id, 10),
      reason,
      req.user?.id,
      req.ip,
      req.headers["user-agent"]
    );
    return successResponse(res, "Manual payment has been rejected.", payment);
  } catch (err) {
    next(err);
  }
};

/**
 * Payment Reconciliation Report
 */
const getReconciliation = async (req, res, next) => {
  try {
    const report = await reconcilePayments(req.query);
    return successResponse(res, "Reconciliation report retrieved successfully.", report);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  createRazorpayPaymentLink,
  getRazorpayPaymentStatus,
  createPayUOrder,
  verifyPayUPayment,
  createPayUPaymentLink,
  getPayUPaymentStatus,
  recordManualPayment,
  verifyManualPayment,
  rejectManualPayment,
  getReconciliation,
};
