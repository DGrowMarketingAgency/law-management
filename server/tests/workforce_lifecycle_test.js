/**
 * Prompt 10: Complete Workforce Lifecycle Test Suite
 * Tests Candidate Pipeline -> Interview -> Offer -> Onboarding -> Activation -> Attendance ->
 * Leaves -> Tasks -> Payroll/Stipends -> Performance Reviews -> Handover -> Access Revocation.
 */

const assert = require("assert");
const pool = require("../config/database");
const WorkforceService = require("../services/workforceService");
const CandidateService = require("../services/candidateService");
const OnboardingService = require("../services/onboardingService");
const AttendanceService = require("../services/attendanceService");
const LeaveService = require("../services/leaveService");
const WorkforceTaskService = require("../services/workforceTaskService");
const PayrollService = require("../services/payrollService");
const PerformanceService = require("../services/performanceService");
const AssetService = require("../services/assetService");
const OffboardingService = require("../services/offboardingService");
const WorkforceSecurityService = require("../services/workforceSecurityService");

async function runTests() {
  console.log("==================================================================");
  console.log("Starting Prompt 10 Complete Workforce Lifecycle Test Suite");
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

  // Get or seed an OWNER user for tests
  const [ownerUsers] = await pool.query(`
    SELECT u.id, u.email, r.name AS role
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.name = 'OWNER'
    LIMIT 1
  `);

  const ownerUser = ownerUsers[0] || { id: 1, email: "owner@chambers.com", role: "OWNER" };

  let candidateId = null;
  let offerId = null;
  let internWorkforceId = null;
  let employeeWorkforceId = null;
  let taskId = null;
  let leaveRequestId = null;

  // -------------------------------------------------------------
  // 1. Candidate Pipeline & ATS Tests
  // -------------------------------------------------------------
  console.log("\n[1. Candidate Pipeline & ATS Tests]");

  await test("Create legal intern candidate with CAN- sequential code", async () => {
    const candidate = await CandidateService.createCandidate({
      full_name: "Rahul Sharma",
      email: `rahul.intern.${Date.now()}@lawcollege.edu`,
      phone: "+919876543210",
      applying_for: "PAID_INTERN",
      college_institution: "Faculty of Law, University of Delhi",
      course_degree: "LL.B (Final Year)",
      graduation_year: 2027,
      source: "CAMPUS_DRIVE",
    });

    assert.ok(candidate.id > 0);
    assert.ok(candidate.candidate_code.startsWith("CAN-"));
    candidateId = candidate.id;
  });

  await test("Schedule interview round and record ratings", async () => {
    const sched = await CandidateService.scheduleInterview(candidateId, {
      round_name: "Round 1 - Constitutional & Procedural Law",
      interviewer_user_id: ownerUser.id,
      scheduled_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      mode: "VIRTUAL",
      notes: "Focus on Article 226 and CPC Order 39 interim injunctions",
    });

    assert.ok(sched.id > 0);
    assert.strictEqual(sched.round_number, 1);

    const feedback = await CandidateService.recordInterviewFeedback(sched.id, {
      rating: 5,
      notes: "Exceptional grasp of CPC amendments and high court precedents.",
      recommendation: "RECOMMENDED",
      result: "SELECTED",
    });

    assert.strictEqual(feedback.status, "UPDATED");

    // Verify candidate advanced to SELECTED
    const details = await CandidateService.getCandidateById(candidateId);
    assert.strictEqual(details.candidate.stage, "SELECTED");
  });

  await test("Issue offer letter and accept it to auto-transition into onboarding", async () => {
    const offer = await CandidateService.createOffer(candidateId, {
      designation: "Legal Intern - Dispute Resolution",
      department: "Litigation & Dispute Resolution",
      joining_date: "2026-10-01",
      end_date: "2026-11-30",
      offered_compensation: 15000.0,
      terms: "Chambers 8-week intensive litigation internship with monthly stipend.",
    }, ownerUser.id);

    assert.ok(offer.id > 0);
    assert.ok(offer.offer_code.startsWith("OFF-"));
    offerId = offer.id;

    // Accept offer
    const acceptRes = await CandidateService.acceptOffer(offerId, ownerUser.id);
    assert.strictEqual(acceptRes.status, "ACCEPTED");
    assert.ok(acceptRes.workforce_id > 0);
    assert.ok(acceptRes.workforce_code.startsWith("INT-"));
    internWorkforceId = acceptRes.workforce_id;
  });

  // -------------------------------------------------------------
  // 2. Onboarding Verification & Activation Guard Tests
  // -------------------------------------------------------------
  console.log("\n[2. Onboarding Verification & Activation Guard Tests]");

  await test("Onboarding checklist auto-seeded with mandatory items", async () => {
    const checklist = await OnboardingService.getChecklist(internWorkforceId);
    assert.ok(checklist.items.length >= 6);
    assert.ok(checklist.summary.pending_mandatory > 0);
  });

  await test("Activation guard prevents non-owner activation with pending mandatory items", async () => {
    // Attempt activation with non-owner role
    await assert.rejects(
      async () => {
        await OnboardingService.completeOnboardingAndActivate(
          internWorkforceId,
          {},
          { id: 999, role: "JUNIOR_ASSOCIATE" }
        );
      },
      (err) => {
        assert.ok(err.message.includes("mandatory checklist items"));
        return true;
      }
    );
  });

  await test("Complete mandatory checklist items and activate profile with user account", async () => {
    const checklist = await OnboardingService.getChecklist(internWorkforceId);
    for (const item of checklist.items) {
      if (item.mandatory) {
        await OnboardingService.updateChecklistItem(item.id, { status: "COMPLETED", remarks: "Verified by Chambers HR" }, ownerUser.id);
      }
    }

    const activation = await OnboardingService.completeOnboardingAndActivate(
      internWorkforceId,
      { create_user_account: true },
      ownerUser
    );

    assert.strictEqual(activation.status, "ACTIVE");
    assert.ok(activation.user_id > 0);

    const profileData = await WorkforceService.getProfileById(internWorkforceId, ownerUser);
    assert.strictEqual(profileData.profile.status, "ACTIVE");
    assert.strictEqual(profileData.profile.workforce_type, "PAID_INTERN");
    assert.strictEqual(profileData.internshipRecord.stipend_enabled, 1);
  });

  // -------------------------------------------------------------
  // 3. Employee Creation & Salary Structure Tests
  // -------------------------------------------------------------
  console.log("\n[3. Employee Creation & Salary Structure Tests]");

  await test("Create full-time Employee profile with EMP- code", async () => {
    const emp = await WorkforceService.createProfile({
      first_name: "Pooja",
      last_name: "Iyer",
      email: `pooja.advocate.${Date.now()}@chambers.com`,
      phone: "+919811223344",
      workforce_type: "EMPLOYEE",
      designation: "Associate Advocate",
      department: "Commercial Arbitration",
      joining_date: "2026-09-15",
      probation_period_days: 90,
      emergency_contact_name: "K. Iyer",
      emergency_contact_phone: "+919811223300",
      blood_group: "O+",
    }, ownerUser.id);

    assert.ok(emp.id > 0);
    assert.ok(emp.workforce_code.startsWith("EMP-"));
    employeeWorkforceId = emp.id;
  });

  await test("Configure confidential employee salary structure (Gross, Basic, Allowances, Deductions)", async () => {
    const sal = await PayrollService.setSalaryStructure(employeeWorkforceId, {
      gross_amount: 85000.0,
      basic_amount: 42500.0,
      allowances_amount: 37500.0,
      deductions_amount: 5000.0,
      components: {
        hra: 25000,
        special_allowance: 12500,
        professional_tax: 200,
        tds: 4800,
      },
    }, ownerUser.id);

    assert.ok(sal.id > 0);
    assert.strictEqual(sal.gross_amount, 85000.0);
    assert.strictEqual(sal.status, "ACTIVE");
  });

  await test("Strict Unpaid Intern Guard: Block stipend disbursement on UNPAID_INTERN", async () => {
    // Create an UNPAID intern
    const unpaid = await WorkforceService.createProfile({
      first_name: "Vikram",
      last_name: "Verma",
      email: `vikram.unpaid.${Date.now()}@lawcollege.edu`,
      phone: "+919777888999",
      workforce_type: "UNPAID_INTERN",
      college_institution: "NLU Delhi",
    }, ownerUser.id);

    // Attempt to configure stipend on UNPAID_INTERN -> must throw 400
    await assert.rejects(
      async () => {
        await PayrollService.setInternStipend(unpaid.id, { stipend_amount: 10000 }, ownerUser.id);
      },
      (err) => {
        assert.ok(err.message.includes("Cannot configure stipend for an UNPAID intern"));
        return true;
      }
    );

    // Attempt to disburse stipend on UNPAID_INTERN -> must throw 400
    await assert.rejects(
      async () => {
        await PayrollService.createDisbursement({
          workforce_id: unpaid.id,
          payment_type: "STIPEND",
          period_start: "2026-10-01",
          period_end: "2026-10-31",
          gross_amount: 10000,
        }, ownerUser.id);
      },
      (err) => {
        assert.ok(err.message.includes("Disbursement blocked"));
        return true;
      }
    );
  });

  // -------------------------------------------------------------
  // 4. AES-256-GCM Bank Encryption & Masking Tests
  // -------------------------------------------------------------
  console.log("\n[4. AES-256-GCM Bank Account Encryption Tests]");

  await test("Bank account encryption at rest and masked display", async () => {
    const rawAcc = "12345678901234";
    const rawIfsc = "HDFC0001234";

    const saved = await PayrollService.saveBankAccount(employeeWorkforceId, {
      account_holder_name: "Pooja Iyer",
      bank_name: "HDFC Bank",
      account_number: rawAcc,
      ifsc: rawIfsc,
      upi_id: "poojaiyer@hdfcbank",
    });

    assert.strictEqual(saved.account_number_masked, "•••• •••• 1234");
    assert.strictEqual(saved.ifsc_masked, "HDFC••••234");

    // Verify in database that it is encrypted and not stored as plaintext
    const [rows] = await pool.query(
      `SELECT account_number_encrypted, ifsc_encrypted FROM workforce_bank_accounts WHERE workforce_id = ?`,
      [employeeWorkforceId]
    );

    assert.notStrictEqual(rows[0].account_number_encrypted, rawAcc);
    assert.ok(rows[0].account_number_encrypted.includes(":"));

    // Verify decryption
    const decryptedAcc = WorkforceSecurityService.decrypt(rows[0].account_number_encrypted);
    assert.strictEqual(decryptedAcc, rawAcc);
  });

  // -------------------------------------------------------------
  // 5. Attendance & Punctuality Tests
  // -------------------------------------------------------------
  console.log("\n[5. Attendance & Punctuality Tests]");

  await test("Attendance check-in marks PRESENT if within schedule grace", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const inRes = await AttendanceService.checkIn(internWorkforceId, {
      attendance_date: today,
      check_in: "09:40:00", // Within 09:30 + 15m grace
      source: "WEB",
    });

    assert.strictEqual(inRes.status, "PRESENT");
  });

  await test("Attendance check-out computes total hours correctly", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const outRes = await AttendanceService.checkOut(internWorkforceId, {
      attendance_date: today,
      check_out: "18:40:00", // 9 hours
    });

    assert.strictEqual(outRes.total_hours, 9.0);
    assert.strictEqual(outRes.status, "PRESENT");
  });

  // -------------------------------------------------------------
  // 6. Leave Management & Attendance Sync Tests
  // -------------------------------------------------------------
  console.log("\n[6. Leave Management Tests]");

  await test("Apply for leave with balance check and date collision prevention", async () => {
    // Get leave type
    const [leaveTypes] = await pool.query(
      `SELECT id FROM workforce_leave_types WHERE code = 'CASUAL' LIMIT 1`
    );
    const leaveTypeId = leaveTypes[0].id;

    // Allocate balance for employee
    const curYear = new Date().getFullYear();
    await pool.query(
      `INSERT INTO workforce_leave_balances
       (workforce_id, leave_type_id, year, opening_balance, allocated, remaining)
       VALUES (?, ?, ?, 12, 12, 12)
       ON DUPLICATE KEY UPDATE remaining = 12`,
      [employeeWorkforceId, leaveTypeId, curYear]
    );

    const appRes = await LeaveService.applyLeave(employeeWorkforceId, {
      leave_type_id: leaveTypeId,
      start_date: "2026-11-10",
      end_date: "2026-11-12",
      total_days: 3,
      reason: "Family wedding commitment",
    });

    assert.ok(appRes.id > 0);
    assert.strictEqual(appRes.status, "PENDING");
    leaveRequestId = appRes.id;

    // Duplicate overlapping request should fail
    await assert.rejects(
      async () => {
        await LeaveService.applyLeave(employeeWorkforceId, {
          leave_type_id: leaveTypeId,
          start_date: "2026-11-11",
          end_date: "2026-11-13",
          total_days: 2,
          reason: "Overlapping request",
        });
      },
      (err) => {
        assert.ok(err.message.includes("overlapping"));
        return true;
      }
    );
  });

  await test("Approve leave request: balance deducted and attendance synced", async () => {
    const proc = await LeaveService.processLeaveRequest(leaveRequestId, "APPROVE", {}, ownerUser.id);
    assert.strictEqual(proc.status, "APPROVED");

    // Verify balance remaining is 12 - 3 = 9
    const balances = await LeaveService.getBalances(employeeWorkforceId);
    const casualBal = balances.find((b) => b.leave_type_code === "CASUAL");
    assert.strictEqual(parseFloat(casualBal.used), 3.0);
    assert.strictEqual(parseFloat(casualBal.remaining), 9.0);

    // Verify attendance sync
    const [attRows] = await pool.query(
      `SELECT * FROM workforce_attendance WHERE workforce_id = ? AND attendance_date = '2026-11-10'`,
      [employeeWorkforceId]
    );
    assert.strictEqual(attRows.length, 1);
    assert.strictEqual(attRows[0].status, "LEAVE");
  });

  // -------------------------------------------------------------
  // 7. Workforce Tasks Delegation Tests
  // -------------------------------------------------------------
  console.log("\n[7. Workforce Tasks Delegation Tests]");

  await test("Create internal task assigned to legal intern with TSK- code", async () => {
    const task = await WorkforceTaskService.createTask({
      title: "Prepare Comparative Table of Section 9 Arbitration Precedents",
      description: "Analyze Delhi HC single bench orders regarding post-award interim relief.",
      task_type: "RESEARCH",
      priority: "HIGH",
      assigned_to: ownerUser.id,
      due_date: "2026-10-15",
      estimated_hours: 8.0,
    }, ownerUser.id);

    assert.ok(task.id > 0);
    assert.ok(task.task_code.startsWith("TSK-"));
    taskId = task.id;
  });

  await test("Log actual hours and mark task as COMPLETED", async () => {
    const updated = await WorkforceTaskService.updateTask(taskId, {
      status: "COMPLETED",
      actual_hours: 7.5,
    }, ownerUser);

    assert.strictEqual(updated.status, "COMPLETED");

    const fetched = await WorkforceTaskService.getTaskById(taskId, ownerUser);
    assert.strictEqual(parseFloat(fetched.actual_hours), 7.5);
    assert.ok(fetched.completed_at !== null);
  });

  // -------------------------------------------------------------
  // 8. Performance Evaluation & Disciplinary Warning Tests
  // -------------------------------------------------------------
  console.log("\n[8. Performance Evaluation & Warning Tests]");

  await test("Record Legal Intern evaluation with 5-point research/drafting criteria", async () => {
    const review = await PerformanceService.createReview(internWorkforceId, {
      review_period: "Month 1 Review",
      overall_rating: 5,
      research_quality: 5,
      drafting_quality: 4,
      punctuality: 5,
      legal_learning: 5,
      professionalism: 5,
      strengths: "Speedy research and accurate case citations.",
      improvements: "Refine synopsis formatting.",
      mentor_comments: "Promising candidate for chambers associate placement.",
      is_shareable_with_member: true,
    }, ownerUser.id);

    assert.ok(review.id > 0);
    assert.strictEqual(review.status, "SUBMITTED");
  });

  await test("Issue controlled disciplinary warning and submit member response", async () => {
    const warning = await PerformanceService.issueWarning(internWorkforceId, {
      category: "ATTENDANCE",
      description: "Unnotified delay in joining morning cause list hearing call.",
      severity: "LOW",
      response_due_date: "2026-10-20",
    }, ownerUser.id);

    assert.ok(warning.id > 0);
    assert.strictEqual(warning.status, "ISSUED");

    // Member submits response
    const updated = await PerformanceService.updateWarning(warning.id, {
      member_response: "Technical connectivity issue while traveling to Patiala House Court. Apologies logged.",
    }, ownerUser);

    assert.strictEqual(updated.status, "UPDATED");
  });

  // -------------------------------------------------------------
  // 9. Offboarding, Access Revocation & Certificate Tests
  // -------------------------------------------------------------
  console.log("\n[9. Offboarding & Revocation Tests]");

  await test("Intern completes tenure: generate unique certificate and execute full access revocation", async () => {
    // 1. Issue certificate
    const cert = await OffboardingService.issueInternshipCertificate(internWorkforceId, ownerUser.id);
    assert.ok(cert.certificate_number.startsWith("CERT-"));
    assert.strictEqual(cert.certificate_status, "ISSUED");

    // 2. Execute full revocation
    const rev = await OffboardingService.executeFullRevocationAndExit(internWorkforceId, ownerUser.id);
    assert.strictEqual(rev.status, "COMPLETED");
    assert.strictEqual(rev.access_revoked, true);

    // Verify profile status is COMPLETED
    const profile = await WorkforceService.getProfileById(internWorkforceId, ownerUser);
    assert.strictEqual(profile.profile.status, "COMPLETED");
  });

  console.log("\n==================================================================");
  console.log(`Prompt 10 Test Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution unhandled error:", err);
  process.exit(1);
});
