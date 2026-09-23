# Legal Document Storage Architecture — Internal Files vs External Cloud Links

## 1. Overview & Core Storage Rule
The platform supports two first-class legal document storage modes designed specifically for law firms handling both routine pleadings and massive evidence bundles:

1. **INTERNAL FILE STORAGE**:
   - Files uploaded directly to the platform's secure, encrypted storage vault.
   - **Upload Limit**: Strictly **10 MB** (`DOCUMENT_MAX_FILE_SIZE_MB=10`).
   - Files $\le 10\text{ MB}$ are validated for MIME type, sanitized, encrypted with per-version Data Encryption Keys (AES-256-GCM), and assigned a cryptographic SHA-256 checksum.
   - Upload attempts $> 10\text{ MB}$ are immediately rejected with HTTP 413 `FILE_TOO_LARGE` and guided to the external cloud link option.

2. **EXTERNAL CLOUD LINK**:
   - Directly links documents hosted in external cloud storage (e.g., Google Drive, Microsoft OneDrive, Dropbox, or custom HTTPS endpoints).
   - **No 10 MB Limit**: External documents can be any file size (gigabyte video evidence, voluminous case bundles, scanned trial records).
   - **Zero Mirroring Policy**: The platform stores metadata and HTTPS links only. It **never** downloads, scrapes, or copies external file bytes into the application server.
   - **Cryptographic Integrity**: Does not assign fake checksums (`checksum = NULL`).
   - **Access Control**: Application-level RBAC, case authorization, and confidentiality levels protect the document record. Accessing the external link is logged with `DOCUMENT_EXTERNAL_LINK_OPENED`.

---

## 2. Storage Comparison Table

| Feature / Behavior | Internal File (`INTERNAL`) | External Cloud Link (`EXTERNAL`) |
| :--- | :--- | :--- |
| **Max File Size** | **10 MB** (strictly enforced by server) | **Unlimited** (managed by external cloud) |
| **Physical Storage Location** | Internal encrypted storage directory | External provider (Google Drive, OneDrive, etc.) |
| **File Bytes on Server** | Stored (AES-256-GCM encrypted) | **None** (link and metadata only) |
| **Checksum (SHA-256)** | Cryptographically computed on upload | **NULL** (never fabricated) |
| **Download Behavior** | Secure decrypted stream via authorized API | `[ 🔗 Open External Document ]` safe redirect |
| **Direct E-Sign Eligibility** | **Eligible** once advocate approves | **Ineligible** (must upload file if eSign needed) |
| **Full-Text Search** | Extracted asynchronously for PDF/DOCX/TXT | Metadata search only (title, tags, category, case) |
| **Malware Scanning** | Scanned on upload if scanner configured | Not applicable (bytes not hosted on server) |
| **Audit Action on Access** | `DOCUMENT_VIEWED`, `DOCUMENT_DOWNLOADED` | `DOCUMENT_EXTERNAL_LINK_OPENED` |

---

## 3. Large File User Experience & Workflow

When a legal professional selects a file exceeding the 10 MB limit (e.g., a 38.4 MB video deposition or 150 MB trial court record):

```
User selects file > 10 MB
        ↓
Frontend detects size & prevents upload request
        ↓
Dedicated "File Too Large" modal displayed:
  "Selected file: Evidence-Bundle.pdf (38.4 MB)"
  "Maximum internal upload size: 10 MB"
  "Please upload this file to Google Drive, OneDrive, Dropbox,
   or another trusted cloud provider and save the link here."
        ↓
[ Add External Link ] button switches directly to External Link tab
with document title and metadata pre-populated
```

If a client or API bypasses the frontend, the backend multipart handler and `fileSecurityService` immediately terminate the request with:
- **HTTP 413 Payload Too Large**
- **Error Code**: `FILE_TOO_LARGE`
- **User-Friendly Message**: *"File exceeds the 10 MB upload limit. Please use Add External Link and store the file in Google Drive, OneDrive, Dropbox, or another trusted cloud provider."*

---

## 4. Supported External Cloud Providers

The system natively identifies and organizes documents from the following cloud providers:

1. `GOOGLE_DRIVE`: URLs matching `drive.google.com` or `docs.google.com`.
2. `ONEDRIVE`: URLs matching `onedrive.live.com`, `*.sharepoint.com`, or `1drv.ms`.
3. `DROPBOX`: URLs matching `dropbox.com`.
4. `OTHER`: Any valid, secure HTTPS document repository (e.g., official court portals, firm cloud repositories).

> [!CAUTION]
> **No OAuth Automation**: This phase explicitly avoids automated OAuth sync or background API fetching from external providers. The user configures cloud-level access permissions directly in their cloud provider.

---

## 5. External URL Security & Validation

All external URLs must pass server-side validation via `ExternalDocumentProvider`:

- **HTTPS Protocol Required**: Unencrypted `http://` URLs are rejected by default because legal documents contain privileged attorney-client communications.
- **Dangerous Scheme Rejection**: The server strictly rejects:
  - `javascript:`
  - `data:`
  - `file:`
  - `vbscript:`
  - `blob:`
- **Safe Navigation**: When an authorized user clicks **Open External Document**, the link is opened in the browser with `target="_blank" rel="noopener noreferrer"` to prevent window opener hijacking and protect session tokens.

---

## 6. Version Control & Immutability

Both storage modes integrate seamlessly into the document versioning state machine:

- **Version Immutability**: Once a version is saved, its URL, storage key, checksum, and author are permanently locked.
- **Updating an External Link**: When counsel updates an external document link, the platform **never** overwrites the historical version. Instead, it creates **Version 2**, preserving Version 1 for historical audit and court verification.
- **Mixed Storage Versioning**:
  - Version 1: External Google Drive link
  - Version 2: Amended internal PDF ($\le 10\text{ MB}$)
  - Version 3: Final signed PDF ($\le 10\text{ MB}$)
  Each version retains its respective `storage_type`, `checksum`, and access mechanics.

---

## 7. E-Signature Rule for External Documents

> [!IMPORTANT]
> **External-linked documents CANNOT be dispatched for electronic signature directly.**

Licensed Indian electronic signature platforms (such as Digio, Leegality, and Aadhaar eSign) require direct byte access to signable PDF artifacts in order to apply digital certificates, calculate hash digests, and append tamper-proof audit trails.

If a user attempts to initiate an eSign request on an external-linked document:
1. The backend throws an HTTP 400 error:
   *"External linked documents cannot be directly sent for eSign. Upload a supported file within the 10 MB limit if eSign is required."*
2. The frontend E-Sign tab displays a dedicated alert informing counsel that a file must be uploaded internally to proceed with electronic signatures.

---

## 8. Database Architecture

### `documents` Table Additions
```sql
ALTER TABLE documents
  ADD COLUMN storage_type ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN internal_storage_key VARCHAR(500) NULL,
  ADD COLUMN internal_file_name VARCHAR(255) NULL,
  ADD COLUMN internal_file_size INT NULL,
  ADD COLUMN internal_mime_type VARCHAR(100) NULL,
  ADD COLUMN external_provider ENUM('GOOGLE_DRIVE', 'ONEDRIVE', 'DROPBOX', 'OTHER') NULL,
  ADD COLUMN external_url TEXT NULL,
  ADD COLUMN external_file_name VARCHAR(255) NULL,
  ADD COLUMN external_file_size BIGINT NULL,
  ADD COLUMN external_mime_type VARCHAR(100) NULL,
  ADD COLUMN external_url_status ENUM('NOT_CHECKED', 'ACTIVE', 'BROKEN', 'UNKNOWN') DEFAULT 'NOT_CHECKED',
  ADD COLUMN external_url_last_verified_at DATETIME NULL;
```

### `document_versions` Table Additions
```sql
ALTER TABLE document_versions
  ADD COLUMN storage_type ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN external_provider ENUM('GOOGLE_DRIVE', 'ONEDRIVE', 'DROPBOX', 'OTHER') NULL,
  ADD COLUMN external_url TEXT NULL,
  ADD COLUMN external_file_name VARCHAR(255) NULL,
  ADD COLUMN external_file_size BIGINT NULL,
  ADD COLUMN external_mime_type VARCHAR(100) NULL,
  ADD COLUMN version_status ENUM('ACTIVE', 'SUPERSEDED', 'ARCHIVED') DEFAULT 'ACTIVE';
```

---

## 9. RBAC & Audit Events

The following permissions and audit events govern external document interactions:

- **Permissions**:
  - `DOCUMENT_EXTERNAL_LINK_CREATE`: Authorizes creating direct external cloud document records.
  - `DOCUMENT_EXTERNAL_LINK_OPEN`: Authorizes retrieving and opening external document links.
- **Audit Logging**:
  - Every external document link opened generates an immutable entry in `crm_audit_logs`:
    - `action`: `'DOCUMENT_EXTERNAL_LINK_OPENED'`
    - `entity_type`: `'DOCUMENT'`
    - `entity_id`: Document ID
    - `user_id`: Authenticated user
    - `ip_address`: Remote IP
    - `user_agent`: Browser user agent
    - `details`: Version number, provider, timestamp
