# Legal Document Management, Repository, Version Control & E-Sign System

## 1. Overview
The Legal Document Management module provides an enterprise-grade, confidential legal document repository tailored for an Indian private advocate's chambers. Legal practice documents represent highly privileged work products and evidence; this module enforces zero-public-access, strict multi-tier authorization, cryptographic SHA-256 integrity verification, backend-generated immutable revision tracking, template automation, internal advocate approval workflows, threaded annotations, and legally binding E-Sign integrations (Digio, Leegality, Mock) compliant with the Information Technology Act, 2000.

> [!IMPORTANT]
> **Legal documents are confidential and must NOT be exposed through public URLs.**
> All document storage is isolated in private, non-web-accessible directories and streamed exclusively through authenticated and authorized API endpoints.
> Unapproved draft documents can NEVER be dispatched for electronic signatures.

---

## 2. Architecture & Storage Abstraction

The storage architecture decouples business logic from physical file storage, adhering to a pluggable provider interface:

```
                  +--------------------------------+
                  |  Document Controller / API     |
                  +---------------+----------------+
                                  |
                                  v
                  +--------------------------------+
                  |  Document Service / Security   |
                  +---------------+----------------+
                                  |
                                  v
                  +--------------------------------+
                  |  DocumentStorageService        |
                  |  (Pluggable Abstraction Layer) |
                  +---------------+----------------+
                                  |
                 +----------------+----------------+
                 |                                 |
                 v                                 v
   +---------------------------+     +-------------------------------+
   | LocalStorageProvider      |     | (Future) S3StorageProvider    |
   | - private-storage/        |     | - AWS S3 / Private MinIO      |
   | - Path traversal shield   |     | - Encrypted at rest           |
   +---------------------------+     +-------------------------------+
```

### 2.1 Private Storage Key Generation
User-provided filenames are **never** used as filesystem paths. Storage keys are generated server-side:
```
cases/{caseId}/documents/{documentId}/v{versionNumber}_{timestamp}_{randomHex}.bin
```
For firm-level records:
```
firm/documents/{documentId}/v{versionNumber}_{timestamp}_{randomHex}.bin
```

This ensures:
1. Complete prevention of directory traversal attacks (`../`, null byte injection).
2. Elimination of filename collisions and race conditions.
3. Storage isolation per case, firm folder, and document revision.

---

## 3. Hierarchical Folder Organization & Document Types

### 3.1 Default Case Folders
Every case automatically initializes standard legal directories:
- `01_Pleadings`: Plaints, Petitions, Written Statements & formal pleadings.
- `02_Applications`: Interim applications, stay petitions, and miscellaneous applications.
- `03_Affidavits`: Sworn statements and verification affidavits.
- `04_Evidence`: Documentary evidence, exhibits, and depositions.
- `05_Court_Orders`: Interim orders, daily order-sheets (Roznama), and judgments.
- `06_Correspondence`: Formal counsel correspondence, notices, and client letters.
- `07_Vakalatnama`: Advocate authorization forms and power of attorney.
- `08_Agreements`: Contracts, settlement terms, and MOUs.
- `99_Other`: Miscellaneous case records.

### 3.2 21 Standard Seeded Document Types
Configured with statutory retention rules and advocate approval requirements:
- Plaint, Written Statement, Bail Application, Anticipatory Bail, Criminal Appeal, Civil Writ, Special Leave Petition, Section 138 NI Act Notice, Vakalatnama, Verification Affidavit, Interim Injunction, Roznama, Settlement Agreement, Legal Opinion, etc.

---

## 4. Legal Document Templates & Variable Resolution

Automates drafting of standard pleadings using double curly brace placeholders `{{PLACEHOLDER}}`:
- Contextual variables (`{{CASE_NUMBER}}`, `{{COURT_NAME}}`, `{{CLIENT_NAME}}`, `{{OPPOSING_PARTY}}`) are automatically pre-filled from active case and client records.
- Missing variables are validated before generation.
- Renders directly to printable PDF buffers and indexes raw text into `document_text_content` for full-text search.

---

## 5. Review & Approval State Machine

```
[DRAFT] ---> (Submit) ---> [IN_REVIEW] ---> (Advocate Approve) ---> [APPROVED] (Locked)
                                |
                                +---> (Request Changes) ---> [CHANGES_REQUESTED] (Unlocked)
                                |
                                +---> (Reject) ---> [REJECTED] (Locked)
```

1. **Advocate-Only Enforcement**: Only users with Advocate, Senior Advocate, or Owner privileges can approve documents. Paralegals and Interns are prohibited by backend RBAC guards.
2. **Document Locking**: Once approved or signed, `is_locked = 1` prevents direct mutations. Revisions require creating a new version.
3. **Threaded Comments**: Counsel and associates can attach threaded comments and page-specific annotations to resolve discrepancies before court filing.

---

## 6. E-Signature Integration

Pluggable provider architecture with `ESignProvider` contract:
- **Mock Provider**: Built-in deterministic simulation generating PDF-1.4 digital certificates with SHA-256 seals, testing multi-signer workflows offline.
- **Digio Provider**: Licensed Indian ASP integration for Aadhaar OTP & USB Token DSC eSigns.
- **Leegality Provider**: Enterprise digital documentation gateway.
- **Multi-Signer Support**: Parallel and sequential signing orders.
- **Webhook Ingestion**: Signature verification, idempotency protection against duplicate delivery, and automated version bump to `SIGNED`.
