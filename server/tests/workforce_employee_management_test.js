/**
 * Automated Test Suite for Workforce Employee Management
 * EDIT + DELETE + ACTIVE/INACTIVE + PROFILE + ACCESS CONTROL
 */

const assert = require("assert");
const pool = require("../config/database");
const WorkforceService = require("../services/workforceService");

async function runTests() {
  console.log("==================================================================");
  console.log("Starting Complete Workforce Employee Management Test Suite");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    -> ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  // 1. Get an OWNER user
  const [ownerUsers] = await pool.query(`
    SELECT u.id, u.email, r.name AS role
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.name = 'OWNER'
    LIMIT 1
  `);

  const ownerUser = ownerUsers[0] || { id: 1, email: "owner@chambers.com", role: "OWNER" };

  let testWorkforceId = null;
  let testWorkforceCode = null;
  let testContactId = null;
  let testUserId = null;

  // 2. Setup a dedicated test member
  await test("Create test employee workforce profile", async () => {
    const uniqueEmail = `test.employee.${Date.now()}@chambers.legal`;
    const res = await WorkforceService.createProfile(
      {
        first_name: "Vikram",
        last_name: "Seth",
        email: uniqueEmail,
        phone: "9876543210",
        workforce_type: "EMPLOYEE",
        designation: "Legal Associate",
        department: "Dispute Resolution",
        joining_date: "2026-09-01",
        emergency_contact_name: "Anjali Seth",
        emergency_contact_phone: "9876543211",
      },
      ownerUser.id
    );

    assert.ok(res.id, "Workforce profile ID should be returned");
    assert.ok(res.workforce_code, "Workforce code should be generated");
    testWorkforceId = res.id;
    testWorkforceCode = res.workforce_code;

    const fullProfile = await WorkforceService.getProfileById(testWorkforceId, ownerUser);
    testContactId = fullProfile.profile.contact_id;
    assert.strictEqual(fullProfile.profile.status, "ONBOARDING");
    assert.strictEqual(fullProfile.profile.designation, "Legal Associate");
  });

  // 3. Test Directory Search & Filtering
  await test("Directory Search & Filtering", async () => {
    const dir = await WorkforceService.getDirectory(
      { search: "Vikram", workforce_type: "EMPLOYEE", status: "ONBOARDING" },
      ownerUser
    );
    assert.ok(dir.profiles.length >= 1, "Directory should return the created member");
    const found = dir.profiles.find((p) => p.id === testWorkforceId);
    assert.ok(found, "Created member must be present in search results");
    assert.strictEqual(found.workforce_code, testWorkforceCode);
  });

  // 4. Test Edit Profile & DB Synchronization
  await test("Edit Profile synchronizes contacts, users, and employment details", async () => {
    const updatedEmail = `vikram.updated.${Date.now()}@chambers.legal`;
    const updatePayload = {
      first_name: "Vikramaditya",
      last_name: "Seth Senior",
      email: updatedEmail,
      phone: "9123456789",
      designation: "Senior Associate Advocate",
      department: "Corporate Arbitration",
      work_location: "Supreme Court Branch",
      emergency_contact_name: "Ramesh Seth",
      emergency_contact_phone: "9123456780",
      probation_period_days: 60,
      notice_period_days: 45,
      notes: "Promoted to arbitration lead.",
    };

    const res = await WorkforceService.updateProfile(testWorkforceId, updatePayload, ownerUser);
    assert.strictEqual(res.success, true);

    // Verify contact table was updated
    const [contacts] = await pool.query("SELECT * FROM contacts WHERE id = ?", [testContactId]);
    assert.strictEqual(contacts[0].first_name, "Vikramaditya");
    assert.strictEqual(contacts[0].last_name, "Seth Senior");
    assert.strictEqual(contacts[0].email, updatedEmail);
    assert.strictEqual(contacts[0].phone, "9123456789");

    // Verify workforce_profiles table was updated
    const [profiles] = await pool.query("SELECT * FROM workforce_profiles WHERE id = ?", [testWorkforceId]);
    assert.strictEqual(profiles[0].designation, "Senior Associate Advocate");
    assert.strictEqual(profiles[0].department, "Corporate Arbitration");
    assert.strictEqual(profiles[0].work_location, "Supreme Court Branch");

    // Verify workforce_employment_records table was updated
    const [empRecords] = await pool.query(
      "SELECT * FROM workforce_employment_records WHERE workforce_id = ?",
      [testWorkforceId]
    );
    assert.strictEqual(empRecords[0].probation_period_days, 60);
    assert.strictEqual(empRecords[0].notice_period_days, 45);
    assert.strictEqual(empRecords[0].emergency_contact_name, "Ramesh Seth");

    // Verify audit log
    const [auditLogs] = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'WORKFORCE_UPDATED' AND entity_id = ? ORDER BY id DESC LIMIT 1",
      [testWorkforceId]
    );
    assert.ok(auditLogs.length > 0, "WORKFORCE_UPDATED audit log must be recorded");
  });

  // 5. Test Immutable Code Guard
  await test("Workforce code remains immutable despite payload modifications", async () => {
    await WorkforceService.updateProfile(
      testWorkforceId,
      {
        first_name: "Vikramaditya",
        workforce_code: "HACKED-CODE-999", // Should be ignored
      },
      ownerUser
    );

    const [profiles] = await pool.query("SELECT workforce_code FROM workforce_profiles WHERE id = ?", [
      testWorkforceId,
    ]);
    assert.strictEqual(profiles[0].workforce_code, testWorkforceCode, "Workforce code must NOT change");
  });

  // 6. Test Member Activation & User Account Provisioning
  await test("Activate Profile provisions login account and marks status ACTIVE", async () => {
    const res = await WorkforceService.activateProfile(testWorkforceId, ownerUser, { force: true });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, "ACTIVE");
    assert.ok(res.user_id, "User ID should be provisioned or linked upon activation");
    testUserId = res.user_id;

    // Verify profile status in DB
    const [profiles] = await pool.query("SELECT status, user_id FROM workforce_profiles WHERE id = ?", [
      testWorkforceId,
    ]);
    assert.strictEqual(profiles[0].status, "ACTIVE");

    // Verify user account status
    const [users] = await pool.query("SELECT status, email FROM users WHERE id = ?", [testUserId]);
    assert.strictEqual(users[0].status, "ACTIVE");

    // Verify audit log
    const [auditLogs] = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'WORKFORCE_ACTIVATED' AND entity_id = ? ORDER BY id DESC LIMIT 1",
      [testWorkforceId]
    );
    assert.ok(auditLogs.length > 0, "WORKFORCE_ACTIVATED audit log must be created");
  });

  // 7. Test Self-Deactivation Prevention
  await test("Owner self-deactivation is strictly rejected with 403 Forbidden", async () => {
    // Find profile of requesting user if any, or mock
    const [ownerProfile] = await pool.query("SELECT id FROM workforce_profiles WHERE user_id = ?", [
      ownerUser.id,
    ]);

    if (ownerProfile.length > 0) {
      let blocked = false;
      try {
        await WorkforceService.deactivateProfile(ownerProfile[0].id, ownerUser, "Attempt self deactivation");
      } catch (err) {
        blocked = true;
        assert.strictEqual(err.statusCode, 403);
      }
      assert.ok(blocked, "Self-deactivation must be blocked");
    } else {
      // Temporarily link test profile to owner to test check
      await pool.query("UPDATE workforce_profiles SET user_id = ? WHERE id = ?", [ownerUser.id, testWorkforceId]);
      let blocked = false;
      try {
        await WorkforceService.deactivateProfile(testWorkforceId, ownerUser, "Attempt self deactivation");
      } catch (err) {
        blocked = true;
        assert.strictEqual(err.statusCode, 403);
      }
      assert.ok(blocked, "Self-deactivation must be blocked");
      // Restore user_id
      await pool.query("UPDATE workforce_profiles SET user_id = ? WHERE id = ?", [testUserId, testWorkforceId]);
    }
  });

  // 8. Test Member Deactivation & Session Revocation
  await test("Deactivate Profile revokes user sessions and sets status INACTIVE", async () => {
    const res = await WorkforceService.deactivateProfile(
      testWorkforceId,
      ownerUser,
      "Leave of absence / temporary suspension"
    );
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, "INACTIVE");

    // Verify profile status in DB
    const [profiles] = await pool.query("SELECT status FROM workforce_profiles WHERE id = ?", [testWorkforceId]);
    assert.strictEqual(profiles[0].status, "INACTIVE");

    // Verify user account status
    const [users] = await pool.query("SELECT status FROM users WHERE id = ?", [testUserId]);
    assert.strictEqual(users[0].status, "INACTIVE");

    // Verify audit log
    const [auditLogs] = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'WORKFORCE_DEACTIVATED' AND entity_id = ? ORDER BY id DESC LIMIT 1",
      [testWorkforceId]
    );
    assert.ok(auditLogs.length > 0, "WORKFORCE_DEACTIVATED audit log must be recorded");
  });

  // 9. Test Member Restoration
  await test("Restore Profile returns member and user account to ACTIVE", async () => {
    const res = await WorkforceService.restoreProfile(testWorkforceId, ownerUser, "Reinstated from leave");
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, "ACTIVE");

    const [profiles] = await pool.query("SELECT status FROM workforce_profiles WHERE id = ?", [testWorkforceId]);
    assert.strictEqual(profiles[0].status, "ACTIVE");

    const [users] = await pool.query("SELECT status FROM users WHERE id = ?", [testUserId]);
    assert.strictEqual(users[0].status, "ACTIVE");

    const [auditLogs] = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'WORKFORCE_RESTORED' AND entity_id = ? ORDER BY id DESC LIMIT 1",
      [testWorkforceId]
    );
    assert.ok(auditLogs.length > 0, "WORKFORCE_RESTORED audit log must be recorded");
  });

  // 10. Test Deletion Safety Check
  await test("Deletion safety check computes real dependency counts across modules", async () => {
    const safety = await WorkforceService.checkDeletionSafety(testWorkforceId);
    assert.strictEqual(safety.workforceId, testWorkforceId);
    assert.ok(typeof safety.counts.assignedCases === "number");
    assert.ok(typeof safety.counts.attendance === "number");
    assert.ok(typeof safety.counts.tasks === "number");
    assert.ok(typeof safety.counts.documents === "number");
    assert.ok(typeof safety.counts.billing === "number");
    assert.ok(typeof safety.canPermanentlyDelete === "boolean");
  });

  // 11. Test Deletion Safety Protection (simulating case assignment)
  await test("Permanent deletion is blocked when case assignments or history exist", async () => {
    // Find or create dummy case to assign
    const [cases] = await pool.query("SELECT id FROM cases LIMIT 1");
    if (cases.length > 0) {
      const caseId = cases[0].id;
      // Insert case assignment
      await pool.query(
        "INSERT INTO case_assignments (case_id, user_id, role_in_case) VALUES (?, ?, 'Associate')",
        [caseId, testUserId]
      );

      const safetyAfter = await WorkforceService.checkDeletionSafety(testWorkforceId);
      assert.strictEqual(safetyAfter.canPermanentlyDelete, false);
      assert.ok(safetyAfter.reasons.length > 0);

      // Attempt permanent delete - must throw 400
      let blocked = false;
      try {
        await WorkforceService.deleteOrArchiveProfile(
          testWorkforceId,
          "PERMANENT_DELETE",
          `DELETE ${testWorkforceCode}`,
          ownerUser
        );
      } catch (err) {
        blocked = true;
        assert.strictEqual(err.statusCode, 400);
      }
      assert.ok(blocked, "Permanent delete must be blocked due to case dependency");

      // Clean up test assignment
      await pool.query("DELETE FROM case_assignments WHERE case_id = ? AND user_id = ?", [caseId, testUserId]);
    }
  });

  // 12. Test Archive Profile with Typed Confirmation
  await test("Archive Profile requires matching confirmation code and sets EXITED", async () => {
    // Wrong code should fail
    let wrongCodeFailed = false;
    try {
      await WorkforceService.deleteOrArchiveProfile(testWorkforceId, "ARCHIVE", "WRONG CODE", ownerUser);
    } catch (err) {
      wrongCodeFailed = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(wrongCodeFailed, "Wrong confirmation code must be rejected");

    // Correct code succeeds
    const res = await WorkforceService.deleteOrArchiveProfile(
      testWorkforceId,
      "ARCHIVE",
      `ARCHIVE ${testWorkforceCode}`,
      ownerUser
    );
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, "EXITED");

    // Check user account disabled
    const [users] = await pool.query("SELECT status FROM users WHERE id = ?", [testUserId]);
    assert.strictEqual(users[0].status, "INACTIVE");

    // Check audit log
    const [auditLogs] = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'WORKFORCE_ARCHIVED' AND entity_id = ? ORDER BY id DESC LIMIT 1",
      [testWorkforceId]
    );
    assert.ok(auditLogs.length > 0, "WORKFORCE_ARCHIVED audit log must be recorded");
  });

  // 13. Test Password Reset Token Generation
  await test("Reset password generates single-use reset token and logs event", async () => {
    const res = await WorkforceService.resetPasswordForEmployee(testWorkforceId, ownerUser);
    assert.strictEqual(res.success, true);
    assert.ok(res.resetToken, "Reset token must be generated");

    // Check audit log
    const [auditLogs] = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'PASSWORD_RESET_REQUESTED' ORDER BY id DESC LIMIT 1"
    );
    assert.ok(auditLogs.length > 0, "PASSWORD_RESET_REQUESTED audit log must be recorded");
  });

  // 14. Test Resend Invitation
  await test("Resend invitation creates secure invitation token and logs event", async () => {
    const res = await WorkforceService.resendInvitation(testWorkforceId, ownerUser);
    assert.strictEqual(res.success, true);
    assert.ok(res.inviteToken, "Invitation token must be created/updated");

    // Check audit log
    const [auditLogs] = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'WORKFORCE_INVITATION_RESENT' AND entity_id = ? ORDER BY id DESC LIMIT 1",
      [testWorkforceId]
    );
    assert.ok(auditLogs.length > 0, "WORKFORCE_INVITATION_RESENT audit log must be recorded");
  });

  // 15. Test Sub-data Queries for Profile Tabs
  await test("Tab query methods return real MySQL datasets without mocks", async () => {
    const cases = await WorkforceService.getAssignedCases(testWorkforceId);
    assert.ok(Array.isArray(cases));

    const att = await WorkforceService.getMemberAttendance(testWorkforceId);
    assert.ok(Array.isArray(att.logs));

    const leaves = await WorkforceService.getMemberLeaves(testWorkforceId);
    assert.ok(Array.isArray(leaves.balances));
    assert.ok(Array.isArray(leaves.requests));

    const tasks = await WorkforceService.getMemberTasks(testWorkforceId);
    assert.ok(Array.isArray(tasks.tasks));

    const docs = await WorkforceService.getMemberDocuments(testWorkforceId);
    assert.ok(Array.isArray(docs));

    const audit = await WorkforceService.getMemberAuditHistory(testWorkforceId);
    assert.ok(Array.isArray(audit.logs));
    assert.ok(audit.logs.length >= 4, "Should have multiple audit logs from our lifecycle tests");
  });

  // 16. Test Permanent Delete (when clean)
  await test("Permanent Delete removes profile when safety check passes and code matches", async () => {
    // Delete any checklist/employment records to ensure clean deletion
    await pool.query("DELETE FROM workforce_onboarding_checklists WHERE workforce_id = ?", [testWorkforceId]);
    await pool.query("DELETE FROM workforce_employment_records WHERE workforce_id = ?", [testWorkforceId]);

    const res = await WorkforceService.deleteOrArchiveProfile(
      testWorkforceId,
      "PERMANENT_DELETE",
      `DELETE ${testWorkforceCode}`,
      ownerUser
    );
    assert.strictEqual(res.success, true);

    const [profiles] = await pool.query("SELECT id FROM workforce_profiles WHERE id = ?", [testWorkforceId]);
    assert.strictEqual(profiles.length, 0, "Workforce profile should be permanently deleted from DB");
  });

  console.log("==================================================================");
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
