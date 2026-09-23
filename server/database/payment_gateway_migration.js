const pool = require("../config/database");

/**
 * Prompt 9 Payment Gateways, Manual/Offline, Payment Links, Webhooks & Reminders Migration
 * Idempotent execution during server startup.
 */
async function runPaymentGatewayMigration() {
  const conn = await pool.getConnection();
  try {
    console.log("[Payment Gateway Migration]: Verifying and upgrading payment gateway schema...");

    // 1. Upgrade payments table columns
    const [existingCols] = await conn.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'
    `);
    const colNames = new Set(existingCols.map((c) => c.COLUMN_NAME));

    if (!colNames.has("payment_type")) {
      await conn.query(`
        ALTER TABLE payments 
        ADD COLUMN payment_type ENUM('ONLINE_GATEWAY', 'MANUAL', 'OFFLINE') NOT NULL DEFAULT 'MANUAL' AFTER client_id,
        ADD INDEX idx_pay_type (payment_type)
      `);
    }

    if (!colNames.has("provider")) {
      await conn.query(`
        ALTER TABLE payments 
        ADD COLUMN provider VARCHAR(50) NULL AFTER payment_method,
        ADD INDEX idx_pay_provider (provider)
      `);
    }

    if (!colNames.has("provider_order_id")) {
      await conn.query(`
        ALTER TABLE payments 
        ADD COLUMN provider_order_id VARCHAR(100) NULL AFTER provider,
        ADD INDEX idx_pay_order (provider_order_id)
      `);
    }

    if (!colNames.has("provider_payment_id")) {
      await conn.query(`
        ALTER TABLE payments 
        ADD COLUMN provider_payment_id VARCHAR(100) NULL AFTER provider_order_id,
        ADD INDEX idx_pay_provider_id (provider, provider_payment_id)
      `);
    }

    if (!colNames.has("provider_reference")) {
      await conn.query(`
        ALTER TABLE payments 
        ADD COLUMN provider_reference VARCHAR(100) NULL AFTER provider_payment_id
      `);
    }

    if (!colNames.has("currency")) {
      await conn.query(`
        ALTER TABLE payments 
        ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'INR' AFTER amount
      `);
    }

    if (!colNames.has("verified_at")) {
      await conn.query(`
        ALTER TABLE payments 
        ADD COLUMN verified_at DATETIME NULL AFTER received_by,
        ADD COLUMN verified_by INT NULL AFTER verified_at,
        ADD COLUMN rejection_reason VARCHAR(255) NULL AFTER verified_by,
        ADD FOREIGN KEY (verified_by) REFERENCES users (id) ON DELETE SET NULL
      `);
    }

    if (!colNames.has("failure_code")) {
      await conn.query(`
        ALTER TABLE payments 
        ADD COLUMN failure_code VARCHAR(100) NULL AFTER rejection_reason,
        ADD COLUMN failure_message VARCHAR(255) NULL AFTER failure_code
      `);
    }

    if (!colNames.has("proof_document_id")) {
      await conn.query(`
        ALTER TABLE payments 
        ADD COLUMN proof_document_id INT NULL AFTER failure_message,
        ADD FOREIGN KEY (proof_document_id) REFERENCES documents (id) ON DELETE SET NULL
      `);
    }

    if (!colNames.has("metadata")) {
      await conn.query(`
        ALTER TABLE payments 
        ADD COLUMN metadata JSON NULL AFTER proof_document_id
      `);
    }

    if (!colNames.has("idempotency_key")) {
      await conn.query(`
        ALTER TABLE payments 
        ADD COLUMN idempotency_key VARCHAR(128) NULL UNIQUE AFTER metadata
      `);
    }

    // Broaden payments.status ENUM
    try {
      await conn.query(`
        ALTER TABLE payments 
        MODIFY COLUMN status ENUM(
          'INITIATED', 'PENDING', 'PENDING_VERIFICATION', 'PENDING_CLEARANCE',
          'AUTHORIZED', 'SUCCESS', 'FAILED', 'REJECTED', 'CANCELLED',
          'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'
        ) NOT NULL DEFAULT 'SUCCESS'
      `);
    } catch (ignored) {}

    // Broaden payments.payment_method ENUM
    try {
      await conn.query(`
        ALTER TABLE payments 
        MODIFY COLUMN payment_method ENUM(
          'CASH', 'BANK_TRANSFER', 'UPI', 'UPI_MANUAL', 'CARD', 'CHEQUE',
          'RETAINER_DRAW', 'ONLINE_GATEWAY', 'RAZORPAY', 'PAYU', 'OTHER'
        ) NOT NULL DEFAULT 'BANK_TRANSFER'
      `);
    } catch (ignored) {}

    // 2. payment_gateway_transactions table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_gateway_transactions (
        id INT NOT NULL AUTO_INCREMENT,
        payment_id INT NULL,
        invoice_id INT NOT NULL,
        client_id INT NOT NULL,
        provider VARCHAR(50) NOT NULL,
        provider_order_id VARCHAR(100) NULL,
        provider_payment_id VARCHAR(100) NULL,
        provider_reference VARCHAR(100) NULL,
        provider_status VARCHAR(50) NULL,
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        request_reference VARCHAR(100) NULL,
        response_reference VARCHAR(100) NULL,
        status ENUM('INITIATED', 'PENDING', 'AUTHORIZED', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED') NOT NULL DEFAULT 'INITIATED',
        raw_response_redacted JSON NULL,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        verified_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_pgt_invoice (invoice_id),
        INDEX idx_pgt_client (client_id),
        INDEX idx_pgt_payment (payment_id),
        INDEX idx_pgt_provider_order (provider, provider_order_id),
        INDEX idx_pgt_provider_pay (provider, provider_payment_id),
        INDEX idx_pgt_status (status),
        FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
        FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. webhook_events table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id INT NOT NULL AUTO_INCREMENT,
        provider VARCHAR(50) NOT NULL,
        event_id VARCHAR(100) NULL,
        event_type VARCHAR(100) NOT NULL,
        signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
        processed BOOLEAN NOT NULL DEFAULT FALSE,
        processed_at DATETIME NULL,
        processing_error TEXT NULL,
        payload_hash VARCHAR(128) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_whe_provider_event (provider, event_id),
        INDEX idx_whe_payload_hash (payload_hash),
        INDEX idx_whe_processed (processed)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. payment_links table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_links (
        id INT NOT NULL AUTO_INCREMENT,
        invoice_id INT NOT NULL,
        client_id INT NOT NULL,
        provider ENUM('RAZORPAY', 'PAYU') NOT NULL,
        provider_payment_link_id VARCHAR(100) NOT NULL,
        payment_link_url VARCHAR(500) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        status ENUM('ACTIVE', 'PAID', 'PARTIALLY_PAID', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
        allow_partial BOOLEAN NOT NULL DEFAULT FALSE,
        description VARCHAR(255) NULL,
        expires_at DATETIME NULL,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_pl_invoice (invoice_id),
        INDEX idx_pl_client (client_id),
        INDEX idx_pl_provider_link (provider, provider_payment_link_id),
        INDEX idx_pl_status (status),
        FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. payment_refunds table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_refunds (
        id INT NOT NULL AUTO_INCREMENT,
        payment_id INT NOT NULL,
        invoice_id INT NOT NULL,
        provider VARCHAR(50) NOT NULL,
        provider_refund_id VARCHAR(100) NULL,
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        reason VARCHAR(255) NOT NULL,
        status ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'SUCCESS',
        requested_by INT NULL,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_prf_payment (payment_id),
        INDEX idx_prf_invoice (invoice_id),
        INDEX idx_prf_status (status),
        FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE RESTRICT,
        FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE RESTRICT,
        FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. notification_logs table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id INT NOT NULL AUTO_INCREMENT,
        channel ENUM('EMAIL', 'WHATSAPP') NOT NULL,
        recipient VARCHAR(200) NOT NULL,
        template VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL DEFAULT 'INVOICE',
        entity_id INT NOT NULL,
        provider VARCHAR(50) NULL,
        provider_message_id VARCHAR(100) NULL,
        status ENUM('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED') NOT NULL DEFAULT 'SENT',
        failure_reason TEXT NULL,
        sent_at DATETIME NULL,
        delivered_at DATETIME NULL,
        read_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_nl_entity (entity_type, entity_id),
        INDEX idx_nl_channel_recipient (channel, recipient),
        INDEX idx_nl_status (status),
        INDEX idx_nl_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. payment_settings table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_settings (
        id INT NOT NULL AUTO_INCREMENT,
        setting_key VARCHAR(100) NOT NULL,
        setting_value JSON NOT NULL,
        description VARCHAR(255) NULL,
        updated_by INT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_ps_key (setting_key),
        FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed default payment settings if not present
    const defaultSettings = [
      [
        "gateway_config",
        JSON.stringify({
          primaryGateway: "RAZORPAY",
          razorpayEnabled: true,
          payuEnabled: true,
          razorpayMode: process.env.RAZORPAY_MODE || "TEST",
          payuMode: process.env.PAYU_MODE || "TEST",
        }),
        "Primary and active payment gateway toggles and modes",
      ],
      [
        "bank_instructions",
        JSON.stringify({
          bankName: "State Bank of India",
          accountName: "Advocate Chambers Client Trust Account",
          accountNumber: "300123456789",
          ifscCode: "SBIN0000123",
          upiId: "chambers@sbi",
          notes: "Please mention the Invoice Number in the transfer remarks/reference.",
        }),
        "Firm bank and UPI payment instructions shown to clients for manual transfers",
      ],
      [
        "reminder_rules",
        JSON.stringify({
          daysBeforeDue: 3,
          dueTodayEnabled: true,
          overdueDays: [1, 7, 15],
          channels: { email: true, whatsapp: true },
          autoPaymentLink: true,
        }),
        "Automated payment reminder schedule rules",
      ],
    ];

    for (const [key, value, desc] of defaultSettings) {
      await conn.query(
        `INSERT IGNORE INTO payment_settings (setting_key, setting_value, description)
         VALUES (?, ?, ?)`,
        [key, value, desc]
      );
    }

    // 8. Register Prompt 9 RBAC Permissions
    const permissions = [
      ["PAYMENT_GATEWAY_CONFIG", "PAYMENTS", "Configure Razorpay, PayU, and payment gateway credentials"],
      ["PAYMENT_VERIFY", "PAYMENTS", "Verify or reject manual and offline payments"],
      ["PAYMENT_RECONCILE", "PAYMENTS", "Run payment reconciliation between gateway and chambers records"],
      ["PAYMENT_LINK_CREATE", "PAYMENTS", "Generate Razorpay or PayU payment links for invoices"],
      ["REMINDER_SEND", "BILLING", "Send manual and automated payment reminders via WhatsApp or Email"],
    ];

    for (const [name, category, description] of permissions) {
      await conn.query(
        `INSERT INTO permissions (name, category, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description), category = VALUES(category)`,
        [name, category, description]
      );
    }

    // OWNER gets all new permissions
    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.name = 'OWNER'
        AND p.name IN ('PAYMENT_GATEWAY_CONFIG', 'PAYMENT_VERIFY', 'PAYMENT_RECONCILE', 'PAYMENT_LINK_CREATE', 'REMINDER_SEND')
    `);

    // SENIOR_ASSOCIATE gets operational permissions (not master gateway secret config)
    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      JOIN permissions p ON p.name IN ('PAYMENT_VERIFY', 'PAYMENT_LINK_CREATE', 'REMINDER_SEND', 'PAYMENT_RECONCILE')
      WHERE r.name = 'SENIOR_ASSOCIATE'
    `);

    // CLIENT gets permission to view own links
    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      JOIN permissions p ON p.name IN ('PAYMENT_VIEW')
      WHERE r.name = 'CLIENT'
    `);

    // Strict check: JUNIOR_ASSOCIATE has NO financial or payment permissions
    await conn.query(`
      DELETE rp FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE r.name = 'JUNIOR_ASSOCIATE'
        AND p.category IN ('BILLING', 'PAYMENTS', 'RETAINERS')
    `);

    console.log("[Payment Gateway Migration]: Prompt 9 schema and RBAC verified successfully!");
  } catch (err) {
    console.error("[Payment Gateway Migration Error]:", err);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { runPaymentGatewayMigration };
