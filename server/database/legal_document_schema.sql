-- ==============================================================================
-- PROMPT 11: LEGAL DOCUMENT MANAGEMENT, VERSION CONTROL, REVIEW, APPROVAL & ESIGN
-- ==============================================================================

USE legal_practice;

-- 1. Document Types Table (Configurable legal document types)
CREATE TABLE IF NOT EXISTS document_types (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  requires_advocate_approval BOOLEAN NOT NULL DEFAULT FALSE,
  requires_esign BOOLEAN NOT NULL DEFAULT FALSE,
  default_folder_name VARCHAR(100) NULL,
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_doc_types_code (code),
  INDEX idx_doc_types_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Document Folders Table (Hierarchical case folders)
CREATE TABLE IF NOT EXISTS document_folders (
  id INT NOT NULL AUTO_INCREMENT,
  case_id INT NULL,
  parent_folder_id INT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  archived_at DATETIME NULL,

  PRIMARY KEY (id),
  INDEX idx_doc_folders_case (case_id),
  INDEX idx_doc_folders_parent (parent_folder_id),
  INDEX idx_doc_folders_archived (archived_at),
  CONSTRAINT fk_doc_folders_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_folders_parent FOREIGN KEY (parent_folder_id) REFERENCES document_folders(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_folders_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Document Templates Table
CREATE TABLE IF NOT EXISTS document_templates (
  id INT NOT NULL AUTO_INCREMENT,
  template_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  document_type_id INT NULL,
  case_type VARCHAR(100) NULL,
  language VARCHAR(30) NOT NULL DEFAULT 'English',
  content LONGTEXT NOT NULL,
  variables JSON NULL,
  status ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  created_by INT NOT NULL,
  updated_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_doc_templates_code (template_code),
  INDEX idx_doc_templates_type (document_type_id),
  INDEX idx_doc_templates_status (status),
  CONSTRAINT fk_doc_templates_type FOREIGN KEY (document_type_id) REFERENCES document_types(id) ON DELETE SET NULL,
  CONSTRAINT fk_doc_templates_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_templates_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Document Reviews Table (Approval workflow)
CREATE TABLE IF NOT EXISTS document_reviews (
  id INT NOT NULL AUTO_INCREMENT,
  document_id INT NOT NULL,
  version_id INT NOT NULL,
  requested_by INT NOT NULL,
  reviewer_id INT NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  comments TEXT NULL,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,

  PRIMARY KEY (id),
  INDEX idx_doc_reviews_document (document_id),
  INDEX idx_doc_reviews_version (version_id),
  INDEX idx_doc_reviews_reviewer (reviewer_id),
  INDEX idx_doc_reviews_status (status),
  CONSTRAINT fk_doc_reviews_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_reviews_version FOREIGN KEY (version_id) REFERENCES document_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_reviews_requested_by FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Document Comments Table (Threaded feedback)
CREATE TABLE IF NOT EXISTS document_comments (
  id INT NOT NULL AUTO_INCREMENT,
  document_id INT NOT NULL,
  version_id INT NOT NULL,
  author_id INT NOT NULL,
  comment TEXT NOT NULL,
  status ENUM('OPEN', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
  resolved_by INT NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_doc_comments_doc (document_id),
  INDEX idx_doc_comments_version (version_id),
  INDEX idx_doc_comments_author (author_id),
  INDEX idx_doc_comments_status (status),
  CONSTRAINT fk_doc_comments_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_comments_version FOREIGN KEY (version_id) REFERENCES document_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_comments_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_doc_comments_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Document Signature Signers Table
CREATE TABLE IF NOT EXISTS document_signature_signers (
  id INT NOT NULL AUTO_INCREMENT,
  signature_request_id INT NOT NULL,
  contact_id INT NULL,
  user_id INT NULL,
  client_id INT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NULL,
  role ENUM('CLIENT', 'ADVOCATE', 'WITNESS', 'AUTHORIZED_SIGNATORY', 'OTHER') NOT NULL DEFAULT 'CLIENT',
  signing_order INT NOT NULL DEFAULT 1,
  status ENUM('PENDING', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED') NOT NULL DEFAULT 'PENDING',
  signature_url VARCHAR(500) NULL,
  signed_at DATETIME NULL,
  decline_reason TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_sig_signers_request (signature_request_id),
  INDEX idx_sig_signers_user (user_id),
  INDEX idx_sig_signers_contact (contact_id),
  INDEX idx_sig_signers_client (client_id),
  INDEX idx_sig_signers_status (status),
  CONSTRAINT fk_sig_signers_request FOREIGN KEY (signature_request_id) REFERENCES document_signature_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_sig_signers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_sig_signers_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  CONSTRAINT fk_sig_signers_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Document Tags Table & Mapping
CREATE TABLE IF NOT EXISTS document_tags (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(20) NOT NULL DEFAULT '#64748b',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_tag_map (
  document_id INT NOT NULL,
  tag_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (document_id, tag_id),
  CONSTRAINT fk_tag_map_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_tag_map_tag FOREIGN KEY (tag_id) REFERENCES document_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Document Text Content (Asynchronous extraction for Full-Text Search Foundation)
CREATE TABLE IF NOT EXISTS document_text_content (
  document_id INT NOT NULL,
  version_id INT NOT NULL,
  extracted_text LONGTEXT NULL,
  status ENUM('PENDING', 'EXTRACTED', 'TEXT_NOT_AVAILABLE', 'FAILED') NOT NULL DEFAULT 'PENDING',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (document_id, version_id),
  FULLTEXT idx_ft_extracted_text (extracted_text),
  CONSTRAINT fk_text_content_doc FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_text_content_ver FOREIGN KEY (version_id) REFERENCES document_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Document Retention Policies Table
CREATE TABLE IF NOT EXISTS document_retention_policies (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  document_type_id INT NULL,
  retention_years INT NOT NULL DEFAULT 7,
  action_after ENUM('ARCHIVE', 'REVIEW_BEFORE_PURGE', 'FLAG') NOT NULL DEFAULT 'ARCHIVE',
  description TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_retention_type FOREIGN KEY (document_type_id) REFERENCES document_types(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
