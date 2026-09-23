# Payment Gateways, Offline Collections & Automated Reminders (Prompt 9)

## 1. Architectural Overview

The **Payment Gateway & Automated Reminders** subsystem extends the Prompt 8 billing architecture into an enterprise-grade payment collection platform tailored for Senior Advocates and law chambers. It unifies online digital payment gateways (**Razorpay** and **PayU**) with offline legal practice banking practices (Direct NEFT/RTGS, UPI transfers, Cheques, Demand Drafts, and Cash).

### Architectural Invariants:
1. **Frontend Success is Never Authoritative**: A client-side checkout completion handler *never* marks an invoice as paid. Only server-side cryptographic signature verification or chambers staff manual clearance can transition a payment to `SUCCESS`.
2. **Provider Pluggability via Factory Pattern**: Providers implement a standardized interface (`BasePaymentProvider`), enabling multi-gateway coexistence and isolated maintenance.
3. **Idempotency & Replay Resistance**: Every webhook and gateway transaction is audited via unique hashes, preventing double-crediting or duplicate receipt issuance.
4. **Cheque Clearance Lifecycle**: Cheques are tracked in `PENDING_CLEARANCE` until cleared by the firm's bank.
5. **Multi-Stage Partial Refunds**: Partial or full reversals update invoice balances and record structured audit trails in `payment_refunds`.
6. **Zero Financial Privileges for Junior Staff**: Junior Associates receive HTTP 403 Forbidden across all financial and reminder operations.

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 CLIENT BILLING PORTAL                  │
                  │   (/billing/pay/:id - Tokenized / Client-facing)       │
                  └───────────┬────────────────────────────┬───────────────┘
                              │                            │
                     Razorpay Checkout                PayU Redirect
                              │                            │
                              ▼                            ▼
                 ┌────────────────────────┐   ┌────────────────────────┐
                 │  HMAC SHA-256 Verifier │   │   SHA-512 Hash Verifier │
                 └────────────┬───────────┘   └────────────┬───────────┘
                              │                            │
                              └─────────────┬──────────────┘
                                            │
                                            ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                  PAYMENT ENGINE                        │
                  │  - Atomic Transaction Locking (FOR UPDATE)             │
                  │  - Sequential Receipt Generator (REC-YYYY-XXXXXX)      │
                  │  - Invoice Allocation & Status Updates                 │
                  └───────────┬────────────────────────────┬───────────────┘
                              │                            │
                              ▼                            ▼
                 ┌────────────────────────┐   ┌────────────────────────┐
                 │   SMTP Email Engine    │   │  WhatsApp Cloud API    │
                 │  (HTML Legal Notices)  │   │  (Official Graph API)  │
                 └────────────────────────┘   └────────────────────────┘
```

---

## 2. Payment Gateway Implementations

### A. Razorpay Provider (`RazorpayPaymentProvider`)
- **Order Creation**: Calls `POST /orders` (or deterministic test harness in test mode) with paise-level precision.
- **Cryptographic Verification**:
  $$\text{Expected Signature} = \text{HMAC-SHA256}(\text{order\_id} \mathbin{\Vert} \text{"|"} \mathbin{\Vert} \text{payment\_id}, \text{key\_secret})$$
  Evaluated using `crypto.timingSafeEqual` to prevent timing attacks.
- **Webhooks**: Verified against `req.rawBody` using the header `X-Razorpay-Signature`.

### B. PayU India Provider (`PayUPaymentProvider`)
- **Order Creation / Form Redirection**: Generates SHA-512 request hash:
  $$\text{sha512}(\text{key} \mathbin{\Vert} \text{txnid} \mathbin{\Vert} \text{amount} \mathbin{\Vert} \text{productinfo} \mathbin{\Vert} \text{firstname} \mathbin{\Vert} \text{email} \mathbin{\Vert} \text{udf1..5} \mathbin{\Vert} \text{salt})$$
- **Reverse Hash Verification**: Validates PayU response callback:
  $$\text{sha512}(\text{salt} \mathbin{\Vert} \text{status} \mathbin{\Vert} \text{udf10..1} \mathbin{\Vert} \text{email} \mathbin{\Vert} \text{firstname} \mathbin{\Vert} \text{productinfo} \mathbin{\Vert} \text{amount} \mathbin{\Vert} \text{txnid} \mathbin{\Vert} \text{key})$$

---

## 3. Manual & Offline Collections

Legal practices frequently receive fees directly via corporate bank transfers or registry-presented instruments.

| Method | Initial Status | Verification Workflow |
| :--- | :--- | :--- |
| `BANK_TRANSFER` (NEFT/RTGS/IMPS) | `PENDING_VERIFICATION` | Staff cross-checks bank statement for UTR; on approval, triggers `verifyManualPayment()`. |
| `UPI_MANUAL` | `PENDING_VERIFICATION` | Staff verifies UPI transaction reference / screenshot. |
| `CHEQUE` | `PENDING_CLEARANCE` | Holds invoice balance until cheque clears bank clearing house. |
| `DEMAND_DRAFT` | `PENDING_CLEARANCE` | Cleared upon presentation at firm's bank. |
| `CASH` | `SUCCESS` | Receipt issued immediately upon cash acceptance at registry. |

---

## 4. Webhook Security & Idempotency Engine

- **Raw Request Body Buffer**: Express configured with `{ verify: (req, res, buf) => { req.rawBody = buf; } }` ensuring exact raw byte validation without JSON serialization variances.
- **Deduplication Ledger (`webhook_events`)**:
  - Event deduplication index on `(provider, event_id)` and `payload_hash`.
  - Replayed webhooks return `200 OK` with `{ duplicate: true }` without touching ledger balances or issuing extra receipts.

---

## 5. Refunds & Financial Adjustments

- Supports both full refunds and partial dispute adjustments.
- **State Transition**:
  - Full refund: Payment status becomes `REFUNDED`.
  - Partial refund: Payment status becomes `PARTIALLY_REFUNDED`.
- **Ledger Impact**:
  - Deducts from payment's refundable balance.
  - Re-opens invoice `amount_due` balance: $\text{amount\_due} = \text{total\_amount} - \text{new\_paid}$.
  - Records immutable audit trail in `payment_refunds` table.

---

## 6. Payment Reminders & Meta WhatsApp Cloud API

### A. Channels
1. **SMTP Email**: HTML templates (`payment_reminder_before_due`, `payment_reminder_due_today`, `payment_reminder_overdue`, `payment_reminder_final_notice`).
2. **Meta WhatsApp Business Cloud API**: Calls `https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages` with approved HSM templates.

### B. Duplicate Dispatch Guard
- Inquiries into `notification_logs` prevent spamming clients:
  - If a reminder was already dispatched on the current calendar date (`DATE(sent_at) = CURRENT_DATE()`) for the same invoice, channel, and template, the engine rejects duplicate dispatch.

---

## 7. Role-Based Access Control (RBAC) Matrix

| Module / Operation | OWNER | SENIOR_ASSOCIATE | JUNIOR_ASSOCIATE |
| :--- | :---: | :---: | :---: |
| View Payments (`PAYMENT_VIEW`) | ✓ | ✓ | ✗ (403 Forbidden) |
| Create Online Payment Link (`PAYMENT_LINK_CREATE`) | ✓ | ✓ | ✗ (403 Forbidden) |
| Verify Manual Payment (`PAYMENT_VERIFY`) | ✓ | ✓ | ✗ (403 Forbidden) |
| Issue Refund / Reversal (`PAYMENT_VERIFY`) | ✓ | ✓ | ✗ (403 Forbidden) |
| Run Reconciliation Audit (`PAYMENT_RECONCILE`) | ✓ | ✓ | ✗ (403 Forbidden) |
| Configure Gateway & Bank Details (`PAYMENT_GATEWAY_CONFIG`) | ✓ | ✗ | ✗ (403 Forbidden) |
| Send Payment Reminders (`REMINDER_SEND`) | ✓ | ✓ | ✗ (403 Forbidden) |

---

## 8. API Endpoint Reference

### Payments & Gateways (`/api/v1/payments`)
- `POST /razorpay/order` — Create Razorpay order for checkout
- `POST /razorpay/verify` — Verify HMAC SHA-256 and allocate receipt
- `POST /payu/order` — Create PayU payment transaction and hash
- `POST /payu/verify` — Verify PayU reverse hash and allocate receipt
- `POST /manual` — Submit manual/cheque payment for chambers verification
- `POST /:id/verify` — Authorize and clear manual payment (Admin/Senior)
- `POST /:id/reject` — Reject manual payment record with mandatory reason
- `POST /:id/refund` — Issue partial or full refund on cleared payment
- `GET /reconciliation` — Retrieve settlement reconciliation audit report

### Webhooks (`/api/v1/webhooks`)
- `POST /razorpay` — Ingest Razorpay raw body payment & refund webhooks
- `POST /payu` — Ingest PayU callback notifications

### Reminders (`/api/v1/invoices/:id/reminders`)
- `POST /send` — Dispatch Email and/or WhatsApp reminder with link inclusion

### Settings (`/api/v1/payment-settings`)
- `GET /` — Fetch masked payment gateway keys & firm bank instructions
- `PUT /` — Update credentials, firm bank accounts, and reminder automation rules
