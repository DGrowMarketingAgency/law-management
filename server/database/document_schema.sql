-- ==============================================================================
-- PROMPT 7: DOCUMENT MANAGEMENT, REPOSITORY, VERSIONS & PERMISSIONS SCHEMA
-- ==============================================================================

USE legal_practice;

-- 1. Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id INT NOT NULL AUTO_INCREMENT,
  case_id INT NOT NULL,
  client_id INT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  category ENUM(
    'PLEADING',
    'PETITION',
    'WRITTEN_STATEMENT',
    'AFFIDAVIT',
    'EVIDENCE',
    'ORDER',
    'JUDGMENT',
    'NOTICE',
    'APPLICATION',
    'LEGAL_NOTICE',
    'AGREEMENT',
    'CORRESPONDENCE',
    'CASE_DOCUMENT',
    'CLIENT_DOCUMENT',
    'OTHER'
  ) NOT NULL DEFAULT 'CASE_DOCUMENT',
  document_type VARCHAR(100) NULL,
  confidentiality_level ENUM('NORMAL', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL', 'ADVOCATE_ONLY') NOT NULL DEFAULT 'NORMAL',
  current_version_id INT NULL,
  created_by INT NOT NULL,
  updated_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  
  PRIMARY KEY (id),
  INDEX idx_documents_case_id (case_id),
  INDEX idx_documents_client_id (client_id),
  INDEX idx_documents_category (category),
  INDEX idx_documents_confidentiality (confidentiality_level),
  INDEX idx_documents_created_by (created_by),
  INDEX idx_documents_deleted_at (deleted_at),
  INDEX idx_documents_case_deleted (case_id, deleted_at),
  CONSTRAINT fk_documents_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT,
  CONSTRAINT fk_documents_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_documents_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_documents_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Document Versions Table
CREATE TABLE IF NOT EXISTS document_versions (
  id INT NOT NULL AUTO_INCREMENT,
  document_id INT NOT NULL,
  version_number INT NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  checksum VARCHAR(64) NOT NULL, -- SHA-256
  change_summary TEXT NULL,
  uploaded_by INT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  UNIQUE KEY uk_doc_version (document_id, version_number),
  INDEX idx_doc_versions_document_id (document_id),
  INDEX idx_doc_versions_checksum (checksum),
  INDEX idx_doc_versions_uploaded_by (uploaded_by),
  CONSTRAINT fk_doc_versions_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_versions_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraint for current_version_id after document_versions is created
ALTER TABLE documents 
  ADD CONSTRAINT fk_documents_current_version 
  FOREIGN KEY (current_version_id) REFERENCES document_versions(id) ON DELETE SET NULL;

-- 3. Document Permissions Table
CREATE TABLE IF NOT EXISTS document_permissions (
  id INT NOT NULL AUTO_INCREMENT,
  document_id INT NOT NULL,
  user_id INT NULL,
  role_id INT NULL,
  permission ENUM('VIEW', 'DOWNLOAD', 'EDIT', 'UPLOAD_VERSION', 'DELETE', 'SHARE') NOT NULL,
  granted_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  INDEX idx_doc_perm_document (document_id),
  INDEX idx_doc_perm_user (user_id),
  INDEX idx_doc_perm_role (role_id),
  CONSTRAINT fk_doc_perm_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_perm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_perm_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_perm_granted_by FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Document Shares Table (Internal Sharing Foundation)
CREATE TABLE IF NOT EXISTS document_shares (
  id INT NOT NULL AUTO_INCREMENT,
  document_id INT NOT NULL,
  shared_with_user_id INT NOT NULL,
  permission ENUM('VIEW', 'DOWNLOAD', 'EDIT') NOT NULL DEFAULT 'VIEW',
  expires_at DATETIME NULL,
  created_by INT NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  INDEX idx_doc_shares_document (document_id),
  INDEX idx_doc_shares_user (shared_with_user_id),
  INDEX idx_doc_shares_expires (expires_at),
  INDEX idx_doc_shares_revoked (revoked_at),
  CONSTRAINT fk_doc_shares_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_shares_user FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_shares_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Document Signature Requests (Future-ready stub table per Prompt 2/7 specification)
CREATE TABLE IF NOT EXISTS document_signature_requests (
  id INT NOT NULL AUTO_INCREMENT,
  document_id INT NOT NULL,
  document_version_id INT NOT NULL,
  requested_by INT NOT NULL,
  status ENUM('PENDING', 'SENT', 'SIGNED', 'DECLINED', 'EXPIRED') DEFAULT 'PENDING',
  provider VARCHAR(50) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  INDEX idx_doc_sig_document (document_id),
  INDEX idx_doc_sig_version (document_version_id),
  CONSTRAINT fk_doc_sig_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_sig_version FOREIGN KEY (document_version_id) REFERENCES document_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_sig_requested_by FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Register System Permissions in `permissions` table
INSERT IGNORE INTO permissions (name, category, description, created_at) VALUES
  ('DOCUMENT_VIEW', 'DOCUMENTS', 'View document metadata, versions and lists', NOW()),
  ('DOCUMENT_CREATE', 'DOCUMENTS', 'Upload new legal documents for a case', NOW()),
  ('DOCUMENT_UPDATE', 'DOCUMENTS', 'Update document metadata', NOW()),
  ('DOCUMENT_DELETE', 'DOCUMENTS', 'Soft-delete and restore documents', NOW()),
  ('DOCUMENT_DOWNLOAD', 'DOCUMENTS', 'Download legal documents and versions', NOW()),
  ('DOCUMENT_UPLOAD_VERSION', 'DOCUMENTS', 'Upload new revisions to existing documents', NOW()),
  ('DOCUMENT_MANAGE_PERMISSION', 'DOCUMENTS', 'Manage granular document permissions', NOW()),
  ('DOCUMENT_SHARE', 'DOCUMENTS', 'Share documents internally with colleagues', NOW()),
  ('ADVOCATE_ONLY_DOCUMENT', 'DOCUMENTS', 'Access and assign advocate-only restricted documents', NOW()),
  ('FILE_DOWNLOAD_AUDIT', 'DOCUMENTS', 'Audit document download history', NOW());

-- Map Permissions to Roles (OWNER gets all, SENIOR_ASSOCIATE gets operational, JUNIOR_ASSOCIATE gets standard case-linked)
-- Owner permissions:
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'OWNER' AND p.category = 'DOCUMENTS';

-- Senior Associate permissions:
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'SENIOR_ASSOCIATE' AND p.name IN (
  'DOCUMENT_VIEW', 'DOCUMENT_CREATE', 'DOCUMENT_UPDATE', 'DOCUMENT_DOWNLOAD', 
  'DOCUMENT_UPLOAD_VERSION', 'DOCUMENT_MANAGE_PERMISSION', 'DOCUMENT_SHARE', 'ADVOCATE_ONLY_DOCUMENT'
);

-- Junior Associate permissions:
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'JUNIOR_ASSOCIATE' AND p.name IN (
  'DOCUMENT_VIEW', 'DOCUMENT_CREATE', 'DOCUMENT_UPDATE', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_UPLOAD_VERSION'
);
