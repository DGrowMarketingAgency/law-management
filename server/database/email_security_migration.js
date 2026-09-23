/**
 * Migration Script: Prompt 12 — Central SMTP Email Service, OTP, 2FA & Security Architecture
 * Executes schema updates, creates tables, seeds standard templates, and maps RBAC permissions.
 */

const db = require('../config/database');

async function columnExists(tableName, columnName) {
  const [rows] = await db.query(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows[0].cnt > 0;
}

async function runEmailSecurityMigration() {
  console.log('=== STARTING PROMPT 12 EMAIL & SECURITY DATABASE MIGRATION ===');

  try {
    // 1. Extend users table
    console.log('\n[1/6] Extending users table...');
    if (!(await columnExists('users', 'email_verified_at'))) {
      await db.query(`ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL AFTER email`);
      console.log('  ✓ Added users.email_verified_at');
    }
    if (!(await columnExists('users', 'two_factor_method'))) {
      await db.query(`ALTER TABLE users ADD COLUMN two_factor_method VARCHAR(50) DEFAULT 'EMAIL_OTP' AFTER two_factor_enabled`);
      console.log('  ✓ Added users.two_factor_method');
    }

    // 2. Extend refresh_tokens table (Session Security)
    console.log('\n[2/6] Extending refresh_tokens table...');
    if (!(await columnExists('refresh_tokens', 'ip_address'))) {
      await db.query(`ALTER TABLE refresh_tokens ADD COLUMN ip_address VARCHAR(45) NULL AFTER revoked_at`);
      console.log('  ✓ Added refresh_tokens.ip_address');
    }
    if (!(await columnExists('refresh_tokens', 'user_agent'))) {
      await db.query(`ALTER TABLE refresh_tokens ADD COLUMN user_agent VARCHAR(255) NULL AFTER ip_address`);
      console.log('  ✓ Added refresh_tokens.user_agent');
    }
    if (!(await columnExists('refresh_tokens', 'device_info'))) {
      await db.query(`ALTER TABLE refresh_tokens ADD COLUMN device_info VARCHAR(150) NULL AFTER user_agent`);
      console.log('  ✓ Added refresh_tokens.device_info');
    }
    if (!(await columnExists('refresh_tokens', 'last_used_at'))) {
      await db.query(`ALTER TABLE refresh_tokens ADD COLUMN last_used_at DATETIME NULL AFTER device_info`);
      console.log('  ✓ Added refresh_tokens.last_used_at');
    }

    // 3. Extend otp_verifications table
    console.log('\n[3/6] Extending otp_verifications table...');
    await db.query(`
      ALTER TABLE otp_verifications 
      MODIFY COLUMN purpose ENUM('LOGIN', 'EMAIL_VERIFICATION', 'PASSWORD_RESET', 'TWO_FACTOR', 'TWO_FACTOR_SETUP', 'INVITATION', 'OTHER') NOT NULL
    `);
    console.log('  ✓ Updated otp_verifications.purpose ENUM');

    if (!(await columnExists('otp_verifications', 'resend_count'))) {
      await db.query(`ALTER TABLE otp_verifications ADD COLUMN resend_count INT DEFAULT 0 AFTER attempt_count`);
      console.log('  ✓ Added otp_verifications.resend_count');
    }
    if (!(await columnExists('otp_verifications', 'last_sent_at'))) {
      await db.query(`ALTER TABLE otp_verifications ADD COLUMN last_sent_at DATETIME NULL AFTER resend_count`);
      console.log('  ✓ Added otp_verifications.last_sent_at');
    }
    if (!(await columnExists('otp_verifications', 'status'))) {
      await db.query(`ALTER TABLE otp_verifications ADD COLUMN status ENUM('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED', 'CANCELLED') DEFAULT 'PENDING' AFTER last_sent_at`);
      console.log('  ✓ Added otp_verifications.status');
    }

    // 4. Create new security and email tables
    console.log('\n[4/6] Creating email and security tables...');

    // 4.1 email_templates
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_key VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        category ENUM('AUTH', 'SECURITY', 'BILLING', 'PAYMENT', 'DOCUMENT', 'WORKFORCE', 'NOTIFICATION', 'SYSTEM') NOT NULL,
        subject_template VARCHAR(255) NOT NULL,
        html_template MEDIUMTEXT NOT NULL,
        text_template TEXT NULL,
        variables JSON NULL,
        status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_template_category (category),
        INDEX idx_template_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✓ Verified table email_templates');

    // 4.2 email_logs
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        recipient VARCHAR(191) NOT NULL,
        template_key VARCHAR(100) NULL,
        subject VARCHAR(255) NOT NULL,
        category VARCHAR(50) NULL,
        status ENUM('QUEUED', 'SENDING', 'SENT', 'FAILED') DEFAULT 'QUEUED',
        message_id VARCHAR(150) NULL,
        provider_response TEXT NULL,
        error_code VARCHAR(100) NULL,
        attempt_count INT DEFAULT 1,
        sent_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_recipient (recipient),
        INDEX idx_email_status (status),
        INDEX idx_email_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✓ Verified table email_logs');

    // 4.3 password_reset_tokens
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        requested_ip VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reset_token_hash (token_hash),
        INDEX idx_reset_user_expires (user_id, expires_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✓ Verified table password_reset_tokens');

    // 4.4 auth_challenges
    await db.query(`
      CREATE TABLE IF NOT EXISTS auth_challenges (
        id VARCHAR(64) PRIMARY KEY,
        user_id INT NOT NULL,
        purpose ENUM('LOGIN_2FA', 'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'SECURITY_ACTION') NOT NULL,
        status ENUM('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
        expires_at DATETIME NOT NULL,
        attempt_count INT DEFAULT 0,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        verified_at DATETIME NULL,
        INDEX idx_challenge_user (user_id, purpose, status),
        INDEX idx_challenge_expires (expires_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✓ Verified table auth_challenges');

    // 5. Seed standard email templates
    console.log('\n[5/6] Seeding standard system email templates...');
    const templates = [
      // AUTH
      {
        template_key: 'login_otp',
        name: 'Login Verification OTP',
        category: 'AUTH',
        subject_template: 'Your Login Verification Code: {{otp}} — {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0f172a; margin-bottom: 8px;">Chambers Login Verification</h2>
            <p>Dear {{user_name}},</p>
            <p>A sign-in attempt was detected for your account. Please enter the one-time verification code below:</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0284c7;">{{otp}}</span>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #64748b;">Valid for {{expires_minutes}} minutes &bull; Single-use only</p>
            </div>
            <p style="font-size: 13px; color: #64748b;">If you did not initiate this sign-in request, your password may be compromised. Please notify chambers administration immediately.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">{{firm_name}} &bull; Confidential Legal Communications</p>
          </div>
        `,
        text_template: 'Your login verification code is {{otp}}. It expires in {{expires_minutes}} minutes. Never share this code with anyone.',
        variables: JSON.stringify(['user_name', 'otp', 'expires_minutes', 'firm_name'])
      },
      {
        template_key: 'email_verification',
        name: 'Email Address Verification',
        category: 'AUTH',
        subject_template: 'Verify Your Email Address — {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0f172a;">Verify Your Chambers Account Email</h2>
            <p>Hello {{user_name}},</p>
            <p>Please confirm that this email address is associated with your account on the Legal Practice Management Platform.</p>
            <p style="text-align: center; margin: 28px 0;">
              <a href="{{verification_url}}" style="background: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Verify Email Address</a>
            </p>
            <p style="font-size: 13px; color: #64748b;">Or paste this link into your browser:<br/><a href="{{verification_url}}">{{verification_url}}</a></p>
            <p style="font-size: 12px; color: #94a3b8;">This link expires in 24 hours.</p>
          </div>
        `,
        text_template: 'Please verify your email address by visiting: {{verification_url}}',
        variables: JSON.stringify(['user_name', 'verification_url', 'firm_name'])
      },
      {
        template_key: 'password_reset',
        name: 'Password Reset Request',
        category: 'AUTH',
        subject_template: 'Reset Your Password — {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0f172a;">Password Reset Instructions</h2>
            <p>Hello {{user_name}},</p>
            <p>We received a request to reset the password for your chambers account. Click the button below to choose a new password:</p>
            <p style="text-align: center; margin: 28px 0;">
              <a href="{{reset_url}}" style="background: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
            </p>
            <p style="font-size: 13px; color: #64748b;">If the button does not work, copy and paste this URL into your browser:<br/><a href="{{reset_url}}">{{reset_url}}</a></p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; margin-top: 20px; font-size: 13px; color: #991b1b;">
              ⚠️ This link expires in {{expires_minutes}} minutes and can only be used once. If you did not request this, please disregard this email.
            </div>
          </div>
        `,
        text_template: 'Reset your password using this link: {{reset_url}} (expires in {{expires_minutes}} minutes).',
        variables: JSON.stringify(['user_name', 'reset_url', 'expires_minutes', 'firm_name'])
      },
      {
        template_key: 'account_invitation',
        name: 'Chambers Account Invitation',
        category: 'AUTH',
        subject_template: 'Invitation to Join {{firm_name}} on Legal Practice Platform',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0f172a;">Welcome to {{firm_name}}</h2>
            <p>Hello {{user_name}},</p>
            <p>You have been invited to join the chambers digital management portal as <strong>{{role_name}}</strong>.</p>
            <p style="text-align: center; margin: 28px 0;">
              <a href="{{invitation_url}}" style="background: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Accept Invitation & Setup Password</a>
            </p>
            <p style="font-size: 12px; color: #94a3b8;">This invitation link will expire in 7 days.</p>
          </div>
        `,
        text_template: 'You have been invited to join {{firm_name}} as {{role_name}}. Setup your account: {{invitation_url}}',
        variables: JSON.stringify(['user_name', 'role_name', 'invitation_url', 'firm_name'])
      },

      // SECURITY
      {
        template_key: 'two_factor_otp',
        name: 'Two-Factor Authentication OTP',
        category: 'SECURITY',
        subject_template: 'Your Two-Factor Security Code: {{otp}} — {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0f172a;">Two-Factor Authentication (2FA)</h2>
            <p>Dear {{user_name}},</p>
            <p>Your two-step security verification code is:</p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #166534;">{{otp}}</span>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #15803d;">Expires in {{expires_minutes}} minutes</p>
            </div>
            <p style="font-size: 13px; color: #64748b;">Never share this code with anyone. Chambers personnel will never ask for your 2FA code.</p>
          </div>
        `,
        text_template: 'Your 2FA security code is {{otp}}. Expires in {{expires_minutes}} minutes.',
        variables: JSON.stringify(['user_name', 'otp', 'expires_minutes', 'firm_name'])
      },
      {
        template_key: 'new_login_alert',
        name: 'New Login Security Alert',
        category: 'SECURITY',
        subject_template: 'Security Alert: New Sign-in to Your Chambers Account — {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #b45309;">New Sign-in Detected</h2>
            <p>Hello {{user_name}},</p>
            <p>Your account was recently accessed from a new device or browser:</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Time:</strong> {{login_time}}</p>
              <p style="margin: 4px 0;"><strong>Device / Browser:</strong> {{device}}</p>
              <p style="margin: 4px 0;"><strong>IP Address:</strong> {{ip_address}}</p>
            </div>
            <p style="font-size: 13px; color: #64748b;">If this was you, you can safely ignore this alert. If you do not recognize this activity, please revoke active sessions and change your password immediately in Settings.</p>
          </div>
        `,
        text_template: 'New sign-in detected for {{user_name}} at {{login_time}} from {{device}} (IP: {{ip_address}}).',
        variables: JSON.stringify(['user_name', 'login_time', 'device', 'ip_address', 'firm_name'])
      },
      {
        template_key: 'password_changed',
        name: 'Password Changed Confirmation',
        category: 'SECURITY',
        subject_template: 'Security Notice: Your Chambers Password Was Changed — {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0f172a;">Password Updated Successfully</h2>
            <p>Hello {{user_name}},</p>
            <p>The password for your chambers account was changed on <strong>{{change_time}}</strong>.</p>
            <p style="font-size: 13px; color: #64748b;">All previous login sessions have been invalidated for security. You must sign in again with your new password.</p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; margin-top: 20px; font-size: 13px; color: #991b1b;">
              ⚠️ If you did not make this change, please contact chambers administration immediately.
            </div>
          </div>
        `,
        text_template: 'Your chambers account password was changed at {{change_time}}. If you did not do this, contact administration immediately.',
        variables: JSON.stringify(['user_name', 'change_time', 'firm_name'])
      },
      {
        template_key: 'two_factor_enabled',
        name: 'Two-Factor Authentication Enabled',
        category: 'SECURITY',
        subject_template: 'Security Confirmation: 2FA Has Been Enabled — {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #15803d;">Two-Factor Authentication Enabled</h2>
            <p>Hello {{user_name}},</p>
            <p>Two-factor authentication (Email OTP) has been successfully activated on your chambers account.</p>
            <p>Future logins will require both your password and a verification code sent to your registered email address.</p>
          </div>
        `,
        text_template: 'Two-factor authentication (Email OTP) has been successfully activated on your chambers account.',
        variables: JSON.stringify(['user_name', 'firm_name'])
      },
      {
        template_key: 'two_factor_disabled',
        name: 'Two-Factor Authentication Disabled',
        category: 'SECURITY',
        subject_template: 'Security Notice: 2FA Has Been Disabled — {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #b91c1c;">Two-Factor Authentication Disabled</h2>
            <p>Hello {{user_name}},</p>
            <p>Two-factor authentication has been turned off for your account.</p>
            <p style="font-size: 13px; color: #64748b;">If you did not make this change, please enable 2FA and change your password immediately in Settings.</p>
          </div>
        `,
        text_template: 'Two-factor authentication has been disabled for your chambers account.',
        variables: JSON.stringify(['user_name', 'firm_name'])
      },

      // BILLING & PAYMENTS
      {
        template_key: 'invoice_issued',
        name: 'Invoice Issued',
        category: 'BILLING',
        subject_template: 'Legal Fee Invoice {{invoice_number}} Issued — {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0f172a;">Legal Services Invoice</h2>
            <p>Dear {{client_name}},</p>
            <p>Please find details for Invoice <strong>{{invoice_number}}</strong> regarding legal representation.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Invoice Total:</strong> ₹{{invoice_total}}</p>
              <p style="margin: 4px 0;"><strong>Due Date:</strong> {{due_date}}</p>
            </div>
            <p style="text-align: center; margin: 28px 0;">
              <a href="{{payment_url}}" style="background: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View & Pay Invoice</a>
            </p>
          </div>
        `,
        text_template: 'Invoice {{invoice_number}} for ₹{{invoice_total}} is due on {{due_date}}. Pay online: {{payment_url}}',
        variables: JSON.stringify(['client_name', 'invoice_number', 'invoice_total', 'due_date', 'payment_url', 'firm_name'])
      },
      {
        template_key: 'payment_receipt',
        name: 'Official Payment Receipt',
        category: 'PAYMENT',
        subject_template: 'Payment Receipt {{receipt_number}} for Invoice {{invoice_number}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #15803d;">Payment Receipt Confirmed</h2>
            <p>Dear {{client_name}},</p>
            <p>We gratefully acknowledge receipt of ₹{{amount}} against Invoice <strong>{{invoice_number}}</strong>.</p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Receipt Number:</strong> {{receipt_number}}</p>
              <p style="margin: 4px 0;"><strong>Amount Received:</strong> ₹{{amount}}</p>
              <p style="margin: 4px 0;"><strong>Remaining Balance:</strong> ₹{{amount_due}}</p>
            </div>
          </div>
        `,
        text_template: 'Receipt {{receipt_number}}: Received ₹{{amount}} for Invoice {{invoice_number}}. Balance: ₹{{amount_due}}.',
        variables: JSON.stringify(['client_name', 'receipt_number', 'invoice_number', 'amount', 'amount_due', 'firm_name'])
      },

      // DOCUMENTS
      {
        template_key: 'document_shared',
        name: 'Document Shared Notification',
        category: 'DOCUMENT',
        subject_template: 'Document Shared With You: {{document_title}} — {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0f172a;">Legal Document Shared</h2>
            <p>Dear {{recipient_name}},</p>
            <p><strong>{{shared_by_name}}</strong> has shared the legal document <strong>{{document_title}}</strong> with you.</p>
            <p style="text-align: center; margin: 28px 0;">
              <a href="{{document_url}}" style="background: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Access Document</a>
            </p>
            <p style="font-size: 12px; color: #94a3b8;">This is a confidential legal transmission protected by attorney-client privilege.</p>
          </div>
        `,
        text_template: '{{shared_by_name}} shared {{document_title}} with you. Access: {{document_url}}',
        variables: JSON.stringify(['recipient_name', 'shared_by_name', 'document_title', 'document_url', 'firm_name'])
      },
      {
        template_key: 'signature_request',
        name: 'Electronic Signature Request',
        category: 'DOCUMENT',
        subject_template: 'Action Required: Signature Request for {{document_title}} — {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0f172a;">Signature Requested</h2>
            <p>Dear {{signer_name}},</p>
            <p>You have been requested to review and electronically sign <strong>{{document_title}}</strong>.</p>
            <p style="text-align: center; margin: 28px 0;">
              <a href="{{signing_url}}" style="background: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Review & Sign Document</a>
            </p>
            <p style="font-size: 12px; color: #94a3b8;">Compliant with Information Technology Act, 2000 digital signature provisions.</p>
          </div>
        `,
        text_template: 'Please review and sign {{document_title}}: {{signing_url}}',
        variables: JSON.stringify(['signer_name', 'document_title', 'signing_url', 'firm_name'])
      },

      // WORKFORCE
      {
        template_key: 'employee_invitation',
        name: 'Chambers Staff Invitation',
        category: 'WORKFORCE',
        subject_template: 'Welcome to the Team at {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0f172a;">Welcome to {{firm_name}}</h2>
            <p>Dear {{candidate_name}},</p>
            <p>We are delighted to welcome you as <strong>{{position_title}}</strong>. Please activate your account to begin your onboarding checklist.</p>
            <p style="text-align: center; margin: 28px 0;">
              <a href="{{onboarding_url}}" style="background: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Start Onboarding</a>
            </p>
          </div>
        `,
        text_template: 'Welcome to {{firm_name}} as {{position_title}}. Start onboarding: {{onboarding_url}}',
        variables: JSON.stringify(['candidate_name', 'position_title', 'onboarding_url', 'firm_name'])
      },
      {
        template_key: 'internship_invitation',
        name: 'Internship Onboarding Invitation',
        category: 'WORKFORCE',
        subject_template: 'Internship Confirmation & Portal Access — {{firm_name}}',
        html_template: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0f172a;">Chambers Internship Confirmation</h2>
            <p>Dear {{intern_name}},</p>
            <p>Your legal internship at {{firm_name}} has been confirmed from <strong>{{start_date}}</strong> to <strong>{{end_date}}</strong>.</p>
            <p style="text-align: center; margin: 28px 0;">
              <a href="{{onboarding_url}}" style="background: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Access Intern Portal</a>
            </p>
          </div>
        `,
        text_template: 'Your legal internship at {{firm_name}} is confirmed from {{start_date}} to {{end_date}}. Access portal: {{onboarding_url}}',
        variables: JSON.stringify(['intern_name', 'start_date', 'end_date', 'onboarding_url', 'firm_name'])
      }
    ];

    for (const t of templates) {
      await db.query(`
        INSERT INTO email_templates (template_key, name, category, subject_template, html_template, text_template, variables, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          category = VALUES(category),
          subject_template = VALUES(subject_template),
          html_template = VALUES(html_template),
          text_template = VALUES(text_template),
          variables = VALUES(variables)
      `, [t.template_key, t.name, t.category, t.subject_template, t.html_template.trim(), t.text_template, t.variables]);
    }
    console.log(`  ✓ Seeded ${templates.length} standard email templates.`);

    // 6. Seed RBAC Permissions
    console.log('\n[6/6] Seeding email and security RBAC permissions...');
    const permissions = [
      { name: 'EMAIL_VIEW', description: 'View SMTP configuration and email delivery logs', category: 'EMAIL' },
      { name: 'EMAIL_TEST', description: 'Trigger SMTP connection verification and test emails', category: 'EMAIL' },
      { name: 'EMAIL_TEMPLATE_VIEW', description: 'View system email templates', category: 'EMAIL' },
      { name: 'EMAIL_TEMPLATE_UPDATE', description: 'Edit and manage email templates', category: 'EMAIL' },
      { name: 'SECURITY_VIEW', description: 'View firm-wide security settings and active sessions', category: 'SECURITY' },
      { name: 'SECURITY_MANAGE', description: 'Manage firm security policies and session revocation', category: 'SECURITY' },
      { name: '2FA_MANAGE', description: 'Enable, configure, and disable two-factor authentication', category: 'SECURITY' },
      { name: 'SESSION_VIEW', description: 'Inspect active browser and device sessions', category: 'SECURITY' },
      { name: 'SESSION_REVOKE', description: 'Terminate and revoke active login sessions', category: 'SECURITY' }
    ];

    for (const p of permissions) {
      await db.query(`
        INSERT INTO permissions (name, description, category)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE description = VALUES(description), category = VALUES(category)
      `, [p.name, p.description, p.category]);
    }

    // Map permissions to OWNER, SENIOR_ASSOCIATE, etc.
    const [ownerRows] = await db.query(`SELECT id FROM roles WHERE name = 'OWNER'`);
    if (ownerRows.length > 0) {
      const ownerRoleId = ownerRows[0].id;
      const [permRows] = await db.query(`SELECT id FROM permissions WHERE name IN (${permissions.map(() => '?').join(',')})`, permissions.map(p => p.name));
      for (const pr of permRows) {
        await db.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [ownerRoleId, pr.id]);
      }
      console.log('  ✓ Assigned all email and security permissions to OWNER role');
    }

    // Map self-security permissions (2FA_MANAGE, SESSION_VIEW, SESSION_REVOKE) to other active roles
    const selfPermNames = ['2FA_MANAGE', 'SESSION_VIEW', 'SESSION_REVOKE'];
    const [otherRoles] = await db.query(`SELECT id, name FROM roles WHERE name != 'OWNER'`);
    const [selfPermRows] = await db.query(`SELECT id FROM permissions WHERE name IN (?, ?, ?)`, selfPermNames);

    for (const r of otherRoles) {
      for (const sp of selfPermRows) {
        await db.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [r.id, sp.id]);
      }
    }
    console.log('  ✓ Mapped self-service security permissions to all chamber roles.');

    console.log('\n=== PROMPT 12 MIGRATION COMPLETED SUCCESSFULLY ===\n');
  } catch (err) {
    console.error('\n❌ Migration Failed:', err);
    throw err;
  }
}

if (require.main === module) {
  runEmailSecurityMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runEmailSecurityMigration;
