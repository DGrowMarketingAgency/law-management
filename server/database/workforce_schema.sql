-- =======================================================
-- Legal Practice Management Platform - Prompt 10 Workforce Schema
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =======================================================

USE `legal_practice`;

-- 1. Workforce Profiles Table
CREATE TABLE IF NOT EXISTS `workforce_profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `contact_id` INT NOT NULL,
  `user_id` INT NULL UNIQUE,
  `workforce_code` VARCHAR(50) NOT NULL UNIQUE,
  `workforce_type` ENUM('EMPLOYEE', 'PAID_INTERN', 'UNPAID_INTERN', 'CONTRACTOR') NOT NULL,
  `designation` VARCHAR(100) NOT NULL,
  `department` VARCHAR(100) NOT NULL,
  `reporting_manager_user_id` INT NULL,
  `joining_date` DATE NOT NULL,
  `expected_end_date` DATE NULL,
  `actual_end_date` DATE NULL,
  `status` ENUM('DRAFT', 'ONBOARDING', 'ACTIVE', 'ON_NOTICE', 'SUSPENDED', 'EXITED', 'TERMINATED', 'CANCELLED', 'COMPLETED', 'EARLY_EXIT') NOT NULL DEFAULT 'DRAFT',
  `work_location` VARCHAR(100) NOT NULL DEFAULT 'Main Chambers',
  `employment_mode` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE', 'HYBRID', 'OFFICE') NOT NULL DEFAULT 'FULL_TIME',
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wfp_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_wfp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wfp_manager` FOREIGN KEY (`reporting_manager_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_wfp_type` (`workforce_type`),
  INDEX `idx_wfp_status` (`status`),
  INDEX `idx_wfp_dept` (`department`),
  INDEX `idx_wfp_code` (`workforce_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Workforce Employment Records (Specific for Employees & Contractors)
CREATE TABLE IF NOT EXISTS `workforce_employment_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL UNIQUE,
  `probation_period_days` INT NOT NULL DEFAULT 90,
  `confirmation_date` DATE NULL,
  `notice_period_days` INT NOT NULL DEFAULT 30,
  `contract_signed_date` DATE NULL,
  `emergency_contact_name` VARCHAR(100) NULL,
  `emergency_contact_phone` VARCHAR(30) NULL,
  `emergency_contact_relation` VARCHAR(50) NULL,
  `blood_group` VARCHAR(10) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wer_workforce` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Employee Salary Structures (Confidential Payroll Data)
CREATE TABLE IF NOT EXISTS `employee_salary_structures` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL,
  `effective_from` DATE NOT NULL,
  `effective_to` DATE NULL,
  `payment_frequency` ENUM('MONTHLY', 'WEEKLY', 'BI_WEEKLY') NOT NULL DEFAULT 'MONTHLY',
  `gross_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `basic_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `allowances_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `deductions_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `components` JSON NULL,
  `status` ENUM('DRAFT', 'ACTIVE', 'ENDED') NOT NULL DEFAULT 'ACTIVE',
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ess_workforce` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  INDEX `idx_ess_wf_status` (`workforce_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Internship Records (Dedicated for Paid and Unpaid Interns)
CREATE TABLE IF NOT EXISTS `internship_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL UNIQUE,
  `internship_code` VARCHAR(50) NOT NULL UNIQUE,
  `internship_type` ENUM('PAID', 'UNPAID') NOT NULL,
  `college_institution` VARCHAR(200) NOT NULL,
  `course` VARCHAR(100) NOT NULL,
  `specialization` VARCHAR(100) NULL,
  `academic_year` VARCHAR(50) NULL,
  `mentor_user_id` INT NULL,
  `start_date` DATE NOT NULL,
  `planned_end_date` DATE NOT NULL,
  `actual_end_date` DATE NULL,
  `duration_weeks` INT NOT NULL DEFAULT 4,
  `stipend_enabled` BOOLEAN NOT NULL DEFAULT FALSE,
  `stipend_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `stipend_frequency` ENUM('MONTHLY', 'WEEKLY', 'ONE_TIME', 'NONE') NOT NULL DEFAULT 'NONE',
  `internship_status` ENUM('APPLICATION', 'SELECTED', 'OFFERED', 'ACCEPTED', 'ONBOARDING', 'ACTIVE', 'COMPLETED', 'EARLY_EXIT', 'TERMINATED', 'CANCELLED') NOT NULL DEFAULT 'APPLICATION',
  `certificate_status` ENUM('NOT_ELIGIBLE', 'ELIGIBLE', 'GENERATED', 'ISSUED') NOT NULL DEFAULT 'NOT_ELIGIBLE',
  `certificate_issued_at` DATETIME NULL,
  `certificate_number` VARCHAR(100) NULL UNIQUE,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_inr_workforce` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inr_mentor` FOREIGN KEY (`mentor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_inr_status` (`internship_status`),
  INDEX `idx_inr_type` (`internship_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Candidate Pipeline (Applicant Tracking for Employees & Interns)
CREATE TABLE IF NOT EXISTS `candidate_pipeline` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `candidate_code` VARCHAR(50) NOT NULL UNIQUE,
  `contact_id` INT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `applying_for` ENUM('EMPLOYEE', 'PAID_INTERN', 'UNPAID_INTERN', 'CONTRACTOR') NOT NULL,
  `college_institution` VARCHAR(200) NULL,
  `course_degree` VARCHAR(100) NULL,
  `graduation_year` INT NULL,
  `resume_url` VARCHAR(500) NULL,
  `source` VARCHAR(100) NOT NULL DEFAULT 'DIRECT',
  `applied_date` DATE NOT NULL,
  `expected_start_date` DATE NULL,
  `expected_duration_weeks` INT NULL,
  `stipend_salary_expectation` DECIMAL(10, 2) NULL,
  `stage` ENUM('APPLIED', 'SCREENING', 'INTERVIEW', 'SELECTED', 'REJECTED', 'OFFERED', 'ACCEPTED', 'ONBOARDING', 'ACTIVE', 'WITHDRAWN') NOT NULL DEFAULT 'APPLIED',
  `remarks` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_can_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  INDEX `idx_can_stage` (`stage`),
  INDEX `idx_can_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Interview Records
CREATE TABLE IF NOT EXISTS `interview_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `candidate_id` INT NOT NULL,
  `round_number` INT NOT NULL DEFAULT 1,
  `round_name` VARCHAR(100) NOT NULL DEFAULT 'Technical / Legal Knowledge',
  `interviewer_user_id` INT NOT NULL,
  `scheduled_at` DATETIME NOT NULL,
  `mode` ENUM('IN_PERSON', 'VIRTUAL', 'PHONE') NOT NULL DEFAULT 'IN_PERSON',
  `rating` INT NULL,
  `notes` TEXT NULL,
  `recommendation` ENUM('RECOMMENDED', 'NOT_RECOMMENDED', 'ON_HOLD') NULL,
  `result` ENUM('PENDING', 'SELECTED', 'REJECTED', 'ON_HOLD') NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_int_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidate_pipeline` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_int_interviewer` FOREIGN KEY (`interviewer_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_int_candidate` (`candidate_id`),
  INDEX `idx_int_result` (`result`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Workforce Offers
CREATE TABLE IF NOT EXISTS `workforce_offers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `candidate_id` INT NULL,
  `workforce_id` INT NULL,
  `offer_code` VARCHAR(50) NOT NULL UNIQUE,
  `offer_type` ENUM('EMPLOYEE', 'PAID_INTERN', 'UNPAID_INTERN', 'CONTRACTOR') NOT NULL,
  `designation` VARCHAR(100) NOT NULL,
  `department` VARCHAR(100) NOT NULL,
  `joining_date` DATE NOT NULL,
  `end_date` DATE NULL,
  `offered_compensation` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `terms` TEXT NULL,
  `status` ENUM('DRAFT', 'ISSUED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `issued_at` DATETIME NULL,
  `accepted_at` DATETIME NULL,
  `rejected_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wfo_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `candidate_pipeline` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wfo_workforce` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE SET NULL,
  INDEX `idx_wfo_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Workforce Onboarding Checklists
CREATE TABLE IF NOT EXISTS `workforce_onboarding_checklists` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `category` ENUM('PERSONAL', 'DOCUMENTS', 'AGREEMENTS', 'IT_ACCESS', 'ORIENTATION', 'CASE_ACCESS', 'EMERGENCY') NOT NULL DEFAULT 'DOCUMENTS',
  `mandatory` BOOLEAN NOT NULL DEFAULT TRUE,
  `assigned_to` INT NULL,
  `due_date` DATE NULL,
  `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'WAIVED') NOT NULL DEFAULT 'PENDING',
  `completed_at` DATETIME NULL,
  `completed_by` INT NULL,
  `remarks` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_obc_workforce` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_obc_assignee` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_obc_completer` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_obc_wf_status` (`workforce_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Workforce Attendance
CREATE TABLE IF NOT EXISTS `workforce_attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL,
  `attendance_date` DATE NOT NULL,
  `check_in` TIME NULL,
  `check_out` TIME NULL,
  `total_hours` DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
  `status` ENUM('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'WORK_FROM_HOME', 'HOLIDAY', 'LEAVE', 'WEEK_OFF') NOT NULL DEFAULT 'PRESENT',
  `source` ENUM('MANUAL', 'WEB', 'REGULARIZED', 'SYSTEM') NOT NULL DEFAULT 'WEB',
  `remarks` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_att_wf_date` (`workforce_id`, `attendance_date`),
  CONSTRAINT `fk_att_workforce` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  INDEX `idx_att_date` (`attendance_date`),
  INDEX `idx_att_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Leave Types, Balances & Requests
CREATE TABLE IF NOT EXISTS `workforce_leave_types` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `default_days_per_year` DECIMAL(4, 1) NOT NULL DEFAULT 12.0,
  `applicable_to` ENUM('ALL', 'EMPLOYEE_ONLY', 'INTERN_ONLY') NOT NULL DEFAULT 'ALL',
  `is_paid` BOOLEAN NOT NULL DEFAULT TRUE,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `workforce_leave_balances` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL,
  `leave_type_id` INT NOT NULL,
  `year` INT NOT NULL,
  `opening_balance` DECIMAL(4, 1) NOT NULL DEFAULT 0.0,
  `allocated` DECIMAL(4, 1) NOT NULL DEFAULT 0.0,
  `used` DECIMAL(4, 1) NOT NULL DEFAULT 0.0,
  `pending` DECIMAL(4, 1) NOT NULL DEFAULT 0.0,
  `remaining` DECIMAL(4, 1) NOT NULL DEFAULT 0.0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_wlb_wf_type_year` (`workforce_id`, `leave_type_id`, `year`),
  CONSTRAINT `fk_wlb_workforce` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wlb_type` FOREIGN KEY (`leave_type_id`) REFERENCES `workforce_leave_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `workforce_leave_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL,
  `leave_type_id` INT NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `total_days` DECIMAL(4, 1) NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `approved_by` INT NULL,
  `approved_at` DATETIME NULL,
  `rejection_reason` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wlr_workforce` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wlr_type` FOREIGN KEY (`leave_type_id`) REFERENCES `workforce_leave_types` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_wlr_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_wlr_status` (`status`),
  INDEX `idx_wlr_dates` (`start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Working Schedules & Holidays
CREATE TABLE IF NOT EXISTS `workforce_working_schedules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `schedule_name` VARCHAR(100) NOT NULL UNIQUE,
  `working_days` JSON NOT NULL, -- e.g. ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
  `start_time` TIME NOT NULL DEFAULT '09:30:00',
  `end_time` TIME NOT NULL DEFAULT '18:30:00',
  `break_duration_minutes` INT NOT NULL DEFAULT 60,
  `grace_minutes` INT NOT NULL DEFAULT 15,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `workforce_holidays` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `holiday_name` VARCHAR(150) NOT NULL,
  `holiday_date` DATE NOT NULL UNIQUE,
  `holiday_type` ENUM('PUBLIC', 'FIRM', 'OPTIONAL') NOT NULL DEFAULT 'FIRM',
  `applicable_to` ENUM('ALL', 'OFFICE_ONLY', 'REMOTE_ONLY') NOT NULL DEFAULT 'ALL',
  `notes` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Workforce Tasks
CREATE TABLE IF NOT EXISTS `workforce_tasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `task_code` VARCHAR(50) NOT NULL UNIQUE,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `task_type` ENUM('CASE', 'RESEARCH', 'DRAFTING', 'DOCUMENT', 'COURT', 'CLIENT', 'ADMIN', 'OTHER') NOT NULL DEFAULT 'CASE',
  `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
  `assigned_to` INT NOT NULL,
  `assigned_by` INT NOT NULL,
  `related_case_id` INT NULL,
  `related_client_id` INT NULL,
  `due_date` DATE NOT NULL,
  `status` ENUM('TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'TODO',
  `estimated_hours` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `actual_hours` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `completed_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wft_assignee` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_wft_creator` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_wft_case` FOREIGN KEY (`related_case_id`) REFERENCES `cases` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wft_client` FOREIGN KEY (`related_client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  INDEX `idx_wft_assignee_status` (`assigned_to`, `status`),
  INDEX `idx_wft_due` (`due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Workforce Payments & Reimbursements (Strict separation from Client Billing)
CREATE TABLE IF NOT EXISTS `workforce_payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `payment_number` VARCHAR(50) NOT NULL UNIQUE,
  `workforce_id` INT NOT NULL,
  `payment_type` ENUM('SALARY', 'STIPEND', 'BONUS', 'REIMBURSEMENT', 'OTHER') NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `gross_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `deductions` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `net_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `payment_date` DATE NULL,
  `payment_method` ENUM('BANK_TRANSFER', 'NEFT_RTGS', 'UPI', 'CHEQUE', 'CASH') NOT NULL DEFAULT 'BANK_TRANSFER',
  `reference_number` VARCHAR(100) NULL,
  `status` ENUM('DRAFT', 'PENDING', 'PAID', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `notes` TEXT NULL,
  `approved_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wfp_wf` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wfp_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_wfp_wf_status` (`workforce_id`, `status`),
  INDEX `idx_wfp_type` (`payment_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `workforce_reimbursements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `claim_number` VARCHAR(50) NOT NULL UNIQUE,
  `workforce_id` INT NOT NULL,
  `expense_date` DATE NOT NULL,
  `category` ENUM('TRAVEL', 'PRINTING', 'COURT_FEE', 'STATIONERY', 'CLIENT_MEETING', 'OTHER') NOT NULL DEFAULT 'COURT_FEE',
  `amount` DECIMAL(10, 2) NOT NULL,
  `description` TEXT NOT NULL,
  `receipt_document_id` INT NULL,
  `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `approved_by` INT NULL,
  `approved_at` DATETIME NULL,
  `rejection_reason` VARCHAR(255) NULL,
  `paid_at` DATETIME NULL,
  `workforce_payment_id` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wfr_wf` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wfr_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wfr_payment` FOREIGN KEY (`workforce_payment_id`) REFERENCES `workforce_payments` (`id`) ON DELETE SET NULL,
  INDEX `idx_wfr_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Workforce Bank Accounts (Encrypted Sensitive Data at Rest)
CREATE TABLE IF NOT EXISTS `workforce_bank_accounts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL UNIQUE,
  `account_holder_name` VARCHAR(150) NOT NULL,
  `bank_name` VARCHAR(100) NOT NULL,
  `account_number_encrypted` VARCHAR(500) NOT NULL,
  `account_number_masked` VARCHAR(20) NOT NULL,
  `ifsc_encrypted` VARCHAR(500) NOT NULL,
  `ifsc_masked` VARCHAR(20) NOT NULL,
  `upi_id` VARCHAR(100) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wba_wf` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Performance Reviews & Goals
CREATE TABLE IF NOT EXISTS `workforce_goals` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL,
  `goal_title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `period` VARCHAR(50) NOT NULL, -- e.g. "Q3-2026"
  `target` VARCHAR(255) NULL,
  `completion_percentage` INT NOT NULL DEFAULT 0,
  `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'DEFERRED', 'CANCELLED') NOT NULL DEFAULT 'IN_PROGRESS',
  `remarks` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wfg_wf` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `workforce_performance_reviews` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL,
  `reviewer_user_id` INT NOT NULL,
  `review_period` VARCHAR(50) NOT NULL,
  `overall_rating` INT NOT NULL, -- 1 to 5
  `research_quality` INT NULL, -- Intern Evaluation Criteria 1-5
  `drafting_quality` INT NULL,
  `punctuality` INT NULL,
  `legal_learning` INT NULL,
  `professionalism` INT NULL,
  `strengths` TEXT NULL,
  `improvements` TEXT NULL,
  `mentor_comments` TEXT NULL,
  `is_shareable_with_member` BOOLEAN NOT NULL DEFAULT FALSE,
  `status` ENUM('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED') NOT NULL DEFAULT 'DRAFT',
  `reviewed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wpr_wf` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wpr_reviewer` FOREIGN KEY (`reviewer_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Controlled Warnings / Disciplinary Records
CREATE TABLE IF NOT EXISTS `workforce_warnings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL,
  `issued_by` INT NOT NULL,
  `issue_date` DATE NOT NULL,
  `category` ENUM('PERFORMANCE', 'ATTENDANCE', 'CONDUCT', 'POLICY', 'CONFIDENTIALITY', 'OTHER') NOT NULL,
  `description` TEXT NOT NULL,
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `response_due_date` DATE NULL,
  `member_response` TEXT NULL,
  `status` ENUM('ISSUED', 'RESPONSE_SUBMITTED', 'RESOLVED', 'ESCALATED') NOT NULL DEFAULT 'ISSUED',
  `resolution` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wfw_wf` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wfw_issuer` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Asset Tracking & Assignment
CREATE TABLE IF NOT EXISTS `workforce_asset_assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL,
  `asset_name` VARCHAR(150) NOT NULL,
  `asset_code` VARCHAR(50) NOT NULL,
  `issued_date` DATE NOT NULL,
  `expected_return_date` DATE NULL,
  `returned_date` DATE NULL,
  `condition_on_issue` VARCHAR(100) NOT NULL DEFAULT 'Good / Working',
  `condition_on_return` VARCHAR(100) NULL,
  `status` ENUM('ASSIGNED', 'RETURNED', 'LOST', 'DAMAGED') NOT NULL DEFAULT 'ASSIGNED',
  `remarks` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wfa_wf` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  INDEX `idx_wfa_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Exit Management, Handover & Offboarding
CREATE TABLE IF NOT EXISTS `workforce_exit_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL UNIQUE,
  `exit_type` ENUM('RESIGNATION', 'TERMINATION', 'CONTRACT_END', 'INTERNSHIP_COMPLETION', 'RETIREMENT', 'OTHER') NOT NULL,
  `requested_date` DATE NOT NULL,
  `proposed_last_working_date` DATE NOT NULL,
  `actual_last_working_date` DATE NULL,
  `reason` TEXT NOT NULL,
  `notice_period_days` INT NOT NULL DEFAULT 30,
  `approved_by` INT NULL,
  `approved_at` DATETIME NULL,
  `rejection_reason` VARCHAR(255) NULL,
  `status` ENUM('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ON_NOTICE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wex_wf` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wex_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_wex_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `workforce_handover_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL,
  `target_user_id` INT NOT NULL,
  `case_id` INT NULL,
  `task_id` INT NULL,
  `document_id` INT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `due_date` DATE NOT NULL,
  `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'WAIVED') NOT NULL DEFAULT 'PENDING',
  `completed_at` DATETIME NULL,
  `approved_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_who_wf` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_who_target` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_who_case` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_who_task` FOREIGN KEY (`task_id`) REFERENCES `workforce_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_who_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_who_wf_status` (`workforce_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `workforce_offboarding_checklists` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workforce_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` ENUM('EXIT_APPROVAL', 'HANDOVER', 'CASE_REASSIGNMENT', 'ASSET_RETURN', 'PAYMENT_SETTLEMENT', 'ACCESS_REVOCATION', 'EXIT_INTERVIEW') NOT NULL,
  `mandatory` BOOLEAN NOT NULL DEFAULT TRUE,
  `status` ENUM('PENDING', 'COMPLETED', 'WAIVED') NOT NULL DEFAULT 'PENDING',
  `completed_at` DATETIME NULL,
  `completed_by` INT NULL,
  `remarks` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_obf_wf` FOREIGN KEY (`workforce_id`) REFERENCES `workforce_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_obf_completer` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
