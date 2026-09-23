const fs = require("fs");
const path = require("path");
const pool = require("../config/database");

/**
 * Prompt 10 Workforce Management System Database Migration
 * Creates 18 tables, seeds new roles (INTERN, HR_ADMIN, ACCOUNTS, ADMIN),
 * granular workforce permissions, default leave types, and Chambers working schedule.
 */
async function runWorkforceMigration() {
  const conn = await pool.getConnection();
  try {
    console.log("[Workforce Migration]: Verifying and executing workforce schema migration...");

    // 1. Execute DDL from workforce_schema.sql
    const sqlPath = path.join(__dirname, "workforce_schema.sql");
    if (fs.existsSync(sqlPath)) {
      const sqlContent = fs.readFileSync(sqlPath, "utf-8");
      
      // Clean all comments (both block and line comments) before splitting
      const cleanedSql = sqlContent
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/--.*$/gm, "");

      const statements = cleanedSql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.toLowerCase().startsWith("use "));

      for (const stmt of statements) {
        try {
          await conn.query(stmt);
        } catch (stmtErr) {
          if (!stmtErr.message.includes("already exists")) {
            console.warn(`[Workforce Migration DDL Notice]:`, stmtErr.message);
          }
        }
      }
      console.log("[Workforce Migration]: DDL statements verified.");
    }

    // 2. Ensure Roles Exist
    const rolesToEnsure = [
      ["OWNER", "Law firm owner/principal counsel with global administrative and financial authority"],
      ["SENIOR_ASSOCIATE", "Senior lawyer handling cases, assignments, junior mentorship, and operations"],
      ["JUNIOR_ASSOCIATE", "Junior lawyer executing case research, drafting, and attending proceedings"],
      ["INTERN", "Legal intern participating in legal research, case study, and assigned tasks"],
      ["HR_ADMIN", "HR & Practice Administrator managing recruitment, onboarding, leave, attendance, and offboarding"],
      ["ACCOUNTS", "Chambers accountant managing workforce payroll, stipends, and expense reimbursements"],
      ["ADMIN", "System administrator managing internal assets, users, and IT operations"],
      ["CLIENT", "Client external portal account"]
    ];

    for (const [name, description] of rolesToEnsure) {
      await conn.query(
        `INSERT INTO roles (name, description)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [name, description]
      );
    }

    // 3. Register Granular Workforce Permissions
    const permissions = [
      // Workforce Profiles & Directory
      ["WORKFORCE_VIEW", "WORKFORCE", "View workforce directory, member profiles, and designations"],
      ["WORKFORCE_CREATE", "WORKFORCE", "Create new employee, intern, or contractor profiles"],
      ["WORKFORCE_UPDATE", "WORKFORCE", "Edit workforce profile details and employment records"],
      ["WORKFORCE_DELETE", "WORKFORCE", "Archive or deactivate workforce profiles"],

      // Recruitment & Pipeline
      ["CANDIDATE_VIEW", "RECRUITMENT", "View recruitment candidate pipeline and applications"],
      ["CANDIDATE_MANAGE", "RECRUITMENT", "Add candidates, advance stages, schedule interviews, and log notes"],
      ["INTERVIEW_MANAGE", "RECRUITMENT", "Conduct interview rounds, record feedback, ratings, and recommendations"],
      ["OFFER_MANAGE", "RECRUITMENT", "Issue, modify, and track job/internship offer letters"],

      // Onboarding
      ["ONBOARDING_MANAGE", "ONBOARDING", "Manage onboarding checklists, verify documents, and initiate activation"],
      ["ONBOARDING_OVERRIDE", "ONBOARDING", "Owner override to activate profile with pending mandatory checklist items"],

      // Attendance & Leave
      ["ATTENDANCE_VIEW", "ATTENDANCE", "View workforce attendance records and daily punches"],
      ["ATTENDANCE_MANAGE", "ATTENDANCE", "Check-in/check-out, regularize attendance, and edit punch logs"],
      ["LEAVE_VIEW", "LEAVE", "View leave requests and balance allocations"],
      ["LEAVE_APPLY", "LEAVE", "Apply for personal leave requests"],
      ["LEAVE_APPROVE", "LEAVE", "Approve or reject workforce leave applications"],

      // Tasks & Assignments
      ["WORKFORCE_TASK_VIEW", "WORKFORCE_TASKS", "View internal workforce tasks"],
      ["WORKFORCE_TASK_MANAGE", "WORKFORCE_TASKS", "Create, assign, update, and manage workforce tasks"],

      // Performance & Disciplinary
      ["PERFORMANCE_VIEW", "PERFORMANCE", "View performance reviews and goal tracking"],
      ["PERFORMANCE_MANAGE", "PERFORMANCE", "Conduct reviews, evaluate legal interns, and manage firm goals"],
      ["WARNING_MANAGE", "PERFORMANCE", "Issue and resolve controlled disciplinary warnings"],

      // Assets
      ["ASSET_VIEW", "ASSETS", "View firm physical and digital asset assignments"],
      ["ASSET_MANAGE", "ASSETS", "Issue, transfer, return, and track condition of firm assets"],

      // Exit & Offboarding
      ["EXIT_VIEW", "OFFBOARDING", "View resignation and exit requests"],
      ["EXIT_MANAGE", "OFFBOARDING", "Review, approve, and process exit requests and handovers"],
      ["ACCESS_REVOKE", "OFFBOARDING", "Revoke user sessions, credentials, and case assignments on exit"],

      // Internal Payroll, Stipends & Reimbursements
      ["SALARY_VIEW", "PAYROLL", "View confidential employee salary structures and payroll history"],
      ["SALARY_MANAGE", "PAYROLL", "Configure salary structures and process monthly employee payroll"],
      ["STIPEND_VIEW", "PAYROLL", "View intern stipend structures and disbursement history"],
      ["STIPEND_MANAGE", "PAYROLL", "Configure and disburse stipends for eligible paid interns"],
      ["REIMBURSEMENT_VIEW", "PAYROLL", "View workforce expense reimbursement claims"],
      ["REIMBURSEMENT_MANAGE", "PAYROLL", "Submit, approve, and settle reimbursement claims"]
    ];

    for (const [name, category, description] of permissions) {
      await conn.query(
        `INSERT INTO permissions (name, category, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description), category = VALUES(category)`,
        [name, category, description]
      );
    }

    // 4. Role - Permission Mappings

    // Helper to map permissions by name
    const assignPermissions = async (roleName, permNames) => {
      if (!permNames || permNames.length === 0) return;
      const placeholders = permNames.map(() => "?").join(",");
      await conn.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id
         FROM roles r
         CROSS JOIN permissions p
         WHERE r.name = ? AND p.name IN (${placeholders})`,
        [roleName, ...permNames]
      );
    };

    // OWNER gets all workforce permissions
    const allWorkforcePerms = permissions.map((p) => p[0]);
    await assignPermissions("OWNER", allWorkforcePerms);

    // HR_ADMIN
    await assignPermissions("HR_ADMIN", [
      "WORKFORCE_VIEW", "WORKFORCE_CREATE", "WORKFORCE_UPDATE",
      "CANDIDATE_VIEW", "CANDIDATE_MANAGE", "INTERVIEW_MANAGE", "OFFER_MANAGE",
      "ONBOARDING_MANAGE",
      "ATTENDANCE_VIEW", "ATTENDANCE_MANAGE",
      "LEAVE_VIEW", "LEAVE_APPROVE", "LEAVE_APPLY",
      "WORKFORCE_TASK_VIEW", "WORKFORCE_TASK_MANAGE",
      "PERFORMANCE_VIEW", "PERFORMANCE_MANAGE", "WARNING_MANAGE",
      "ASSET_VIEW", "ASSET_MANAGE",
      "EXIT_VIEW", "EXIT_MANAGE", "ACCESS_REVOKE",
      "STIPEND_VIEW", "REIMBURSEMENT_VIEW"
    ]);

    // ACCOUNTS
    await assignPermissions("ACCOUNTS", [
      "WORKFORCE_VIEW",
      "SALARY_VIEW", "SALARY_MANAGE",
      "STIPEND_VIEW", "STIPEND_MANAGE",
      "REIMBURSEMENT_VIEW", "REIMBURSEMENT_MANAGE",
      "ATTENDANCE_VIEW", "LEAVE_VIEW", "LEAVE_APPLY"
    ]);

    // ADMIN
    await assignPermissions("ADMIN", [
      "WORKFORCE_VIEW", "WORKFORCE_CREATE", "WORKFORCE_UPDATE",
      "ONBOARDING_MANAGE",
      "ASSET_VIEW", "ASSET_MANAGE",
      "WORKFORCE_TASK_VIEW", "WORKFORCE_TASK_MANAGE",
      "ACCESS_REVOKE"
    ]);

    // SENIOR_ASSOCIATE
    await assignPermissions("SENIOR_ASSOCIATE", [
      "WORKFORCE_VIEW",
      "WORKFORCE_TASK_VIEW", "WORKFORCE_TASK_MANAGE",
      "ATTENDANCE_VIEW", "ATTENDANCE_MANAGE",
      "LEAVE_VIEW", "LEAVE_APPLY", "LEAVE_APPROVE",
      "PERFORMANCE_VIEW", "PERFORMANCE_MANAGE",
      "REIMBURSEMENT_VIEW", "REIMBURSEMENT_MANAGE",
      "CANDIDATE_VIEW", "INTERVIEW_MANAGE"
    ]);

    // JUNIOR_ASSOCIATE (Operational self-access only)
    await assignPermissions("JUNIOR_ASSOCIATE", [
      "ATTENDANCE_VIEW", "ATTENDANCE_MANAGE",
      "LEAVE_VIEW", "LEAVE_APPLY",
      "WORKFORCE_TASK_VIEW",
      "REIMBURSEMENT_VIEW", "REIMBURSEMENT_MANAGE"
    ]);

    // INTERN (Operational self-access only)
    await assignPermissions("INTERN", [
      "ATTENDANCE_VIEW", "ATTENDANCE_MANAGE",
      "LEAVE_VIEW", "LEAVE_APPLY",
      "WORKFORCE_TASK_VIEW"
    ]);

    // Strict boundary enforcement: Ensure JUNIOR_ASSOCIATE and INTERN have ZERO access to SALARY or STIPEND or CLIENT BILLING
    await conn.query(`
      DELETE rp FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE r.name IN ('JUNIOR_ASSOCIATE', 'INTERN', 'CLIENT')
        AND (p.name IN ('SALARY_VIEW', 'SALARY_MANAGE', 'STIPEND_VIEW', 'STIPEND_MANAGE', 'ONBOARDING_OVERRIDE') 
             OR p.category IN ('BILLING', 'PAYMENTS', 'RETAINERS'))
    `);

    // Ensure CLIENT has zero workforce permissions
    await conn.query(`
      DELETE rp FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE r.name = 'CLIENT'
        AND p.category IN ('WORKFORCE', 'RECRUITMENT', 'ONBOARDING', 'ATTENDANCE', 'LEAVE', 'WORKFORCE_TASKS', 'PAYROLL', 'PERFORMANCE', 'OFFBOARDING', 'ASSETS')
    `);

    // 5. Seed Default Leave Types
    const defaultLeaveTypes = [
      ["Casual Leave", "CASUAL", "Standard casual time-off for personal commitments", 12.0, "ALL", true],
      ["Sick / Medical Leave", "SICK", "Paid leave for health issues and medical consultations", 10.0, "ALL", true],
      ["Earned / Annual Leave", "ANNUAL", "Privileged annual vacation leave", 15.0, "EMPLOYEE_ONLY", true],
      ["Loss of Pay / Unpaid", "UNPAID", "Authorized leave without compensation", 30.0, "ALL", false],
      ["Intern Academic Leave", "INTERNSHIP_LEAVE", "Leave granted to legal interns for law examinations/college moot courts", 6.0, "INTERN_ONLY", false]
    ];

    for (const [name, code, desc, days, applicable, isPaid] of defaultLeaveTypes) {
      await conn.query(
        `INSERT INTO workforce_leave_types (name, code, description, default_days_per_year, applicable_to, is_paid, active)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE default_days_per_year = VALUES(default_days_per_year), description = VALUES(description)`,
        [name, code, desc, days, applicable, isPaid]
      );
    }

    // 6. Seed Default Chambers Working Schedule
    const [existingSchedules] = await conn.query(`SELECT id FROM workforce_working_schedules LIMIT 1`);
    if (existingSchedules.length === 0) {
      await conn.query(`
        INSERT INTO workforce_working_schedules 
        (schedule_name, working_days, start_time, end_time, break_duration_minutes, grace_minutes, active)
        VALUES (
          'Chambers Standard Schedule',
          JSON_ARRAY('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'),
          '09:30:00',
          '18:30:00',
          60,
          15,
          TRUE
        )
      `);
    }

    console.log("[Workforce Migration]: Prompt 10 Workforce schema, roles, permissions, leave types, and schedules initialized successfully!");
  } catch (err) {
    console.error("[Workforce Migration Error]:", err);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { runWorkforceMigration };
