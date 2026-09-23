# Limitation Act Deadline Engine & Alert System

## 1. Overview & Chambers Context
The **Limitation Act Deadline Management System** provides automated statutory calculation, trigger-event date arithmetic, manual overrides, alert scheduling, and chambers overview for legal matters pending before Indian courts and tribunals.

> [!IMPORTANT]
> ### Critical Legal Safety Principle
> This system is strictly an **INTERNAL ASSISTIVE DEADLINE TRACKING TOOL**.
> It does **NOT** claim that an automatically calculated date is legally final, conclusive, or legally correct.
> 
> The platform mandates and displays the following notice across all calculation outputs, reports, and interfaces:
> *"System-generated limitation date. Verify against the applicable law, facts, exclusions, extensions, court orders, and professional legal judgment."*
> 
> The system never presents a calculated deadline as an unquestionable legal conclusion. Authorized advocates retain complete authority to review, adjust, or manually override any deadline.

---

## 2. Rule Architecture & Legal Data Integrity

In accordance with professional legal standards, the platform **does not invent or hardcode legal rules, articles, or statutory periods into JavaScript code**. All statutory rules are strictly data-driven and maintained in the `deadline_rules` database table.

If no verified rule exists in the database for a proceeding:
- The system returns: `"Applicable limitation rule not configured. Manual deadline entry is required."`
- The advocate uses the **Manual Deadline Fallback** to record the verified date, reason, and briefing notes.

### `deadline_rules` Schema Structure
- `act_name`: Statutory act title (e.g., `Limitation Act, 1963`, `Arbitration and Conciliation Act, 1996`).
- `act_version`: Version identifier (default `1963`).
- `article_reference`: Article number where applicable (e.g., `Article 54`, `Article 116`).
- `section_reference`: Specific section reference (e.g., `Section 34(3)`).
- `proceeding_type`: Category of court proceeding (e.g., `Specific Performance Suit`, `Civil Appeal to High Court`, `Leave to Defend`).
- `limitation_days` / `limitation_months` / `limitation_years`: Configured statutory duration.
- `trigger_type`: Relevant statutory trigger event (e.g., `CAUSE_OF_ACTION`, `DATE_OF_ORDER`, `DATE_OF_JUDGMENT`, `DATE_OF_KNOWLEDGE`, `DATE_OF_DEFAULT`, `DATE_OF_RECEIPT_OF_AWARD`, `DATE_FIXED_FOR_PERFORMANCE`).
- `exclusion_notes`: Statutory notes on exclusions (e.g., Section 12 certified copy exclusion).
- `source_reference`: Official citation or schedule reference.
- `is_active`: Boolean status flag. Inactive rules are rejected during calculation with HTTP 422.

---

## 3. Pure Calendar Date Arithmetic

To strictly comply with Indian statutory practice and prevent date slippage from timezones:
1. All limitation dates are processed as pure calendar dates (`YYYY-MM-DD`) without UTC conversion.
2. The MySQL connection pool enforces `dateStrings: true`, ensuring date fields are returned as exact ISO date strings without local timezone offsets.
3. Arithmetic Rules:
   - **Calendar Days**: Adds exact integer days using UTC epoch dates.
   - **Calendar Months**: Preserves day-of-month. If target month has fewer days, clamps to the last calendar day of that month (e.g., Jan 31 + 1 Month = Feb 28/29; March 31 + 1 Month = April 30).
   - **Calendar Years**: Target year = current year + N. Leap year Feb 29 + 1 Year = Feb 28.

---

## 4. Calculation Snapshots & Auditability

When a deadline is calculated or created, the system generates an immutable JSON `calculation_snapshot` containing:
```json
{
  "act_name": "Limitation Act, 1963",
  "act_version": "1963",
  "article_reference": "Article 54",
  "section_reference": "Section 3",
  "proceeding_type": "Specific Performance Suit",
  "limitation_period": "3 Year(s)",
  "trigger_type": "DATE_FIXED_FOR_PERFORMANCE",
  "trigger_date": "2026-09-11",
  "calculated_deadline": "2029-09-11",
  "calculation_method": "CALENDAR_YEARS",
  "calculation_explanation": "Trigger Date (2026-09-11) + 3 Year(s) according to Limitation Act, 1963 Article Article 54 Section Section 3 (CALENDAR_YEARS).",
  "calculated_at": "2026-09-11T11:00:00.000Z"
}
```
This guarantees full evidentiary traceability even if statutory rules or versions are later amended.

---

## 5. Manual Override Workflow

Authorized advocates (`DEADLINE_OVERRIDE` permission) can manually override any active calculated deadline:
1. **Preservation**: The original `calculated_deadline` and `calculation_snapshot` are **never overwritten or destroyed**.
2. **Override Fields**: The system stores:
   - `overridden_deadline`: The advocate-specified date.
   - `effective_deadline`: Set to `overridden_deadline`.
   - `is_manual_override`: Flagged as `true`.
   - `override_reason`: Mandatory legal justification (e.g., Section 14 exclusion of time, high court stay order).
   - `overridden_by`: Authenticated advocate ID from JWT.
   - `overridden_at`: Audit timestamp (`NOW()`).
3. **Alert Rescheduling**: Existing `PENDING` alerts are automatically cancelled, sent history is preserved, and a new alert schedule is generated based on the new effective date.
4. **Audit Logging**: An audit event `DEADLINE_OVERRIDDEN` is logged into chambers audit trail.

---

## 6. Alert Schedule & Overdue Processing

Limitation alerts are generated for:
- **`D30`**: 30 calendar days before effective deadline.
- **`D15`**: 15 calendar days before effective deadline.
- **`D7`**: 7 calendar days before effective deadline.
- **`D1`**: 1 calendar day before effective deadline.
- **`OVERDUE`**: Generated if a deadline is already past upon creation or execution.

### Anti-Duplicate Guarantee
The `deadline_alerts` table enforces a composite unique key:
```sql
UNIQUE KEY `uk_da_deadline_type_date` (`deadline_id`, `alert_type`, `scheduled_for`)
```
This completely prevents duplicate alert scheduling.

### Daily Alert Dispatcher
The backend service `processPendingDeadlineAlerts()` scans for all pending alerts due on or before `CURRENT_DATE()` for active matters, dispatches internal alerts via `deadlineNotificationService`, and marks status as `SENT` or `FAILED`.

---

## 7. Status Lifecycle

| Status | Trigger Condition |
|---|---|
| `UPCOMING` | Effective deadline > 15 days in the future |
| `DUE_SOON` | Effective deadline is within 1 to 15 days |
| `DUE_TODAY` | Effective deadline is today |
| `OVERDUE` | Effective deadline < today and not completed/waived |
| `MANUAL_REVIEW_REQUIRED` | Created via manual fallback or unverified rule |
| `COMPLETED` | Marked complete by advocate with completion date and notes |
| `WAIVED` | Waived with mandatory written justification (settlement, client instruction) |

---

## 8. Two-Layer RBAC & Security

Access is enforced through a strict two-layer security model:
1. **Layer 1: Permission Check**:
   - Middleware checks if the user possesses `DEADLINE_VIEW`, `DEADLINE_CREATE`, `DEADLINE_OVERRIDE`, `DEADLINE_COMPLETE`, `DEADLINE_WAIVE`, `DEADLINE_RULE_VIEW`, or `DEADLINE_RULE_MANAGE`.
2. **Layer 2: Resource-Level Case Authorization (`authorizeCaseAccess`)**:
   - `OWNER` & `SENIOR_ASSOCIATE`: Chambers-wide access.
   - `JUNIOR_ASSOCIATE`: Restricted strictly to matters where they have an active assignment in `case_assignments`. Unassigned case deadline access returns **403 Forbidden**.
   - `CLIENT`: Denied all access to internal deadline management.

---

## 9. REST API Specification

### Rule Management
- `GET /api/v1/deadline-rules` — List rules with search and filters (`DEADLINE_RULE_VIEW`)
- `GET /api/v1/deadline-rules/:id` — Retrieve rule details (`DEADLINE_RULE_VIEW`)
- `POST /api/v1/deadline-rules` — Create limitation rule (`DEADLINE_RULE_MANAGE`)
- `PUT /api/v1/deadline-rules/:id` — Update limitation rule (`DEADLINE_RULE_MANAGE`)
- `PATCH /api/v1/deadline-rules/:id/toggle-active` — Toggle rule active status (`DEADLINE_RULE_MANAGE`)

### Calculation & Deadlines Dashboard
- `POST /api/v1/deadlines/calculate` — Assistive calculation preview (`DEADLINE_VIEW`)
- `GET /api/v1/deadlines/dashboard` — Chambers KPI metrics, urgency breakdown, and top deadlines (`DEADLINE_VIEW`)
- `GET /api/v1/deadlines/alerts` — Alert schedule inspection (`DEADLINE_VIEW`)
- `POST /api/v1/deadlines/alerts/process` — Trigger pending alert delivery (`DEADLINE_VIEW`)

### Case Deadlines (Scoped by Case Access)
- `GET /api/v1/cases/:caseId/deadlines` — List case deadlines (`DEADLINE_VIEW` + `authorizeCaseAccess`)
- `GET /api/v1/cases/:caseId/deadlines/:deadlineId` — Single deadline with audit & alerts (`DEADLINE_VIEW` + `authorizeCaseAccess`)
- `POST /api/v1/cases/:caseId/deadlines` — Create deadline (rule-based or manual) (`DEADLINE_CREATE` + `authorizeCaseAccess`)
- `POST /api/v1/cases/:caseId/deadlines/:deadlineId/override` — Manual override with mandatory reason (`DEADLINE_OVERRIDE` + `authorizeCaseAccess`)
- `POST /api/v1/cases/:caseId/deadlines/:deadlineId/complete` — Mark completed (`DEADLINE_COMPLETE` + `authorizeCaseAccess`)
- `POST /api/v1/cases/:caseId/deadlines/:deadlineId/waive` — Waive deadline (`DEADLINE_WAIVE` + `authorizeCaseAccess`)
