const db = require("../config/database");

/**
 * WhatsApp Business Platform Service
 * Official Cloud API client with template messaging for legal fee payment notifications.
 */

const WHATSAPP_TEMPLATES = {
  invoice_payment_link: {
    templateName: "invoice_payment_link",
    languageCode: "en",
    description: "Legal fee invoice payment link",
    variables: ["client_name", "invoice_number", "amount_due", "due_date", "payment_link"],
  },
  payment_due_reminder: {
    templateName: "payment_due_reminder",
    languageCode: "en",
    description: "Payment due date reminder",
    variables: ["client_name", "invoice_number", "amount_due", "due_date", "payment_link"],
  },
  payment_overdue_reminder: {
    templateName: "payment_overdue_reminder",
    languageCode: "en",
    description: "Overdue invoice notice",
    variables: ["client_name", "invoice_number", "amount_due", "due_date", "payment_link"],
  },
  payment_success: {
    templateName: "payment_success",
    languageCode: "en",
    description: "Payment receipt acknowledgment",
    variables: ["client_name", "invoice_number", "amount", "receipt_number", "remaining_due"],
  },
};

/**
 * Format phone number to E.164 without leading '+' for WhatsApp Cloud API
 */
const formatPhoneNumber = (phone) => {
  if (!phone) return "";
  const cleaned = phone.replace(/[^0-9]/g, "");
  // Default to India (+91) if 10 digits
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  return cleaned;
};

/**
 * Send an official WhatsApp template message
 * @param {object} params
 * @returns {Promise<object>}
 */
const sendWhatsAppMessage = async ({
  to,
  templateKey,
  variables = {},
  entityType = "INVOICE",
  entityId = 0,
}) => {
  const recipientPhone = formatPhoneNumber(to);
  const templateConfig = WHATSAPP_TEMPLATES[templateKey];

  if (!recipientPhone) {
    const err = new Error("Invalid or missing client phone number for WhatsApp message.");
    err.statusCode = 422;
    throw err;
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const baseUrl = process.env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com/v20.0";

  const isConfigured = Boolean(token && phoneNumberId && token !== "replace_this_later");

  let status = "SENT";
  let failureReason = null;
  let providerMessageId = null;

  if (!isConfigured) {
    status = "FAILED";
    failureReason = "WHATSAPP_NOT_CONFIGURED: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing in environment.";
  } else {
    // Build parameters for official WhatsApp Cloud API
    const parameters = (templateConfig?.variables || []).map((varName) => ({
      type: "text",
      text: String(variables[varName] || "-"),
    }));

    try {
      const response = await fetch(`${baseUrl}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "template",
          template: {
            name: templateConfig?.templateName || templateKey,
            language: { code: templateConfig?.languageCode || "en" },
            components: [
              {
                type: "body",
                parameters,
              },
            ],
          },
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        status = "FAILED";
        failureReason = body.error?.message || "WhatsApp API request failed";
      } else {
        providerMessageId = body.messages?.[0]?.id || null;
      }
    } catch (err) {
      status = "FAILED";
      failureReason = err.message;
    }
  }

  // Record in notification_logs
  const [result] = await db.query(
    `INSERT INTO notification_logs (
      channel, recipient, template, entity_type, entity_id, provider,
      provider_message_id, status, failure_reason, sent_at
    ) VALUES ('WHATSAPP', ?, ?, ?, ?, 'WHATSAPP_CLOUD', ?, ?, ?, ?)`,
    [
      recipientPhone,
      templateKey,
      entityType,
      entityId,
      providerMessageId,
      status,
      failureReason,
      status === "SENT" ? new Date() : null,
    ]
  );

  return {
    success: status === "SENT",
    logId: result.insertId,
    status,
    recipient: recipientPhone,
    template: templateKey,
    failureReason,
    providerMessageId,
  };
};

const buildWhatsAppPayload = (recipientPhone, templateKey, variables = {}) => {
  const templateConfig = WHATSAPP_TEMPLATES[templateKey];
  const parameters = (templateConfig?.variables || []).map((varName) => ({
    type: "text",
    text: String(variables[varName] || "-"),
  }));
  return {
    messaging_product: "whatsapp",
    to: formatPhoneNumber(recipientPhone),
    type: "template",
    template: {
      name: templateConfig?.templateName || templateKey,
      language: { code: templateConfig?.languageCode || "en" },
      components: [
        {
          type: "body",
          parameters,
        },
      ],
    },
  };
};

module.exports = {
  sendWhatsAppMessage,
  formatPhoneNumber,
  buildWhatsAppPayload,
  formatWhatsAppPayload: buildWhatsAppPayload,
  WHATSAPP_TEMPLATES,
};
