const pool = require("../config/database");

/**
 * Prompt 8 Billing, Invoicing, Payments, Retainers & RBAC Migration
 * Idempotent execution that runs automatically during server initialization.
 */
async function runBillingMigration() {
  const conn = await pool.getConnection();
  try {
    console.log("[Billing Migration]: Verifying and upgrading billing schema...");

    // 1. fee_entries table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS fee_entries (
        id INT NOT NULL AUTO_INCREMENT,
        client_id INT NOT NULL,
        case_id INT NULL,
        hearing_id INT NULL,
        fee_type ENUM('TIME', 'APPEARANCE', 'FIXED_FEE', 'EXPENSE', 'RETAINER_DRAW', 'OTHER') NOT NULL DEFAULT 'FIXED_FEE',
        description TEXT NOT NULL,
        service_date DATE NOT NULL,
        duration_minutes INT NULL,
        hourly_rate DECIMAL(12, 2) NULL,
        quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
        unit VARCHAR(50) NOT NULL DEFAULT 'UNIT',
        rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        amount DECIMAL(12, 2) NOT NULL,
        is_taxable BOOLEAN NOT NULL DEFAULT TRUE,
        tax_category VARCHAR(50) NULL DEFAULT 'LEGAL_SERVICES',
        invoice_id INT NULL,
        status ENUM('UNBILLED', 'INVOICED', 'CANCELLED') NOT NULL DEFAULT 'UNBILLED',
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        PRIMARY KEY (id),
        INDEX idx_fe_client (client_id),
        INDEX idx_fe_case (case_id),
        INDEX idx_fe_hearing (hearing_id),
        INDEX idx_fe_invoice (invoice_id),
        INDEX idx_fe_status (status),
        INDEX idx_fe_service_date (service_date),
        CONSTRAINT fk_fe_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
        CONSTRAINT fk_fe_case FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE SET NULL,
        CONSTRAINT fk_fe_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. invoices table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INT NOT NULL AUTO_INCREMENT,
        invoice_number VARCHAR(100) NOT NULL,
        client_id INT NOT NULL,
        case_id INT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        status ENUM('DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID') NOT NULL DEFAULT 'DRAFT',
        subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        discount_type ENUM('PERCENTAGE', 'FIXED') NOT NULL DEFAULT 'FIXED',
        discount_value DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        taxable_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        gst_mode ENUM('STANDARD', 'RCM', 'EXEMPT', 'NOT_APPLICABLE', 'MANUAL_REVIEW') NOT NULL DEFAULT 'STANDARD',
        tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
        cgst_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        sgst_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        igst_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        amount_due DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        rcm_applicable BOOLEAN NOT NULL DEFAULT FALSE,
        rcm_reason VARCHAR(255) NULL,
        place_of_supply VARCHAR(100) NULL DEFAULT 'Tamil Nadu',
        notes TEXT NULL,
        terms TEXT NULL,
        billing_name VARCHAR(200) NOT NULL,
        billing_address TEXT NULL,
        billing_email VARCHAR(191) NULL,
        billing_phone VARCHAR(50) NULL,
        client_gstin VARCHAR(50) NULL,
        advocate_business_name VARCHAR(200) NULL,
        advocate_address TEXT NULL,
        advocate_gstin VARCHAR(50) NULL,
        snapshot_data JSON NULL,
        created_by INT NULL,
        issued_by INT NULL,
        issued_at DATETIME NULL,
        cancelled_by INT NULL,
        cancelled_at DATETIME NULL,
        cancellation_reason VARCHAR(255) NULL,
        voided_by INT NULL,
        voided_at DATETIME NULL,
        void_reason VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_invoices_number (invoice_number),
        INDEX idx_invoices_client (client_id),
        INDEX idx_invoices_case (case_id),
        INDEX idx_invoices_status (status),
        INDEX idx_invoices_date (invoice_date),
        INDEX idx_invoices_due (due_date),
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
        FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
        FOREIGN KEY (issued_by) REFERENCES users (id) ON DELETE SET NULL,
        FOREIGN KEY (cancelled_by) REFERENCES users (id) ON DELETE SET NULL,
        FOREIGN KEY (voided_by) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Add fee_entries -> invoice_id constraint if not already linked
    try {
      const [existingFk] = await conn.query(`
        SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fee_entries' AND COLUMN_NAME = 'invoice_id' AND REFERENCED_TABLE_NAME = 'invoices'
      `);
      if (existingFk.length === 0) {
        await conn.query(`
          ALTER TABLE fee_entries
          ADD FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE SET NULL
        `);
      }
    } catch (ignored) {
      // Constraint already exists or handled
    }

    // 3. invoice_items table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INT NOT NULL AUTO_INCREMENT,
        invoice_id INT NOT NULL,
        fee_entry_id INT NULL,
        description VARCHAR(255) NOT NULL,
        service_date DATE NULL,
        quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
        unit VARCHAR(50) NOT NULL DEFAULT 'UNIT',
        unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        discount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        taxable_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
        tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        line_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_ii_invoice (invoice_id),
        INDEX idx_ii_fee_entry (fee_entry_id),
        FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
        FOREIGN KEY (fee_entry_id) REFERENCES fee_entries (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. payments table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT NOT NULL AUTO_INCREMENT,
        receipt_number VARCHAR(100) NOT NULL,
        client_id INT NOT NULL,
        invoice_id INT NOT NULL,
        payment_date DATE NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        payment_method ENUM('CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'RETAINER_DRAW', 'ONLINE_GATEWAY', 'OTHER') NOT NULL DEFAULT 'BANK_TRANSFER',
        reference_number VARCHAR(100) NULL,
        transaction_id VARCHAR(100) NULL,
        status ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'SUCCESS',
        notes TEXT NULL,
        received_by INT NULL,
        refunded_at DATETIME NULL,
        refund_reason VARCHAR(255) NULL,
        refunded_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_payments_receipt (receipt_number),
        INDEX idx_pay_invoice (invoice_id),
        INDEX idx_pay_client (client_id),
        INDEX idx_pay_status (status),
        INDEX idx_pay_date (payment_date),
        FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE RESTRICT,
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
        FOREIGN KEY (received_by) REFERENCES users (id) ON DELETE SET NULL,
        FOREIGN KEY (refunded_by) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. retainers table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS retainers (
        id INT NOT NULL AUTO_INCREMENT,
        client_id INT NOT NULL,
        case_id INT NULL,
        name VARCHAR(200) NOT NULL,
        opening_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        current_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        start_date DATE NOT NULL,
        expiry_date DATE NULL,
        status ENUM('ACTIVE', 'EXHAUSTED', 'CLOSED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
        notes TEXT NULL,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_ret_client (client_id),
        INDEX idx_ret_case (case_id),
        INDEX idx_ret_status (status),
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
        FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. retainer_transactions table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS retainer_transactions (
        id INT NOT NULL AUTO_INCREMENT,
        retainer_id INT NOT NULL,
        transaction_type ENUM('DEPOSIT', 'DRAW_DOWN', 'REFUND', 'ADJUSTMENT') NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        transaction_date DATE NOT NULL,
        balance_after DECIMAL(12, 2) NOT NULL,
        invoice_id INT NULL,
        fee_entry_id INT NULL,
        reference VARCHAR(100) NULL,
        description TEXT NOT NULL,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_rtx_retainer (retainer_id),
        INDEX idx_rtx_invoice (invoice_id),
        INDEX idx_rtx_type (transaction_type),
        FOREIGN KEY (retainer_id) REFERENCES retainers (id) ON DELETE RESTRICT,
        FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE SET NULL,
        FOREIGN KEY (fee_entry_id) REFERENCES fee_entries (id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. invoice_reminders table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS invoice_reminders (
        id INT NOT NULL AUTO_INCREMENT,
        invoice_id INT NOT NULL,
        reminder_type ENUM('BEFORE_DUE', 'DUE_TODAY', 'OVERDUE', 'CUSTOM') NOT NULL,
        channel ENUM('EMAIL', 'WHATSAPP', 'CLIENT_PORTAL') NOT NULL DEFAULT 'CLIENT_PORTAL',
        status ENUM('SCHEDULED', 'SENT', 'NOT_CONFIGURED', 'FAILED') NOT NULL DEFAULT 'NOT_CONFIGURED',
        recipient VARCHAR(200) NOT NULL,
        subject VARCHAR(255) NULL,
        message TEXT NOT NULL,
        scheduled_for DATE NOT NULL,
        sent_at DATETIME NULL,
        created_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_rem_invoice (invoice_id),
        INDEX idx_rem_type_date (invoice_id, reminder_type, scheduled_for),
        FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. billing_audit_logs table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS billing_audit_logs (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NULL,
        event VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INT NOT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        details JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_ba_user (user_id),
        INDEX idx_ba_event (event),
        INDEX idx_ba_entity (entity_type, entity_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Extend clients table with user_id for Client Portal mapping
    const [clientCols] = await conn.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'user_id'
    `);
    if (clientCols.length === 0) {
      try {
        await conn.query(`
          ALTER TABLE clients
          ADD COLUMN user_id INT NULL UNIQUE AFTER contact_id,
          ADD CONSTRAINT fk_cl_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        `);
        console.log("[Billing Migration]: Added user_id column to clients table.");
      } catch (err) {
        console.warn("[Billing Migration]: Note on adding clients.user_id:", err.message);
      }
    }

    // 10. Register Prompt 8 Billing Permissions
    const permissions = [
      ['BILLING_VIEW', 'BILLING', 'View chambers bills, invoices, retainers, and financial records'],
      ['BILLING_CREATE', 'BILLING', 'Create professional fee entries and draft invoices'],
      ['BILLING_UPDATE', 'BILLING', 'Modify draft invoice line items and fee amounts'],
      ['BILLING_ISSUE', 'BILLING', 'Issue official invoices and lock financial values'],
      ['BILLING_CANCEL', 'BILLING', 'Cancel unissued or issued chambers invoices'],
      ['BILLING_VOID', 'BILLING', 'Void erroneous invoices with audited reason'],
      ['BILLING_EXPORT', 'BILLING', 'Export billing records for Chartered Accountant and Tally'],
      ['BILLING_REMINDER_SEND', 'BILLING', 'Send and preview payment reminder notices'],
      ['INVOICE_VIEW', 'BILLING', 'View invoices and fee notes'],
      ['INVOICE_CREATE', 'BILLING', 'Create draft fee notes and invoices'],
      ['INVOICE_UPDATE', 'BILLING', 'Update draft invoices'],
      ['INVOICE_ISSUE', 'BILLING', 'Issue invoices and lock snapshot'],
      ['INVOICE_CANCEL', 'BILLING', 'Cancel or void invoices'],
      ['FEE_ENTRY_VIEW', 'BILLING', 'View billable fee entries and time sheets'],
      ['FEE_ENTRY_CREATE', 'BILLING', 'Create billable fee entries'],
      ['FEE_ENTRY_UPDATE', 'BILLING', 'Update unbilled fee entries'],
      ['FEE_ENTRY_DELETE', 'BILLING', 'Delete unbilled fee entries'],
      ['PAYMENT_VIEW', 'PAYMENTS', 'View client payments and transaction records'],
      ['PAYMENT_CREATE', 'PAYMENTS', 'Record payments and issue official receipts'],
      ['PAYMENT_RECORD', 'PAYMENTS', 'Record payment against invoice'],
      ['PAYMENT_REFUND', 'PAYMENTS', 'Process payment reversals and refunds'],
      ['RETAINER_VIEW', 'RETAINERS', 'View client retainers and trust accounts'],
      ['RETAINER_CREATE', 'RETAINERS', 'Open new client retainer accounts'],
      ['RETAINER_UPDATE', 'RETAINERS', 'Manage retainer deposits and draw-downs'],
      ['RETAINER_MANAGE', 'RETAINERS', 'Full retainer trust account management'],
      ['CLIENT_BILLING_VIEW', 'BILLING', 'View own client portal invoices and receipts'],
    ];

    for (const [name, category, description] of permissions) {
      await conn.query(`
        INSERT INTO permissions (name, category, description)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE description = VALUES(description), category = VALUES(category)
      `, [name, category, description]);
    }

    // Map permissions:
    // OWNER gets ALL permissions
    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.name = 'OWNER'
    `);

    // SENIOR_ASSOCIATE permissions
    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      JOIN permissions p ON p.name IN (
        'BILLING_VIEW', 'BILLING_CREATE', 'BILLING_UPDATE', 'BILLING_ISSUE',
        'INVOICE_VIEW', 'INVOICE_CREATE', 'INVOICE_UPDATE', 'INVOICE_ISSUE',
        'FEE_ENTRY_VIEW', 'FEE_ENTRY_CREATE', 'FEE_ENTRY_UPDATE', 'FEE_ENTRY_DELETE',
        'PAYMENT_VIEW', 'PAYMENT_CREATE', 'PAYMENT_RECORD',
        'RETAINER_VIEW', 'RETAINER_CREATE', 'RETAINER_UPDATE', 'RETAINER_MANAGE',
        'BILLING_EXPORT', 'BILLING_REMINDER_SEND', 'CLIENT_BILLING_VIEW'
      )
      WHERE r.name = 'SENIOR_ASSOCIATE'
    `);

    // CLIENT permissions
    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      JOIN permissions p ON p.name IN ('BILLING_VIEW', 'PAYMENT_VIEW', 'CLIENT_BILLING_VIEW')
      WHERE r.name = 'CLIENT'
    `);

    // NOTE: JUNIOR_ASSOCIATE gets ZERO billing permissions by specification.
    // Ensure any accidental billing permissions for JUNIOR_ASSOCIATE are removed:
    await conn.query(`
      DELETE rp FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE r.name = 'JUNIOR_ASSOCIATE'
        AND p.category IN ('BILLING', 'PAYMENTS', 'RETAINERS')
    `);

    console.log("[Billing Migration]: Billing schema and RBAC verified successfully!");
  } catch (err) {
    console.error("[Billing Migration Error]:", err);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { runBillingMigration };
