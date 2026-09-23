const db = require("../config/database");

/**
 * Payment Settings Service
 * Manages firm-level gateway configurations, test/live modes,
 * bank instructions, and reminder rules with secret masking.
 */

const DEFAULT_SETTINGS = {
  gateway_config: {
    primaryGateway: "RAZORPAY",
    razorpayEnabled: true,
    payuEnabled: true,
    razorpayMode: process.env.RAZORPAY_MODE || "TEST",
    payuMode: process.env.PAYU_MODE || "TEST",
  },
  bank_instructions: {
    bankName: "State Bank of India",
    accountName: "Advocate Chambers Client Trust Account",
    accountNumber: "300123456789",
    ifscCode: "SBIN0000123",
    upiId: "chambers@sbi",
    notes: "Please mention the Invoice Number in the transfer remarks/reference.",
  },
  reminder_rules: {
    daysBeforeDue: 3,
    dueTodayEnabled: true,
    overdueDays: [1, 7, 15],
    channels: { email: true, whatsapp: true },
    autoPaymentLink: true,
  },
  smtp_config: {
    host: process.env.SMTP_HOST || "smtp.mailtrap.io",
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ? "********" : "",
    fromEmail: process.env.EMAIL_FROM || "billing@chambers.in",
    fromName: process.env.EMAIL_FROM_NAME || "Advocate's Chambers Billing",
    configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
  },
  whatsapp_config: {
    baseUrl: process.env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com/v20.0",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ? "********" : "",
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ? "********" : "",
    configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  },
};

/**
 * Fetch all payment settings with masked secrets
 * @returns {Promise<object>}
 */
const getPaymentSettings = async () => {
  const [rows] = await db.query(`SELECT setting_key, setting_value FROM payment_settings`);
  const settings = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    try {
      const parsed = typeof row.setting_value === "string" ? JSON.parse(row.setting_value) : row.setting_value;
      settings[row.setting_key] = { ...settings[row.setting_key], ...parsed };
    } catch (e) {
      // Keep default
    }
  }

  // Ensure gateway configuration reflects current environment variables safely
  settings.gateway_config.razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  settings.gateway_config.payuConfigured = Boolean(process.env.PAYU_MERCHANT_KEY && process.env.PAYU_SALT);
  settings.gateway_config.razorpayKeyId = process.env.RAZORPAY_KEY_ID
    ? process.env.RAZORPAY_KEY_ID.slice(0, 8) + "********"
    : "";
  settings.gateway_config.payuMerchantKey = process.env.PAYU_MERCHANT_KEY
    ? process.env.PAYU_MERCHANT_KEY.slice(0, 4) + "********"
    : "";

  return settings;
};

/**
 * Update a specific payment settings category
 * @param {string} key
 * @param {object} value
 * @param {number} userId
 * @returns {Promise<object>}
 */
const updatePaymentSettings = async (key, value, userId) => {
  const allowedKeys = ["gateway_config", "bank_instructions", "reminder_rules"];
  if (!allowedKeys.includes(key)) {
    const err = new Error(`Cannot modify settings key: '${key}'. Allowed: ${allowedKeys.join(", ")}`);
    err.statusCode = 422;
    throw err;
  }

  // Filter out any secret fields that should only come from environment
  const safeValue = { ...value };
  delete safeValue.razorpayKeySecret;
  delete safeValue.payuSalt;
  delete safeValue.smtpPassword;
  delete safeValue.whatsappAccessToken;

  await db.query(
    `INSERT INTO payment_settings (setting_key, setting_value, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
    [key, JSON.stringify(safeValue), userId || null]
  );

  return getPaymentSettings();
};

module.exports = {
  getPaymentSettings,
  updatePaymentSettings,
};
