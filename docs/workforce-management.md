# Prompt 10: Complete Internal Employee + Internship Management System

## 1. Overview & Architecture
The Employee + Internship Management System provides advocate chambers with an end-to-end workforce lifecycle management platform. It strictly separates internal workforce operations and compensation from client-facing practice management, matters, and billing while providing seamless linking where appropriate (such as case assignments, task allocations, and attendance).

### Key Pillars
1. **Workforce Differentiation**:
   - `EMPLOYEE`: Full-time and part-time advocates, associates, paralegals, and administrative staff with structured monthly base salaries, allowances, and statutory leave quotas.
   - `PAID_INTERN`: Law interns receiving fixed monthly stipends.
   - `UNPAID_INTERN`: Pro-bono/academic credit interns with **strictly blocked** stipend disbursements at both API, service, and database constraint levels.
   - `CONTRACTOR`: External retainers, stenographers, and filing clerks.

2. **Security & Financial Separation**:
   - Client billing (`invoices`, `payments`, `receipts`, `retainers`) is strictly separate from internal compensation (`workforce_salary_structures`, `workforce_disbursements`, `workforce_reimbursements`).
   - Bank account details (Account numbers, IFSC codes, PAN) are encrypted at rest using **AES-256-GCM** with authenticated checksums.
   - Masked display (`•••• •••• 1234` / `HDFC••••234`) is enforced on all non-administrative endpoints.
   - Strict RBAC: Interns and Junior Associates are completely barred from viewing compensation structures or other members' confidential records.

3. **Atomic Sequential Code Generation**:
   - `EMP-YYYY-XXXX` — Employees
   - `INT-YYYY-XXXX` — Interns
   - `CON-YYYY-XXXX` — Contractors
   - `CAN-YYYY-XXXX` — Candidates
   - `OFF-YYYY-XXXX` — Job & Internship Offers
   - `TSK-YYYY-XXXX` — Chambers Tasks
   - `PAY-YYYY-XXXX` — Payroll Disbursements
   - `CLM-YYYY-XXXX` — Expense Reimbursement Claims
   - `CERT-YYYY-XXXX` — Internship Completion Certificates

---

## 2. Database Schema (25 Dedicated Tables)

| Table Name | Description |
|---|---|
| `workforce_profiles` | Core employee & intern identity, designations, dates, emergency contacts, bar council enrollments |
| `workforce_types_history` | Audit log of role transitions (e.g. Unpaid Intern &rarr; Paid Intern &rarr; Associate) |
| `workforce_candidates` | ATS candidate recruitment pipeline (Resume, university, GPA, specialization, status) |
| `workforce_interviews` | Interview rounds (Chambers Advocate round, Managing Partner round, feedback scores) |
| `workforce_offers` | Formal offer letters with remuneration terms, acceptance tracking, and validity windows |
| `workforce_onboarding_checklists` | Configurable onboarding tasks (Document collection, Chambers ID, Library card) |
| `workforce_bank_details` | AES-256-GCM encrypted bank accounts and IFSC codes |
| `workforce_salary_structures` | Monthly base salaries, allowances, and deductions for employees |
| `workforce_intern_stipends` | Intern-specific stipend terms with unpaid intern guard |
| `workforce_disbursements` | Monthly salary & stipend disbursements, payment references, and payment slips |
| `workforce_reimbursements` | Court filing fees, travel expenses, and chambers meal reimbursement claims |
| `workforce_working_schedules` | Chambers shift hours (e.g. 09:30 AM – 06:30 PM with 15-minute grace period) |
| `workforce_attendance_logs` | Daily punch-in, punch-out, total work hours, and late marks |
| `workforce_attendance_regularizations`| Missed punch regularization requests and manager approvals |
| `workforce_leave_types` | Leave definitions (Casual, Sick, Maternity, Exam Prep) with workforce type eligibility |
| `workforce_leave_balances` | Annual allotted vs. used quotas per member |
| `workforce_leave_requests` | Formal leave applications with date-range overlap collision prevention |
| `workforce_tasks` | Chambers administrative, research, and filing tasks linked to cases and clients |
| `workforce_goals` | Performance objectives and KPI targets |
| `workforce_reviews` | Performance appraisals (including 5-point legal drafting & research criteria for interns) |
| `workforce_disciplinary_warnings` | Formal warning records with acknowledgement tracking |
| `workforce_assets` | Issued laptops, access cards, chambers keys, and library books |
| `workforce_exit_requests` | Resignation, internship completion, and termination notices |
| `workforce_handovers` | Case and document handover tracking to designated successors |
| `workforce_internship_certificates` | Official verified internship certificates with unique verification codes |

---

## 3. REST API Specification

### Base URL: `/api/v1/workforce`

| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/dashboard` | Metrics, headcount by type, attendance status, active tasks | `WORKFORCE_VIEW` |
| `GET` | `/directory` | Paginated directory with type, status, and department filters | `WORKFORCE_VIEW` |
| `POST` | `/profiles` | Register a new employee or intern profile | `WORKFORCE_MANAGE` |
| `GET` | `/profiles/:id` | Full profile with bank details, leave quotas, and history | `WORKFORCE_VIEW` |
| `PUT` | `/profiles/:id` | Update profile information | `WORKFORCE_MANAGE` |
| `POST` | `/candidates` | Create candidate in ATS pipeline | `WORKFORCE_RECRUITMENT` |
| `GET` | `/candidates` | Filter candidates by stage (APPLIED, SHORTLISTED, etc.) | `WORKFORCE_RECRUITMENT` |
| `POST` | `/candidates/:id/interviews` | Schedule candidate interview round | `WORKFORCE_RECRUITMENT` |
| `POST` | `/candidates/:id/offers` | Issue offer letter | `WORKFORCE_RECRUITMENT` |
| `POST` | `/offers/:id/accept` | Accept offer & auto-provision onboarding workforce record | `WORKFORCE_RECRUITMENT` |
| `POST` | `/profiles/:id/onboarding/complete` | Complete onboarding & auto-create login user account | `WORKFORCE_MANAGE` |
| `POST` | `/attendance/punch-in` | Punch-in with timestamp and grace period calculation | `ATTENDANCE_PUNCH` |
| `POST` | `/attendance/punch-out` | Punch-out and calculate total duration | `ATTENDANCE_PUNCH` |
| `GET` | `/attendance/today` | Current day chambers roster and attendance log | `ATTENDANCE_VIEW` |
| `GET` | `/leaves/types` | Retrieve leave types eligible for specific workforce type | `LEAVE_VIEW` |
| `POST` | `/profiles/:id/leaves/apply` | Apply for leave with date collision validation | `LEAVE_APPLY` |
| `PATCH` | `/leaves/requests/:id/process` | Approve or reject leave request | `LEAVE_APPROVE` |
| `GET` | `/tasks` | Filter tasks by priority, status, or assignee | `TASK_VIEW` |
| `POST` | `/tasks` | Create new chambers task linked to case/client | `TASK_CREATE` |
| `PATCH` | `/tasks/:id` | Update task status or assignment | `TASK_UPDATE` |
| `GET` | `/payroll/disbursements` | View monthly salary and stipend disbursements | `PAYROLL_VIEW` |
| `POST` | `/payroll/disbursements` | Create disbursement (unpaid interns strictly blocked) | `PAYROLL_MANAGE` |
| `PATCH` | `/payroll/disbursements/:id/paid` | Mark disbursement as paid with UTR reference | `PAYROLL_MANAGE` |
| `POST` | `/payroll/reimbursements` | Submit expense claim for court fees, travel, etc. | `REIMBURSEMENT_SUBMIT` |
| `PATCH` | `/payroll/reimbursements/:id/process`| Approve or reject reimbursement claim | `REIMBURSEMENT_APPROVE` |
| `GET` | `/assets` | List issued chambers laptops, keys, and access cards | `ASSET_VIEW` |
| `POST` | `/assets/assign` | Issue an asset to a workforce member | `ASSET_MANAGE` |
| `PATCH` | `/assets/:id/return` | Record asset return and condition | `ASSET_MANAGE` |
| `POST` | `/profiles/:id/exit-request` | Initiate resignation or internship completion | `WORKFORCE_OFFBOARD` |
| `POST` | `/profiles/:id/issue-certificate` | Generate internship certificate (`CERT-YYYY-XXXX`) | `WORKFORCE_OFFBOARD` |
| `POST` | `/profiles/:id/revoke-and-exit` | Revoke login accounts, tokens, and unassign cases | `WORKFORCE_OFFBOARD` |

---

## 4. Frontend UI Pages
The frontend is built using standard React.js, Vite, and clean Vanilla CSS (no Tailwind / TypeScript):
1. **Workforce Overview** (`/workforce`): Headcount KPI cards, quick punch widget, daily attendance progress, upcoming leave schedules.
2. **Members Directory** (`/workforce/directory`): Searchable roster with tabbed filtering by workforce type, status, and designation.
3. **Member Detail Profile** (`/workforce/members/:id`): Tabbed deep-dive with profile details, encrypted bank details, leave ledger, tasks, and reviews.
4. **Candidate Pipeline** (`/workforce/candidates`): Kanban-style ATS pipeline with interview scheduling, offer generation, and one-click onboarding conversion.
5. **Daily Attendance** (`/workforce/attendance`): Today's roster, punch-in/out console, monthly attendance summaries, and regularization requests.
6. **Leave Management** (`/workforce/leaves`): Leave quota ledger, apply modal with collision guards, pending approval actions.
7. **Chambers Tasks** (`/workforce/tasks`): Task board with case/client linking, priority indicators, and status updates.
8. **Payroll & Stipends** (`/workforce/payroll`): Monthly salary and intern stipend disbursements, UTR recording, and expense claim management.
9. **Chambers Assets** (`/workforce/assets`): Hardware and physical security tracking for laptops, keys, and RFID access badges.
10. **Offboarding & Alumni** (`/workforce/offboarding`): Exit workflows, handover registers, internship completion certificates, and one-click access revocation.

### Accordion Navigation Behavior
Adheres to the single-active accordion pattern:
- All accordion sections start collapsed by default.
- Clicking an accordion section opens its children and collapses all other open sections.
