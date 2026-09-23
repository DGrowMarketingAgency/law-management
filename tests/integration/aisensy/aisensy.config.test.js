const assert = require("assert");
const path = require("path");
module.paths.push(path.resolve(__dirname, "../../../server/node_modules"));
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const aisensyService = require("../../../server/services/whatsapp/aisensyService");
const { maskPhoneNumber } = require("../../../server/utils/phoneUtils");

async function runConfigTests() {
  console.log("==================================================");
  console.log("SUITE 1: AiSensy Configuration & Validation Tests");
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

  // Preserve original env
  const origKey = process.env.AISENSY_API_KEY;
  const origCampaign = process.env.AISENSY_CAMPAIGN_NAME;
  const origDest = process.env.AISENSY_TEST_DESTINATION;
  const origTestMode = process.env.AISENSY_TEST_MODE;

  try {
    // 1. Missing API Key Test
    await test("Missing API key returns AISENSY_NOT_CONFIGURED", async () => {
      delete process.env.AISENSY_API_KEY;
      const res = await aisensyService.sendTestMessage({ destination: "+919876543210" });
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "AISENSY_NOT_CONFIGURED");
    });

    // 2. Missing Campaign Name Test
    await test("Missing campaign returns AISENSY_CAMPAIGN_NOT_CONFIGURED", async () => {
      process.env.AISENSY_API_KEY = "test_valid_key_123";
      delete process.env.AISENSY_CAMPAIGN_NAME;
      const res = await aisensyService.sendTestMessage({ destination: "+919876543210" });
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "AISENSY_CAMPAIGN_NOT_CONFIGURED");
    });

    // 3. Missing Destination in Test Mode Test
    await test("Missing test destination in test mode returns AISENSY_TEST_DESTINATION_NOT_CONFIGURED", async () => {
      process.env.AISENSY_API_KEY = "test_valid_key_123";
      process.env.AISENSY_CAMPAIGN_NAME = "test_campaign";
      process.env.AISENSY_TEST_MODE = "true";
      delete process.env.AISENSY_TEST_DESTINATION;
      const res = await aisensyService.sendTestMessage({ destination: "+919876543210" });
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "AISENSY_TEST_DESTINATION_NOT_CONFIGURED");
    });

    // 4. Invalid Phone Number Format Test
    await test("Invalid destination returns INVALID_PHONE_NUMBER", async () => {
      process.env.AISENSY_API_KEY = "test_valid_key_123";
      process.env.AISENSY_CAMPAIGN_NAME = "test_campaign";
      process.env.AISENSY_TEST_DESTINATION = "+919876543210";
      const res = await aisensyService.sendTestMessage({ destination: "not-a-phone-number" });
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "INVALID_PHONE_NUMBER");
    });

    // 5. Check Configuration Status Method
    await test("checkConfiguration() accurately checks readiness without throwing", async () => {
      delete process.env.AISENSY_API_KEY;
      const check1 = aisensyService.checkConfiguration();
      assert.strictEqual(check1.ready, false);
      assert.strictEqual(check1.code, "AISENSY_NOT_CONFIGURED");

      process.env.AISENSY_API_KEY = "test_valid_key";
      delete process.env.AISENSY_CAMPAIGN_NAME;
      const check2 = aisensyService.checkConfiguration();
      assert.strictEqual(check2.ready, false);
      assert.strictEqual(check2.code, "AISENSY_CAMPAIGN_NOT_CONFIGURED");

      process.env.AISENSY_CAMPAIGN_NAME = "hearing_reminder_test";
      const check3 = aisensyService.checkConfiguration();
      assert.strictEqual(check3.ready, true);
    });

    // 6. Phone Number Masking Privacy Protection
    await test("Phone number privacy masking correctly hides middle digits", async () => {
      const masked = maskPhoneNumber("+918870686660");
      assert.strictEqual(masked, "+91******6660");
      assert(!masked.includes("887068"), "Sensitive middle digits are masked");
    });

    // 7. validateConfig() Safe Exposure Check
    await test("validateConfig() never exposes API key string", async () => {
      process.env.AISENSY_API_KEY = "super_secret_ai_sensy_api_key_12345";
      const config = aisensyService.validateConfig();
      assert.strictEqual(config.apiKeyConfigured, true);
      assert.strictEqual(config.apiKey, undefined);
      assert(!JSON.stringify(config).includes("super_secret_ai_sensy_api_key_12345"));
    });

  } finally {
    // Restore original env
    if (origKey) process.env.AISENSY_API_KEY = origKey; else delete process.env.AISENSY_API_KEY;
    if (origCampaign) process.env.AISENSY_CAMPAIGN_NAME = origCampaign; else delete process.env.AISENSY_CAMPAIGN_NAME;
    if (origDest) process.env.AISENSY_TEST_DESTINATION = origDest; else delete process.env.AISENSY_TEST_DESTINATION;
    if (origTestMode) process.env.AISENSY_TEST_MODE = origTestMode; else delete process.env.AISENSY_TEST_MODE;
  }

  console.log(`\nSUITE 1 RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
  return { passed, failed };
}

if (require.main === module) {
  runConfigTests().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runConfigTests;
