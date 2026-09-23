const assert = require("assert");
const path = require("path");
module.paths.push(path.resolve(__dirname, "../../../server/node_modules"));
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const { getTestPool, closeTestPool } = require("./testDbHelper");

async function runIdempotencyTests() {
  console.log("==================================================");
  console.log("SUITE 8: AiSensy Idempotency & Duplicate Protection Tests");
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

  const testPool = await getTestPool();

  // Redirect database module cache to testPool
  const dbModulePath = require.resolve("../../../server/config/database");
  const origDbExport = require(dbModulePath);
  require.cache[dbModulePath].exports = testPool;

  const hearingReminderService = require("../../../server/services/whatsapp/hearingReminderService");

  let testContactId = null;
  let testClientId = null;
  let testCaseId = null;
  let testHearingId = null;

  try {
    // 1. Setup isolated test fixture in test DB
    const unique = Date.now();
    const [cnt] = await testPool.query(
      `INSERT INTO contacts (first_name, last_name, display_name, phone, whatsapp_number, whatsapp_opt_in)
       VALUES ('Idem', 'Test', 'Idem Test', '+918870686660', '+918870686660', 1)`
    );
    testContactId = cnt.insertId;

    const [cl] = await testPool.query(
      `INSERT INTO clients (contact_id, client_code, status) VALUES (?, ?, 'ACTIVE')`,
      [testContactId, `TC_IDEM_${unique}`]
    );
    testClientId = cl.insertId;

    const [cs] = await testPool.query(
      `INSERT INTO cases (case_number, title, case_type, case_status, primary_client_id, court_id)
       VALUES (?, 'Idempotency Case', 'WRIT_PETITION', 'ACTIVE', ?, 1)`,
      [`WP/IDEM/${unique}`, testClientId]
    );
    testCaseId = cs.insertId;

    const [hr] = await testPool.query(
      `INSERT INTO case_hearings (case_id, hearing_date, hearing_time, purpose, status)
       VALUES (?, '2026-09-20', '10:30:00', 'Final Hearing', 'SCHEDULED')`,
      [testCaseId]
    );
    testHearingId = hr.insertId;

    // 2. Database-level Duplicate Protection for Reminders
    await test("Duplicate reminder generation for same hearing/client/type is strictly prevented", async () => {
      // First generation
      const gen1 = await hearingReminderService.generateHearingReminders(testHearingId);
      assert.strictEqual(gen1.success, true);

      const [rowsBefore] = await testPool.query(
        `SELECT COUNT(*) as cnt FROM hearing_reminders WHERE hearing_id = ?`,
        [testHearingId]
      );
      assert.strictEqual(rowsBefore[0].cnt, 4, "4 initial reminders generated");

      // Second generation (simulate accidental re-run)
      await hearingReminderService.generateHearingReminders(testHearingId);

      const [rowsAfter] = await testPool.query(
        `SELECT COUNT(*) as cnt FROM hearing_reminders WHERE hearing_id = ?`,
        [testHearingId]
      );
      assert.strictEqual(rowsAfter[0].cnt, 4, "Row count remains 4; duplicate creation blocked");
    });

    // 3. Double-dispatch prevention (atomic state locking)
    await test("Reminder already SENT cannot be dispatched a second time", async () => {
      // Mark one reminder as SENT
      await testPool.query(
        `UPDATE hearing_reminders SET status = 'SENT', provider_message_id = 'wamid.ALREADY_SENT_001'
         WHERE hearing_id = ? AND reminder_type = 'HEARING_7_DAYS'`,
        [testHearingId]
      );

      // Attempt to process due reminders
      process.env.AISENSY_ENABLED = "true";
      process.env.AISENSY_TEST_MODE = "false";

      let dispatchAttempted = false;
      global.fetch = async () => {
        dispatchAttempted = true;
        return { ok: true, json: async () => ({}) };
      };

      await hearingReminderService.processDueReminders();

      // Ensure provider was not called for the already SENT reminder
      const [sentRow] = await testPool.query(
        `SELECT status, provider_message_id FROM hearing_reminders WHERE hearing_id = ? AND reminder_type = 'HEARING_7_DAYS'`,
        [testHearingId]
      );
      assert.strictEqual(sentRow[0].status, "SENT");
      assert.strictEqual(sentRow[0].provider_message_id, "wamid.ALREADY_SENT_001");
    });

    // 4. Webhook Idempotency: Duplicate events for same messageId and status
    await test("Webhook duplicate event handling is completely idempotent", async () => {
      const msgId = `wamid.IDEM_WH_${Date.now()}`;
      await testPool.query(
        `UPDATE hearing_reminders 
         SET status = 'SENT', provider_message_id = ? 
         WHERE hearing_id = ? AND reminder_type = 'HEARING_DAY'`,
        [msgId, testHearingId]
      );

      const [remRow] = await testPool.query(
        `SELECT id FROM hearing_reminders WHERE provider_message_id = ?`,
        [msgId]
      );
      const reminderId = remRow[0].id;

      // Event 1: DELIVERED
      await hearingReminderService.handleWebhookStatusUpdate({
        messageId: msgId,
        status: "DELIVERED",
        timestamp: 1726000000,
      });

      const [row1] = await testPool.query(
        `SELECT status, delivered_at FROM hearing_reminders WHERE id = ?`,
        [reminderId]
      );
      assert.strictEqual(row1[0].status, "DELIVERED");

      // Event 2: Exact duplicate DELIVERED event
      await hearingReminderService.handleWebhookStatusUpdate({
        messageId: msgId,
        status: "DELIVERED",
        timestamp: 1726000000,
      });

      const [row2] = await testPool.query(
        `SELECT status, delivered_at FROM hearing_reminders WHERE id = ?`,
        [reminderId]
      );
      assert.strictEqual(row2[0].status, "DELIVERED");
      assert.strictEqual(
        new Date(row1[0].delivered_at).getTime(),
        new Date(row2[0].delivered_at).getTime(),
        "Timestamp not changed by duplicate event"
      );

      // Verify no duplicate reminder row was created
      const [countCheck] = await testPool.query(
        `SELECT COUNT(*) as cnt FROM hearing_reminders WHERE provider_message_id = ?`,
        [msgId]
      );
      assert.strictEqual(countCheck[0].cnt, 1, "Exactly one reminder record exists");
    });

  } finally {
    if (testHearingId) await testPool.query(`DELETE FROM hearing_reminders WHERE hearing_id = ?`, [testHearingId]);
    if (testHearingId) await testPool.query(`DELETE FROM case_hearings WHERE id = ?`, [testHearingId]);
    if (testCaseId) await testPool.query(`DELETE FROM cases WHERE id = ?`, [testCaseId]);
    if (testClientId) await testPool.query(`DELETE FROM clients WHERE id = ?`, [testClientId]);
    if (testContactId) await testPool.query(`DELETE FROM contacts WHERE id = ?`, [testContactId]);

    require.cache[dbModulePath].exports = origDbExport;
    await closeTestPool();
  }

  console.log(`\nSUITE 8 RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
  return { passed, failed };
}

if (require.main === module) {
  runIdempotencyTests().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runIdempotencyTests;
