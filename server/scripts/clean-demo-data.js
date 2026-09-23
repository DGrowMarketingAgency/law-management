/**
 * Production Readiness Database Cleanup Script
 * --------------------------------------------
 * Safely removes all seeded development, demo, and mock business records
 * while strictly preserving system master configuration (roles, permissions,
 * role_permissions, court masters, statutory limitation rules, and email templates).
 *
 * Usage: node server/scripts/clean-demo-data.js
 */

const db = require("../config/database");

const TABLES_TO_PURGE = [
  // User Authentication & Sessions
  "refresh_tokens",
  "password_reset_tokens",
  "otp_verifications",
  "auth_challenges",
  "auth_audit_logs",
  "user_invitations",
  "user_vaults",
  "vault_sessions",
  "user_roles",
  "users",

  // CRM, Clients & Contacts
  "appointments",
  "follow_ups",
  "lead_activities",
  "leads",
  "client_consents",
  "contact_tag_map",
  "contact_tags",
  "contact_addresses",
  "referral_sources",
  "clients",
  "contacts",
  "crm_audit_logs",

  // Matters & Court Proceedings
  "case_adjournments",
  "case_counsel",
  "case_assignments",
  "case_notes",
  "deadline_alerts",
  "case_deadlines",
  "case_hearings",
  "case_parties",
  "cases",

  // Documents & E-Signatures
  "document_comments",
  "document_reviews",
  "document_shares",
  "document_permissions",
  "document_tag_map",
  "document_tags",
  "document_signature_signers",
  "document_signature_requests",
  "document_text_content",
  "document_versions",
  "document_folders",
  "documents",

  // Billing, Invoicing & Payments
  "invoice_items",
  "invoice_reminders",
  "fee_entries",
  "payment_refunds",
  "payment_links",
  "payment_gateway_transactions",
  "payments",
  "retainer_transactions",
  "retainers",
  "invoices",
  "billing_audit_logs",

  // Workforce & HR
  "workforce_asset_assignments",
  "workforce_attendance",
  "workforce_bank_accounts",
  "employee_salary_structures",
  "workforce_employment_records",
  "workforce_exit_requests",
  "workforce_goals",
  "workforce_handover_items",
  "workforce_holidays",
  "workforce_leave_balances",
  "workforce_leave_requests",
  "workforce_offboarding_checklists",
  "workforce_offers",
  "workforce_onboarding_checklists",
  "workforce_payments",
  "workforce_performance_reviews",
  "workforce_reimbursements",
  "workforce_tasks",
  "workforce_warnings",
  "interview_records",
  "candidate_pipeline",
  "internship_records",
  "workforce_profiles",

  // Notifications & Logs
  "email_logs",
  "notification_logs",
  "webhook_events",
];

async function cleanDemoData() {
  console.log("==========================================================");
  console.log("Starting Production Database Cleanup (Purging Demo Data)");
  console.log("==========================================================");

  const conn = await db.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    let purgedCount = 0;
    for (const table of TABLES_TO_PURGE) {
      try {
        const [check] = await conn.query(
          `SELECT COUNT(*) as c FROM information_schema.tables 
           WHERE table_schema = DATABASE() AND table_name = ?`,
          [table]
        );
        if (check[0]?.c > 0) {
          const [res] = await conn.query(`DELETE FROM \`${table}\``);
          await conn.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
          console.log(`  ✓ Cleared table: ${table} (${res.affectedRows} records removed)`);
          purgedCount++;
        }
      } catch (tableErr) {
        console.warn(`  ! Could not clear ${table}:`, tableErr.message);
      }
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");

    console.log("\n----------------------------------------------------------");
    console.log(`Cleanup Complete: Successfully purged ${purgedCount} tables.`);
    console.log("Preserved Master Tables: roles, permissions, role_permissions,");
    console.log("courts, deadline_rules, email_templates, and workforce_leave_types.");
    console.log("System is now pristine and ready for First Owner Setup (/setup).");
    console.log("==========================================================\n");
  } catch (err) {
    console.error("Cleanup Error:", err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

cleanDemoData();
