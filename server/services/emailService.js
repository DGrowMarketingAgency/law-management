const centralEmailService = require("./email/emailService");
const emailTemplateService = require("./email/emailTemplateService");

/**
 * Root emailService proxy to maintain 100% backward compatibility
 * while routing all email requests through the unified central email subsystem.
 */

const TEMPLATES = {
  invoice_payment_link: {
    subject: "Payment Link for Invoice {{invoice_number}} — {{firm_name}}",
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #0f172a;">Invoice Payment Request</h2>
        <p>Dear {{client_name}},</p>
        <p>Please find the secure online payment link for your legal fee invoice <strong>{{invoice_number}}</strong>.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Outstanding Amount:</strong> ₹{{amount_due}}</p>
          <p style="margin: 4px 0;"><strong>Due Date:</strong> {{due_date}}</p>
        </div>
        <p style="text-align: center; margin: 30px 0;">
          <a href="{{payment_link}}" style="background: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Pay Securely Online</a>
        </p>
        <p style="font-size: 13px; color: #64748b;">If the button above does not work, paste this link into your browser:<br/><a href="{{payment_link}}">{{payment_link}}</a></p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">{{firm_name}} • Confidential Legal Communication</p>
      </div>
    `,
  },
  payment_reminder_before_due: {
    subject: "Upcoming Payment Reminder: Invoice {{invoice_number}} — {{firm_name}}",
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #0f172a;">Upcoming Payment Reminder</h2>
        <p>Dear {{client_name}},</p>
        <p>This is a gentle reminder that payment for Invoice <strong>{{invoice_number}}</strong> is due on <strong>{{due_date}}</strong>.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Amount Due:</strong> ₹{{amount_due}}</p>
        </div>
        <p style="text-align: center; margin: 30px 0;">
          <a href="{{payment_link}}" style="background: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Pay Invoice Now</a>
        </p>
        <p style="font-size: 12px; color: #94a3b8;">{{firm_name}}</p>
      </div>
    `,
  },
  payment_reminder_due_today: {
    subject: "Payment Due Today: Invoice {{invoice_number}} — {{firm_name}}",
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #b45309;">Invoice Payment Due Today</h2>
        <p>Dear {{client_name}},</p>
        <p>This is to remind you that your invoice <strong>{{invoice_number}}</strong> is due today, <strong>{{due_date}}</strong>.</p>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: #92400e;"><strong>Outstanding Balance:</strong> ₹{{amount_due}}</p>
        </div>
        <p style="text-align: center; margin: 30px 0;">
          <a href="{{payment_link}}" style="background: #b45309; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Complete Payment</a>
        </p>
        <p style="font-size: 12px; color: #94a3b8;">{{firm_name}}</p>
      </div>
    `,
  },
  payment_reminder_overdue: {
    subject: "Urgent: Overdue Payment Notice for Invoice {{invoice_number}} — {{firm_name}}",
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #b91c1c;">Overdue Invoice Notice</h2>
        <p>Dear {{client_name}},</p>
        <p>Invoice <strong>{{invoice_number}}</strong> with outstanding amount of <strong>₹{{amount_due}}</strong> was due on <strong>{{due_date}}</strong> and is currently overdue.</p>
        <p>Please clear the outstanding dues promptly using the secure link below or via direct bank transfer.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="{{payment_link}}" style="background: #b91c1c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Pay Overdue Bill</a>
        </p>
        <p style="font-size: 12px; color: #94a3b8;">{{firm_name}}</p>
      </div>
    `,
  },
  payment_success: {
    subject: "Payment Received: Receipt {{receipt_number}} for Invoice {{invoice_number}}",
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #15803d;">Payment Received With Thanks</h2>
        <p>Dear {{client_name}},</p>
        <p>We have received your payment of <strong>₹{{amount}}</strong> against Invoice <strong>{{invoice_number}}</strong>.</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Receipt Number:</strong> {{receipt_number}}</p>
          <p style="margin: 4px 0;"><strong>Amount Paid:</strong> ₹{{amount}}</p>
          <p style="margin: 4px 0;"><strong>Remaining Balance:</strong> ₹{{amount_due}}</p>
        </div>
        <p>Official payment receipt PDF is available for download in your client portal.</p>
        <p style="font-size: 12px; color: #94a3b8;">{{firm_name}}</p>
      </div>
    `,
  },
};

const renderTemplate = (templateStr, vars = {}) => {
  return String(templateStr).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    return vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : "";
  });
};

const getTemplate = (templateName, vars = {}) => {
  const tpl = TEMPLATES[templateName];
  if (!tpl) return null;
  return {
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.body, vars),
  };
};

const sendEmail = (params) => centralEmailService.sendEmail(params);

module.exports = {
  // Legacy & compatibility methods
  sendEmail,
  renderTemplate,
  getTemplate,
  TEMPLATES,

  // Central Email Service direct export
  centralEmailService,
  sendTemplateEmail: (params) => centralEmailService.sendTemplateEmail(params),
  testSmtpConnection: () => centralEmailService.testSmtpConnection(),
  sendOtpEmail: (params) => centralEmailService.sendOtpEmail(params),
  sendEmailVerification: (params) => centralEmailService.sendEmailVerification(params),
  sendPasswordResetEmail: (params) => centralEmailService.sendPasswordResetEmail(params),
  sendTwoFactorOtpEmail: (params) => centralEmailService.sendTwoFactorOtpEmail(params),
  sendLoginAlertEmail: (params) => centralEmailService.sendLoginAlertEmail(params),
  sendPasswordChangedEmail: (params) => centralEmailService.sendPasswordChangedEmail(params),
  sendTwoFactorEnabledEmail: (params) => centralEmailService.sendTwoFactorEnabledEmail(params),
  sendTwoFactorDisabledEmail: (params) => centralEmailService.sendTwoFactorDisabledEmail(params),
  sendInvitationEmail: (params) => centralEmailService.sendInvitationEmail(params),
  sendInvoiceEmail: (params) => centralEmailService.sendInvoiceEmail(params),
  sendPaymentReceiptEmail: (params) => centralEmailService.sendPaymentReceiptEmail(params),
  sendPaymentReminderEmail: (params) => centralEmailService.sendPaymentReminderEmail(params),
  sendPaymentSuccessEmail: (params) => centralEmailService.sendPaymentSuccessEmail(params),
  sendPaymentFailedEmail: (params) => centralEmailService.sendPaymentFailedEmail(params),
  sendRefundEmail: (params) => centralEmailService.sendRefundEmail(params),
  sendDocumentNotificationEmail: (params) => centralEmailService.sendDocumentNotificationEmail(params),
  sendSignatureRequestEmail: (params) => centralEmailService.sendSignatureRequestEmail(params),
  sendEmployeeInvitationEmail: (params) => centralEmailService.sendEmployeeInvitationEmail(params),
  sendInternshipNotificationEmail: (params) => centralEmailService.sendInternshipNotificationEmail(params),
};
