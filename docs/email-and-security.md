# Central SMTP Email Service & Advanced Security Architecture

## 1. Overview
The Central SMTP Email & Security Subsystem provides a unified, enterprise-grade communication and authentication hardening framework for the Legal Practice Management Platform.

All emails across the platform—Authentication, Billing, Invoices, Payment Gateways, Legal Documents, Client Communications, and Workforce Management—are funneled through a single, resilient `CentralEmailService` powered by Nodemailer and standard SMTP transport.

---

## 2. Core Security Guarantees
1. **Account Enumeration Prevention**: The `POST /api/v1/auth/forgot-password` endpoint returns a generic HTTP 200 response regardless of whether the requested email address exists in the chambers database.
2. **Cryptographically Secure OTPs**:
   - Single-use 6-digit numeric codes generated via Node.js `crypto.randomInt(100000, 999999)`.
   - Only SHA-256 hashed representations are stored in `otp_verifications` (`otp_hash`). Raw codes are never stored.
   - Fixed 5-minute expiration window.
   - Strict 60-second resend cooldown timer and maximum 5 resends per challenge session.
   - Purpose isolation (`LOGIN`, `PASSWORD_RESET`, `TWO_FACTOR`, `TWO_FACTOR_SETUP`, `EMAIL_VERIFICATION`, `INVITATION`).
3. **Challenge-Based Two-Factor Authentication (2FA)**:
   - Primary 2FA method is strictly `EMAIL_OTP` (no third-party authenticator dependencies or SMS gateway leaks).
   - When 2FA is active, initial password match issues an ephemeral `challengeId` rather than access/refresh tokens.
   - Final JWT access and refresh tokens are issued only after valid OTP verification against the pending challenge.
4. **Crypto Password Reset Tokens**:
   - 32-byte cryptographic random tokens (`crypto.randomBytes(32).toString('hex')`).
   - SHA-256 hash stored in `password_reset_tokens`; token is single-use and invalidated immediately upon redemption.
   - All active refresh sessions are revoked upon successful password reset.
5. **Session Device Tracking & Revocation**:
   - Every refresh session in `refresh_tokens` captures `ip_address`, `user_agent`, `device_info`, and updates `last_used_at` upon each token rotation.
   - Users can inspect all active device sessions and terminate individual sessions or log out all other devices with a single click.
6. **XSS & Template Injection Safeguards**:
   - All template substitutions sanitize user-supplied variables using HTML entity escaping (`&`, `<`, `>`, `"`, `'`).
   - Script tags (`<script>`) are strictly forbidden in template definitions.
7. **Rate Limiting & Exponential Backoff**:
   - Recipient rate limits: Maximum 5 emails per hour per recipient to prevent flooding/abuse.
   - Automatic retry loop: Up to 3 attempts with exponential backoff delays for temporary network/socket disconnects.

---

## 3. Database Architecture

### `email_templates`
| Column | Type | Description |
|---|---|---|
| `id` | INT AUTO_INCREMENT PRIMARY KEY | Unique template identifier |
| `template_key` | VARCHAR(100) UNIQUE | Unique machine key (e.g. `invoice_issued`, `two_factor_otp`) |
| `name` | VARCHAR(255) | Friendly administrative display name |
| `category` | ENUM | `AUTH`, `BILLING`, `PAYMENT`, `DOCUMENT`, `WORKFORCE`, `SYSTEM`, `SECURITY`, `GENERAL` |
| `subject_template` | VARCHAR(255) | Dynamic subject line template |
| `html_template` | TEXT | HTML formatted email body with dynamic tags |
| `text_template` | TEXT | Plaintext email body fallback |
| `variables` | JSON | Array of allowed variable keys (e.g. `["client_name", "otp"]`) |
| `status` | ENUM('ACTIVE', 'INACTIVE') | Template availability status |

### `email_logs`
| Column | Type | Description |
|---|---|---|
| `id` | INT AUTO_INCREMENT PRIMARY KEY | Unique delivery log identifier |
| `user_id` | INT NULL | Linked user if dispatched to a user account |
| `recipient` | VARCHAR(255) | Normalized recipient email address |
| `template_key` | VARCHAR(100) | Template used for generation |
| `subject` | VARCHAR(255) | Rendered subject line |
| `category` | VARCHAR(50) | Email category |
| `status` | ENUM | `QUEUED`, `SENDING`, `SENT`, `FAILED` |
| `message_id` | VARCHAR(255) | Provider SMTP message ID |
| `provider_response` | JSON | SMTP transport response or error message |
| `error_code` | VARCHAR(100) | Failure code (e.g. `RATE_LIMIT_EXCEEDED`, `EAUTH`) |
| `attempt_count` | INT DEFAULT 1 | Total attempts made |
| `sent_at` | TIMESTAMP NULL | Actual transmission timestamp |

### `password_reset_tokens`
| Column | Type | Description |
|---|---|---|
| `id` | INT AUTO_INCREMENT PRIMARY KEY | Token identifier |
| `user_id` | INT NOT NULL | Target user account |
| `token_hash` | VARCHAR(64) NOT NULL | SHA-256 hash of the 32-byte raw token |
| `expires_at` | TIMESTAMP NOT NULL | Expiration timestamp (30 minutes default) |
| `used_at` | TIMESTAMP NULL | Timestamp when redeemed (enforces single-use) |
| `requested_ip` | VARCHAR(45) | Requester IP address |
| `user_agent` | VARCHAR(255) | Requester browser user agent |

### `auth_challenges`
| Column | Type | Description |
|---|---|---|
| `id` | VARCHAR(64) PRIMARY KEY | Unique challenge ID hex |
| `user_id` | INT NOT NULL | Linked user account |
| `purpose` | ENUM | `LOGIN_2FA`, `PASSWORD_RESET`, `EMAIL_VERIFICATION`, `SECURITY_ACTION` |
| `status` | ENUM | `PENDING`, `VERIFIED`, `EXPIRED`, `CANCELLED` |
| `expires_at` | TIMESTAMP NOT NULL | Challenge expiration timestamp |
| `verified_at` | TIMESTAMP NULL | Timestamp when successfully completed |
| `ip_address` | VARCHAR(45) | Requester IP |
| `user_agent` | VARCHAR(255) | Requester device agent |

---

## 4. Centralized API Endpoints

### Authentication & Security (`/api/v1/auth`)
- `POST /login`: Initiates sign-in. Returns session tokens or 2FA challenge.
- `POST /2fa/verify`: Validates 2FA challenge + OTP and issues access/refresh tokens.
- `POST /2fa/resend`: Resends 2FA code with 60-second cooldown enforcement.
- `POST /forgot-password`: Generates reset token & sends secure email. Generic 200 response.
- `POST /reset-password`: Consumes reset token or OTP to update password and revoke other sessions.
- `POST /verify-email`: Validates verification token and marks email verified.
- `POST /verify-email/send`: Sends verification email to authenticated user.
- `GET /sessions`: Lists all active device sessions with IP, browser, and current flag.
- `POST /sessions/revoke`: Terminates a specific active session.
- `POST /sessions/revoke-all`: Logs out all other devices.

### Security Overview (`/api/v1/security`)
- `GET /overview`: Returns complete user security posture, 2FA status, verification status, active sessions count, and recent audit events.
- `GET /audit-logs`: Paginated cryptographic security audit events.

### Email Administration (`/api/v1/email`)
- `GET /status`: SMTP transport status, configured host/port, and live connectivity test.
- `POST /test`: Dispatches an authentic diagnostic test email.
- `GET /templates`: Lists all database templates with category filters.
- `GET /templates/:key`: Template details and dynamic variables.
- `PUT /templates/:id`: Updates subject, HTML, plaintext, and active status.
- `GET /logs`: Paginated delivery logs with status filters (`SENT`, `FAILED`, etc.).
