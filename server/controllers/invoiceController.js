const invoiceService = require("../services/invoiceService");
const invoicePdfService = require("../services/invoicePdfService");
const billingReminderService = require("../services/billingReminderService");
const { validateCreateInvoice } = require("../validators/invoiceValidator");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { logBillingEvent } = require("../services/billingAuditService");

const createInvoice = async (req, res, next) => {
  try {
    const errors = validateCreateInvoice(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], "VALIDATION_ERROR", errors, 422);
    }

    const invoice = await invoiceService.createInvoice(
      req.body,
      req.user.id,
      req.ip,
      req.get("user-agent")
    );

    return successResponse(res, "Draft invoice created successfully.", invoice, 201);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, err.code || "INVOICE_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

const getInvoices = async (req, res, next) => {
  try {
    const result = await invoiceService.getInvoices(req.query);
    return successResponse(res, "Invoices retrieved successfully.", result);
  } catch (err) {
    next(err);
  }
};

const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    return successResponse(res, "Invoice details retrieved.", invoice);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "NOT_FOUND", null, err.statusCode);
    }
    next(err);
  }
};

const updateDraftInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.updateDraftInvoice(
      req.params.id,
      req.body,
      req.user.id,
      req.ip,
      req.get("user-agent")
    );

    return successResponse(res, "Draft invoice updated successfully.", invoice);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "INVOICE_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

const issueInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.issueInvoice(
      req.params.id,
      req.user.id,
      req.ip,
      req.get("user-agent")
    );

    return successResponse(res, "Invoice officially issued and locked.", invoice);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "INVOICE_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

const sendInvoice = async (req, res, next) => {
  try {
    const channel = req.body.channel || "CLIENT_PORTAL";
    const invoice = await invoiceService.sendInvoice(
      req.params.id,
      channel,
      req.user.id,
      req.ip,
      req.get("user-agent")
    );

    return successResponse(res, `Invoice marked as sent via ${channel}.`, invoice);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "INVOICE_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

const cancelInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.cancelInvoice(
      req.params.id,
      req.body.reason,
      req.user.id,
      req.ip,
      req.get("user-agent")
    );

    return successResponse(res, "Invoice cancelled successfully.", invoice);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "INVOICE_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

const voidInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.voidInvoice(
      req.params.id,
      req.body.reason,
      req.user.id,
      req.ip,
      req.get("user-agent")
    );

    return successResponse(res, "Invoice voided successfully.", invoice);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "INVOICE_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

const downloadInvoicePdf = async (req, res, next) => {
  try {
    const result = await invoicePdfService.generateInvoicePdf(req.params.id);
    const buffer = Buffer.isBuffer(result) ? result : (result.pdfBuffer || result.buffer || result);
    const filename = result.filename || `Invoice_${req.params.id}.pdf`;

    await logBillingEvent(
      req.user.id,
      "INVOICE_PDF_DOWNLOADED",
      "INVOICE",
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

const previewReminder = async (req, res, next) => {
  try {
    const reminderType = req.body.reminder_type || req.query.reminder_type || "BEFORE_DUE";
    const channel = req.body.channel || req.query.channel || "CLIENT_PORTAL";
    const preview = await billingReminderService.previewReminder(req.params.id, reminderType, channel);
    return successResponse(res, "Reminder preview generated.", preview);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "REMINDER_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

const sendReminder = async (req, res, next) => {
  try {
    const reminder = await billingReminderService.sendReminder(
      req.params.id,
      req.body,
      req.user.id,
      req.ip,
      req.get("user-agent")
    );

    return successResponse(res, "Payment reminder notice recorded.", reminder);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "REMINDER_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

module.exports = {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateDraftInvoice,
  issueInvoice,
  sendInvoice,
  cancelInvoice,
  voidInvoice,
  downloadInvoicePdf,
  previewReminder,
  sendReminder,
};
