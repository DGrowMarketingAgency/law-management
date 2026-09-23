const db = require("../config/database");
const { sendEmail } = require("./emailService");
const { sendWhatsAppMessage } = require("./whatsappService");
const { logBillingEvent } = require("./billingAuditService");

/**
 * Payment Reminder Rules & Delivery Engine
 * Idempotent, deduplicated reminder dispatch across WhatsApp and Email.
 */

/**
 * Check if a reminder was already sent today for this invoice and channel
 * @param {number} invoiceId
 * @param {'EMAIL'|'WHATSAPP'} channel
 * @param {string} template
 * @returns {Promise<boolean>}
 */
const isDuplicateReminder = async (invoiceId, channel, template) => {
  const [rows] = await db.query(
    `SELECT id FROM notification_logs
     WHERE entity_type = 'INVOICE'
       AND entity_id = ?
       AND channel = ?
       AND template = ?
       AND status = 'SENT'
       AND DATE(sent_at) = CURRENT_DATE()
     LIMIT 1`,
    [invoiceId, channel, template]
  );
  return rows.length > 0;
};

/**
 * Retrieve or create an active payment link for reminder inclusion
 */
const getOrCreatePaymentLink = async (invoice, conn = db) => {
  // 1. Check for existing active link
  const [links] = await conn.query(
    `SELECT * FROM payment_links 
     WHERE invoice_id = ? 
       AND status = 'ACTIVE' 
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY id DESC LIMIT 1`,
    [invoice.id]
  );

  if (links.length > 0) {
    return links[0].payment_link_url;
  }

  // 2. If no active link exists, construct public client pay portal URL
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  return `${clientUrl}/billing/pay/${invoice.id}`;
};

/**
 * Send a Payment Reminder for an invoice
 * @param {object} params
 * @returns {Promise<object>}
 */
const sendPaymentReminder = async ({
  invoiceId,
  channel = "EMAIL",
  reminderType = "BEFORE_DUE",
  customNote = null,
  userId = null,
  ip = null,
  userAgent = null,
}) => {
  // 1. Fetch invoice and client contact details
  const [rows] = await db.query(
    `SELECT inv.*, cnt.display_name AS client_name, cnt.email AS client_email, cnt.phone AS client_phone
     FROM invoices inv
     JOIN clients cl ON inv.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     WHERE inv.id = ?`,
    [invoiceId]
  );

  if (rows.length === 0) {
    const err = new Error("Invoice not found.");
    err.statusCode = 404;
    throw err;
  }

  const invoice = rows[0];

  // 2. Validate eligibility
  if (invoice.amount_due <= 0 || ["PAID", "CANCELLED", "VOID"].includes(invoice.status)) {
    const err = new Error(`Invoice #${invoice.invoice_number} is already paid, cancelled, or has zero amount due.`);
    err.statusCode = 422;
    throw err;
  }

  // 3. Map template key based on reminder type
  let templateKey = "payment_reminder_before_due";
  let whatsappKey = "payment_due_reminder";

  if (reminderType === "DUE_TODAY") {
    templateKey = "payment_reminder_due_today";
    whatsappKey = "payment_due_reminder";
  } else if (reminderType.startsWith("OVERDUE")) {
    templateKey = "payment_reminder_overdue";
    whatsappKey = "payment_overdue_reminder";
  }

  // 4. Duplicate Check
  const channelUpper = channel.toUpperCase();
  const isDuplicate = await isDuplicateReminder(invoice.id, channelUpper, templateKey);
  if (isDuplicate) {
    const err = new Error(`A ${channelUpper} reminder (${templateKey}) has already been sent today for invoice #${invoice.invoice_number}. Duplicate prevented.`);
    err.statusCode = 409;
    err.code = "DUPLICATE_REMINDER_PREVENTED";
    throw err;
  }

  // 5. Resolve payment link
  const paymentLink = await getOrCreatePaymentLink(invoice);

  const variables = {
    client_name: invoice.client_name || invoice.billing_name || "Client",
    invoice_number: invoice.invoice_number,
    amount_due: Number(invoice.amount_due).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
    due_date: new Date(invoice.due_date).toISOString().slice(0, 10),
    payment_link: paymentLink,
    firm_name: "Advocate's Chambers Legal Practice",
    custom_note: customNote || "",
  };

  let result;
  if (channelUpper === "EMAIL") {
    if (!invoice.client_email && !invoice.billing_email) {
      const err = new Error("Client has no email address on file.");
      err.statusCode = 422;
      throw err;
    }
    const to = invoice.client_email || invoice.billing_email;
    result = await sendEmail({
      to,
      templateName: templateKey,
      variables,
      entityType: "INVOICE",
      entityId: invoice.id,
    });
  } else if (channelUpper === "WHATSAPP") {
    const to = invoice.client_phone || invoice.billing_phone;
    if (!to) {
      const err = new Error("Client has no phone number on file for WhatsApp messaging.");
      err.statusCode = 422;
      throw err;
    }
    result = await sendWhatsAppMessage({
      to,
      templateKey: whatsappKey,
      variables,
      entityType: "INVOICE",
      entityId: invoice.id,
    });
  } else {
    const err = new Error(`Unsupported reminder channel: '${channel}'. Allowed: EMAIL, WHATSAPP`);
    err.statusCode = 422;
    throw err;
  }

  // Record audit log
  await logBillingEvent(
    userId,
    channelUpper === "EMAIL" ? "EMAIL_REMINDER_SENT" : "WHATSAPP_REMINDER_SENT",
    "INVOICE",
    invoice.id,
    ip,
    userAgent,
    {
      channel: channelUpper,
      template: templateKey,
      recipient: result.recipient,
      status: result.status,
      amountDue: invoice.amount_due,
      paymentLink,
    }
  );

  return {
    success: result.success,
    status: result.status,
    channel: channelUpper,
    recipient: result.recipient,
    template: templateKey,
    paymentLink,
    failureReason: result.failureReason,
  };
};

/**
 * Get communication history of reminders for an invoice
 * @param {number} invoiceId
 * @returns {Promise<Array>}
 */
const getInvoiceReminders = async (invoiceId) => {
  const [rows] = await db.query(
    `SELECT * FROM notification_logs
     WHERE entity_type = 'INVOICE' AND entity_id = ?
     ORDER BY id DESC`,
    [invoiceId]
  );
  return rows;
};

module.exports = {
  sendPaymentReminder,
  getInvoiceReminders,
  isDuplicateReminder,
};
