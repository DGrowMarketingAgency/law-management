const smtpTransport = require("../services/email/smtpTransport");
const emailTemplateService = require("../services/email/emailTemplateService");
const emailQueueService = require("../services/email/emailQueueService");
const centralEmailService = require("../services/email/emailService");
const env = require("../config/env");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * GET /api/v1/email/status
 * Check SMTP transport configuration & server connectivity
 */
const getSmtpStatus = async (req, res, next) => {
  try {
    const isConfigured = Boolean(env.email.host && env.email.user);
    let connection = { ok: false, message: "SMTP credentials not configured in environment." };

    if (isConfigured && env.email.enabled) {
      connection = await smtpTransport.verifyConnection();
    }

    return successResponse(
      res,
      "SMTP service status retrieved.",
      {
        enabled: env.email.enabled,
        configured: isConfigured,
        host: env.email.host || "Not configured",
        port: env.email.port,
        secure: env.email.secure,
        from: env.email.from,
        fromName: env.email.fromName,
        replyTo: env.email.replyTo,
        connection,
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/email/test
 * Send a test email via SMTP
 */
const sendTestEmail = async (req, res, next) => {
  try {
    const { to } = req.body;
    const recipient = to || req.user?.email;

    if (!recipient) {
      return errorResponse(res, "Recipient email address is required.", "VALIDATION_ERROR", null, 400);
    }

    const testTime = new Date().toISOString();
    const result = await centralEmailService.sendEmail({
      to: recipient,
      subject: `[Test] Chambers SMTP Connection Test — ${env.email.fromName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0;">SMTP Test Successful</h2>
          <p>This is a verification email dispatched by <strong>${env.email.fromName}</strong> legal platform.</p>
          <div style="background: #f8fafc; padding: 14px; border-radius: 6px; font-size: 13px; color: #475569; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${testTime}</p>
            <p style="margin: 4px 0;"><strong>Host:</strong> ${env.email.host || "mock"}:${env.email.port}</p>
            <p style="margin: 4px 0;"><strong>Sender:</strong> ${env.email.from}</p>
          </div>
          <p style="font-size: 12px; color: #94a3b8;">Chambers Practice Management Security Core</p>
        </div>
      `,
      text: `SMTP Test Successful. Timestamp: ${testTime}. Dispatched from ${env.email.fromName}.`,
      metadata: {
        userId: req.user?.id,
        category: "SYSTEM",
      },
    });

    if (!result.success) {
      return errorResponse(
        res,
        result.error || "Failed to transmit test email.",
        result.errorCode || "SMTP_TEST_FAILED",
        result,
        500
      );
    }

    return successResponse(res, `Test email successfully dispatched to ${recipient}.`, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/email/templates
 * List all email templates
 */
const listTemplates = async (req, res, next) => {
  try {
    const { category } = req.query;
    const templates = await emailTemplateService.listTemplates(category);
    return successResponse(res, "Email templates retrieved.", { templates }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/email/templates/:key
 * Get template details by key
 */
const getTemplateByKey = async (req, res, next) => {
  try {
    const { key } = req.params;
    const template = await emailTemplateService.getTemplateByKey(key);
    if (!template) {
      return errorResponse(res, `Template '${key}' not found.`, "NOT_FOUND", null, 404);
    }
    return successResponse(res, "Email template details.", { template }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/email/templates/:id
 * Update template content
 */
const updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, subject_template, html_template, text_template, status } = req.body;

    const updated = await emailTemplateService.updateTemplate(id, {
      name,
      subject_template,
      html_template,
      text_template,
      status,
    });

    return successResponse(res, "Email template updated successfully.", { template: updated }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/email/logs
 * Retrieve email delivery logs
 */
const getDeliveryLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const page = parseInt(req.query.page, 10) || 1;
    const offset = (page - 1) * limit;
    const status = req.query.status || null;

    const result = await emailQueueService.getDeliveryLogs(limit, offset, status);
    return successResponse(
      res,
      "Email delivery logs retrieved.",
      {
        logs: result.logs,
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSmtpStatus,
  sendTestEmail,
  listTemplates,
  getTemplateByKey,
  updateTemplate,
  getDeliveryLogs,
};
