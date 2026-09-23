const db = require("../../config/database");
const env = require("../../config/env");

/**
 * HTML entities escape mapping to protect against XSS and template injection
 */
const escapeHtml = (str) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

class EmailTemplateService {
  /**
   * Render template string by substituting variables with HTML-escaped values
   * @param {string} templateStr
   * @param {object} variables
   * @param {boolean} isHtml
   * @returns {string}
   */
  renderString(templateStr, variables = {}, isHtml = true) {
    if (!templateStr) return "";

    return templateStr.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, varName) => {
      const val = variables[varName];
      if (val === undefined || val === null) {
        return "";
      }

      // Safe URL variables (like reset_url, payment_url, verification_url) shouldn't have & escaped to &amp; in href
      const rawUrlVars = [
        "reset_url",
        "verification_url",
        "payment_url",
        "invitation_url",
        "document_url",
        "signing_url",
        "onboarding_url",
        "app_url"
      ];

      if (rawUrlVars.includes(varName)) {
        return String(val);
      }

      return isHtml ? escapeHtml(val) : String(val);
    });
  }

  /**
   * Fetch active template by key from database with caching/fallback
   * @param {string} templateKey
   * @returns {Promise<object|null>}
   */
  async getTemplateByKey(templateKey) {
    const ALIASES = {
      two_factor_code: "two_factor_otp",
      user_invitation: "account_invitation",
      signature_requested: "signature_request",
      invoice_payment_link: "invoice_issued",
      payment_success: "payment_receipt",
    };
    const resolvedKey = ALIASES[templateKey] || templateKey;

    try {
      const [rows] = await db.query(
        `SELECT * FROM email_templates WHERE template_key = ? AND status = 'ACTIVE' LIMIT 1`,
        [resolvedKey]
      );
      if (rows.length > 0) {
        return rows[0];
      }
    } catch (err) {
      console.warn(`[Template Service Warn]: Failed to fetch template '${resolvedKey}' from DB:`, err.message);
    }

    return null;
  }

  /**
   * Render a complete template (Subject, HTML, Plaintext) with given variables
   * @param {string} templateKey
   * @param {object} variables
   * @returns {Promise<{ subject: string, html: string, text: string, category: string }>}
   */
  async renderTemplate(templateKey, variables = {}) {
    const tmpl = await this.getTemplateByKey(templateKey);

    if (!tmpl) {
      const err = new Error(`Email template '${templateKey}' not found or inactive.`);
      err.statusCode = 404;
      err.code = "TEMPLATE_NOT_FOUND";
      throw err;
    }

    // Standard chambers context variables
    const enrichedVars = {
      firm_name: env.email.fromName,
      app_url: env.email.appUrl,
      support_email: env.email.replyTo || env.email.from,
      user_name: variables.first_name || variables.name || "Counsel",
      first_name: variables.user_name || variables.name || "Counsel",
      otp: variables.otp_code || variables.otp || "",
      otp_code: variables.otp || variables.otp_code || "",
      ...variables,
    };
    // Ensure both user_name and first_name are populated if either is supplied
    if (variables.first_name && !variables.user_name) enrichedVars.user_name = variables.first_name;
    if (variables.user_name && !variables.first_name) enrichedVars.first_name = variables.user_name;
    if (variables.otp && !variables.otp_code) enrichedVars.otp_code = variables.otp;
    if (variables.otp_code && !variables.otp) enrichedVars.otp = variables.otp_code;

    const subject = this.renderString(tmpl.subject_template, enrichedVars, false);
    const html = this.renderString(tmpl.html_template, enrichedVars, true);
    const text = tmpl.text_template
      ? this.renderString(tmpl.text_template, enrichedVars, false)
      : subject;

    return {
      subject,
      html,
      text,
      category: tmpl.category,
    };
  }

  /**
   * List all templates for admin dashboard
   * @param {string|null} category
   * @returns {Promise<Array>}
   */
  async listTemplates(category = null) {
    let query = `SELECT id, template_key, name, category, subject_template, status, variables, updated_at FROM email_templates`;
    const params = [];
    if (category) {
      query += ` WHERE category = ?`;
      params.push(category);
    }
    query += ` ORDER BY category, name`;
    const [rows] = await db.query(query, params);
    return rows;
  }

  /**
   * Update template by ID
   * @param {number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async updateTemplate(id, data) {
    const fields = [];
    const params = [];

    if (data.name) {
      fields.push("name = ?");
      params.push(data.name.trim());
    }
    if (data.subject_template) {
      fields.push("subject_template = ?");
      params.push(data.subject_template.trim());
    }
    if (data.html_template) {
      // Basic check against dangerous scripts
      if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(data.html_template)) {
        const err = new Error("Executable <script> tags are strictly forbidden in email templates.");
        err.statusCode = 422;
        throw err;
      }
      fields.push("html_template = ?");
      params.push(data.html_template);
    }
    if (data.text_template !== undefined) {
      fields.push("text_template = ?");
      params.push(data.text_template);
    }
    if (data.status) {
      fields.push("status = ?");
      params.push(data.status);
    }

    if (fields.length === 0) {
      const err = new Error("No fields provided for update.");
      err.statusCode = 422;
      throw err;
    }

    params.push(id);
    await db.query(`UPDATE email_templates SET ${fields.join(", ")} WHERE id = ?`, params);
    const [rows] = await db.query(`SELECT * FROM email_templates WHERE id = ?`, [id]);
    return rows[0];
  }
}

module.exports = new EmailTemplateService();
