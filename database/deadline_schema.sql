-- =======================================================
-- Legal Practice Management Platform - Prompt 6 Schema
-- Limitation Act Deadline Management System
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =======================================================

USE `legal_practice`;

-- 1. Deadline Rules Table
CREATE TABLE IF NOT EXISTS `deadline_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `act_name` VARCHAR(150) NOT NULL,
  `act_version` VARCHAR(50) NOT NULL DEFAULT '1963',
  `section_reference` VARCHAR(100) NULL,
  `article_reference` VARCHAR(100) NULL,
  `proceeding_type` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `limitation_days` INT NULL,
  `limitation_months` INT NULL,
  `limitation_years` INT NULL,
  `trigger_type` VARCHAR(100) NOT NULL,
  `exclusion_notes` TEXT NULL,
  `source_reference` VARCHAR(255) NULL,
  `effective_from` DATE NULL,
  `effective_to` DATE NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_by` INT NULL,
  `updated_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_dr_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_dr_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_dr_act_art` (`act_name`, `article_reference`),
  INDEX `idx_dr_proceeding` (`proceeding_type`),
  INDEX `idx_dr_active` (`is_active`),
  INDEX `idx_dr_trigger` (`trigger_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Case Deadlines Table
CREATE TABLE IF NOT EXISTS `case_deadlines` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `case_id` INT NOT NULL,
  `deadline_rule_id` INT NULL,
  `title` VARCHAR(255) NOT NULL,
  `trigger_type` VARCHAR(100) NOT NULL,
  `trigger_date` DATE NOT NULL,
  `calculated_deadline` DATE NULL,
  `overridden_deadline` DATE NULL,
  `effective_deadline` DATE NOT NULL,
  `is_manual_override` BOOLEAN NOT NULL DEFAULT FALSE,
  `override_reason` TEXT NULL,
  `overridden_by` INT NULL,
  `overridden_at` DATETIME NULL,
  `calculation_snapshot` JSON NULL,
  `calculation_method` VARCHAR(100) NULL,
  `status` ENUM('UPCOMING', 'DUE_SOON', 'DUE_TODAY', 'OVERDUE', 'COMPLETED', 'WAIVED', 'MANUAL_REVIEW_REQUIRED') NOT NULL DEFAULT 'UPCOMING',
  `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'HIGH',
  `is_manual` BOOLEAN NOT NULL DEFAULT FALSE,
  `manual_reason` TEXT NULL,
  `notes` TEXT NULL,
  `completed_by` INT NULL,
  `completed_at` DATETIME NULL,
  `completion_notes` TEXT NULL,
  `waived_by` INT NULL,
  `waived_at` DATETIME NULL,
  `waiver_reason` TEXT NULL,
  `created_by` INT NULL,
  `updated_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cd_case` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cd_rule` FOREIGN KEY (`deadline_rule_id`) REFERENCES `deadline_rules` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cd_overrider` FOREIGN KEY (`overridden_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cd_completer` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cd_waiver` FOREIGN KEY (`waived_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cd_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cd_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_cd_case` (`case_id`),
  INDEX `idx_cd_effective` (`effective_deadline`),
  INDEX `idx_cd_status` (`status`),
  INDEX `idx_cd_rule` (`deadline_rule_id`),
  INDEX `idx_cd_priority` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Deadline Alerts Table
CREATE TABLE IF NOT EXISTS `deadline_alerts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `deadline_id` INT NOT NULL,
  `alert_type` ENUM('D30', 'D15', 'D7', 'D1', 'OVERDUE') NOT NULL,
  `scheduled_for` DATE NOT NULL,
  `sent_at` DATETIME NULL,
  `status` ENUM('PENDING', 'SENT', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `channel` VARCHAR(50) NOT NULL DEFAULT 'INTERNAL',
  `recipient_id` INT NULL,
  `error_message` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_da_deadline` FOREIGN KEY (`deadline_id`) REFERENCES `case_deadlines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_da_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  UNIQUE KEY `uk_da_deadline_type_date` (`deadline_id`, `alert_type`, `scheduled_for`),
  INDEX `idx_da_deadline` (`deadline_id`),
  INDEX `idx_da_sched_status` (`scheduled_for`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Register Limitation & Deadline Management Permissions
INSERT IGNORE INTO `permissions` (`name`, `category`, `description`) VALUES
('DEADLINE_VIEW', 'DEADLINES', 'View case limitation deadlines and alert dashboards'),
('DEADLINE_CREATE', 'DEADLINES', 'Calculate and create limitation deadlines for cases'),
('DEADLINE_UPDATE', 'DEADLINES', 'Update case deadline notes and details'),
('DEADLINE_OVERRIDE', 'DEADLINES', 'Manually override calculated limitation deadlines with documented reason'),
('DEADLINE_COMPLETE', 'DEADLINES', 'Mark limitation deadlines as completed'),
('DEADLINE_WAIVE', 'DEADLINES', 'Waive limitation deadlines with mandatory justification'),
('DEADLINE_RULE_VIEW', 'DEADLINES', 'View configured limitation rules and references'),
('DEADLINE_RULE_MANAGE', 'DEADLINES', 'Create, update, activate, and deactivate limitation rules');

-- Map permissions to OWNER (All 8 permissions)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'OWNER' AND p.category = 'DEADLINES';

-- Map permissions to SENIOR_ASSOCIATE
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.name IN (
  'DEADLINE_VIEW', 'DEADLINE_CREATE', 'DEADLINE_UPDATE',
  'DEADLINE_OVERRIDE', 'DEADLINE_COMPLETE', 'DEADLINE_WAIVE',
  'DEADLINE_RULE_VIEW'
)
WHERE r.name = 'SENIOR_ASSOCIATE';

-- Map permissions to JUNIOR_ASSOCIATE (Strictly assigned matters only)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.name IN (
  'DEADLINE_VIEW', 'DEADLINE_CREATE', 'DEADLINE_RULE_VIEW'
)
WHERE r.name = 'JUNIOR_ASSOCIATE';
