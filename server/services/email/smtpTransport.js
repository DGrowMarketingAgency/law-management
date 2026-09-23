const nodemailer = require("nodemailer");
const env = require("../../config/env");

/**
 * SMTP Transport Manager
 * Centralized Nodemailer transport singleton with connection verification and resilience.
 */
class SmtpTransport {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  /**
   * Initialize or refresh Nodemailer SMTP transporter instance
   */
  initTransporter() {
    const { smtp, enabled } = env.email;

    if (!enabled || !smtp.host || !smtp.user) {
      this.transporter = null;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure, // true for 465, false for 587
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5,
        connectionTimeout: 10000, // 10s
        greetingTimeout: 5000,
        socketTimeout: 15000,
        tls: {
          rejectUnauthorized: env.isProduction,
        },
      });
    } catch (err) {
      console.error("[SMTP Transport Init Error]:", err.message);
      this.transporter = null;
    }
  }

  /**
   * Check if SMTP credentials are configured
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(
      env.email.enabled &&
      env.email.smtp.host &&
      env.email.smtp.user &&
      env.email.smtp.pass
    );
  }

  /**
   * Safely verify SMTP connection without exposing passwords
   * @returns {Promise<{ success: boolean, message: string, code?: string }>}
   */
  async verifyConnection() {
    if (!env.email.enabled) {
      return {
        success: false,
        message: "Email sending is disabled in application environment (EMAIL_ENABLED=false).",
        code: "EMAIL_DISABLED",
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        message: "SMTP host, user, or password is not configured in environment.",
        code: "EMAIL_NOT_CONFIGURED",
      };
    }

    if (!this.transporter) {
      this.initTransporter();
    }

    if (!this.transporter) {
      return {
        success: false,
        message: "Failed to initialize SMTP transport instance.",
        code: "SMTP_INIT_FAILED",
      };
    }

    try {
      await this.transporter.verify();
      return {
        success: true,
        message: "SMTP connection verified successfully. Ready to transmit legal notices.",
      };
    } catch (err) {
      console.error("[SMTP Verify Error]:", err.message);
      let safeMessage = "SMTP server rejected connection.";
      if (err.code === "EAUTH") {
        safeMessage = "SMTP authentication failed. Verify SMTP username and app password.";
      } else if (err.code === "ESOCKET" || err.code === "ETIMEDOUT") {
        safeMessage = `Unable to connect to SMTP host ${env.email.smtp.host}:${env.email.smtp.port}. Network or firewall timeout.`;
      }

      return {
        success: false,
        message: safeMessage,
        code: err.code || "SMTP_CONNECTION_FAILED",
      };
    }
  }

  /**
   * Send mail through the transport
   * @param {object} mailOptions
   * @returns {Promise<object>} Nodemailer send result
   */
  async sendMail(mailOptions) {
    if (!this.isConfigured()) {
      const err = new Error("Email service is currently unavailable: SMTP credentials not configured.");
      err.code = "EMAIL_NOT_CONFIGURED";
      err.statusCode = 503;
      throw err;
    }

    if (!this.transporter) {
      this.initTransporter();
    }

    return await this.transporter.sendMail(mailOptions);
  }
}

module.exports = new SmtpTransport();
