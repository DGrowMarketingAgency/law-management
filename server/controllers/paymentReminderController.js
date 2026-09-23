const { sendPaymentReminder, getInvoiceReminders } = require("../services/paymentReminderService");
const { successResponse } = require("../utils/apiResponse");

/**
 * Send Email Payment Reminder
 */
const sendEmailReminder = async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    const { reminder_type = "BEFORE_DUE", custom_note } = req.body;

    const result = await sendPaymentReminder({
      invoiceId,
      channel: "EMAIL",
      reminderType: reminder_type,
      customNote: custom_note,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(res, "Email payment reminder dispatched successfully.", result);
  } catch (err) {
    next(err);
  }
};

/**
 * Send WhatsApp Payment Reminder
 */
const sendWhatsAppReminder = async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    const { reminder_type = "BEFORE_DUE", custom_note } = req.body;

    const result = await sendPaymentReminder({
      invoiceId,
      channel: "WHATSAPP",
      reminderType: reminder_type,
      customNote: custom_note,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(res, "WhatsApp payment reminder dispatched successfully.", result);
  } catch (err) {
    next(err);
  }
};

/**
 * Generalized Reminder Dispatch
 */
const sendReminder = async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    const { channel = "EMAIL", reminder_type = "BEFORE_DUE", custom_note } = req.body;

    const result = await sendPaymentReminder({
      invoiceId,
      channel,
      reminderType: reminder_type,
      customNote: custom_note,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(res, "Payment reminder dispatched successfully.", result);
  } catch (err) {
    next(err);
  }
};

/**
 * Get Invoice Reminder History
 */
const getReminders = async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    const reminders = await getInvoiceReminders(invoiceId);
    return successResponse(res, "Invoice reminder history fetched.", reminders);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendEmailReminder,
  sendWhatsAppReminder,
  sendReminder,
  getReminders,
};
