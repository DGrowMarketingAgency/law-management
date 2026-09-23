const db = require("../config/database");

/**
 * Sensitive financial keys that must NEVER be written to audit logs
 */
const SENSITIVE_KEYS = [
  "password",
  "password_hash",
  "pin",
  "upi_pin",
  "cvv",
  "cvc",
  "card_number",
  "account_number",
  "secret",
  "token",
  "authorization",
];

/**
 * Recursively sanitize details object to remove sensitive financial keys
 * @param {*} obj
 * @returns {*}
 */
const sanitizeDetails = (obj) => {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeDetails);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Log a financial/billing audit event
 * @param {number|null} userId
 * @param {string} event
 * @param {string} entityType - e.g. 'FEE_ENTRY', 'INVOICE', 'PAYMENT', 'RETAINER', 'REMINDER'
 * @param {number} entityId
 * @param {string|null} ipAddress
 * @param {string|null} userAgent
 * @param {object} [details={}]
 * @param {import('mysql2/promise').Connection} [conn=null] - Optional transaction connection
 * @returns {Promise<void>}
 */
const logBillingEvent = async (
  userId,
  event,
  entityType,
  entityId,
  ipAddress = null,
  userAgent = null,
  details = {},
  conn = null
) => {
  try {
    const client = conn || db;
    const sanitized = sanitizeDetails(details);
    const detailsJson = JSON.stringify(sanitized);

    await client.execute(
      `INSERT INTO billing_audit_logs 
       (user_id, event, entity_type, entity_id, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        event,
        entityType,
        entityId,
        ipAddress || null,
        userAgent ? String(userAgent).substring(0, 255) : null,
        detailsJson,
      ]
    );
  } catch (err) {
    console.error("[Billing Audit Log Error]: Failed to record financial audit log:", err.message);
    // Audit logging should not crash business operations unless in strict audit mode
  }
};

module.exports = {
  logBillingEvent,
  sanitizeDetails,
};
