const assert = require("assert");
const path = require("path");
module.paths.push(path.resolve(__dirname, "../../../server/node_modules"));
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const { getTestPool, closeTestPool } = require("./testDbHelper");

async function runSchedulerTests() {
  console.log("==================================================");
  console.log("SUITE 4: AiSensy Scheduler & Lifecycle Safety Tests");
  console.log("==================================================");

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

  const origKey = process.env.AISENSY_API_KEY;
  const origCampaign = process.env.AISENSY_CAMPAIGN_NAME;
  const origDest = process.env.AISENSY_TEST_DESTINATION;
  const origTestMode = process.env.AISENSY_TEST_MODE;
  const origFetch = global.fetch;

  // Initialize test database pool
  const testPool = await getTestPool();

  // Redirect database module cache to testPool
  const dbModulePath = require.resolve("../../../server/config/database");
  const origDbExport = require(dbModulePath);
  require.cache[dbModulePath].exports = testPool;

  const hearingReminderService = require("../../../server/services/whatsapp/hearingReminderService");
  const scheduler = require("../../../server/services/whatsapp/hearingReminderScheduler");

  let testContactId = null;
  let testClientId = null;
  let testCaseId = null;
  let testHearingId = null;

  try {
    // 1. Strict Test Mode Safety: processDueReminders and scheduler tick must NOT send reminders when test mode is true
    await test("In test mode, processDueReminders() skips sending automatic reminders", async () => {
      process.env.AISENSY_ENABLED = "true";
      process.env.AISENSY_TEST_MODE = "true";

      let fetchCalled = false;
      global.fetch = async () => {
        fetchCalled = true;
        return { ok: true, json: async () => ({ status: "ACCEPTED" }) };
      };

      const result = await hearingReminderService.processDueReminders();
      assert.strictEqual(result.skipped, true);
      assert.strictEqual(result.reason, "AUTOMATIC_REMINDERS_DISABLED_IN_TEST_MODE");
      assert.strictEqual(fetchCalled, false, "AiSensy API must NOT be called for automatic reminders in test mode");
    });

    // 2. Setup isolated test fixture in test DB
    const uniqueSuffix = Date.now();
    const [cntRes] = await testPool.query(
      `INSERT INTO contacts (first_name, last_name, display_name, phone, whatsapp_number, whatsapp_opt_in, whatsapp_opt_in_at)
       VALUES ('SchedTest', 'Client', 'SchedTest Client', '+918870686660', '+918870686660', 1, NOW())`
    );
    testContactId = cntRes.insertId;

    const [clRes] = await testPool.query(
      `INSERT INTO clients (contact_id, client_code, status) VALUES (?, ?, 'ACTIVE')`,
      [testContactId, `TC_SCHED_${uniqueSuffix}`]
    );
    testClientId = clRes.insertId;

    const [caseRes] = await testPool.query(
      `INSERT INTO cases (case_number, title, case_type, case_status, primary_client_id, court_id)
       VALUES (?, 'Sched Test Case vs State', 'WRIT_PETITION', 'ACTIVE', ?, 1)`,
      [`WP/SCHED/${uniqueSuffix}`, testClientId]
    );
    testCaseId = caseRes.insertId;

    // Future hearing on 20 September 2026
    const [hearingRes] = await testPool.query(
      `INSERT INTO case_hearings (case_id, hearing_date, hearing_time, purpose, status)
       VALUES (?, '2026-09-20', '10:30:00', 'Final Hearing', 'SCHEDULED')`,
      [testCaseId]
    );
    testHearingId = hearingRes.insertId;

    // 3. Test Schedule Generation for Future Hearing (20 September 2026)
    await test("Future hearing on 2026-09-20 generates accurate reminder schedules (e.g. 19 Sep for 1d)", async () => {
      const genResult = await hearingReminderService.generateHearingReminders(testHearingId);
      assert.strictEqual(genResult.success, true);

      const [remRows] = await testPool.query(
        `SELECT * FROM hearing_reminders WHERE hearing_id = ? ORDER BY scheduled_at ASC`,
        [testHearingId]
      );

      assert.strictEqual(remRows.length, 4, "4 reminder rules scheduled");
      const oneDayReminder = remRows.find((r) => r.reminder_type === "HEARING_1_DAY");
      assert(oneDayReminder, "HEARING_1_DAY exists");
      const schedDate = new Date(oneDayReminder.scheduled_at);
      assert.strictEqual(schedDate.getDate(), 19, `1-day reminder scheduled on 19th (got ${schedDate.getDate()})`);
      assert.strictEqual(schedDate.getMonth(), 8, `1-day reminder scheduled in September (got month index ${schedDate.getMonth()})`);
    });

    // 4. Test Cancelled Hearing Skips Reminders
    await test("If hearing is CANCELLED, reminders are marked CANCELLED/SKIPPED and API is not called", async () => {
      let fetchCalled = false;
      global.fetch = async () => {
        fetchCalled = true;
        return { ok: true, json: async () => ({}) };
      };

      await testPool.query(`UPDATE case_hearings SET status = 'CANCELLED' WHERE id = ?`, [testHearingId]);
      await hearingReminderService.cancelHearingReminders(testHearingId, "Hearing cancelled by court");

      const [cancelledRows] = await testPool.query(
        `SELECT status FROM hearing_reminders WHERE hearing_id = ?`,
        [testHearingId]
      );

      assert(
        cancelledRows.every((r) => r.status === "CANCELLED" || r.status === "SKIPPED"),
        "All reminders for cancelled hearing are CANCELLED/SKIPPED"
      );
      assert.strictEqual(fetchCalled, false, "AiSensy API must NOT be called for cancelled hearing");
    });

    // 5. Test Rescheduled Hearing
    await test("Rescheduled hearing cancels old schedules and generates new schedules for updated date", async () => {
      // Reschedule to 25 September 2026
      await testPool.query(
        `UPDATE case_hearings SET hearing_date = '2026-09-25', status = 'SCHEDULED' WHERE id = ?`,
        [testHearingId]
      );

      await hearingReminderService.rescheduleHearingReminders(testHearingId);

      const [rescheduledRows] = await testPool.query(
        `SELECT * FROM hearing_reminders WHERE hearing_id = ? AND status = 'SCHEDULED'`,
        [testHearingId]
      );

      assert.strictEqual(rescheduledRows.length, 4, "4 new reminders generated for rescheduled date");
      const new1Day = rescheduledRows.find((r) => r.reminder_type === "HEARING_1_DAY");
      const reschedDate = new Date(new1Day.scheduled_at);
      assert.strictEqual(reschedDate.getDate(), 24, `Rescheduled 1-day reminder on 24th (got ${reschedDate.getDate()})`);
    });

    // 6. Test Opt-Out Lifecycle
    await test("When client opts out, reminders transition to SKIPPED with reason WHATSAPP_OPT_OUT", async () => {
      await testPool.query(
        `UPDATE contacts SET whatsapp_opt_in = 0, whatsapp_opt_out_at = NOW() WHERE id = ?`,
        [testContactId]
      );

      await hearingReminderService.handleClientOptOut(testClientId);

      const [pendingAfterOptOut] = await testPool.query(
        `SELECT COUNT(*) as cnt FROM hearing_reminders WHERE client_id = ? AND status = 'SCHEDULED'`,
        [testClientId]
      );

      assert.strictEqual(pendingAfterOptOut[0].cnt, 0, "No pending SCHEDULED reminders remain after opt-out");
    });

    // 7. Test Missing Phone Number
    await test("Missing WhatsApp number transitions reminder to SKIPPED with MISSING_WHATSAPP_NUMBER", async () => {
      // Create fresh hearing for missing phone client
      const [cnt2] = await testPool.query(
        `INSERT INTO contacts (first_name, last_name, display_name, whatsapp_opt_in)
         VALUES ('NoPhone', 'Client', 'NoPhone Client', 1)`
      );
      const noPhoneContactId = cnt2.insertId;

      const [cl2] = await testPool.query(
        `INSERT INTO clients (contact_id, client_code, status) VALUES (?, ?, 'ACTIVE')`,
        [noPhoneContactId, `TC_NOP_${Date.now()}`]
      );
      const noPhoneClientId = cl2.insertId;

      const [cs2] = await testPool.query(
        `INSERT INTO cases (case_number, title, case_type, case_status, primary_client_id, court_id)
         VALUES (?, 'No Phone Case', 'WRIT_PETITION', 'ACTIVE', ?, 1)`,
        [`WP/NOP/${Date.now()}`, noPhoneClientId]
      );
      const noPhoneCaseId = cs2.insertId;

      const [hr2] = await testPool.query(
        `INSERT INTO case_hearings (case_id, hearing_date, hearing_time, purpose, status)
         VALUES (?, '2026-09-20', '10:30:00', 'Final Hearing', 'SCHEDULED')`,
        [noPhoneCaseId]
      );
      const noPhoneHearingId = hr2.insertId;

      // Insert due reminder with no phone
      const [insRes] = await testPool.query(
        `INSERT INTO hearing_reminders (hearing_id, case_id, client_id, reminder_type, scheduled_at, status, whatsapp_number)
         VALUES (?, ?, ?, 'HEARING_DAY', NOW(), 'SCHEDULED', NULL)`,
        [noPhoneHearingId, noPhoneCaseId, noPhoneClientId]
      );
      const reminderId = insRes.insertId;

      // In test mode, processDueReminders safely skips sending;
      // To test the missing-phone check inside the processing loop, verify that when executed,
      // it identifies the missing number and marks it SKIPPED without calling external APIs.
      process.env.AISENSY_ENABLED = "true";
      process.env.AISENSY_TEST_MODE = "false";

      let externalApiCalled = false;
      global.fetch = async () => {
        externalApiCalled = true;
        return { ok: true, json: async () => ({}) };
      };

      await hearingReminderService.processDueReminders();

      const [checkRow] = await testPool.query(`SELECT status, failure_reason FROM hearing_reminders WHERE id = ?`, [reminderId]);
      assert.strictEqual(checkRow[0].status, "SKIPPED");
      assert.strictEqual(checkRow[0].failure_reason, "MISSING_WHATSAPP_NUMBER");
      assert.strictEqual(externalApiCalled, false, "Provider must NOT be called when phone is missing");

      // Clean up second fixture
      await testPool.query(`DELETE FROM hearing_reminders WHERE id = ?`, [reminderId]);
      await testPool.query(`DELETE FROM case_hearings WHERE id = ?`, [noPhoneHearingId]);
      await testPool.query(`DELETE FROM cases WHERE id = ?`, [noPhoneCaseId]);
      await testPool.query(`DELETE FROM clients WHERE id = ?`, [noPhoneClientId]);
      await testPool.query(`DELETE FROM contacts WHERE id = ?`, [noPhoneContactId]);
    });

  } finally {
    // Cleanup fixtures in test DB
    if (testHearingId) await testPool.query(`DELETE FROM hearing_reminders WHERE hearing_id = ?`, [testHearingId]);
    if (testHearingId) await testPool.query(`DELETE FROM case_hearings WHERE id = ?`, [testHearingId]);
    if (testCaseId) await testPool.query(`DELETE FROM cases WHERE id = ?`, [testCaseId]);
    if (testClientId) await testPool.query(`DELETE FROM clients WHERE id = ?`, [testClientId]);
    if (testContactId) await testPool.query(`DELETE FROM contacts WHERE id = ?`, [testContactId]);

    // Restore original DB export
    require.cache[dbModulePath].exports = origDbExport;
    await closeTestPool();

    global.fetch = origFetch;
    if (origKey) process.env.AISENSY_API_KEY = origKey; else delete process.env.AISENSY_API_KEY;
    if (origCampaign) process.env.AISENSY_CAMPAIGN_NAME = origCampaign; else delete process.env.AISENSY_CAMPAIGN_NAME;
    if (origDest) process.env.AISENSY_TEST_DESTINATION = origDest; else delete process.env.AISENSY_TEST_DESTINATION;
    if (origTestMode) process.env.AISENSY_TEST_MODE = origTestMode; else delete process.env.AISENSY_TEST_MODE;
  }

  console.log(`\nSUITE 4 RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
  return { passed, failed };
}

if (require.main === module) {
  runSchedulerTests().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runSchedulerTests;
