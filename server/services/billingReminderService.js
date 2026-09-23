const db = require("../config/database");
const { getInvoiceById } = require("./invoiceService");
const { logBillingEvent } = require("./billingAuditService");

const ALLOWED_REMINDER_TYPES = ["BEFORE_DUE", "DUE_TODAY", "OVERDUE", "CUSTOM"];
const ALLOWED_CHANNELS = ["EMAIL", "WHATSAPP", "CLIENT_PORTAL"];

/**
 * Generate preview message for an invoice payment reminder
 * @param {number} invoiceId
 * @param {'BEFORE_DUE'|'DUE_TODAY'|'OVERDUE'|'CUSTOM'} reminderType
 * @param {string} [channel='CLIENT_PORTAL']
 * @returns {Promise<{ subject: string, message: string, recipient: string, invoiceNumber: string, amountDue: number, dueDate: string }>}
 */
const previewReminder = async (invoiceId, reminderType = "BEFORE_DUE", channel = "CLIENT_PORTAL") => {
  const invoice = await getInvoiceById(invoiceId);

  if (["PAID", "CANCELLED", "VOID"].includes(invoice.status)) {
    const err = new Error(`Cannot create a payment reminder for a ${invoice.status} invoice.`);
    err.statusCode = 422;
    throw err;
  }

  const clientName = invoice.billing_name || "Valued Client";
  const dueAmount = invoice.amount_due;
  const dueDate = invoice.due_date;
  const invNumber = invoice.invoice_number;

  let subject = `Payment Reminder: Invoice ${invNumber}`;
  let message = "";

  if (reminderType === "BEFORE_DUE") {
    subject = `Upcoming Payment Notice: Invoice ${invNumber} - Advocate's Chambers`;
    message = `Dear ${clientName},\n\nThis is a friendly reminder that professional fee invoice ${invNumber} for ₹${dueAmount.toLocaleString("en-IN")} is due on ${dueDate}.\n\nKindly arrange the transfer at your convenience.\n\nThank you,\nAdvocate's Chambers`;
  } else if (reminderType === "DUE_TODAY") {
    subject = `Payment Due Today: Invoice ${invNumber} - Advocate's Chambers`;
    message = `Dear ${clientName},\n\nPlease note that invoice ${invNumber} in the amount of ₹${dueAmount.toLocaleString("en-IN")} is due today (${dueDate}).\n\nIf payment has already been dispatched, please share the transaction reference.\n\nThank you,\nAdvocate's Chambers`;
  } else if (reminderType === "OVERDUE") {
    subject = `Overdue Notice: Invoice ${invNumber} - Advocate's Chambers`;
    message = `Dear ${clientName},\n\nOur records indicate that professional fee invoice ${invNumber} for ₹${dueAmount.toLocaleString("en-IN")} was due on ${dueDate} and remains outstanding.\n\nWe kindly request prompt settlement of this matter.\n\nThank you,\nAdvocate's Chambers`;
  } else {
    message = `Dear ${clientName},\n\nRegarding chambers invoice ${invNumber}, an outstanding balance of ₹${dueAmount.toLocaleString("en-IN")} remains due.\n\nThank you,\nAdvocate's Chambers`;
  }

  const recipient = channel === "WHATSAPP"
    ? (invoice.billing_phone || "No phone on file")
    : (invoice.billing_email || invoice.billing_phone || "Client Portal");

  return {
    subject,
    message,
    recipient,
    invoiceNumber: invNumber,
    amountDue: dueAmount,
    dueDate,
  };
};

/**
 * Schedule / Send a payment reminder
 * @param {number} invoiceId
 * @param {object} reminderData
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const sendReminder = async (invoiceId, reminderData, userId, ip = null, userAgent = null) => {
  const {
    reminder_type = "BEFORE_DUE",
    channel = "CLIENT_PORTAL",
    custom_message,
    scheduled_date,
  } = reminderData;

  const invoice = await getInvoiceById(invoiceId);

  if (["PAID", "CANCELLED", "VOID"].includes(invoice.status)) {
    const err = new Error(`Cannot send payment reminder for a ${invoice.status} invoice.`);
    err.statusCode = 422;
    throw err;
  }

  const preview = await previewReminder(invoiceId, reminder_type, channel);
  const messageText = custom_message && custom_message.trim() ? custom_message.trim() : preview.message;
  const targetDate = scheduled_date || new Date().toISOString().split("T")[0];

  // Prevent duplicate spam for the same invoice + reminder_type + scheduled date
  const [existing] = await db.execute(
    `SELECT id FROM invoice_reminders 
     WHERE invoice_id = ? AND reminder_type = ? AND scheduled_for = ? LIMIT 1`,
    [invoiceId, reminder_type, targetDate]
  );

  if (existing.length > 0) {
    const err = new Error(
      `A reminder of type '${reminder_type}' has already been scheduled/sent for this invoice on ${targetDate}.`
    );
    err.statusCode = 409;
    throw err;
  }

  // Delivery status: In this phase, external providers are not connected.
  // Record status as 'NOT_CONFIGURED' (or 'SENT' for internal CLIENT_PORTAL)
  const deliveryStatus = channel === "CLIENT_PORTAL" ? "SENT" : "NOT_CONFIGURED";

  const [result] = await db.execute(
    `INSERT INTO invoice_reminders (
      invoice_id, reminder_type, channel, status, recipient, subject,
      message, scheduled_for, sent_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoiceId,
      reminder_type,
      channel,
      deliveryStatus,
      preview.recipient,
      preview.subject,
      messageText,
      targetDate,
      deliveryStatus === "SENT" ? new Date() : null,
      userId || null,
    ]
  );

  const reminderId = result.insertId;

  await logBillingEvent(userId, "REMINDER_SENT", "REMINDER", reminderId, ip, userAgent, {
    invoiceId,
    invoiceNumber: invoice.invoice_number,
    reminderType: reminder_type,
    channel,
    status: deliveryStatus,
  });

  const [reminderRows] = await db.execute(
    `SELECT * FROM invoice_reminders WHERE id = ?`,
    [reminderId]
  );

  return reminderRows[0];
};

module.exports = {
  previewReminder,
  sendReminder,
};
