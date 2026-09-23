# Chambers Client Billing, Invoicing, Payment & Retainer Management Platform (Prompt 8)

## 1. Overview
Prompt 8 establishes the complete financial operating foundation for the Legal Practice Management Platform (Advocate's Chambers). It provides end-to-end fee accounting, GST/RCM compliant invoicing, partial payment tracking, official receipt generation, client advance retainers held in trust, and accounts receivable aging analysis.

---

## 2. Core Architecture & Modules

```
                               ┌────────────────────────┐
                               │     Fee Entries        │
                               │ TIME | APPEARANCE      │
                               │ FIXED_FEE | EXPENSE    │
                               └───────────┬────────────┘
                                           │ (Selected into draft)
                                           ▼
┌────────────────────────┐     ┌────────────────────────┐     ┌────────────────────────┐
│   Retainer Accounts    │     │       Invoices         │     │     Payments &         │
│ (Trust Advance Funds)  │────▶│ DRAFT ──▶ ISSUED ──────┼────▶│     Receipts           │
│ Deposits, Drawdowns    │     │  ▲          │          │     │ Partial, Full, Receipts│
└────────────────────────┘     │  │          ▼          │     └────────────────────────┘
                               │  │    Snapshot Locked  │
                               │  └──── CANCEL/VOID     │
                               └────────────────────────┘
```

### 2.1 Fee Entries & Time Tracking
- **Entry Types**:
  - `TIME`: Billable counsel hours. Duration calculated in minutes, converted to decimal hours: `(duration_minutes / 60) * rate`.
  - `APPEARANCE`: Court hearing appearances linked optionally to `case_hearings`. Includes duplicate prevention for the same hearing.
  - `FIXED_FEE`: Agreed lump-sum fees for drafting, advisory, or legal opinions.
  - `EXPENSE`: Court fees, clerkage, stamp duty, travel disbursements.
  - `RETAINER_DRAW`: Periodic drawdown against advance retainer deposits.
- **Unbilled vs Billed**:
  - Entries start as `is_billed = FALSE`.
  - When attached to an invoice, `invoice_items.fee_entry_id` links the entry.
  - Upon invoice issuance, entries are marked `is_billed = TRUE` and cannot be modified or double-billed.

### 2.2 Sequential Numbering Engine (`invoiceNumberService.js`)
- Uses MySQL table `invoice_sequences` with `SELECT ... FOR UPDATE` row-level locking.
- Guaranteed gapless sequential numbering per calendar year:
  - Invoices: `INV-YYYY-XXXXXX` (e.g. `INV-2026-000001`)
  - Receipts: `REC-YYYY-XXXXXX` (e.g. `REC-2026-000001`)
- Concurrency-safe: eliminates race conditions across simultaneous counsel billing events.

### 2.3 Financial Calculation Engine (`billingCalculationService.js`)
- All monetary operations use exact 2-decimal half-up rounding (`roundDec2`) to prevent JavaScript floating-point errors (e.g. `0.1 + 0.2 = 0.30000000000000004`).
- **Formulas**:
  - `Line Item Subtotal = Quantity × Unit Price`
  - `Invoice Subtotal = Σ Line Item Subtotals`
  - `Discount = FIXED ? min(Value, Subtotal) : Subtotal × (Value / 100)`
  - `Taxable Amount = Subtotal - Discount`
  - `Taxes`:
    - **Intra-state**: `CGST (9%) + SGST (9%) = 18%`
    - **Inter-state**: `IGST (18%)`
    - **Reverse Charge Mechanism (RCM)**: `Tax Rate = 0%`. Note displayed on bill: *Tax payable by recipient entity under Sec 9(3) CGST Act, 2017*.
  - `Total Amount = Taxable Amount + Tax Amount`
  - `Amount Due = max(0, Total Amount - Amount Paid)`

### 2.4 Invoice Lifecycle & Immutable Snapshot
```
[DRAFT] ──────▶ [ISSUED] ──────▶ [SENT] ──────▶ [PARTIALLY_PAID] ──────▶ [PAID]
   │                │
   ▼                ▼
[CANCELLED]       [VOID]
```
- **Draft Invoices**: Fully mutable. Line items, discounts, clients, and due dates can be updated. Temporary identifier `DRAFT-XXXXXX` used.
- **Issuance**:
  - Assigns official sequential `INV-YYYY-XXXXXX`.
  - Freezes complete state in `snapshot_data` JSON column (client details, chambers letterhead, line items, rates, tax breakdown).
  - Subsequent updates to client name, address, or hourly rates do NOT alter historical issued bills.
- **Cancellation vs Void**:
  - `CANCELLED`: Only applicable to DRAFT invoices. Releases unbilled fee entries.
  - `VOID`: Applicable to issued invoices with 0 payments. Nullifies outstanding dues while preserving audit trail.

### 2.5 Payments & Receipt Engine (`paymentService.js`)
- Records payments against issued/sent invoices.
- **Payment Modes**: `NEFT`, `RTGS`, `IMPS`, `UPI`, `CHEQUE`, `DEMAND_DRAFT`, `CASH`, `RETAINER_ADJUSTMENT`.
- **Overpayment Prevention**: Rejects any payment where `payAmount > invoice.amount_due`.
- **Status Auto-Resolution**:
  - `amount_paid == total_amount` ➔ `PAID`
  - `amount_paid > 0 && amount_due > 0` ➔ `PARTIALLY_PAID`
  - `due_date < today && amount_due > 0` ➔ `OVERDUE`
- **Receipts**:
  - Assigns official `REC-YYYY-XXXXXX`.
  - Pure Node.js vector PDF binary generated on-demand.

### 2.6 Retainers & Advance Trust Accounting (`retainerService.js`)
- Advance client deposits held in trust account (`retainers` table).
- Full double-entry style ledger tracking in `retainer_transactions`:
  - `DEPOSIT`: Client transfers advance security funds.
  - `DRAWDOWN`: Invoice payment settled via retainer adjustment.
  - `REFUND`: Unused funds returned upon matter conclusion.
  - `ADJUSTMENT`: Accounting corrections.
- Balance cannot go below zero.

### 2.7 Accounts Receivable Aging Analysis
Invoices are segregated into recovery buckets based on `due_date`:
- **Current**: Due date is today or in the future.
- **1–30 Days**: Overdue by 1 to 30 calendar days.
- **31–60 Days**: Overdue by 31 to 60 calendar days.
- **60+ Days**: Critical overdue accounts requiring escalation.

### 2.8 CA & Tax CSV Export (`billingExportService.js`)
- RFC-4180 compliant CSV exports with UTF-8 BOM (`\uFEFF`) for seamless import into Microsoft Excel, TallyPrime, and Zoho Books without character corruption.
- Includes GSTIN, Place of Supply, Taxable Value, CGST, SGST, IGST, and RCM flags.

### 2.9 Pure Node.js PDF Generation (`invoicePdfService.js`)
- Standalone vector PDF 1.4 binary engine.
- No heavy headless browsers (Puppeteer/Chromium) or native compile dependencies required.
- Generates professional Advocates Chambers letterhead, clean tabular formatting, and official receipt vouchers.

---

## 3. RBAC & Security Matrix

| Role | Fee Entries | View Invoices | Create/Issue Invoices | Record Payments | Retainers | Client Portal |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **OWNER / MANAGING_PARTNER** | Full CRUD | Full Access | Full Access | Full Access | Full Access | Admin View |
| **SENIOR_ASSOCIATE** | Full CRUD | Full Access | Create & Draft | Record Payments | View Only | Admin View |
| **JUNIOR_ASSOCIATE** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** |
| **CLIENT** | **403 Forbidden** | Own Invoices | **403 Forbidden** | **403 Forbidden** | Own Retainer | Own Portal Only |

> **Strict Authorization Principle**: Junior Associates are completely blocked from viewing fee rates, financial billing figures, or firm revenues. Clients can strictly only access records linked to their authenticated identity (`req.user.id`).

---

## 4. API Endpoints Reference

### Billing & Dashboard
- `GET /api/v1/billing/dashboard` — Chambers KPI cards & aging summary
- `GET /api/v1/billing/aging` — Detailed accounts receivable aging report
- `GET /api/v1/billing/export?type=invoices|payments` — RFC-4180 CSV export for CA

### Invoices
- `GET /api/v1/invoices` — List invoices (supports status and client filters)
- `POST /api/v1/invoices` — Create draft invoice
- `GET /api/v1/invoices/:id` — Get invoice detail, line items, and payments
- `PUT /api/v1/invoices/:id` — Update draft invoice
- `POST /api/v1/invoices/:id/issue` — Formally issue invoice (creates immutable snapshot)
- `POST /api/v1/invoices/:id/send` — Mark invoice as sent to client
- `POST /api/v1/invoices/:id/cancel` — Cancel draft invoice
- `POST /api/v1/invoices/:id/void` — Void issued invoice
- `GET /api/v1/invoices/:id/pdf` — Stream invoice PDF buffer
- `POST /api/v1/invoices/:id/remind` — Send client payment reminder notification

### Fee Entries
- `GET /api/v1/fee-entries` — List fee entries
- `POST /api/v1/fee-entries` — Log new billable fee entry
- `GET /api/v1/fee-entries/unbilled` — Query unbilled entries for client/matter
- `PUT /api/v1/fee-entries/:id` — Edit unbilled entry
- `DELETE /api/v1/fee-entries/:id` — Delete unbilled entry

### Payments & Receipts
- `GET /api/v1/payments` — List payment receipts
- `POST /api/v1/payments` — Record payment against invoice
- `GET /api/v1/payments/:id` — Get payment details
- `GET /api/v1/payments/:id/receipt` — Stream official receipt PDF
- `POST /api/v1/payments/:id/refund` — Process payment refund

### Retainers
- `GET /api/v1/retainers` — List client retainer accounts
- `POST /api/v1/retainers` — Create new retainer account
- `GET /api/v1/retainers/:id` — Get retainer account with transaction ledger
- `POST /api/v1/retainers/:id/deposit` — Deposit advance trust funds
- `POST /api/v1/retainers/:id/refund` — Refund unused retainer funds

### Client Portal
- `GET /api/v1/client-portal/billing/dashboard` — Client outstanding dues & summary
- `GET /api/v1/client-portal/billing/invoices` — Client's own invoices
- `GET /api/v1/client-portal/billing/invoices/:id/pdf` — Download client invoice PDF
- `GET /api/v1/client-portal/billing/payments` — Client's payment receipts
- `GET /api/v1/client-portal/billing/payments/:id/receipt` — Download client receipt PDF
