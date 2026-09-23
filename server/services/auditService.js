const db = require("../config/database");

/**
 * Log an authentication / authorization security event
 * Explicitly sanitizes details to prevent logging passwords, OTPs, or raw secrets.
 * @param {number|null} userId
 * @param {string} event
 * @param {string} ipAddress
 * @param {string} userAgent
 * @param {object} details
 */
const logAuthEvent = async (
  userId,
  event,
  ipAddress = null,
  userAgent = null,
  details = {},
) => {
  try {
    // Sanitize any potential sensitive keys from details object
    const sanitizedDetails = { ...details };
    const sensitiveKeys = [
      "password",
      "newPassword",
      "currentPassword",
      "vaultPassword",
      "vault_password",
      "new_password",
      "current_password",
      "otp",
      "token",
      "refreshToken",
      "jwt",
      "vaultKey",
      "vault_key",
      "dek",
      "kek",
      "dataKey",
      "secret",
      "privateKey",
    ];
    for (const key of sensitiveKeys) {
      if (sanitizedDetails[key]) {
        sanitizedDetails[key] = "[REDACTED]";
      }
    }

    const query = `
      INSERT INTO auth_audit_logs (user_id, event, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?)
    `;

    await db.execute(query, [
      userId || null,
      event,
      ipAddress ? String(ipAddress).slice(0, 45) : null,
      userAgent ? String(userAgent).slice(0, 255) : null,
      JSON.stringify(sanitizedDetails),
    ]);

    // Also persist into centralized audit_logs table for administrative compliance
    try {
      const entityId = sanitizedDetails.workforceId || sanitizedDetails.targetUserId || null;
      await db.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, details)
         VALUES (?, ?, 'WORKFORCE', ?, ?, ?, ?)`,
        [
          userId || null,
          event,
          entityId ? parseInt(entityId, 10) : null,
          ipAddress ? String(ipAddress).slice(0, 45) : null,
          userAgent ? String(userAgent).slice(0, 255) : null,
          JSON.stringify(sanitizedDetails),
        ]
      );
    } catch (_) {}
  } catch (error) {
    // Audit log failure should not crash the main application, but should be logged on stderr
    console.error(
      "[Audit Log Error]: Failed to write auth audit log:",
      error.message,
    );
  }
};

/**
 * Log a CRM business event into crm_audit_logs
 * @param {number|null} userId
 * @param {string} action
 * @param {string} entityType
 * @param {number} entityId
 * @param {string} ipAddress
 * @param {string} userAgent
 * @param {object} details
 */
const logCrmEvent = async (
  userId,
  action,
  entityType,
  entityId,
  ipAddress = null,
  userAgent = null,
  details = {},
) => {
  try {
    const query = `
      INSERT INTO crm_audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const safeUserId = userId ? parseInt(userId, 10) : null;
    const safeAction = String(action || "UNKNOWN").slice(0, 50);
    const safeEntityType = String(entityType || "UNKNOWN").slice(0, 50);
    const safeEntityId = parseInt(entityId, 10) || 0;
    const safeIp = ipAddress ? String(ipAddress).slice(0, 45) : null;
    const safeUserAgent = userAgent ? String(userAgent).slice(0, 255) : null;
    const safeDetails = JSON.stringify(details || {});

    await db.query(query, [
      safeUserId,
      safeAction,
      safeEntityType,
      safeEntityId,
      safeIp,
      safeUserAgent,
      safeDetails,
    ]);
  } catch (error) {
    console.error(
      "[CRM Audit Log Error]: Failed to write crm audit log:",
      error.message,
    );
  }
};

/**
 * Log a Case business event into crm_audit_logs (or case audit logs)
 * @param {number|null} userId
 * @param {string} action
 * @param {string} entityType
 * @param {number} entityId
 * @param {string} ipAddress
 * @param {string} userAgent
 * @param {object} details
 */
const logCaseEvent = async (
  userId,
  action,
  entityType,
  entityId,
  ipAddress = null,
  userAgent = null,
  details = {},
) => {
  return await logCrmEvent(
    userId,
    action,
    entityType,
    entityId,
    ipAddress,
    userAgent,
    details,
  );
};

/**
 * Log a Limitation Deadline business event into crm_audit_logs
 * @param {number|null} userId
 * @param {string} action
 * @param {number} entityId
 * @param {string} ipAddress
 * @param {string} userAgent
 * @param {object} details
 */
const logDeadlineEvent = async (
  userId,
  action,
  entityId,
  ipAddress = null,
  userAgent = null,
  details = {},
) => {
  return await logCrmEvent(
    userId,
    action,
    "CASE_DEADLINE",
    entityId,
    ipAddress,
    userAgent,
    details,
  );
};

/**
 * Log a Document business/security event into crm_audit_logs
 * @param {number|null} userId
 * @param {string} action
 * @param {number} documentId
 * @param {string} ipAddress
 * @param {string} userAgent
 * @param {object} details
 */
const logDocumentEvent = async (
  userId,
  action,
  documentId,
  ipAddress = null,
  userAgent = null,
  details = {},
) => {
  return await logCrmEvent(
    userId,
    action,
    "DOCUMENT",
    documentId,
    ipAddress,
    userAgent,
    details,
  );
};

/**
 * Log a Hearing Reminder event into audit_logs and crm_audit_logs
 * @param {number|null} userId
 * @param {string} action
 * @param {number} reminderId
 * @param {string} ipAddress
 * @param {string} userAgent
 * @param {object} details
 */
const logHearingReminderEvent = async (
  userId,
  action,
  reminderId,
  ipAddress = null,
  userAgent = null,
  details = {},
) => {
    try {
      // Sanitize any potential sensitive keys (access tokens, secret keys)
      const sanitizedDetails = { ...details };
      const sensitiveKeys = [
        "password",
        "token",
        "accessToken",
        "WHATSAPP_ACCESS_TOKEN",
        "secret",
        "webhookSecret",
      ];
      for (const key of sensitiveKeys) {
        if (sanitizedDetails[key]) {
          sanitizedDetails[key] = "[REDACTED]";
        }
      }

      const safeUserId = userId ? parseInt(userId, 10) : null;
      const safeAction = String(action || "UNKNOWN").slice(0, 100);
      const safeEntityId = parseInt(reminderId, 10) || 0;
      const safeIp = ipAddress ? String(ipAddress).slice(0, 45) : null;
      const safeUserAgent = userAgent ? String(userAgent).slice(0, 255) : null;
      const safeDetails = JSON.stringify(sanitizedDetails);

      // Record in audit_logs
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, details)
       VALUES (?, ?, 'HEARING_REMINDER', ?, ?, ?, ?)`,
        [safeUserId, safeAction, safeEntityId, safeIp, safeUserAgent, safeDetails]
      );

      // Also record in crm_audit_logs for timeline consistency
      await db.query(
        `INSERT INTO crm_audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, details)
       VALUES (?, ?, 'HEARING_REMINDER', ?, ?, ?, ?)`,
        [safeUserId, safeAction, safeEntityId, safeIp, safeUserAgent, safeDetails]
      );
    } catch (error) {
      console.error(
        "[Hearing Reminder Audit Log Error]: Failed to write audit log:",
        error.message
      );
    }
  };

  module.exports = {
    logAuthEvent,
    logCrmEvent,
    logCaseEvent,
    logDeadlineEvent,
    logDocumentEvent,
    logHearingReminderEvent,
  };
