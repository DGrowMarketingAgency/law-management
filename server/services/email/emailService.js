const db = require("../../config/database");
const env = require("../../config/env");
const smtpTransport = require("./smtpTransport");
const emailTemplateService = require("./emailTemplateService");
const emailSecurityService = require("./emailSecurityService");
const emailQueueService = require("./emailQueueService");

/**
 * Fallback default templates if database template is not yet seeded
 */
const DEFAULT_FALLBACK_TEMPLATES = {
  invoice_payment_link: {
    subject: "Payment Link for Invoice {{invoice_number}} — {{firm_name}}",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
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
    </div>`
  },
  payment_reminder_before_due: {
    subject: "Upcoming Payment Reminder: Invoice {{invoice_number}} — {{firm_name}}",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: #0f172a;">Upcoming Payment Reminder</h2>
      <p>Dear {{client_name}},</p>
      <p>Payment for Invoice <strong>{{invoice_number}}</strong> is due on <strong>{{due_date}}</strong>.</p>
      <p style="margin: 4px 0;"><strong>Amount Due:</strong> ₹{{amount_due}}</p>
      <p><a href="{{payment_link}}">Pay Online</a></p>
    </div>`
  },
  payment_reminder_due_today: {
    subject: "Payment Due Today: Invoice {{invoice_number}} — {{firm_name}}",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: #b45309;">Invoice Payment Due Today</h2>
      <p>Dear {{client_name}},</p>
      <p>Invoice <strong>{{invoice_number}}</strong> is due today, <strong>{{due_date}}</strong>.</p>
      <p><strong>Outstanding Balance:</strong> ₹{{amount_due}}</p>
      <p><a href="{{payment_link}}">Pay Now</a></p>
    </div>`
  },
  payment_reminder_overdue: {
    subject: "Urgent: Overdue Payment Notice for Invoice {{invoice_number}} — {{firm_name}}",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: #b91c1c;">Overdue Invoice Notice</h2>
      <p>Dear {{client_name}},</p>
      <p>Invoice <strong>{{invoice_number}}</strong> of ₹{{amount_due}} is overdue.</p>
      <p><a href="{{payment_link}}">Pay Overdue Bill</a></p>
    </div>`
  },
  payment_success: {
    subject: "Payment Received: Receipt {{receipt_number}} for Invoice {{invoice_number}}",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: #15803d;">Payment Received With Thanks</h2>
      <p>Dear {{client_name}},</p>
      <p>We received payment of <strong>₹{{amount}}</strong> against Invoice <strong>{{invoice_number}}</strong>.</p>
      <p>Receipt: {{receipt_number}}</p>
    </div>`
  }
};

class CentralEmailService {
  /**
   * Test SMTP transport connection
   */
  async testSmtpConnection() {
    return await smtpTransport.verifyConnection();
  }

  /**
   * Send arbitrary email with rate-limiting, retries, and logging
   * @param {object} options
   */
  async sendEmail({
    to,
    subject,
    html,
    text,
    from,
    replyTo,
    attachments = [],
    metadata = {},
    // Legacy support fields:
    templateName,
    variables,
    customSubject,
    customBody,
    entityType,
    entityId,
  }) {
    // If templateName is passed, delegate to sendTemplateEmail
    if (templateName && !html) {
      return this.sendTemplateEmail({
        templateKey: templateName,
        to,
        variables: variables || {},
        customSubject,
        customBody,
        entityType,
        entityId,
        metadata,
      });
    }

    const recipient = String(to || "").trim().toLowerCase();
    if (!recipient) {
      throw new Error("Recipient email address is required.");
    }

    // Check hourly rate limit
    const rateCheck = await emailSecurityService.checkRateLimit(recipient, metadata.templateKey);
    if (!rateCheck.allowed) {
      console.warn(`[Email Rate Limit Exceeded]: Recipient ${recipient} reached ${rateCheck.count}/${rateCheck.max} emails per hour.`);
      // Record failed log
      await emailQueueService.createLog({
        userId: metadata.userId,
        recipient,
        templateKey: metadata.templateKey,
        subject,
        category: metadata.category || "SYSTEM",
        status: "FAILED",
        errorCode: "RATE_LIMIT_EXCEEDED",
      });

      return {
        success: false,
        error: "Hourly email rate limit exceeded for recipient. Please try again later.",
        errorCode: "RATE_LIMIT_EXCEEDED",
        status: "FAILED",
      };
    }

    const mailOptions = {
      from: from || `"${env.email.fromName}" <${env.email.from}>`,
      to: recipient,
      replyTo: replyTo || env.email.replyTo || env.email.from,
      subject,
      html,
      text: text || subject,
      attachments,
    };

    const sendResult = await emailQueueService.sendWithRetry(mailOptions, {
      userId: metadata.userId,
      templateKey: metadata.templateKey,
      category: metadata.category,
    });

    // Backward-compatibility: Log into notification_logs if entityType exists
    if (entityType) {
      try {
        const [notifResult] = await db.query(
          `INSERT INTO notification_logs (
            channel, recipient, template, entity_type, entity_id, provider,
            provider_message_id, status, failure_reason, sent_at
          ) VALUES ('EMAIL', ?, ?, ?, ?, 'SMTP', ?, ?, ?, ?)`,
          [
            recipient,
            metadata.templateKey || "CUSTOM_EMAIL",
            entityType,
            entityId || 0,
            sendResult.messageId || null,
            sendResult.success ? "SENT" : "FAILED",
            sendResult.error || null,
            sendResult.success ? new Date() : null,
          ]
        );
        sendResult.logId = notifResult.insertId;
      } catch (logErr) {
        console.warn("[Notification Log Warn]:", logErr.message);
      }
    }

    return sendResult;
  }

  /**
   * Send template-based email (retrieves DB template or fallback, escapes vars, queues & logs)
   */
  async sendTemplateEmail({
    templateKey,
    templateName,
    to,
    variables = {},
    customSubject = null,
    customBody = null,
    entityType = null,
    entityId = 0,
    metadata = {},
  }) {
    const key = templateKey || templateName;
    let subject = customSubject;
    let html = customBody;
    let text = "";
    let category = "GENERAL";

    // Try DB template first
    try {
      const rendered = await emailTemplateService.renderTemplate(key, variables);
      subject = subject || rendered.subject;
      html = html || rendered.html;
      text = rendered.text;
      category = rendered.category;
    } catch (err) {
      // Fallback to DEFAULT_FALLBACK_TEMPLATES if DB template not found
      if (DEFAULT_FALLBACK_TEMPLATES[key]) {
        const fallback = DEFAULT_FALLBACK_TEMPLATES[key];
        const enriched = {
          firm_name: env.email.fromName,
          ...variables,
        };
        subject = subject || emailTemplateService.renderString(fallback.subject, enriched, false);
        html = html || emailTemplateService.renderString(fallback.body, enriched, true);
        text = subject;
        category = "BILLING";
      } else {
        console.warn(`[Template Notice]: Template '${key}' not found, rendering minimal body.`);
        subject = subject || `Notification from ${env.email.fromName}`;
        html = html || `<p>${JSON.stringify(variables)}</p>`;
        text = subject;
      }
    }

    return this.sendEmail({
      to,
      subject,
      html,
      text,
      entityType,
      entityId,
      metadata: {
        ...metadata,
        templateKey: key,
        category: metadata.category || category,
      },
    });
  }

  // ==========================================
  // AUTHENTICATION & SECURITY EMAIL HELPERS
  // ==========================================

  /**
   * Send generic or login OTP
   */
  async sendOtpEmail({ to, otp, purpose = "LOGIN", expiryMinutes = env.otp.expiresMinutes, firstName = "Counsel" }) {
    const templateKey = purpose === "LOGIN" ? "login_otp" : "two_factor_code";
    return this.sendTemplateEmail({
      templateKey,
      to,
      variables: {
        first_name: firstName,
        otp_code: otp,
        otp,
        expiry_minutes: expiryMinutes,
        purpose,
      },
      metadata: { category: "AUTH" },
    });
  }

  /**
   * Send email address verification link
   */
  async sendEmailVerification({ to, verificationToken, verificationUrl, firstName = "Counsel" }) {
    const link = verificationUrl || `${env.email.appUrl}/verify-email?token=${verificationToken}`;
    return this.sendTemplateEmail({
      templateKey: "email_verification",
      to,
      variables: {
        first_name: firstName,
        verification_link: link,
        verification_url: link,
      },
      metadata: { category: "AUTH" },
    });
  }

  /**
   * Send secure single-use password reset link
   */
  async sendPasswordResetEmail({ to, resetToken, resetUrl, firstName = "Counsel", ip = "Unknown IP", userAgent = "Unknown Browser" }) {
    const link = resetUrl || `${env.email.appUrl}/reset-password?token=${resetToken}`;
    return this.sendTemplateEmail({
      templateKey: "password_reset",
      to,
      variables: {
        first_name: firstName,
        reset_link: link,
        reset_url: link,
        expiry_minutes: env.passwordReset.expiresMinutes,
        ip_address: ip,
        user_agent: userAgent,
      },
      metadata: { category: "SECURITY" },
    });
  }

  /**
   * Send 2FA email OTP
   */
  async sendTwoFactorOtpEmail({ to, otp, expiryMinutes = env.otp.expiresMinutes, firstName = "Counsel", ip = "Unknown IP", userAgent = "Unknown Browser" }) {
    return this.sendTemplateEmail({
      templateKey: "two_factor_code",
      to,
      variables: {
        first_name: firstName,
        otp_code: otp,
        otp,
        expiry_minutes: expiryMinutes,
        ip_address: ip,
        user_agent: userAgent,
      },
      metadata: { category: "SECURITY" },
    });
  }

  /**
   * Send suspicious/new login alert email
   */
  async sendLoginAlertEmail({ to, firstName = "Counsel", ip = "Unknown IP", userAgent = "Unknown Browser", time = new Date().toUTCString(), location = "Unknown" }) {
    return this.sendTemplateEmail({
      templateKey: "new_login_alert",
      to,
      variables: {
        first_name: firstName,
        login_time: time,
        ip_address: ip,
        user_agent: userAgent,
        location,
      },
      metadata: { category: "SECURITY" },
    });
  }

  /**
   * Send password changed confirmation alert
   */
  async sendPasswordChangedEmail({ to, firstName = "Counsel", ip = "Unknown IP", userAgent = "Unknown Browser", time = new Date().toUTCString() }) {
    return this.sendTemplateEmail({
      templateKey: "password_changed",
      to,
      variables: {
        first_name: firstName,
        change_time: time,
        ip_address: ip,
        user_agent: userAgent,
      },
      metadata: { category: "SECURITY" },
    });
  }

  /**
   * Send 2FA enabled alert
   */
  async sendTwoFactorEnabledEmail({ to, firstName = "Counsel", ip = "Unknown IP", userAgent = "Unknown Browser", time = new Date().toUTCString() }) {
    return this.sendTemplateEmail({
      templateKey: "two_factor_enabled",
      to,
      variables: {
        first_name: firstName,
        enable_time: time,
        ip_address: ip,
        user_agent: userAgent,
      },
      metadata: { category: "SECURITY" },
    });
  }

  /**
   * Send 2FA disabled alert
   */
  async sendTwoFactorDisabledEmail({ to, firstName = "Counsel", ip = "Unknown IP", userAgent = "Unknown Browser", time = new Date().toUTCString() }) {
    return this.sendTemplateEmail({
      templateKey: "two_factor_disabled",
      to,
      variables: {
        first_name: firstName,
        disable_time: time,
        ip_address: ip,
        user_agent: userAgent,
      },
      metadata: { category: "SECURITY" },
    });
  }

  /**
   * Send user invitation email
   */
  async sendInvitationEmail({ to, inviteToken, inviteUrl, roleName = "Member", firmName = env.email.fromName, inviterName = "Chambers Administrator" }) {
    const link = inviteUrl || `${env.email.appUrl}/accept-invitation?token=${inviteToken}`;
    return this.sendTemplateEmail({
      templateKey: "user_invitation",
      to,
      variables: {
        role_name: roleName,
        firm_name: firmName,
        inviter_name: inviterName,
        invitation_link: link,
        invitation_url: link,
      },
      metadata: { category: "WORKFORCE" },
    });
  }

  // ==========================================
  // BILLING & PAYMENT EMAIL HELPERS
  // ==========================================

  /**
   * Send invoice email with optional PDF attachment
   */
  async sendInvoiceEmail({ to, clientName, invoiceNumber, amountDue, dueDate, paymentUrl, pdfBuffer = null }) {
    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `Invoice_${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      });
    }

    return this.sendTemplateEmail({
      templateKey: "invoice_payment_link",
      to,
      variables: {
        client_name: clientName,
        invoice_number: invoiceNumber,
        amount_due: amountDue,
        due_date: dueDate,
        payment_link: paymentUrl,
        payment_url: paymentUrl,
      },
      attachments,
      entityType: "INVOICE",
      metadata: { category: "BILLING" },
    });
  }

  /**
   * Send payment receipt email
   */
  async sendPaymentReceiptEmail({ to, clientName, invoiceNumber, receiptNumber, amountPaid, amountDue = 0, pdfBuffer = null }) {
    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `Receipt_${receiptNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      });
    }

    return this.sendTemplateEmail({
      templateKey: "payment_success",
      to,
      variables: {
        client_name: clientName,
        invoice_number: invoiceNumber,
        receipt_number: receiptNumber,
        amount: amountPaid,
        amount_due: amountDue,
      },
      attachments,
      entityType: "PAYMENT",
      metadata: { category: "PAYMENT" },
    });
  }

  /**
   * Send payment reminder email
   */
  async sendPaymentReminderEmail({ to, clientName, invoiceNumber, amountDue, dueDate, reminderType = "BEFORE_DUE", paymentUrl }) {
    let templateKey = "payment_reminder_before_due";
    if (reminderType === "DUE_TODAY") {
      templateKey = "payment_reminder_due_today";
    } else if (reminderType === "OVERDUE") {
      templateKey = "payment_reminder_overdue";
    }

    return this.sendTemplateEmail({
      templateKey,
      to,
      variables: {
        client_name: clientName,
        invoice_number: invoiceNumber,
        amount_due: amountDue,
        due_date: dueDate,
        payment_link: paymentUrl,
        payment_url: paymentUrl,
      },
      entityType: "INVOICE_REMINDER",
      metadata: { category: "BILLING" },
    });
  }

  /**
   * Send payment success confirmation
   */
  async sendPaymentSuccessEmail({ to, clientName, invoiceNumber, amount, receiptNumber }) {
    return this.sendPaymentReceiptEmail({
      to,
      clientName,
      invoiceNumber,
      receiptNumber,
      amountPaid: amount,
    });
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailedEmail({ to, clientName, invoiceNumber, amount, failureReason, retryUrl }) {
    return this.sendTemplateEmail({
      templateKey: "payment_failed",
      to,
      variables: {
        client_name: clientName,
        invoice_number: invoiceNumber,
        amount,
        failure_reason: failureReason || "Transaction declined by issuing bank",
        retry_link: retryUrl,
        retry_url: retryUrl,
      },
      entityType: "PAYMENT",
      metadata: { category: "PAYMENT" },
    });
  }

  /**
   * Send refund notification email
   */
  async sendRefundEmail({ to, clientName, invoiceNumber, refundAmount, reason = "Requested by counsel" }) {
    return this.sendTemplateEmail({
      templateKey: "refund_processed",
      to,
      variables: {
        client_name: clientName,
        invoice_number: invoiceNumber,
        refund_amount: refundAmount,
        reason,
      },
      entityType: "PAYMENT",
      metadata: { category: "PAYMENT" },
    });
  }

  // ==========================================
  // DOCUMENT & WORKFORCE EMAIL HELPERS
  // ==========================================

  /**
   * Send document notification email
   */
  async sendDocumentNotificationEmail({ to, recipientName, documentTitle, caseNumber = "N/A", actionUrl, actionType = "Shared" }) {
    return this.sendTemplateEmail({
      templateKey: "document_shared",
      to,
      variables: {
        recipient_name: recipientName,
        document_title: documentTitle,
        case_number: caseNumber,
        action_type: actionType,
        document_link: actionUrl,
        document_url: actionUrl,
      },
      metadata: { category: "DOCUMENT" },
    });
  }

  /**
   * Send e-Signature request email
   */
  async sendSignatureRequestEmail({ to, signerName, documentTitle, signingUrl, expiryDays = 7, senderName = "Legal Counsel" }) {
    return this.sendTemplateEmail({
      templateKey: "signature_requested",
      to,
      variables: {
        signer_name: signerName,
        document_title: documentTitle,
        signing_link: signingUrl,
        signing_url: signingUrl,
        expiry_days: expiryDays,
        sender_name: senderName,
      },
      metadata: { category: "DOCUMENT" },
    });
  }

  /**
   * Send employee onboarding invitation email
   */
  async sendEmployeeInvitationEmail({ to, employeeName, role, onboardingUrl }) {
    return this.sendTemplateEmail({
      templateKey: "user_invitation",
      to,
      variables: {
        inviter_name: "Chambers HR",
        firm_name: env.email.fromName,
        role_name: role,
        invitation_link: onboardingUrl,
        invitation_url: onboardingUrl,
      },
      metadata: { category: "WORKFORCE" },
    });
  }

  /**
   * Send internship notification email
   */
  async sendInternshipNotificationEmail({ to, internName, stage, actionUrl }) {
    return this.sendTemplateEmail({
      templateKey: "internship_stage_update",
      to,
      variables: {
        intern_name: internName,
        stage_name: stage,
        action_link: actionUrl,
        action_url: actionUrl,
      },
      metadata: { category: "WORKFORCE" },
    });
  }
}

module.exports = new CentralEmailService();
