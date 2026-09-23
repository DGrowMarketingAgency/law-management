# Database Schema Reference — Legal Practice Management Platform

This document outlines the core database architecture for the Legal Practice Management Platform, focusing on the **Legal Document Management, Version Control, Review Workflow, and Electronic Signature (E-Sign)** subsystem.

---

## 1. Document Management Tables

### `documents`
Master record for every case-linked, client-linked, or firm-level document.

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | INT AUTO_INCREMENT | PRIMARY KEY |
| `document_number` | VARCHAR(50) | UNIQUE, Server-generated identifier (`DOC-YYYY-XXXXXX`) |
| `case_id` | INT NULL | FK to `cases(id)` ON DELETE SET NULL. Nullable for firm-level docs |
| `client_id` | INT NULL | FK to `clients(id)` ON DELETE SET NULL |
| `folder_id` | INT NULL | FK to `document_folders(id)` ON DELETE SET NULL |
| `document_type_id` | INT NOT NULL | FK to `document_types(id)` |
| `title` | VARCHAR(255) | NOT NULL, Document title |
| `description` | TEXT NULL | Optional contextual overview |
| `storage_type` | ENUM | `'INTERNAL'`, `'EXTERNAL'` (Default: `'INTERNAL'`) |
| `internal_storage_key` | VARCHAR(500) NULL | Relative storage key within internal encrypted vault |
| `internal_file_name` | VARCHAR(255) NULL | Sanitized filename of internal file |
| `internal_file_size` | INT NULL | Size in bytes ($\le 10\text{ MB}$) |
| `internal_mime_type` | VARCHAR(100) NULL | Detected MIME type |
| `external_provider` | ENUM NULL | `'GOOGLE_DRIVE'`, `'ONEDRIVE'`, `'DROPBOX'`, `'OTHER'` |
| `external_url` | TEXT NULL | HTTPS external cloud document link |
| `external_file_name` | VARCHAR(255) NULL | Optional filename supplied for cloud link |
| `external_file_size` | BIGINT NULL | Optional byte size for external document |
| `external_mime_type` | VARCHAR(100) NULL | Optional MIME type for external document |
| `external_url_status` | ENUM | `'NOT_CHECKED'`, `'ACTIVE'`, `'BROKEN'`, `'UNKNOWN'` (Default: `'NOT_CHECKED'`) |
| `external_url_last_verified_at` | DATETIME NULL | Timestamp of manual link verification |
| `source` | ENUM | `'UPLOADED'`, `'EXTERNAL_LINK'`, `'CREATED_FROM_TEMPLATE'`, `'GENERATED'`, `'CLIENT_UPLOADED'`, `'COURT_UPLOADED'`, `'SIGNED'`, `'IMPORTED'`, `'OTHER'` |
| `status` | ENUM | `'DRAFT'`, `'IN_REVIEW'`, `'CHANGES_REQUESTED'`, `'APPROVED'`, `'READY_FOR_SIGNATURE'`, `'SIGNATURE_PENDING'`, `'SIGNED'`, `'REJECTED'`, `'ARCHIVED'`, `'CANCELLED'` |
| `confidentiality_level`| ENUM | `'NORMAL'`, `'CONFIDENTIAL'`, `'HIGHLY_CONFIDENTIAL'`, `'ADVOCATE_ONLY'` (Default: `'NORMAL'`) |
| `current_version_id` | INT NULL | Points to current active version in `document_versions` |
| `is_locked` | TINYINT(1) | Default 0. Set to 1 when approved, under review, or signed |
| `owner_user_id` | INT NOT NULL | FK to `users(id)` |
| `created_by` | INT NOT NULL | FK to `users(id)` |
| `approved_by` | INT NULL | FK to `users(id)`, advocate who approved the document |
| `approved_at` | DATETIME NULL | Timestamp of formal advocate approval |
| `signed_at` | DATETIME NULL | Timestamp when all electronic signers completed execution |
| `archived_at` | DATETIME NULL | Timestamp when archived |
| `retention_until` | DATETIME NULL | Retention policy expiration date |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

---

### `document_versions`
Strictly immutable snapshot of document revisions, cryptographic hashes, and cloud storage pointers.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INT AUTO_INCREMENT | PRIMARY KEY |
| `document_id` | INT NOT NULL | FK to `documents(id)` ON DELETE CASCADE |
| `version_number` | INT NOT NULL | Incremental version number (1, 2, 3...) |
| `storage_type` | ENUM | `'INTERNAL'`, `'EXTERNAL'` (Default: `'INTERNAL'`) |
| `storage_key` | VARCHAR(500) NULL | Storage relative path (NULL for `EXTERNAL`) |
| `original_filename` | VARCHAR(255) | Original uploaded or referenced file name |
| `file_size` | BIGINT NOT NULL | Size in bytes (0 for external if unspecified) |
| `mime_type` | VARCHAR(100) | MIME type (e.g. `application/pdf`, `text/uri-list`) |
| `checksum` | VARCHAR(64) NULL | Cryptographic SHA-256 integrity hash (NULL for `EXTERNAL`) |
| `external_provider` | ENUM NULL | `'GOOGLE_DRIVE'`, `'ONEDRIVE'`, `'DROPBOX'`, `'OTHER'` |
| `external_url` | TEXT NULL | HTTPS external cloud link |
| `external_file_name` | VARCHAR(255) NULL | File name for external cloud link |
| `external_file_size` | BIGINT NULL | External file size in bytes |
| `external_mime_type` | VARCHAR(100) NULL | External MIME type |
| `version_status` | ENUM | `'ACTIVE'`, `'SUPERSEDED'`, `'ARCHIVED'` (Default: `'ACTIVE'`) |
| `change_summary` | VARCHAR(255) | Change notes for this revision |
| `uploaded_by` | INT NOT NULL | FK to `users(id)` |
| `created_at` | TIMESTAMP | Immutable creation timestamp |

*Constraints*: `UNIQUE KEY (document_id, version_number)`

---

### `document_folders`
Case-level and firm-level organizational structure.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INT AUTO_INCREMENT | PRIMARY KEY |
| `case_id` | INT NULL | FK to `cases(id)` ON DELETE CASCADE. Null for firm root |
| `parent_folder_id` | INT NULL | Self-referencing FK for subfolder nesting |
| `name` | VARCHAR(100) NOT NULL | Folder name (`01_Pleadings`, `02_Applications`, etc.) |
| `is_system` | TINYINT(1) | 1 if created as standard chamber default |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

*Constraints*: `UNIQUE KEY (case_id, name)`

---

### `document_types`
Configurable Indian legal document taxonomy.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INT AUTO_INCREMENT | PRIMARY KEY |
| `code` | VARCHAR(50) NOT NULL | Unique code (e.g. `VAKALATNAMA`, `WRIT_PETITION`, `PLAINT`) |
| `name` | VARCHAR(100) NOT NULL | Display name |
| `category` | ENUM | `'COURT'`, `'CLIENT'`, `'INTERNAL'`, `'EVIDENCE'`, `'OTHER'` |
| `requires_advocate_approval`| TINYINT(1) | If 1, requires advocate role to approve |
| `allows_esign` | TINYINT(1) | If 1, eligible for e-signature workflow |
| `is_active` | TINYINT(1) | Active flag |

---

### `document_templates` & `document_template_versions`
Standard legal drafting templates with dynamic placeholders.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INT AUTO_INCREMENT | PRIMARY KEY |
| `title` | VARCHAR(255) NOT NULL | Template title |
| `code` | VARCHAR(100) NOT NULL | Unique template code |
| `document_type_id` | INT NOT NULL | FK to `document_types(id)` |
| `practice_area` | VARCHAR(100) | Civil, Criminal, Constitutional, etc. |
| `content` | LONGTEXT NOT NULL | Template body with `{{VARIABLE}}` placeholders |
| `variables` | JSON | Extracted list of template variable tokens |
| `status` | ENUM | `'DRAFT'`, `'ACTIVE'`, `'ARCHIVED'` |
| `version` | INT DEFAULT 1 | Current version number |
| `created_by` | INT NOT NULL | FK to `users(id)` |

---

## 2. Review, Approval & Collaboration Tables

### `document_reviews`
Formal review requests and advocate approval audit.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INT AUTO_INCREMENT | PRIMARY KEY |
| `document_id` | INT NOT NULL | FK to `documents(id)` ON DELETE CASCADE |
| `version_id` | INT NOT NULL | FK to `document_versions(id)` |
| `reviewer_id` | INT NOT NULL | FK to `users(id)` assigned reviewer |
| `requested_by` | INT NOT NULL | FK to `users(id)` author |
| `status` | ENUM | `'PENDING'`, `'APPROVED'`, `'CHANGES_REQUESTED'`, `'REJECTED'`, `'CANCELLED'` |
| `comments` | TEXT NULL | Review feedback |
| `requested_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `reviewed_at` | DATETIME NULL | Completion timestamp |

---

### `document_comments`
Threaded discussion, review annotations, and inline resolution tracking.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INT AUTO_INCREMENT | PRIMARY KEY |
| `document_id` | INT NOT NULL | FK to `documents(id)` ON DELETE CASCADE |
| `version_id` | INT NULL | Optional link to specific version |
| `parent_comment_id` | INT NULL | Self-referencing FK for threaded replies |
| `user_id` | INT NOT NULL | FK to `users(id)` comment author |
| `comment` | TEXT NOT NULL | Feedback content |
| `status` | ENUM | `'OPEN'`, `'RESOLVED'` (Default: `'OPEN'`) |
| `resolved_by` | INT NULL | FK to `users(id)` who resolved it |
| `resolved_at` | DATETIME NULL | Timestamp of resolution |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## 3. Permissions & Sharing Tables

### `document_permissions`
Document-level override permissions.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INT AUTO_INCREMENT | PRIMARY KEY |
| `document_id` | INT NOT NULL | FK to `documents(id)` ON DELETE CASCADE |
| `user_id` | INT NULL | FK to `users(id)` |
| `role_id` | INT NULL | FK to `roles(id)` |
| `permission` | VARCHAR(50) NOT NULL | `VIEW`, `DOWNLOAD`, `EDIT`, `APPROVE`, `SHARE`, `SIGN` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

### `document_shares`
Secure sharing with clients, contacts, or external parties.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INT AUTO_INCREMENT | PRIMARY KEY |
| `document_id` | INT NOT NULL | FK to `documents(id)` ON DELETE CASCADE |
| `shared_with_client_id` | INT NULL | FK to `clients(id)` |
| `shared_with_contact_id` | INT NULL | FK to `contacts(id)` |
| `permission` | ENUM | `'VIEW'`, `'DOWNLOAD'` (Default: `'VIEW'`) |
| `access_token` | VARCHAR(64) UNIQUE | High-entropy random token for external access |
| `expires_at` | DATETIME NULL | Expiration timestamp |
| `revoked_at` | DATETIME NULL | Revocation timestamp |
| `created_by` | INT NOT NULL | FK to `users(id)` |

---

## 4. Electronic Signature Tables

### `document_signature_requests`
Master record for external e-sign gateway transactions.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INT AUTO_INCREMENT | PRIMARY KEY |
| `document_id` | INT NOT NULL | FK to `documents(id)` ON DELETE CASCADE |
| `version_id` | INT NOT NULL | FK to `document_versions(id)` (Approved document version) |
| `provider` | ENUM | `'MOCK'`, `'DIGIO'`, `'LEEGALITY'` |
| `external_request_id` | VARCHAR(100) NOT NULL | Unique provider transaction identifier |
| `status` | ENUM | `'DRAFT'`, `'SENT'`, `'PARTIALLY_SIGNED'`, `'COMPLETED'`, `'DECLINED'`, `'EXPIRED'`, `'CANCELLED'` |
| `signing_order` | ENUM | `'SEQUENTIAL'`, `'PARALLEL'` |
| `expires_at` | DATETIME NULL | Request expiry deadline |
| `completed_at` | DATETIME NULL | Timestamp of final execution |
| `created_by` | INT NOT NULL | FK to `users(id)` |

*Constraints*: `UNIQUE KEY (provider, external_request_id)`

---

### `document_signature_signers`
Signer identities, signing sequence, and statutory Section 65B audit capture.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INT AUTO_INCREMENT | PRIMARY KEY |
| `signature_request_id`| INT NOT NULL | FK to `document_signature_requests(id)` ON DELETE CASCADE |
| `contact_id` | INT NULL | Optional link to `contacts(id)` |
| `user_id` | INT NULL | Optional link to internal `users(id)` |
| `signer_name` | VARCHAR(150) NOT NULL| Full legal name of signer |
| `signer_email` | VARCHAR(150) NOT NULL| Signer email address |
| `signer_phone` | VARCHAR(20) NULL | Signer mobile number (for OTP verification) |
| `signer_role` | ENUM | `'CLIENT'`, `'ADVOCATE'`, `'OPPOSING_PARTY'`, `'WITNESS'`, `'OTHER'` |
| `order_index` | INT DEFAULT 1 | Execution sequence for `SEQUENTIAL` workflows |
| `status` | ENUM | `'PENDING'`, `'NOTIFIED'`, `'VIEWED'`, `'SIGNED'`, `'REJECTED'`, `'EXPIRED'` |
| `signed_at` | DATETIME NULL | Execution timestamp |
| `ip_address` | VARCHAR(45) NULL | IP address recorded at signature time |
| `audit_trail` | JSON NULL | Provider certificate serial, timestamp, and authentication details |

---

## 5. Classification & Retention Tables

### `document_tags` & `document_tag_map`
Chambers tags (`URGENT`, `EVIDENCE`, `CONFIDENTIAL`, `SIGNED`, `COURT`).

### `document_text_content`
Asynchronously extracted text content for full-text searching (`extracted_text`, `status`).

### `document_retention_policies`
Chamber retention rules (`Civil Cases - 10 Years`, `Corporate Agreements - 12 Years`, etc.).

---

## 6. Email & Advanced Security Subsystem (Prompt 12)

### Altered Tables
- `users`: Added `email_verified_at` (TIMESTAMP NULL) and `two_factor_method` (ENUM('EMAIL_OTP', 'NONE') DEFAULT 'EMAIL_OTP').
- `refresh_tokens`: Added `ip_address` (VARCHAR(45)), `user_agent` (VARCHAR(255)), `device_info` (VARCHAR(150)), and `last_used_at` (TIMESTAMP).
- `otp_verifications`: Expanded `purpose` enum with `EMAIL_VERIFICATION`, `TWO_FACTOR`, `INVITATION`; added `resend_count` (INT DEFAULT 0), `last_sent_at` (TIMESTAMP), and `status` (ENUM('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED')).

### `email_templates`
Database-driven transactional templates with category separation, subject and HTML templates, and allowed variable specifications.

### `email_logs`
Cryptographic delivery log recording every dispatch event, recipient, template key, attempt counts, provider message IDs, and error codes.

### `password_reset_tokens`
Stores SHA-256 hashed 32-byte cryptographic tokens with 30-minute expiration and `used_at` single-use timestamp tracking.

### `auth_challenges`
Ephemeral authentication challenge records used for 2FA login verification, tracking challenge expiration, status, IP, and user-agent.

