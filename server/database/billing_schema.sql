-- ==============================================================================
-- PROMPT 8: COMPLETE CLIENT BILLING, INVOICE, PAYMENT & RETAINER MANAGEMENT SCHEMA
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ==============================================================================

USE `legal_practice`;

-- 1. Fee Entries Table (Pre-billing work and billable charges)
CREATE TABLE IF NOT EXISTS `fee_entries` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `client_id` INT NOT NULL,
  `case_id` INT NULL,
  `hearing_id` INT NULL,
  `fee_type` ENUM('TIME', 'APPEARANCE', 'FIXED_FEE', 'EXPENSE', 'RETAINER_DRAW', 'OTHER') NOT NULL DEFAULT 'FIXED_FEE',
  `description` TEXT NOT NULL,
  `service_date` DATE NOT NULL,
  `duration_minutes` INT NULL,
  `hourly_rate` DECIMAL(12, 2) NULL,
  `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  `unit` VARCHAR(50) NOT NULL DEFAULT 'UNIT',
  `rate` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `amount` DECIMAL(12, 2) NOT NULL,
  `is_taxable` BOOLEAN NOT NULL DEFAULT TRUE,
  `tax_category` VARCHAR(50) NULL DEFAULT 'LEGAL_SERVICES',
  `invoice_id` INT NULL,
  `status` ENUM('UNBILLED', 'INVOICED', 'CANCELLED') NOT NULL DEFAULT 'UNBILLED',
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,

  PRIMARY KEY (`id`),
  INDEX `idx_fe_client` (`client_id`),
  INDEX `idx_fe_case` (`case_id`),
  INDEX `idx_fe_hearing` (`hearing_id`),
  INDEX `idx_fe_invoice` (`invoice_id`),
  INDEX `idx_fe_status` (`status`),
  INDEX `idx_fe_service_date` (`service_date`),
  CONSTRAINT `fk_fe_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_fe_case` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_fe_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Invoices Table (Master invoice records with snapshots)
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `invoice_number` VARCHAR(100) NOT NULL,
  `client_id` INT NOT NULL,
  `case_id` INT NULL,
  `invoice_date` DATE NOT NULL,
  `due_date` DATE NOT NULL,
  `status` ENUM('DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID') NOT NULL DEFAULT 'DRAFT',
  `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `discount_type` ENUM('PERCENTAGE', 'FIXED') NOT NULL DEFAULT 'FIXED',
  `discount_value` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `taxable_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `gst_mode` ENUM('STANDARD', 'RCM', 'EXEMPT', 'NOT_APPLICABLE', 'MANUAL_REVIEW') NOT NULL DEFAULT 'STANDARD',
  `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
  `cgst_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `sgst_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `igst_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `amount_paid` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `amount_due` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `rcm_applicable` BOOLEAN NOT NULL DEFAULT FALSE,
  `rcm_reason` VARCHAR(255) NULL,
  `place_of_supply` VARCHAR(100) NULL DEFAULT 'Tamil Nadu',
  `notes` TEXT NULL,
  `terms` TEXT NULL,

  -- Preserved Billing Snapshot (captured when invoice is issued)
  `billing_name` VARCHAR(200) NOT NULL,
  `billing_address` TEXT NULL,
  `billing_email` VARCHAR(191) NULL,
  `billing_phone` VARCHAR(50) NULL,
  `client_gstin` VARCHAR(50) NULL,
  `advocate_business_name` VARCHAR(200) NULL,
  `advocate_address` TEXT NULL,
  `advocate_gstin` VARCHAR(50) NULL,

  `created_by` INT NULL,
  `issued_by` INT NULL,
  `issued_at` DATETIME NULL,
  `cancelled_by` INT NULL,
  `cancelled_at` DATETIME NULL,
  `cancellation_reason` VARCHAR(255) NULL,
  `voided_by` INT NULL,
  `voided_at` DATETIME NULL,
  `void_reason` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invoices_number` (`invoice_number`),
  INDEX `idx_invoices_client` (`client_id`),
  INDEX `idx_invoices_case` (`case_id`),
  INDEX `idx_invoices_status` (`status`),
  INDEX `idx_invoices_date` (`invoice_date`),
  INDEX `idx_invoices_due` (`due_date`),
  FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`cancelled_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`voided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key from fee_entries to invoices now that invoices exists
ALTER TABLE `fee_entries`
  ADD CONSTRAINT `fk_fe_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL;

-- 3. Invoice Items Table (Granular items per invoice)
CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `invoice_id` INT NOT NULL,
  `fee_entry_id` INT NULL,
  `description` VARCHAR(255) NOT NULL,
  `service_date` DATE NULL,
  `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  `unit` VARCHAR(50) NOT NULL DEFAULT 'UNIT',
  `unit_price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `taxable_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_ii_invoice` (`invoice_id`),
  INDEX `idx_ii_fee_entry` (`fee_entry_id`),
  CONSTRAINT `fk_ii_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ii_fee_entry` FOREIGN KEY (`fee_entry_id`) REFERENCES `fee_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Payments Table (Recorded payments and receipts)
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `receipt_number` VARCHAR(100) NOT NULL,
  `client_id` INT NOT NULL,
  `invoice_id` INT NOT NULL,
  `payment_date` DATE NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `payment_method` ENUM('CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'RETAINER_DRAW', 'ONLINE_GATEWAY', 'OTHER') NOT NULL DEFAULT 'BANK_TRANSFER',
  `reference_number` VARCHAR(100) NULL,
  `transaction_id` VARCHAR(100) NULL,
  `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'SUCCESS',
  `notes` TEXT NULL,
  `received_by` INT NULL,
  `refunded_at` DATETIME NULL,
  `refund_reason` VARCHAR(255) NULL,
  `refunded_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payments_receipt` (`receipt_number`),
  INDEX `idx_pay_invoice` (`invoice_id`),
  INDEX `idx_pay_client` (`client_id`),
  INDEX `idx_pay_status` (`status`),
  INDEX `idx_pay_date` (`payment_date`),
  CONSTRAINT `fk_pay_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pay_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pay_receiver` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pay_refunder` FOREIGN KEY (`refunded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Retainers Table (Client advance retainers / trust funds)
CREATE TABLE IF NOT EXISTS `retainers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `client_id` INT NOT NULL,
  `case_id` INT NULL,
  `name` VARCHAR(200) NOT NULL,
  `opening_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `current_balance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `start_date` DATE NOT NULL,
  `expiry_date` DATE NULL,
  `status` ENUM('ACTIVE', 'EXHAUSTED', 'CLOSED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  `notes` TEXT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_ret_client` (`client_id`),
  INDEX `idx_ret_case` (`case_id`),
  INDEX `idx_ret_status` (`status`),
  CONSTRAINT `fk_ret_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ret_case` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ret_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Retainer Transactions Table (Audit ledger of retainer changes)
CREATE TABLE IF NOT EXISTS `retainer_transactions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `retainer_id` INT NOT NULL,
  `transaction_type` ENUM('DEPOSIT', 'DRAW_DOWN', 'REFUND', 'ADJUSTMENT') NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `transaction_date` DATE NOT NULL,
  `balance_after` DECIMAL(12, 2) NOT NULL,
  `invoice_id` INT NULL,
  `fee_entry_id` INT NULL,
  `reference` VARCHAR(100) NULL,
  `description` TEXT NOT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_rtx_retainer` (`retainer_id`),
  INDEX `idx_rtx_invoice` (`invoice_id`),
  INDEX `idx_rtx_type` (`transaction_type`),
  CONSTRAINT `fk_rtx_retainer` FOREIGN KEY (`retainer_id`) REFERENCES `retainers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rtx_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rtx_fee_entry` FOREIGN KEY (`fee_entry_id`) REFERENCES `fee_entries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rtx_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Invoice Reminders Table (Payment reminder foundation)
CREATE TABLE IF NOT EXISTS `invoice_reminders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `invoice_id` INT NOT NULL,
  `reminder_type` ENUM('BEFORE_DUE', 'DUE_TODAY', 'OVERDUE', 'CUSTOM') NOT NULL,
  `channel` ENUM('EMAIL', 'WHATSAPP', 'CLIENT_PORTAL') NOT NULL DEFAULT 'CLIENT_PORTAL',
  `status` ENUM('SCHEDULED', 'SENT', 'NOT_CONFIGURED', 'FAILED') NOT NULL DEFAULT 'NOT_CONFIGURED',
  `recipient` VARCHAR(200) NOT NULL,
  `subject` VARCHAR(255) NULL,
  `message` TEXT NOT NULL,
  `scheduled_for` DATE NOT NULL,
  `sent_at` DATETIME NULL,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_rem_invoice` (`invoice_id`),
  INDEX `idx_rem_type_date` (`invoice_id`, `reminder_type`, `scheduled_for`),
  CONSTRAINT `fk_rem_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rem_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Billing Audit Logs Table
CREATE TABLE IF NOT EXISTS `billing_audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NULL,
  `event` VARCHAR(50) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `details` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_ba_user` (`user_id`),
  INDEX `idx_ba_event` (`event`),
  INDEX `idx_ba_entity` (`entity_type`, `entity_id`),
  CONSTRAINT `fk_ba_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
