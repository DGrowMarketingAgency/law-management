const db = require("../../config/database");
const env = require("../../config/env");
const smtpTransport = require("./smtpTransport");

class EmailQueueService {
  /**
   * Log an email transmission event in email_logs table
   * @param {object} logData
   * @returns {Promise<number>} Inserted log ID
   */
  async createLog(logData) {
    try {
      const [res] = await db.query(
        `INSERT INTO email_logs (
          user_id, recipient, template_key, subject, category,
          status, message_id, provider_response, error_code, attempt_count, sent_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logData.userId || null,
          String(logData.recipient).toLowerCase().trim(),
          logData.templateKey || null,
          logData.subject,
          logData.category || "SYSTEM",
          logData.status || "QUEUED",
          logData.messageId || null,
          logData.providerResponse ? JSON.stringify(logData.providerResponse) : null,
          logData.errorCode || null,
          logData.attemptCount || 1,
          logData.sentAt || null,
        ]
      );
      return res.insertId;
    } catch (e) {
      console.warn("[Email Log Error]: Failed to create email log record:", e.message);
      return null;
    }
  }

  /**
   * Update existing email log record
   * @param {number} logId
   * @param {object} updates
   */
  async updateLog(logId, updates) {
    if (!logId) return;
    try {
      const fields = [];
      const params = [];

      if (updates.status) {
        fields.push("status = ?");
        params.push(updates.status);
      }
      if (updates.messageId) {
        fields.push("message_id = ?");
        params.push(updates.messageId);
      }
      if (updates.providerResponse) {
        fields.push("provider_response = ?");
        params.push(JSON.stringify(updates.providerResponse));
      }
      if (updates.errorCode) {
        fields.push("error_code = ?");
        params.push(updates.errorCode);
      }
      if (updates.attemptCount !== undefined) {
        fields.push("attempt_count = ?");
        params.push(updates.attemptCount);
      }
      if (updates.sentAt) {
        fields.push("sent_at = ?");
        params.push(updates.sentAt);
      }

      if (fields.length > 0) {
        params.push(logId);
        await db.query(`UPDATE email_logs SET ${fields.join(", ")} WHERE id = ?`, params);
      }
    } catch (e) {
      console.warn("[Email Log Update Error]:", e.message);
    }
  }

  /**
   * Dispatch email with automatic retry loop (up to maxRetries)
   * @param {object} mailOptions - Nodemailer mail options { to, subject, html, text, from, replyTo, attachments }
   * @param {object} metadata - { userId, templateKey, category }
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendWithRetry(mailOptions, metadata = {}) {
    const maxRetries = env.email.maxRetries;
    const recipient = mailOptions.to;

    const logId = await this.createLog({
      userId: metadata.userId,
      recipient,
      templateKey: metadata.templateKey,
      subject: mailOptions.subject,
      category: metadata.category,
      status: "QUEUED",
      attemptCount: 1,
    });

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.updateLog(logId, { status: "SENDING", attemptCount: attempt });

        const result = await smtpTransport.sendMail(mailOptions);

        await this.updateLog(logId, {
          status: "SENT",
          messageId: result.messageId,
          providerResponse: { response: result.response, accepted: result.accepted },
          sentAt: new Date(),
        });

        return {
          success: true,
          messageId: result.messageId,
          status: "SENT",
        };
      } catch (err) {
        lastError = err;
        console.warn(`[SMTP Transmission Attempt ${attempt}/${maxRetries} Failed]:`, err.message);

        // If credentials not configured, do not retry
        if (err.code === "EMAIL_NOT_CONFIGURED" || err.code === "EAUTH") {
          break;
        }

        // Exponential backoff delay for temporary socket/network errors
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retry attempts failed
    const errorCode = lastError?.code || "EMAIL_DELIVERY_FAILED";
    await this.updateLog(logId, {
      status: "FAILED",
      errorCode,
      providerResponse: { error: lastError?.message || "Unknown delivery failure" },
    });

    return {
      success: false,
      error: lastError?.message || "Failed to transmit email after maximum retries.",
      errorCode,
      status: "FAILED",
    };
  }

  /**
   * Fetch recent email delivery logs for admin inspection
   * @param {number} limit
   * @param {number} offset
   * @param {string|null} status
   * @returns {Promise<{ logs: Array, total: number }>}
   */
  async getDeliveryLogs(limit = 50, offset = 0, status = null) {
    let query = `SELECT el.*, u.first_name, u.last_name FROM email_logs el LEFT JOIN users u ON el.user_id = u.id`;
    let countQuery = `SELECT COUNT(*) as total FROM email_logs el`;
    const params = [];

    if (status) {
      query += ` WHERE el.status = ?`;
      countQuery += ` WHERE el.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY el.created_at DESC LIMIT ? OFFSET ?`;

    const [logs] = await db.query(query, [...params, limit, offset]);
    const [countRows] = await db.query(countQuery, params);

    return {
      logs,
      total: countRows[0]?.total || 0,
    };
  }
}

module.exports = new EmailQueueService();
