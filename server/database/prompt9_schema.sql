-- ==============================================================================
-- PROMPT 9: PAYMENT GATEWAYS, MANUAL/OFFLINE PAYMENTS, PAYMENT LINKS, WEBHOOKS & REMINDERS
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ==============================================================================

USE `legal_practice`;

-- 1. Payment Gateway Transactions Ledger (reconciliation & audit)
CREATE TABLE IF NOT EXISTS `payment_gateway_transactions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `payment_id` INT NULL,
  `invoice_id` INT NOT NULL,
  `client_id` INT NOT NULL,
  `provider` VARCHAR(50) NOT NULL,
  `provider_order_id` VARCHAR(100) NULL,
  `provider_payment_id` VARCHAR(100) NULL,
  `provider_reference` VARCHAR(100) NULL,
  `provider_status` VARCHAR(50) NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `request_reference` VARCHAR(100) NULL,
  `response_reference` VARCHAR(100) NULL,
  `status` ENUM('INITIATED', 'PENDING', 'AUTHORIZED', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED') NOT NULL DEFAULT 'INITIATED',
  `raw_response_redacted` JSON NULL,
  `verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `verified_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_pgt_invoice` (`invoice_id`),
  INDEX `idx_pgt_client` (`client_id`),
  INDEX `idx_pgt_payment` (`payment_id`),
  INDEX `idx_pgt_provider_order` (`provider`, `provider_order_id`),
  INDEX `idx_pgt_provider_pay` (`provider`, `provider_payment_id`),
  INDEX `idx_pgt_status` (`status`),
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Webhook Events Table (idempotency, raw verification hash, replay protection)
CREATE TABLE IF NOT EXISTS `webhook_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `provider` VARCHAR(50) NOT NULL,
  `event_id` VARCHAR(100) NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `signature_valid` BOOLEAN NOT NULL DEFAULT FALSE,
  `processed` BOOLEAN NOT NULL DEFAULT FALSE,
  `processed_at` DATETIME NULL,
  `processing_error` TEXT NULL,
  `payload_hash` VARCHAR(128) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_whe_provider_event` (`provider`, `event_id`),
  INDEX `idx_whe_payload_hash` (`payload_hash`),
  INDEX `idx_whe_processed` (`processed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Payment Links Table (active, reuse, expiry, tracking)
CREATE TABLE IF NOT EXISTS `payment_links` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `invoice_id` INT NOT NULL,
  `client_id` INT NOT NULL,
  `provider` ENUM('RAZORPAY', 'PAYU') NOT NULL,
  `provider_payment_link_id` VARCHAR(100) NOT NULL,
  `payment_link_url` VARCHAR(500) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `status` ENUM('ACTIVE', 'PAID', 'PARTIALLY_PAID', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `allow_partial` BOOLEAN NOT NULL DEFAULT FALSE,
  `description` VARCHAR(255) NULL,
  `expires_at` DATETIME NULL,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_pl_invoice` (`invoice_id`),
  INDEX `idx_pl_client` (`client_id`),
  INDEX `idx_pl_provider_link` (`provider`, `provider_payment_link_id`),
  INDEX `idx_pl_status` (`status`),
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Payment Refunds Table
CREATE TABLE IF NOT EXISTS `payment_refunds` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `payment_id` INT NOT NULL,
  `invoice_id` INT NOT NULL,
  `provider` VARCHAR(50) NOT NULL,
  `provider_refund_id` VARCHAR(100) NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `reason` VARCHAR(255) NOT NULL,
  `status` ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'SUCCESS',
  `requested_by` INT NULL,
  `processed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_prf_payment` (`payment_id`),
  INDEX `idx_prf_invoice` (`invoice_id`),
  INDEX `idx_prf_status` (`status`),
  FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Notification Logs Table (WhatsApp & Email reminders audit)
CREATE TABLE IF NOT EXISTS `notification_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `channel` ENUM('EMAIL', 'WHATSAPP') NOT NULL,
  `recipient` VARCHAR(200) NOT NULL,
  `template` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL DEFAULT 'INVOICE',
  `entity_id` INT NOT NULL,
  `provider` VARCHAR(50) NULL,
  `provider_message_id` VARCHAR(100) NULL,
  `status` ENUM('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED') NOT NULL DEFAULT 'SENT',
  `failure_reason` TEXT NULL,
  `sent_at` DATETIME NULL,
  `delivered_at` DATETIME NULL,
  `read_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_nl_entity` (`entity_type`, `entity_id`),
  INDEX `idx_nl_channel_recipient` (`channel`, `recipient`),
  INDEX `idx_nl_status` (`status`),
  INDEX `idx_nl_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Payment Settings Table (Firm-level gateway, manual instructions & rules)
CREATE TABLE IF NOT EXISTS `payment_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` JSON NOT NULL,
  `description` VARCHAR(255) NULL,
  `updated_by` INT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ps_key` (`setting_key`),
  FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
