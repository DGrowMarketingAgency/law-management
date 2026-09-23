# Document Vault & Password AppLock Security Architecture

## 1. Overview & Core Principle

The **Encrypted Document Vault** introduces an additional cryptographic protection layer to the Legal Practice Management Platform.

> [!IMPORTANT]
> **Vault unlock is an additional security layer and does not replace authentication or authorization.**
> Every document operation requires traversing the full multi-tier security pipeline:
>
> `JWT Authentication` ➔ `Global RBAC` ➔ `Case-Level Authorization` ➔ `Granular Document Permissions` ➔ `Advocate-Only Enforcement` ➔ `Vault Unlock Session` ➔ `AES-256-GCM Decryption & Integrity Verification`

---

## 2. Threat Model & Key Management Limitations

### Protected Scenarios:

1. **Database Leak / Compromise**: An attacker possessing a full MySQL dump gets only KDF salts, KDF parameters, encrypted vault keys, and encrypted DEKs. Without the user's vault password, no plaintext keys can be recovered.
2. **Storage Leak / Cloud Bucket Exposure**: An attacker possessing physical storage files or S3 bucket contents gets only AES-256-GCM ciphertext binary files. Opening or inspecting these files reveals no readable legal text or metadata.
3. **Database + Storage Combined Leak**: Even if an attacker acquires both the MySQL database dump and the physical storage files simultaneously, the legal documents remain cryptographically unreadable because the Data Encryption Keys (DEKs) are wrapped with the Master Vault Key, which is wrapped with a password-derived Key Encryption Key (KEK).
4. **Session Hijacking & Cross-Site Scripting (XSS)**: Raw vault keys and plaintext session tokens are **never** stored in `localStorage`, `sessionStorage`, cookies, React state, or API responses.

### Honest Assessment of Limitations:

If the application server host itself is fully compromised (root access or remote code execution allowing inspection of Node.js process memory during an active user session), application-level encryption cannot guarantee protection against an attacker capturing keys directly from server RAM. Therefore:

- Production OS hardening
- Database IAM & least-privilege credentials
- TLS termination with HSTS
- Storage IAM private access policies
- Server monitoring and audit log forwarding
  remain mandatory components of the overall defense-in-depth posture.

---

## 3. Cryptographic Hierarchy (Envelope Encryption)

```
                       User Document Vault Password
                                    │
                                    ▼
       Key Derivation Function: Node.js crypto.scrypt (or Argon2id)
       [Salt: 32 random bytes | N=16384, r=8, p=1, maxmem=64MB]
                                    │
                                    ▼
                     Key Encryption Key (KEK) [256-bit]
                                    │
                                    ▼  (AES-256-GCM Unwrap)
       Encrypted Vault Key [Stored in user_vaults with IV + Auth Tag]
                                    │
                                    ▼
                   Master Vault Key [256-bit Buffer in RAM]
                                    │
                                    ▼  (AES-256-GCM Unwrap)
  Encrypted Data Encryption Key (DEK) [Stored in document_versions]
                                    │
                                    ▼
                   Per-Document DEK [256-bit Buffer in RAM]
                                    │
                                    ▼  (AES-256-GCM Decrypt)
           Encrypted File Payload [Stored in private-storage]
                                    │
                                    ▼
      Plaintext Legal Document (Streamed securely with private, no-store)
```

---

## 4. Key Derivation & Vault Password Security

- **Vault Password**: Configured separately by each advocate. Distinct from the application login password.
- **KDF Algorithm**: Memory-hard `scrypt` (or Argon2id) with cryptographic salts generated via `crypto.randomBytes(32)`.
- **Zero Knowledge**: Plaintext vault passwords, KEKs, and Master Vault Keys are never written to MySQL, log files, or API responses.

---

## 5. Per-File Envelope Encryption & AES-256-GCM

1. **Per-Document Version DEK**: Every document upload or new version revision generates a unique 256-bit random key (`crypto.randomBytes(32)`). Keys are never reused across files or versions.
2. **AES-256-GCM**: Authenticated encryption algorithm providing both confidentiality and cryptographic integrity.
3. **Unique Nonces (IVs)**: Every encryption operation uses a fresh 12-byte (96-bit) cryptographically random IV.
4. **Authentication Tags**: 16-byte (128-bit) GCM authentication tags are verified before plaintext is returned.
5. **Fail-Closed Guarantee**: If GCM tag verification fails, key unwrapping fails, or SHA-256 plaintext checksum fails, the system fails closed immediately without releasing partial plaintext.

---

## 6. Server-Side Vault Session & Auto-Locking

- **Opaque Session Tokens**: Upon unlocking, the server generates a 256-bit random token.
- **Hashed Storage**: Only the `SHA-256` hash of the session token is persisted in `vault_sessions`.
- **HttpOnly Cookie**: The raw token is sent to the client as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie named `vault_session`.
- **Ephemeral RAM Key Cache**: Plaintext Master Vault Keys live only in server memory with strict TTL matching session activity.
- **Inactivity Auto-Lock**: Defaults to 15 minutes (`VAULT_AUTO_LOCK_MINUTES=15`). Every protected document operation updates `last_activity_at`. If inactive for 15 minutes, the session is invalidated automatically.
- **Failed Attempts Lockout**: After 5 failed password attempts (`VAULT_MAX_FAILED_ATTEMPTS=5`), the vault enters a temporary lockout for 15 minutes (`VAULT_LOCKOUT_MINUTES=15`).
- **Revoke All Sessions**: Advocates can revoke all active vault sessions across devices via `POST /api/v1/vault/revoke-all`.

---

## 7. Zero Re-Encryption Password Changes

When an advocate updates their Document Vault password:

1. The server verifies the current password and unwraps the Master Vault Key.
2. A new random salt is generated, and a new KEK is derived from the new password.
3. The **same** Master Vault Key is re-encrypted with the new KEK and saved to `user_vaults`.
4. All existing vault sessions are revoked.
5. **No document files or DEKs need to be re-encrypted**, enabling instantaneous and zero-downtime password changes.

---

## 8. Migration Utility (`scripts/encrypt-existing-documents.js`)

- Safely scans for unencrypted legacy document versions.
- Requires user ID and vault password.
- Encrypts files to ciphertext and updates MySQL metadata.
- Verifies roundtrip decryption and SHA-256 checksums before updating.
- Preserves plaintext backups (`.plaintext_bak`) by default (`DOCUMENT_MIGRATION_DELETE_PLAINTEXT=false`).

---

## 9. Comprehensive Audit Logging

Audit events recorded in `auth_audit_logs` and `crm_audit_logs`:

- `VAULT_SETUP`
- `VAULT_UNLOCK_SUCCESS`
- `VAULT_UNLOCK_FAILED`
- `VAULT_LOCK`
- `VAULT_AUTO_LOCK`
- `VAULT_PASSWORD_CHANGED`
- `VAULT_ALL_SESSIONS_REVOKED`
- `DOCUMENT_ENCRYPTED`
- `DOCUMENT_DECRYPTED`
- `DOCUMENT_DOWNLOADED`
- `VERSION_ENCRYPTED`
- `DOCUMENT_ENCRYPTION_MIGRATION`

All logs strictly redact passwords, keys, tokens, and document content.
