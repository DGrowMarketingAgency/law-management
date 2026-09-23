-- =======================================================
-- Legal Practice Management Platform - Prompt 5 Case Schema
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =======================================================

USE `legal_practice`;

-- 1. Courts Table
CREATE TABLE IF NOT EXISTS `courts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `code` VARCHAR(50) NULL UNIQUE,
  `court_type` ENUM(
    'SUPREME_COURT', 'HIGH_COURT', 'DISTRICT_COURT', 'SESSIONS_COURT',
    'MAGISTRATE_COURT', 'FAMILY_COURT', 'CIVIL_COURT', 'CRIMINAL_COURT',
    'TRIBUNAL', 'OTHER'
  ) NOT NULL DEFAULT 'DISTRICT_COURT',
  `location` VARCHAR(200) NULL,
  `city` VARCHAR(100) NOT NULL,
  `state` VARCHAR(100) NOT NULL,
  `address` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  INDEX `idx_courts_city_state` (`city`, `state`),
  INDEX `idx_courts_type` (`court_type`),
  INDEX `idx_courts_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Cases Table
CREATE TABLE IF NOT EXISTS `cases` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `case_number` VARCHAR(100) NOT NULL,
  `cnr_number` VARCHAR(50) NULL UNIQUE,
  `court_id` INT NOT NULL,
  `case_type` VARCHAR(100) NOT NULL,
  `case_stage` ENUM(
    'NEW', 'FILED', 'ADMITTED', 'NOTICE', 'PLEADINGS', 'EVIDENCE',
    'ARGUMENTS', 'JUDGMENT', 'ORDER', 'APPEAL', 'EXECUTION', 'CLOSED'
  ) NOT NULL DEFAULT 'NEW',
  `case_status` ENUM('ACTIVE', 'STAYED', 'CLOSED', 'DISPOSED', 'TRANSFERRED', 'WITHDRAWN') NOT NULL DEFAULT 'ACTIVE',
  `title` VARCHAR(255) NOT NULL,
  `filing_date` DATE NULL,
  `registration_date` DATE NULL,
  `next_hearing_date` DATE NULL,
  `description` TEXT NULL,
  `primary_client_id` INT NOT NULL,
  `source` ENUM('MANUAL', 'ECOURTS') NOT NULL DEFAULT 'MANUAL',
  `created_by` INT NULL,
  `updated_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  CONSTRAINT `fk_case_court` FOREIGN KEY (`court_id`) REFERENCES `courts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_case_client` FOREIGN KEY (`primary_client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_case_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_cases_number` (`case_number`),
  INDEX `idx_cases_cnr` (`cnr_number`),
  INDEX `idx_cases_court` (`court_id`),
  INDEX `idx_cases_client` (`primary_client_id`),
  INDEX `idx_cases_status` (`case_status`),
  INDEX `idx_cases_stage` (`case_stage`),
  INDEX `idx_cases_next_date` (`next_hearing_date`),
  INDEX `idx_cases_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Case Parties
CREATE TABLE IF NOT EXISTS `case_parties` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `case_id` INT NOT NULL,
  `contact_id` INT NOT NULL,
  `party_role` ENUM(
    'PLAINTIFF', 'DEFENDANT', 'PETITIONER', 'RESPONDENT',
    'APPELLANT', 'APPEALANT', 'COMPLAINANT', 'ACCUSED',
    'APPLICANT', 'OPPOSITE_PARTY', 'OTHER'
  ) NOT NULL,
  `party_description` VARCHAR(255) NULL,
  `is_primary` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cp_case` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cp_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE RESTRICT,
  UNIQUE KEY `uk_case_contact_role` (`case_id`, `contact_id`, `party_role`),
  INDEX `idx_cp_case` (`case_id`),
  INDEX `idx_cp_contact` (`contact_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Case Counsel
CREATE TABLE IF NOT EXISTS `case_counsel` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `case_id` INT NOT NULL,
  `contact_id` INT NOT NULL,
  `counsel_type` ENUM('OUR_COUNSEL', 'OPPOSING_COUNSEL', 'OTHER_COUNSEL') NOT NULL DEFAULT 'OPPOSING_COUNSEL',
  `notes` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ccsl_case` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ccsl_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE RESTRICT,
  UNIQUE KEY `uk_case_counsel` (`case_id`, `contact_id`, `counsel_type`),
  INDEX `idx_ccsl_case` (`case_id`),
  INDEX `idx_ccsl_contact` (`contact_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Case Assignments Enhancements
-- Note: case_assignments was created in Prompt 2. Add columns if not already present.
DROP TABLE IF EXISTS `case_assignments`;
CREATE TABLE `case_assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `case_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `role_in_case` VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED_ASSOCIATE',
  `assigned_by` INT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ca_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ca_case` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ca_assigner` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_ca_user` (`user_id`),
  INDEX `idx_ca_case` (`case_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Case Notes
CREATE TABLE IF NOT EXISTS `case_notes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `case_id` INT NOT NULL,
  `author_id` INT NOT NULL,
  `note_type` ENUM('GENERAL', 'HEARING', 'STRATEGY', 'CLIENT', 'INTERNAL') NOT NULL DEFAULT 'GENERAL',
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  CONSTRAINT `fk_cn_case` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cn_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_cn_case` (`case_id`),
  INDEX `idx_cn_type` (`note_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Case Hearings
CREATE TABLE IF NOT EXISTS `case_hearings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `case_id` INT NOT NULL,
  `court_id` INT NULL,
  `hearing_date` DATE NOT NULL,
  `hearing_time` TIME NULL,
  `hearing_type` VARCHAR(100) NULL,
  `courtroom` VARCHAR(100) NULL,
  `judge` VARCHAR(150) NULL,
  `purpose` VARCHAR(255) NULL,
  `status` ENUM('SCHEDULED', 'COMPLETED', 'ADJOURNED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  `remarks` TEXT NULL,
  `source` VARCHAR(50) DEFAULT 'MANUAL',
  `created_by` INT NULL,
  `updated_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ch_case` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ch_court` FOREIGN KEY (`court_id`) REFERENCES `courts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ch_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_ch_case` (`case_id`),
  INDEX `idx_ch_date_status` (`hearing_date`, `status`),
  INDEX `idx_ch_court` (`court_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Case Adjournments
CREATE TABLE IF NOT EXISTS `case_adjournments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `case_id` INT NOT NULL,
  `hearing_id` INT NOT NULL,
  `previous_date` DATE NOT NULL,
  `new_date` DATE NOT NULL,
  `reason` TEXT NOT NULL,
  `requested_by` VARCHAR(100) NULL,
  `approved_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cadj_case` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cadj_hearing` FOREIGN KEY (`hearing_id`) REFERENCES `case_hearings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cadj_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_cadj_case` (`case_id`),
  INDEX `idx_cadj_hearing` (`hearing_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Register Case Management Permissions
INSERT IGNORE INTO `permissions` (`name`, `category`, `description`) VALUES
('COURT_VIEW', 'COURTS', 'View court registry list and court details'),
('COURT_CREATE', 'COURTS', 'Register new courts or tribunals in registry'),
('COURT_UPDATE', 'COURTS', 'Edit court information or deactivate court'),
('COURT_DELETE', 'COURTS', 'Delete or remove court records'),

('CASE_VIEW', 'CASES', 'View court matters and case dossiers'),
('CASE_CREATE', 'CASES', 'Open new court matters'),
('CASE_UPDATE', 'CASES', 'Update case status, stage, and details'),
('CASE_DELETE', 'CASES', 'Soft delete or archive court matters'),
('CASE_ASSIGN', 'CASES', 'Assign or reassign advocates to cases'),

('HEARING_VIEW', 'HEARINGS', 'View hearings and court schedules'),
('HEARING_CREATE', 'HEARINGS', 'Schedule court dates and hearings'),
('HEARING_UPDATE', 'HEARINGS', 'Update hearing details and status'),
('HEARING_DELETE', 'HEARINGS', 'Cancel or delete hearing entries'),
('HEARING_ADJOURN', 'HEARINGS', 'Record hearing adjournments'),

('CAUSELIST_VIEW', 'CAUSELIST', 'View aggregated daily chambers cause list');

-- Map permissions to OWNER
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'OWNER' AND p.category IN ('COURTS', 'CASES', 'HEARINGS', 'CAUSELIST');

-- Map permissions to SENIOR_ASSOCIATE
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.name IN (
  'COURT_VIEW', 'COURT_CREATE', 'COURT_UPDATE',
  'CASE_VIEW', 'CASE_CREATE', 'CASE_UPDATE', 'CASE_ASSIGN',
  'HEARING_VIEW', 'HEARING_CREATE', 'HEARING_UPDATE', 'HEARING_ADJOURN',
  'CAUSELIST_VIEW'
)
WHERE r.name = 'SENIOR_ASSOCIATE';

-- Map permissions to JUNIOR_ASSOCIATE
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.name IN (
  'COURT_VIEW',
  'CASE_VIEW', 'CASE_UPDATE',
  'HEARING_VIEW', 'HEARING_CREATE', 'HEARING_UPDATE', 'HEARING_ADJOURN',
  'CAUSELIST_VIEW'
)
WHERE r.name = 'JUNIOR_ASSOCIATE';
