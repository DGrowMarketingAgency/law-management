-- =======================================================
-- Legal Practice Management Platform - Seed Data
-- Roles, Permissions, Role-Permission Matrix, and Initial Owner
-- =======================================================

USE `legal_practice`;

-- 1. Insert Standard Roles
INSERT INTO `roles` (`name`, `description`) VALUES
('OWNER', 'Senior Advocate / Chambers Head with full administrative control'),
('SENIOR_ASSOCIATE', 'Senior legal associate handling cases, clients, and draft reviews'),
('JUNIOR_ASSOCIATE', 'Junior advocate handling research, court appearances, and assigned cases'),
('CLIENT', 'Client with read-only access to their own matters and invoices')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- 2. Insert Standard Permissions
INSERT INTO `permissions` (`name`, `category`, `description`) VALUES
-- User Management
('USER_VIEW', 'USERS', 'View chambers users and associates list'),
('USER_CREATE', 'USERS', 'Invite or create new chambers users'),
('USER_UPDATE', 'USERS', 'Edit chambers user profile and contact details'),
('USER_DISABLE', 'USERS', 'Deactivate or suspend user accounts'),
('USER_ROLE_UPDATE', 'USERS', 'Modify role assignments for users'),

-- Case Management
('CASE_VIEW', 'CASES', 'View court matters and hearing schedules'),
('CASE_CREATE', 'CASES', 'File and open new case files'),
('CASE_UPDATE', 'CASES', 'Update case status, next dates, and court steps'),
('CASE_DELETE', 'CASES', 'Archive or delete court matters'),
('CASE_ASSIGN', 'CASES', 'Assign junior associates to cases'),

-- Client Management
('CLIENT_VIEW', 'CLIENTS', 'View client profiles and contact information'),
('CLIENT_CREATE', 'CLIENTS', 'Onboard and create new client records'),
('CLIENT_UPDATE', 'CLIENTS', 'Update client contact and confidential details'),
('CLIENT_DELETE', 'CLIENTS', 'Remove or archive client records'),

-- Document Management
('DOCUMENT_VIEW', 'DOCUMENTS', 'View pleadings, orders, and brief repository'),
('DOCUMENT_UPLOAD', 'DOCUMENTS', 'Upload case files, memos, and vakalatnamas'),
('DOCUMENT_UPDATE', 'DOCUMENTS', 'Draft and update legal document versions'),
('DOCUMENT_DELETE', 'DOCUMENTS', 'Delete drafts and uploaded documents'),
('DOCUMENT_DOWNLOAD', 'DOCUMENTS', 'Download case briefs and court orders'),
('DOCUMENT_SIGN', 'DOCUMENTS', 'Approve and eSign pleadings'),

-- Billing & Invoicing
('BILLING_VIEW', 'BILLING', 'View chambers bills, retainers, and expenses'),
('BILLING_CREATE', 'BILLING', 'Create professional fee invoices and receipts'),
('BILLING_UPDATE', 'BILLING', 'Modify invoice line items and fee amounts'),
('BILLING_DELETE', 'BILLING', 'Cancel or delete chambers invoices'),

-- CRM & Contacts
('CRM_VIEW', 'CRM', 'View contacts, leads, and chambers appointments'),
('CRM_CREATE', 'CRM', 'Add contacts and record consultation leads'),
('CRM_UPDATE', 'CRM', 'Update leads and schedule follow-ups'),

-- System Audit
('AUDIT_VIEW', 'AUDIT', 'View system access and security audit logs')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- 3. Map Permissions to Roles

-- A. OWNER gets ALL permissions
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'OWNER';

-- B. SENIOR_ASSOCIATE permissions
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.name IN (
  'USER_VIEW',
  'CASE_VIEW', 'CASE_CREATE', 'CASE_UPDATE', 'CASE_ASSIGN',
  'CLIENT_VIEW', 'CLIENT_CREATE', 'CLIENT_UPDATE',
  'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD', 'DOCUMENT_UPDATE', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_SIGN',
  'BILLING_VIEW', 'BILLING_CREATE',
  'CRM_VIEW', 'CRM_CREATE', 'CRM_UPDATE'
)
WHERE r.name = 'SENIOR_ASSOCIATE';

-- C. JUNIOR_ASSOCIATE permissions
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.name IN (
  'CASE_VIEW', 'CASE_UPDATE',
  'CLIENT_VIEW',
  'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD', 'DOCUMENT_DOWNLOAD',
  'CRM_VIEW'
)
WHERE r.name = 'JUNIOR_ASSOCIATE';

-- D. CLIENT permissions
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.name IN (
  'CASE_VIEW',
  'DOCUMENT_VIEW', 'DOCUMENT_DOWNLOAD',
  'BILLING_VIEW'
)
WHERE r.name = 'CLIENT';

