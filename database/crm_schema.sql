-- =======================================================
-- Legal Practice Management Platform - Prompt 4 CRM Schema
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =======================================================

USE `legal_practice`;

-- 1. Referral Sources Table
CREATE TABLE IF NOT EXISTS `referral_sources` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `referral_sources` (`name`, `description`) VALUES
('EXISTING_CLIENT', 'Referred by an existing chambers client'),
('COLLEAGUE_ADVOCATE', 'Referred by fellow advocate / bar member'),
('BAR_ASSOCIATION', 'Bar association legal aid / referral'),
('DIRECT_INQUIRY', 'Direct walk-in or personal acquaintance'),
('ONLINE_PORTAL', 'Digital inquiry or official chambers email'),
('OTHER', 'Other referral source');

-- 2. Contacts Table (Central relationship entity)
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(100) NULL,
  `last_name` VARCHAR(100) NULL,
  `display_name` VARCHAR(200) NOT NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(30) NULL,
  `alternate_phone` VARCHAR(30) NULL,
  `organization_name` VARCHAR(150) NULL,
  `contact_type` ENUM('CLIENT', 'LEAD', 'OPPOSING_COUNSEL', 'WITNESS', 'REFERRAL_SOURCE', 'OTHER') NOT NULL DEFAULT 'LEAD',
  `notes` TEXT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  CONSTRAINT `fk_cnt_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_contacts_email` (`email`),
  INDEX `idx_contacts_phone` (`phone`),
  INDEX `idx_contacts_display_name` (`display_name`),
  INDEX `idx_contacts_type` (`contact_type`),
  INDEX `idx_contacts_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Contact Addresses Table
CREATE TABLE IF NOT EXISTS `contact_addresses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `contact_id` INT NOT NULL,
  `address_type` ENUM('HOME', 'OFFICE', 'COURT', 'OTHER') NOT NULL DEFAULT 'OFFICE',
  `address_line_1` VARCHAR(255) NOT NULL,
  `address_line_2` VARCHAR(255) NULL,
  `city` VARCHAR(100) NOT NULL,
  `district` VARCHAR(100) NULL,
  `state` VARCHAR(100) NOT NULL,
  `country` VARCHAR(100) NOT NULL DEFAULT 'India',
  `postal_code` VARCHAR(20) NOT NULL,
  `is_primary` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ca_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  INDEX `idx_ca_contact` (`contact_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Contact Tags & Map
CREATE TABLE IF NOT EXISTS `contact_tags` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `color` VARCHAR(20) DEFAULT '#1e3a8a',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `contact_tags` (`name`, `color`) VALUES
('High Net Worth', '#b45309'),
('Corporate', '#1e3a8a'),
('Criminal Defense', '#b91c1c'),
('Civil Dispute', '#047857'),
('Pro Bono', '#6d28d9'),
('Frequent Referrer', '#0284c7');

CREATE TABLE IF NOT EXISTS `contact_tag_map` (
  `contact_id` INT NOT NULL,
  `tag_id` INT NOT NULL,
  PRIMARY KEY (`contact_id`, `tag_id`),
  CONSTRAINT `fk_ctm_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ctm_tag` FOREIGN KEY (`tag_id`) REFERENCES `contact_tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Clients Table (Business relationship linked to Contact)
CREATE TABLE IF NOT EXISTS `clients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `contact_id` INT NOT NULL UNIQUE,
  `client_code` VARCHAR(50) NOT NULL UNIQUE,
  `client_source` VARCHAR(50) NULL DEFAULT 'DIRECT',
  `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `notes` TEXT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cl_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cl_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_clients_code` (`client_code`),
  INDEX `idx_clients_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Client Consents Table (Immutable historical compliance records)
CREATE TABLE IF NOT EXISTS `client_consents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `client_id` INT NOT NULL,
  `consent_type` ENUM('DATA_PROCESSING', 'COMMUNICATION', 'WHATSAPP', 'DOCUMENT_SHARING') NOT NULL,
  `consent_text` TEXT NOT NULL,
  `consent_version` VARCHAR(20) NOT NULL DEFAULT 'v1.0',
  `consented_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `withdrawn_at` DATETIME NULL,
  `ip_address` VARCHAR(45) NULL,
  `recorded_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cc_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cc_user` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_cc_client` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Leads Table (Pipeline State Machine)
CREATE TABLE IF NOT EXISTS `leads` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `contact_id` INT NOT NULL,
  `source` VARCHAR(50) NOT NULL DEFAULT 'DIRECT',
  `status` ENUM('INQUIRY', 'CONSULTATION_SCHEDULED', 'CONSULTATION_DONE', 'RETAINED', 'NOT_CONVERTED') NOT NULL DEFAULT 'INQUIRY',
  `not_converted_reason` VARCHAR(255) NULL,
  `converted_client_id` INT NULL,
  `converted_at` DATETIME NULL,
  `assigned_to` INT NULL,
  `notes` TEXT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ld_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ld_client` FOREIGN KEY (`converted_client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ld_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ld_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_leads_contact` (`contact_id`),
  INDEX `idx_leads_status` (`status`),
  INDEX `idx_leads_assigned` (`assigned_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Lead Activities Table (Historical interaction log)
CREATE TABLE IF NOT EXISTS `lead_activities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `activity_type` ENUM('CALL', 'MESSAGE', 'EMAIL', 'MEETING', 'NOTE', 'OTHER') NOT NULL DEFAULT 'NOTE',
  `subject` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `activity_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_la_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_la_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_la_lead` (`lead_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Follow-Ups Table
CREATE TABLE IF NOT EXISTS `follow_ups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `contact_id` INT NULL,
  `client_id` INT NULL,
  `lead_id` INT NULL,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `follow_up_type` ENUM('CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'PAYMENT', 'OTHER') NOT NULL DEFAULT 'CALL',
  `status` ENUM('PENDING', 'COMPLETED', 'CANCELLED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
  `scheduled_for` DATETIME NOT NULL,
  `completed_at` DATETIME NULL,
  `assigned_to` INT NOT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_fu_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fu_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fu_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fu_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_fu_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_fu_contact` (`contact_id`),
  INDEX `idx_fu_client` (`client_id`),
  INDEX `idx_fu_lead` (`lead_id`),
  INDEX `idx_fu_assigned` (`assigned_to`),
  INDEX `idx_fu_status_date` (`status`, `scheduled_for`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Appointments Table
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `contact_id` INT NULL,
  `client_id` INT NULL,
  `title` VARCHAR(200) NOT NULL,
  `appointment_type` ENUM('CONSULTATION', 'CLIENT_MEETING', 'COURT_RELATED', 'OTHER') NOT NULL DEFAULT 'CONSULTATION',
  `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED') NOT NULL DEFAULT 'SCHEDULED',
  `appointment_date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `location` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `assigned_to` INT NOT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_apt_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_apt_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_apt_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_apt_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_apt_assigned_date` (`assigned_to`, `appointment_date`),
  INDEX `idx_apt_contact` (`contact_id`),
  INDEX `idx_apt_client` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. CRM Audit Logs Table
CREATE TABLE IF NOT EXISTS `crm_audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `action` VARCHAR(50) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `details` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_crm_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_crm_audit_user` (`user_id`),
  INDEX `idx_crm_audit_entity` (`entity_type`, `entity_id`),
  INDEX `idx_crm_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Register CRM Permissions
INSERT IGNORE INTO `permissions` (`name`, `category`, `description`) VALUES
('CONTACT_VIEW', 'CONTACTS', 'View chambers contacts and address details'),
('CONTACT_CREATE', 'CONTACTS', 'Create new chambers contacts'),
('CONTACT_UPDATE', 'CONTACTS', 'Update contact records and addresses'),
('CONTACT_DELETE', 'CONTACTS', 'Soft delete contacts'),

('LEAD_VIEW', 'LEADS', 'View inquiries and leads pipeline'),
('LEAD_CREATE', 'LEADS', 'Record new client inquiry or lead'),
('LEAD_UPDATE', 'LEADS', 'Update lead status and schedule consultation'),
('LEAD_ASSIGN', 'LEADS', 'Assign leads to associates'),
('LEAD_CONVERT', 'LEADS', 'Convert retained lead to client profile'),

('FOLLOWUP_VIEW', 'FOLLOWUPS', 'View chambers follow-up tasks'),
('FOLLOWUP_CREATE', 'FOLLOWUPS', 'Create and schedule follow-ups'),
('FOLLOWUP_UPDATE', 'FOLLOWUPS', 'Complete, edit, or cancel follow-ups'),
('FOLLOWUP_DELETE', 'FOLLOWUPS', 'Delete follow-up reminders'),

('APPOINTMENT_VIEW', 'APPOINTMENTS', 'View chambers calendar and appointments'),
('APPOINTMENT_CREATE', 'APPOINTMENTS', 'Schedule consultations and client appointments'),
('APPOINTMENT_UPDATE', 'APPOINTMENTS', 'Reschedule or cancel appointments'),
('APPOINTMENT_DELETE', 'APPOINTMENTS', 'Delete appointment records'),

('CONFLICT_CHECK', 'CRM', 'Run conflict of interest name/entity checks');

-- Map permissions to OWNER
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'OWNER' AND p.category IN ('CONTACTS', 'LEADS', 'FOLLOWUPS', 'APPOINTMENTS', 'CRM');

-- Map permissions to SENIOR_ASSOCIATE
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.name IN (
  'CONTACT_VIEW', 'CONTACT_CREATE', 'CONTACT_UPDATE',
  'CLIENT_VIEW', 'CLIENT_CREATE', 'CLIENT_UPDATE',
  'LEAD_VIEW', 'LEAD_CREATE', 'LEAD_UPDATE', 'LEAD_ASSIGN', 'LEAD_CONVERT',
  'FOLLOWUP_VIEW', 'FOLLOWUP_CREATE', 'FOLLOWUP_UPDATE',
  'APPOINTMENT_VIEW', 'APPOINTMENT_CREATE', 'APPOINTMENT_UPDATE',
  'CONFLICT_CHECK'
)
WHERE r.name = 'SENIOR_ASSOCIATE';

-- Map permissions to JUNIOR_ASSOCIATE
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.name IN (
  'CONTACT_VIEW', 'CONTACT_CREATE',
  'CLIENT_VIEW',
  'LEAD_VIEW', 'LEAD_CREATE',
  'FOLLOWUP_VIEW', 'FOLLOWUP_CREATE', 'FOLLOWUP_UPDATE',
  'APPOINTMENT_VIEW', 'APPOINTMENT_CREATE',
  'CONFLICT_CHECK'
)
WHERE r.name = 'JUNIOR_ASSOCIATE';
