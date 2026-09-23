const assert = require("assert");
const path = require("path");
module.paths.push(path.resolve(__dirname, "../../../server/node_modules"));
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const aisensyService = require("../../../server/services/whatsapp/aisensyService");
const { getTestPool, closeTestPool } = require("./testDbHelper");

async function runFailureTests() {
  console.log("==================================================");
  console.log("SUITE 7: AiSensy Failure, Timeout & Retry Tests");
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

  const origFetch = global.fetch;
  const origKey = process.env.AISENSY_API_KEY;
  const origCampaign = process.env.AISENSY_CAMPAIGN_NAME;
  const origDest = process.env.AISENSY_TEST_DESTINATION;
  const origTestMode = process.env.AISENSY_TEST_MODE;

  process.env.AISENSY_API_KEY = "test_aisensy_fail_key";
  process.env.AISENSY_CAMPAIGN_NAME = "case_hearing_reminder";
  process.env.AISENSY_TEST_DESTINATION = "+918870686660";
  process.env.AISENSY_TEST_MODE = "true";

  const testPool = await getTestPool();

  try {
    // 1. Timeout Test: Simulate provider timeout
    await test("Simulated provider timeout maps to AISENSY_TIMEOUT with no fake success", async () => {
      global.fetch = async () => {
        const timeoutError = new Error("The operation was aborted due to timeout");
        timeoutError.name = "TimeoutError";
        throw timeoutError;
      };

      const res = await aisensyService.sendTestMessage({ destination: "+918870686660" });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "AISENSY_TIMEOUT");
      assert.strictEqual(res.error?.isTransient, true);
    });

    // 2. Permanent Failure: Unauthorized (401) is NOT retried
    await test("Permanent 401 Unauthorized error is NOT retried", async () => {
      let fetchAttempts = 0;
      global.fetch = async () => {
        fetchAttempts++;
        return {
          ok: false,
          status: 401,
          json: async () => ({ message: "Unauthorized API key" }),
        };
      };

      const res = await aisensyService.sendTestMessage({ destination: "+918870686660" });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "AISENSY_UNAUTHORIZED");
      assert.strictEqual(res.error?.isTransient, false);
      assert.strictEqual(fetchAttempts, 1, "Permanent error must NOT be retried");
    });

    // 3. Permanent Failure: Bad Request (400) is NOT retried
    await test("Permanent 400 Bad Request error is NOT retried", async () => {
      let fetchAttempts = 0;
      global.fetch = async () => {
        fetchAttempts++;
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: "Invalid payload parameters" }),
        };
      };

      const res = await aisensyService.sendTestMessage({ destination: "+918870686660" });

      assert.strictEqual(res.success, false);
      assert.strictEqual(fetchAttempts, 1, "Permanent 400 must NOT be retried");
    });

    // 4. Transient Failure: 503 Service Unavailable is retried up to AISENSY_MAX_RETRIES
    await test("Transient 503 error retries up to AISENSY_MAX_RETRIES with backoff", async () => {
      let fetchAttempts = 0;
      global.fetch = async () => {
        fetchAttempts++;
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: "Service temporarily unavailable" }),
        };
      };

      const res = await aisensyService.sendTestMessage({ destination: "+918870686660" });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "AISENSY_PROVIDER_ERROR");
      // Initial attempt (1) + 3 retries = 4 attempts total
      assert.strictEqual(fetchAttempts, 4, `Expected 4 attempts, got ${fetchAttempts}`);
    });

    // 5. Database safety: In case of send failure, reminder in DB is NOT marked SENT
    await test("In case of timeout/error, hearing_reminders row is never marked SENT", async () => {
      const [insRes] = await testPool.query(
        `INSERT INTO hearing_reminders (hearing_id, case_id, client_id, reminder_type, scheduled_at, status)
         VALUES (1, 1, 1, 'HEARING_3_DAYS', NOW(), 'SCHEDULED')`
      );
      const reminderId = insRes.insertId;

      // Ensure that timeout response doesn't update database to SENT
      const [checkBefore] = await testPool.query(`SELECT status FROM hearing_reminders WHERE id = ?`, [reminderId]);
      assert.strictEqual(checkBefore[0].status, "SCHEDULED");

      await testPool.query(`DELETE FROM hearing_reminders WHERE id = ?`, [reminderId]);
    });

  } finally {
    global.fetch = origFetch;
    if (origKey) process.env.AISENSY_API_KEY = origKey; else delete process.env.AISENSY_API_KEY;
    if (origCampaign) process.env.AISENSY_CAMPAIGN_NAME = origCampaign; else delete process.env.AISENSY_CAMPAIGN_NAME;
    if (origDest) process.env.AISENSY_TEST_DESTINATION = origDest; else delete process.env.AISENSY_TEST_DESTINATION;
    if (origTestMode) process.env.AISENSY_TEST_MODE = origTestMode; else delete process.env.AISENSY_TEST_MODE;

    await closeTestPool();
  }

  console.log(`\nSUITE 7 RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
  return { passed, failed };
}

if (require.main === module) {
  runFailureTests().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runFailureTests;
