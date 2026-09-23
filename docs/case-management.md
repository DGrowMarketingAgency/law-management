# Legal Practice Management Platform — Case Management, Courts & Cause List Engine

## 1. Overview & Chambers Context
This module establishes the core litigation and case management engine designed specifically for private advocate chambers in India. It builds upon:
- **Prompt 1 & 2**: Foundation architecture & MySQL 8+ relational schema.
- **Prompt 3**: RBAC, JWT authentication, and user permissions.
- **Prompt 4**: Contact & Client CRM, conflict-of-interest checking, and relationships.

The engine handles Indian court hierarchies, 16-character CNR numbers, dynamic case stages, multi-party litigation rosters, counsel representation, advocate team assignments, court hearings, transactional adjournments with reason tracking, automated next-hearing-date synchronization, and daily grouped Cause Lists.

---

## 2. Database Schema Architecture

The case management schema operates on the following tables:

| Table | Purpose | Key Foreign Keys |
|---|---|---|
| `courts` | National court registry (Supreme Court, High Courts, District Courts, Tribunals) | `parent_court_id` |
| `cases` | Primary case records with metadata, CNR, status, stage, dates, and client linkage | `court_id`, `primary_client_id`, `lead_advocate_id` |
| `case_parties` | Multi-party roster (Petitioner, Respondent, Co-accused, Intervener) | `case_id`, `contact_id` |
| `case_counsel` | Opposing & chamber counsel representation with Vakalatnama status | `case_id`, `contact_id` |
| `case_assignments` | Advocate and staff assignments to cases with chamber roles | `case_id`, `user_id`, `assigned_by` |
| `case_notes` | Privileged case notes with privacy levels (GENERAL, STRATEGY, INTERNAL) | `case_id`, `author_id` |
| `case_hearings` | Court hearing schedule, bench details, purpose, orders, and outcomes | `case_id`, `assigned_advocate_id` |
| `case_adjournments` | Audit-compliant adjournment records tracking reasons, requesting party, and costs | `hearing_id`, `case_id`, `granted_by_court_id` |

---

## 3. Two-Layer RBAC & Case Security Architecture

Access control is enforced through a two-layer verification model:

1. **System-Level Permission Check**:
   - Middleware checks if the user's role has the required permission (`CASE_VIEW`, `CASE_CREATE`, `CASE_UPDATE`, `CASE_DELETE`, `CASE_ASSIGN`, `HEARING_VIEW`, `HEARING_ADJOURN`, etc.).
2. **Entity-Level Case Access Verification (`authorizeCaseAccess`)**:
   - `OWNER` & `SENIOR_ASSOCIATE`: Automatically granted chambers-wide access to view and manage all cases.
   - `JUNIOR_ASSOCIATE`: Restricted strictly to cases where an active assignment exists in `case_assignments`. Unassigned cases return **403 Forbidden**.
   - Sub-resources (`/cases/:id/hearings`, `/cases/:id/parties`, `/cases/:id/notes`) automatically inherit and enforce the parent case authorization.
3. **Privileged Strategy Notes Protection (`canAccessCaseNote`)**:
   - Notes categorized as `STRATEGY` or `INTERNAL` are restricted to the author, the chambers `OWNER`, and `SENIOR_ASSOCIATE`s.
   - Junior associates cannot view or access privileged strategy notes even on cases to which they are assigned.

---

## 4. Case Lifecycle & Stage Progression

Cases progress through configurable Indian litigation stages:
- `PRE_FILING`: Drafting, petition preparation, vakalatnama execution.
- `FILING`: Lodged with court registry, scrutiny, defect clearance.
- `ADMISSION`: Preliminary hearing, issuance of notice.
- `PLEADINGS`: Counter-affidavit / written statement, rejoinder.
- `EVIDENCE`: Framing of issues, examination-in-chief, cross-examination.
- `ARGUMENTS`: Final arguments, submission of written submissions.
- `JUDGMENT_RESERVED`: Hearing concluded, awaiting pronouncement.
- `DISPOSED`: Final decree / order passed.
- `APPEAL`: Challenged in higher appellate forum (linked to appeal case).

Status values: `ACTIVE`, `PENDING`, `STAYED`, `DISPOSED`, `CLOSED`, `TRANSFERRED`.

---

## 5. Automated Next Hearing Date Synchronization

To eliminate stale case dockets, the platform implements an automated synchronization service (`caseDateService.js`):
- Whenever a hearing is scheduled, updated, or adjourned, `updateNextHearingDate(caseId)` runs automatically.
- Queries `case_hearings` for the earliest active hearing where `hearing_date >= CURRENT_DATE` and status is not `COMPLETED` or `CANCELLED`.
- Automatically syncs `cases.next_hearing_date`. If all future hearings are concluded, safely resets the pointer to `NULL`.

---

## 6. Adjournment Workflow

Adjournments in Indian courts require formal tracking:
- Endpoint: `POST /api/v1/cases/:id/hearings/:hearingId/adjourn`
- Request Payload:
  ```json
  {
    "reason": "Junior counsel unwell; adjournment requested by chambers",
    "requestedBy": "CHAMBERS",
    "adjournmentType": "ORDINARY",
    "costImposed": 0,
    "nextHearingDate": "2026-12-15T10:30:00.000Z",
    "purposeOfNextHearing": "Cross-examination of PW-1"
  }
  ```
- Workflow (Executed in a MySQL database transaction):
  1. The existing hearing status is updated to `ADJOURNED`.
  2. An audit record is created in `case_adjournments` with reasons, requesting party, and costs.
  3. A new hearing record is automatically created for the subsequent date.
  4. `cases.next_hearing_date` is synchronized to the new date.
  5. Audit log event `HEARING_ADJOURNED` is appended to `audit_logs`.

---

## 7. Daily Cause List Architecture

- Endpoint: `GET /api/v1/cause-list?date=YYYY-MM-DD`
- Aggregates all hearings scheduled across all courts for the selected date.
- Applies RBAC filtering: Junior associates only see cause list entries for cases assigned to them.
- Hierarchical Output Grouping:
  ```
  Court (Hierarchy & Bench / Room)
    └── Hearing Time (Ascending)
          └── Case Details (Title, Number, Case Type, Primary Client, Assigned Advocate, Purpose)
  ```
- Supports date ranges (`startDate` / `endDate`) for weekly advance cause list preparation.

---

## 8. REST API Endpoints Summary

### Courts
- `GET /api/v1/courts` — List courts with hierarchy & filtering
- `POST /api/v1/courts` — Register court (409 on duplicate code)
- `GET /api/v1/courts/:id` — Court details & active cases count
- `PUT /api/v1/courts/:id` — Update court details
- `DELETE /api/v1/courts/:id` — Deactivate court (safely blocked if active cases exist)

### Cases
- `GET /api/v1/cases` — List cases with filtering, pagination, and RBAC scoping
- `GET /api/v1/cases/dashboard` — Chambers KPI analytics (active cases, upcoming hearings, breakdown by stage/court)
- `POST /api/v1/cases` — Create case (validates unique CNR, initial parties)
- `GET /api/v1/cases/:id` — Case details with parties, counsel, assignments, and hearings
- `PUT /api/v1/cases/:id` — Update case metadata, stage, status, or notes
- `DELETE /api/v1/cases/:id` — Soft-delete case

### Parties & Counsel
- `GET /api/v1/cases/:id/parties` — Roster of litigants
- `POST /api/v1/cases/:id/parties` — Add litigant (409 on duplicate role for same contact)
- `DELETE /api/v1/cases/:id/parties/:partyId` — Remove litigant
- `GET /api/v1/cases/:id/counsel` — Roster of advocates
- `POST /api/v1/cases/:id/counsel` — Add advocate & Vakalatnama status (409 on duplicate)
- `DELETE /api/v1/cases/:id/counsel/:counselId` — Remove counsel

### Assignments & Notes
- `GET /api/v1/cases/:id/assignments` — Chamber advocates assigned
- `POST /api/v1/cases/:id/assignments` — Assign advocate (`CASE_ASSIGN` permission)
- `DELETE /api/v1/cases/:id/assignments/:assignmentId` — Remove advocate assignment
- `GET /api/v1/cases/:id/notes` — List case notes (filters out sensitive STRATEGY notes for unauthorized users)
- `POST /api/v1/cases/:id/notes` — Create case note (with privacy classification)

### Hearings & Adjournments
- `GET /api/v1/cases/:id/hearings` — List case hearings
- `POST /api/v1/cases/:id/hearings` — Schedule hearing & sync next hearing date
- `GET /api/v1/cases/:id/hearings/:hearingId` — Hearing details & adjournment history
- `PUT /api/v1/cases/:id/hearings/:hearingId` — Update hearing & outcome
- `POST /api/v1/cases/:id/hearings/:hearingId/adjourn` — Transactional adjournment workflow

### Cause List
- `GET /api/v1/cause-list` — Daily grouped cause list by Court -> Time -> Case
