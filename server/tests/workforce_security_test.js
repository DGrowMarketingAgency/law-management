/**
 * Prompt 10: Workforce Security & RBAC Boundary Test Suite
 * Verifies that Interns, Junior Associates, and Clients cannot breach
 * private directories, confidential salaries, or unassigned tasks.
 */

const assert = require("assert");
const pool = require("../config/database");
const WorkforceService = require("../services/workforceService");
const PayrollService = require("../services/payrollService");
const WorkforceTaskService = require("../services/workforceTaskService");
const PerformanceService = require("../services/performanceService");

async function runSecurityTests() {
  console.log("==================================================================");
  console.log("Starting Prompt 10 Workforce Security & RBAC Test Suite");
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
      failed++;
    }
  }

  // 1. Setup real test users in users table
  const ownerUser = { id: 1, role: "OWNER", permissions: ["ALL"] };

  const [u1] = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, status)
     VALUES ('Aakash', 'Verma', ?, 'hash', 'ACTIVE')`,
    [`aakash.test.${Date.now()}@lawcollege.edu`]
  );
  const internUser1 = { id: u1.insertId, role: "INTERN", permissions: ["WORKFORCE_VIEW", "WORKFORCE_TASK_VIEW"] };

  const [u2] = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, status)
     VALUES ('Sneha', 'Menon', ?, 'hash', 'ACTIVE')`,
    [`sneha.test.${Date.now()}@lawcollege.edu`]
  );
  const internUser2 = { id: u2.insertId, role: "INTERN", permissions: ["WORKFORCE_VIEW", "WORKFORCE_TASK_VIEW"] };

  const [u3] = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, status)
     VALUES ('Rohan', 'Advocate', ?, 'hash', 'ACTIVE')`,
    [`rohan.test.${Date.now()}@chambers.com`]
  );
  const juniorAssociate = { id: u3.insertId, role: "JUNIOR_ASSOCIATE", permissions: ["WORKFORCE_VIEW", "WORKFORCE_TASK_VIEW"] };
  const clientUser = { id: 9999, role: "CLIENT", permissions: [] };

  // Create two distinct test profiles
  const profile1 = await WorkforceService.createProfile({
    first_name: "Aakash",
    last_name: "Verma",
    email: `aakash.intern.${Date.now()}@lawcollege.edu`,
    phone: "+919988776611",
    workforce_type: "PAID_INTERN",
  }, ownerUser.id);

  // Link internUser1 to profile1
  await pool.query(`UPDATE workforce_profiles SET user_id = ? WHERE id = ?`, [internUser1.id, profile1.id]);

  const profile2 = await WorkforceService.createProfile({
    first_name: "Sneha",
    last_name: "Menon",
    email: `sneha.intern.${Date.now()}@lawcollege.edu`,
    phone: "+919988776622",
    workforce_type: "PAID_INTERN",
  }, ownerUser.id);

  // Link internUser2 to profile2
  await pool.query(`UPDATE workforce_profiles SET user_id = ? WHERE id = ?`, [internUser2.id, profile2.id]);

  // -------------------------------------------------------------
  // 1. Profile Isolation Tests
  // -------------------------------------------------------------
  console.log("\n[1. Profile Privacy & Boundary Tests]");

  await test("Intern can view their own profile", async () => {
    const data = await WorkforceService.getProfileById(profile1.id, internUser1);
    assert.strictEqual(data.profile.id, profile1.id);
  });

  await test("Intern CANNOT view another intern's private profile (403 Forbidden)", async () => {
    await assert.rejects(
      async () => {
        await WorkforceService.getProfileById(profile2.id, internUser1);
      },
      (err) => {
        assert.ok(err.message.includes("Access denied. You can only view your own profile"));
        return true;
      }
    );
  });

  await test("Junior Associate CANNOT view other members' profiles (403 Forbidden)", async () => {
    await assert.rejects(
      async () => {
        await WorkforceService.getProfileById(profile1.id, juniorAssociate);
      },
      (err) => {
        assert.ok(err.message.includes("Access denied. You can only view your own profile"));
        return true;
      }
    );
  });

  // -------------------------------------------------------------
  // 2. Salary & Payroll Confidentiality Tests
  // -------------------------------------------------------------
  console.log("\n[2. Salary & Payroll Confidentiality Tests]");

  await test("Intern viewing own profile does NOT receive salaryStructure", async () => {
    const data = await WorkforceService.getProfileById(profile1.id, internUser1);
    assert.strictEqual(data.salaryStructure, null);
  });

  await test("Junior Associate attempting to configure salary is rejected", async () => {
    // Only OWNER/ACCOUNTS can configure
    const [roles] = await pool.query(
      `SELECT p.name FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN roles r ON rp.role_id = r.id
       WHERE r.name = 'JUNIOR_ASSOCIATE' AND p.name = 'SALARY_MANAGE'`
    );
    assert.strictEqual(roles.length, 0);
  });

  // -------------------------------------------------------------
  // 3. Task Privacy Scoping Tests
  // -------------------------------------------------------------
  console.log("\n[3. Task Privacy Scoping Tests]");

  await test("Intern only sees tasks assigned to themselves", async () => {
    // Create task for internUser1
    const t1 = await WorkforceTaskService.createTask({
      title: "Task for Intern 1",
      assigned_to: internUser1.id,
      due_date: "2026-10-25",
    }, ownerUser.id);

    // Create task for internUser2
    const t2 = await WorkforceTaskService.createTask({
      title: "Task for Intern 2",
      assigned_to: internUser2.id,
      due_date: "2026-10-25",
    }, ownerUser.id);

    // Intern 1 queries tasks
    const intern1Tasks = await WorkforceTaskService.getTasks({}, internUser1);
    const hasOwn = intern1Tasks.tasks.some((t) => t.id === t1.id);
    const hasOther = intern1Tasks.tasks.some((t) => t.id === t2.id);

    assert.strictEqual(hasOwn, true);
    assert.strictEqual(hasOther, false);
  });

  // -------------------------------------------------------------
  // 4. Performance Review Privacy Tests
  // -------------------------------------------------------------
  console.log("\n[4. Performance Review Privacy Tests]");

  await test("Internal mentor notes flagged as not shareable are hidden from member", async () => {
    // Create non-shareable review
    await PerformanceService.createReview(profile1.id, {
      review_period: "Confidential Evaluation",
      overall_rating: 3,
      mentor_comments: "Private partner assessment regarding contract drafting speed",
      is_shareable_with_member: false,
    }, ownerUser.id);

    // Create shareable review
    await PerformanceService.createReview(profile1.id, {
      review_period: "Quarterly Summary",
      overall_rating: 4,
      mentor_comments: "Good client presence",
      is_shareable_with_member: true,
    }, ownerUser.id);

    // When internUser1 views reviews
    const internViews = await PerformanceService.getReviews(profile1.id, internUser1);
    const containsPrivate = internViews.some((r) => r.is_shareable_with_member === 0 || r.is_shareable_with_member === false);
    assert.strictEqual(containsPrivate, false);

    // When ownerUser views reviews
    const ownerViews = await PerformanceService.getReviews(profile1.id, ownerUser);
    assert.ok(ownerViews.length >= 2);
  });

  // -------------------------------------------------------------
  // 5. Client External Boundary Tests
  // -------------------------------------------------------------
  console.log("\n[5. Client External Portal Boundary Tests]");

  await test("Verify CLIENT role has ZERO permissions across any WORKFORCE category", async () => {
    const [perms] = await pool.query(
      `SELECT p.name, p.category 
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN roles r ON rp.role_id = r.id
       WHERE r.name = 'CLIENT' AND p.category IN ('WORKFORCE', 'RECRUITMENT', 'ONBOARDING', 'ATTENDANCE', 'LEAVE', 'WORKFORCE_TASKS', 'PAYROLL', 'PERFORMANCE', 'OFFBOARDING', 'ASSETS')`
    );

    assert.strictEqual(perms.length, 0);
  });

  console.log("\n==================================================================");
  console.log(`Prompt 10 Security Test Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSecurityTests().catch((err) => {
  console.error("Security test error:", err);
  process.exit(1);
});
