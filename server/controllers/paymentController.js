const paymentService = require("../services/paymentService");
const invoicePdfService = require("../services/invoicePdfService");
const { validateRecordPayment } = require("../validators/paymentValidator");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { logBillingEvent } = require("../services/billingAuditService");

const recordPayment = async (req, res, next) => {
  try {
    const errors = validateRecordPayment(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], "VALIDATION_ERROR", errors, 422);
    }

    const payment = await paymentService.recordPayment(
      req.body,
      req.user.id,
      req.ip,
      req.get("user-agent")
    );

    return successResponse(res, "Payment recorded and official receipt generated.", payment, 201);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, err.code || "PAYMENT_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

const getPayments = async (req, res, next) => {
  try {
    const result = await paymentService.getPayments(req.query);
    return successResponse(res, "Payments retrieved successfully.", result);
  } catch (err) {
    next(err);
  }
};

const getPaymentById = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    return successResponse(res, "Payment details retrieved.", payment);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "NOT_FOUND", null, err.statusCode);
    }
    next(err);
  }
};

const refundPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.refundPayment(
      req.params.id,
      req.body.reason,
      req.user.id,
      req.ip,
      req.get("user-agent")
    );

    return successResponse(res, "Payment refunded and balances adjusted successfully.", payment);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "PAYMENT_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

const downloadReceiptPdf = async (req, res, next) => {
  try {
    const result = await invoicePdfService.generateReceiptPdf(req.params.id);
    const buffer = Buffer.isBuffer(result) ? result : (result.pdfBuffer || result.buffer || result);
    const filename = result.filename || `Receipt_${req.params.id}.pdf`;

    await logBillingEvent(
      req.user.id,
      "RECEIPT_PDF_DOWNLOADED",
      "PAYMENT",
      parseInt(req.params.id, 10),
      req.ip,
      req.get("user-agent"),
      { filename }
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "PDF_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

module.exports = {
  recordPayment,
  getPayments,
  getPaymentById,
  refundPayment,
  downloadReceiptPdf,
};
