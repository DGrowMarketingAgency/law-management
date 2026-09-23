# Workforce Employee Management Documentation

## Overview
The Workforce Employee Management module provides comprehensive lifecycle administration for Chambers personnel, including Advocates, Senior Associates, Retainers, and Legal Interns. It enforces strict audit compliance, database synchronization, self-deactivation protection, and dependency safety policies.

---

## 1. Architecture & Synchronization

When updating or managing a workforce member, records across multiple relational tables are synchronized atomically in database transactions:

| Entity | Table | Synchronized Fields |
|---|---|---|
| **Contact Card** | `contacts` | `first_name`, `last_name`, `display_name`, `email`, `phone`, `alternate_phone` |
| **HR Profile** | `workforce_profiles` | `designation`, `department`, `work_location`, `employment_mode`, `joining_date`, `expected_end_date`, `notes`, `status` |
| **System User** | `users` | `first_name`, `last_name`, `email`, `phone`, `status` (synchronized when `user_id` is linked) |
| **Employment Terms** | `workforce_employment_records` | `probation_period_days`, `notice_period_days`, `emergency_contact_name`, `emergency_contact_phone`, `blood_group` |
| **Internship Details** | `internship_records` | `college_institution`, `stipend_amount`, `internship_status` |

---

## 2. Status Lifecycle & State Transitions

The `workforce_profiles.status` field governs employee access and chambers standing:

```
                  ┌───────────────┐
                  │  ONBOARDING   │
                  └───────┬───────┘
                          │ (Activate with checklist verification)
                          ▼
                  ┌───────────────┐
     ┌───────────►│    ACTIVE     │◄────────────┐
     │            └───────┬───────┘             │
     │                    │                     │
     │                    ▼ (Deactivate)        │ (Restore)
     │            ┌───────────────┐             │
     │            │   INACTIVE    │─────────────┤
     │            └───────┬───────┘             │
     │                    │ (Archive)           │
     │                    ▼                     │
     │            ┌───────────────┐             │
     └────────────│    EXITED     │─────────────┘
                  └───────────────┘
```

- **ONBOARDING**: Initial state upon member profile creation. Checklist items track background verification, NDA signing, and bar council enrollment.
- **ACTIVE**: Full access granted; platform user account activated; eligible for case assignments, task delegation, and attendance logging.
- **INACTIVE**: Suspended or on leave. Platform credentials revoked and active JWT refresh tokens invalidated. Historical data remains intact.
- **EXITED / ARCHIVED**: Offboarded member. System access terminated permanently while legal case history, attendance, invoices, and audit logs are preserved.

---

## 3. Safety Guardrails & Policies

1. **Owner Self-Deactivation Guard**:
   - Chambers owners cannot deactivate or suspend their own workforce accounts. Any attempt throws `403 Forbidden` (`You cannot deactivate your own account`).
2. **Immutable Workforce Code**:
   - Codes (e.g. `EMP-000001`, `INT-000001`) are system-generated and permanent. Updates to this field are ignored and rejected by the service.
3. **Deletion Safety Check (`GET /workforce/profiles/:id/deletion-safety`)**:
   - Queries database dependencies across:
     - `case_assignments` (Assigned active/past cases)
     - `documents` (Authored or uploaded compliance documents)
     - `fee_entries` (Billed fees and legal invoices)
     - `workforce_attendance` (Punch-in and hour records)
     - `workforce_tasks` (Assigned legal tasks)
     - `workforce_leave_requests` (Leave history)
   - If historical records exist (`canPermanentlyDelete: false`):
     - Permanent hard delete is blocked.
     - The profile can only be **Archived** (`POST /workforce/profiles/:id/archive`), which sets status to `EXITED` and revokes user logins while maintaining Bar compliance.
4. **Explicit Typed Confirmation**:
   - Archiving requires typing: `ARCHIVE <WORKFORCE_CODE>`
   - Permanent deletion requires typing: `DELETE <WORKFORCE_CODE>`

---

## 4. API Endpoints

### Administrative & Lifecycle Endpoints

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/workforce/directory` | `WORKFORCE_VIEW` | Search, filter, and paginate workforce members. |
| `GET` | `/workforce/profiles/:id` | `WORKFORCE_VIEW` | Fetch detailed member profile with related records. |
| `PATCH` | `/workforce/profiles/:id` | `WORKFORCE_UPDATE` | Update member profile, contact, user, and employment details. |
| `POST` | `/workforce/profiles/:id/activate` | `WORKFORCE_UPDATE` | Validate onboarding and activate profile with user account. |
| `POST` | `/workforce/profiles/:id/deactivate` | `WORKFORCE_UPDATE` | Suspend member, revoke user sessions, and set status to `INACTIVE`. |
| `POST` | `/workforce/profiles/:id/restore` | `WORKFORCE_UPDATE` | Restore suspended or inactive member back to `ACTIVE`. |
| `GET` | `/workforce/profiles/:id/deletion-safety` | `WORKFORCE_DELETE` | Calculate dependency counts and determine permanent delete eligibility. |
| `POST` | `/workforce/profiles/:id/archive` | `WORKFORCE_DELETE` | Safely archive member with typed confirmation. |
| `DELETE` | `/workforce/profiles/:id` | `WORKFORCE_DELETE` | Permanently delete member (only if no historical dependencies). |
| `POST` | `/workforce/profiles/:id/reset-password` | `USER_UPDATE` | Generate secure single-use password reset link and notify employee. |
| `POST` | `/workforce/profiles/:id/resend-invitation` | `USER_CREATE` | Generate secure setup token and re-email invitation link. |

### Tab Data Endpoints

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/workforce/profiles/:id/assigned-cases` | `WORKFORCE_VIEW` | Active and historical legal cases assigned to the member. |
| `GET` | `/workforce/profiles/:id/attendance` | `ATTENDANCE_VIEW` | Detailed attendance logs, punch-in/out, and regularization. |
| `GET` | `/workforce/profiles/:id/leave` | `LEAVE_VIEW` | Leave balances by category and past leave requests. |
| `GET` | `/workforce/profiles/:id/tasks` | `WORKFORCE_TASK_VIEW` | Assigned tasks, priorities, deadlines, and completion status. |
| `GET` | `/workforce/profiles/:id/documents` | `WORKFORCE_VIEW` | Verification files, agreements, NDAs, and bar certificates. |
| `GET` | `/workforce/profiles/:id/activity` | `WORKFORCE_VIEW` | Chronological audit trail of status changes and administrative actions. |

---

## 5. Audit Logging

Every state transition and administrative action produces an entry in `audit_logs` and `auth_audit_logs`:

- `WORKFORCE_UPDATED`
- `WORKFORCE_ACTIVATED`
- `WORKFORCE_DEACTIVATED`
- `WORKFORCE_RESTORED`
- `WORKFORCE_ARCHIVED`
- `WORKFORCE_PERMANENTLY_DELETED`
- `PASSWORD_RESET_REQUESTED`
- `WORKFORCE_INVITATION_RESENT`

---

## 6. Verification & Automated Tests

Run the test suite via:

```bash
node server/tests/workforce_employee_management_test.js
node server/tests/workforce_lifecycle_test.js
```
