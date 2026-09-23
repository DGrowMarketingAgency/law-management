const assert = require("assert");
const path = require("path");
const crypto = require("crypto");
module.paths.push(path.resolve(__dirname, "../../../server/node_modules"));
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const { getTestPool, closeTestPool } = require("./testDbHelper");

async function runWebhookTests() {
  console.log("==================================================");
  console.log("SUITE 5: AiSensy / WhatsApp Webhook Processing Tests");
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
  const whatsAppService = require("../../../server/services/whatsapp/whatsappService");

  let testContactId = null;
  let testClientId = null;
  let testCaseId = null;
  let testHearingId = null;
  let testReminderId = null;
  const testProviderMsgId = `wamid.TEST_WH_${Date.now()}`;

  try {
    // 1. Setup fixture in test DB
    const [cnt] = await testPool.query(
      `INSERT INTO contacts (first_name, last_name, display_name, phone, whatsapp_number, whatsapp_opt_in)
       VALUES ('Webhook', 'User', 'Webhook User', '+918870686660', '+918870686660', 1)`
    );
    testContactId = cnt.insertId;

    const [cl] = await testPool.query(
      `INSERT INTO clients (contact_id, client_code, status) VALUES (?, ?, 'ACTIVE')`,
      [testContactId, `TC_WH_${Date.now()}`]
    );
    testClientId = cl.insertId;

    const [cs] = await testPool.query(
      `INSERT INTO cases (case_number, title, case_type, case_status, primary_client_id, court_id)
       VALUES (?, 'Webhook Test Case', 'WRIT_PETITION', 'ACTIVE', ?, 1)`,
      [`WP/WH/${Date.now()}`, testClientId]
    );
    testCaseId = cs.insertId;

    const [hr] = await testPool.query(
      `INSERT INTO case_hearings (case_id, hearing_date, hearing_time, purpose, status)
       VALUES (?, '2026-09-20', '10:30:00', 'Final Hearing', 'SCHEDULED')`,
      [testCaseId]
    );
    testHearingId = hr.insertId;

    const [rem] = await testPool.query(
      `INSERT INTO hearing_reminders (hearing_id, case_id, client_id, reminder_type, scheduled_at, status, provider_message_id)
       VALUES (?, ?, ?, 'HEARING_DAY', NOW(), 'SENT', ?)`,
      [testHearingId, testCaseId, testClientId, testProviderMsgId]
    );
    testReminderId = rem.insertId;

    // 2. Webhook Signature Security Verification
    await test("Invalid webhook signature is rejected", async () => {
      const secret = "test_webhook_secret_key_12345";
      process.env.WHATSAPP_WEBHOOK_SECRET = secret;

      const payload = JSON.stringify({ event: "test" });
      const validSig = "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
      const invalidSig = "sha256=" + crypto.createHmac("sha256", "wrong_secret").update(payload).digest("hex");

      const isValid = whatsAppService.validateWebhookSignature(payload, validSig);
      const isInvalid = whatsAppService.validateWebhookSignature(payload, invalidSig);

      assert.strictEqual(isValid, true, "Valid HMAC signature passes");
      assert.strictEqual(isInvalid, false, "Forged HMAC signature is rejected");
    });

    // 3. Status Transition: DELIVERED
    await test("DELIVERED webhook event updates hearing_reminders status and delivered_at", async () => {
      await hearingReminderService.handleWebhookStatusUpdate({
        messageId: testProviderMsgId,
        status: "DELIVERED",
        timestamp: Math.floor(Date.now() / 1000),
      });

      const [row] = await testPool.query(
        `SELECT status, delivered_at FROM hearing_reminders WHERE id = ?`,
        [testReminderId]
      );
      assert.strictEqual(row[0].status, "DELIVERED");
      assert(row[0].delivered_at !== null, "delivered_at timestamp is populated");
    });

    // 4. Status Transition: READ
    await test("READ webhook event updates hearing_reminders status and read_at", async () => {
      await hearingReminderService.handleWebhookStatusUpdate({
        messageId: testProviderMsgId,
        status: "READ",
        timestamp: Math.floor(Date.now() / 1000),
      });

      const [row] = await testPool.query(
        `SELECT status, read_at FROM hearing_reminders WHERE id = ?`,
        [testReminderId]
      );
      assert.strictEqual(row[0].status, "READ");
      assert(row[0].read_at !== null, "read_at timestamp is populated");
    });

    // 5. Status Transition: FAILED
    await test("FAILED webhook event updates hearing_reminders status, failed_at and failure_reason", async () => {
      const failMsgId = `wamid.FAIL_${Date.now()}`;
      const [failRem] = await testPool.query(
        `INSERT INTO hearing_reminders (hearing_id, case_id, client_id, reminder_type, scheduled_at, status, provider_message_id)
         VALUES (?, ?, ?, 'HEARING_1_DAY', NOW(), 'SENT', ?)`,
        [testHearingId, testCaseId, testClientId, failMsgId]
      );

      await hearingReminderService.handleWebhookStatusUpdate({
        messageId: failMsgId,
        status: "FAILED",
        timestamp: Math.floor(Date.now() / 1000),
        error: { code: 131026, message: "Message undeliverable" },
      });

      const [row] = await testPool.query(
        `SELECT status, failed_at, failure_reason FROM hearing_reminders WHERE id = ?`,
        [failRem.insertId]
      );
      assert.strictEqual(row[0].status, "FAILED");
      assert(row[0].failed_at !== null, "failed_at timestamp is populated");
      assert(row[0].failure_reason.includes("Message undeliverable"));

      await testPool.query(`DELETE FROM hearing_reminders WHERE id = ?`, [failRem.insertId]);
    });

    // 6. Duplicate Webhook Event Protection (Idempotency)
    await test("Duplicate delivery event is processed idempotently without corruption", async () => {
      const [before] = await testPool.query(
        `SELECT status, read_at FROM hearing_reminders WHERE id = ?`,
        [testReminderId]
      );

      // Send same READ event second time
      await hearingReminderService.handleWebhookStatusUpdate({
        messageId: testProviderMsgId,
        status: "READ",
        timestamp: Math.floor(Date.now() / 1000),
      });

      const [after] = await testPool.query(
        `SELECT status, read_at FROM hearing_reminders WHERE id = ?`,
        [testReminderId]
      );

      assert.strictEqual(after[0].status, "READ");
      assert.strictEqual(
        new Date(before[0].read_at).getTime(),
        new Date(after[0].read_at).getTime(),
        "read_at timestamp remains stable on duplicate webhook processing"
      );
    });

  } finally {
    if (testReminderId) await testPool.query(`DELETE FROM hearing_reminders WHERE id = ?`, [testReminderId]);
    if (testHearingId) await testPool.query(`DELETE FROM case_hearings WHERE id = ?`, [testHearingId]);
    if (testCaseId) await testPool.query(`DELETE FROM cases WHERE id = ?`, [testCaseId]);
    if (testClientId) await testPool.query(`DELETE FROM clients WHERE id = ?`, [testClientId]);
    if (testContactId) await testPool.query(`DELETE FROM contacts WHERE id = ?`, [testContactId]);

    require.cache[dbModulePath].exports = origDbExport;
    await closeTestPool();
  }

  console.log(`\nSUITE 5 RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
  return { passed, failed };
}

if (require.main === module) {
  runWebhookTests().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runWebhookTests;
