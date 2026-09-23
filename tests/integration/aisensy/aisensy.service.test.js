const assert = require("assert");
const path = require("path");
module.paths.push(path.resolve(__dirname, "../../../server/node_modules"));
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const aisensyService = require("../../../server/services/whatsapp/aisensyService");

async function runServiceTests() {
  console.log("==================================================");
  console.log("SUITE 2: AiSensy Service & Error Normalization Tests");
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
      failed++;
    }
  }

  // Backup global fetch and env
  const origFetch = global.fetch;
  const origKey = process.env.AISENSY_API_KEY;
  const origCampaign = process.env.AISENSY_CAMPAIGN_NAME;
  const origDest = process.env.AISENSY_TEST_DESTINATION;
  const origTestMode = process.env.AISENSY_TEST_MODE;

  process.env.AISENSY_API_KEY = "test_aisensy_secret_api_key_abc123";
  process.env.AISENSY_CAMPAIGN_NAME = "hearing_reminder_test";
  process.env.AISENSY_TEST_DESTINATION = "+918870686660";
  process.env.AISENSY_TEST_MODE = "true";

  try {
    // 1. Valid Request (200 OK)
    await test("Valid 200 response normalizes to status ACCEPTED and extracts messageId", async () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          status: "ACCEPTED",
          messageId: "msg_aisensy_test_998877",
        }),
      });

      const res = await aisensyService.sendTestMessage({
        destination: "+918870686660",
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data?.status, "ACCEPTED");
      assert.strictEqual(res.data?.providerMessageId, "msg_aisensy_test_998877");
    });

    // 2. HTTP 400 Bad Request (Campaign issue)
    await test("HTTP 400 with campaign detail maps to AISENSY_CAMPAIGN_ERROR", async () => {
      global.fetch = async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          error: "Campaign template does not exist",
          details: "Template case_reminder_v1 is inactive",
        }),
      });

      const res = await aisensyService.sendTestMessage({
        destination: "+918870686660",
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "AISENSY_CAMPAIGN_ERROR");
      assert.strictEqual(res.error?.statusCode, 400);
    });

    // 3. HTTP 401 Unauthorized
    await test("HTTP 401 maps to AISENSY_UNAUTHORIZED with permanent failure flag", async () => {
      global.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          message: "Invalid API Key provided",
        }),
      });

      const res = await aisensyService.sendTestMessage({
        destination: "+918870686660",
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "AISENSY_UNAUTHORIZED");
      assert.strictEqual(res.error?.isTransient, false);
    });

    // 4. HTTP 403 Forbidden
    await test("HTTP 403 maps to AISENSY_UNAUTHORIZED", async () => {
      global.fetch = async () => ({
        ok: false,
        status: 403,
        json: async () => ({
          error: "Forbidden: Account subscription expired",
        }),
      });

      const res = await aisensyService.sendTestMessage({
        destination: "+918870686660",
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "AISENSY_UNAUTHORIZED");
    });

    // 5. HTTP 404 Not Found
    await test("HTTP 404 maps to AISENSY_CAMPAIGN_ERROR", async () => {
      global.fetch = async () => ({
        ok: false,
        status: 404,
        json: async () => ({
          error: "Resource not found",
        }),
      });

      const res = await aisensyService.sendTestMessage({
        destination: "+918870686660",
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "AISENSY_CAMPAIGN_ERROR");
    });

    // 6. HTTP 429 Rate Limited
    await test("HTTP 429 maps to AISENSY_RATE_LIMITED with transient retry flag", async () => {
      let callCount = 0;
      global.fetch = async () => {
        callCount++;
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: "Rate limit exceeded" }),
        };
      };

      const res = await aisensyService.sendTestMessage({
        destination: "+918870686660",
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "AISENSY_RATE_LIMITED");
      assert.strictEqual(res.error?.isTransient, true);
      // Retried transient error
      assert(callCount > 1, "Transient 429 error was retried");
    });

    // 7. HTTP 500 / 502 / 503 Provider Server Errors
    await test("HTTP 500/502/503 map to AISENSY_PROVIDER_ERROR", async () => {
      const err500 = aisensyService.normalizeProviderError(null, 500, { message: "Internal server crash" });
      assert.strictEqual(err500.code, "AISENSY_PROVIDER_ERROR");
      assert.strictEqual(err500.isTransient, true);

      const err502 = aisensyService.normalizeProviderError(null, 502, { message: "Bad Gateway" });
      assert.strictEqual(err502.code, "AISENSY_PROVIDER_ERROR");

      const err503 = aisensyService.normalizeProviderError(null, 503, { message: "Service Unavailable" });
      assert.strictEqual(err503.code, "AISENSY_PROVIDER_ERROR");
    });

    // 8. Secret Redaction Test
    await test("normalizeProviderError strictly redacts API key if provider echoes it", async () => {
      const sensitiveMsg = `Provider error: Request failed for apiKey=${process.env.AISENSY_API_KEY} at server`;
      const normalized = aisensyService.normalizeProviderError(null, 400, { details: sensitiveMsg });

      assert(!normalized.details.includes("test_aisensy_secret_api_key_abc123"), "API key must be redacted");
      assert(normalized.details.includes("[REDACTED]"), "API key replaced with [REDACTED]");
    });

  } finally {
    // Restore global fetch & env
    global.fetch = origFetch;
    if (origKey) process.env.AISENSY_API_KEY = origKey; else delete process.env.AISENSY_API_KEY;
    if (origCampaign) process.env.AISENSY_CAMPAIGN_NAME = origCampaign; else delete process.env.AISENSY_CAMPAIGN_NAME;
    if (origDest) process.env.AISENSY_TEST_DESTINATION = origDest; else delete process.env.AISENSY_TEST_DESTINATION;
    if (origTestMode) process.env.AISENSY_TEST_MODE = origTestMode; else delete process.env.AISENSY_TEST_MODE;
  }

  console.log(`\nSUITE 2 RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
  return { passed, failed };
}

if (require.main === module) {
  runServiceTests().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runServiceTests;
