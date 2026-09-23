# Document Security, RBAC & Isolation Architecture

## 1. Zero-Trust Access Model
In an advocate's chambers, legal documents represent attorney-client privileged communications and sensitive evidence. The platform enforces multi-layered authorization barriers at every request boundary:

1. **Authentication (JWT & HttpOnly Refresh Tokens)**: All requests must authenticate via verified bearer tokens.
2. **Permission Guard (`authorize(permission)`)**: Evaluates granular user permissions (`DOCUMENT_VIEW`, `DOCUMENT_CREATE`, `DOCUMENT_UPDATE`, `DOCUMENT_DELETE`, `DOCUMENT_DOWNLOAD`, `DOCUMENT_SHARE`, etc.).
3. **Case-Level Isolation (`checkDocumentAccess`)**:
   - Chambers Owners and Admins possess chambers-wide administrative access.
   - Assigned Counsel / Advocates can access documents within cases they are formally assigned to.
   - Non-assigned users are strictly blocked from case-level documents.
4. **Client Isolation**:
   - Clients in the client portal can only view documents explicitly shared with them or where they are the primary client on an authorized category.
   - Internal drafts, advocate notes, and unshared documents remain completely invisible to clients.
5. **Advocate-Only Confidentiality Tier (`ADVOCATE_ONLY`)**:
   - Highly privileged strategy documents, fee agreements, and settlement tolerances classified as `ADVOCATE_ONLY` are restricted exclusively to licensed advocates.
   - Paralegals, legal interns, and administrative clerks receive a 403 Forbidden error upon attempting to view, download, or edit `ADVOCATE_ONLY` files.

---

## 2. Document Immutability & Locking
To satisfy judicial evidence standards and prevent accidental or malicious alteration:
- Once a document enters `IN_REVIEW`, `APPROVED`, or `SIGNED` state, `is_locked = TRUE`.
- Any direct `PATCH /documents/:id` call targeting a locked document is rejected with `423 Locked`.
- Historical versions in `document_versions` are write-once, read-only.
- Every revision has an immutable SHA-256 integrity checksum computed at creation time.

---

## 3. Cryptographic Storage & Encryption
- **AES-256-GCM Envelope Encryption**: Documents can be protected with per-version Data Encryption Keys (DEKs) wrapped by the chamber's master Vault Key.
- **Physical Isolation**: Binary artifacts are stored outside the web root (`storage/documents/`). Path traversal attempts (`../`) are filtered out server-side.
- **Content Streaming**: Document downloads stream binary bytes with `Cache-Control: private, no-store` and dynamic MIME-type headers.
