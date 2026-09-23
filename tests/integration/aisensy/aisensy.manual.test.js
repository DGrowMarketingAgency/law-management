const assert = require("assert");
const path = require("path");
module.paths.push(path.resolve(__dirname, "../../../server/node_modules"));
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const aisensyService = require("../../../server/services/whatsapp/aisensyService");
const whatsappController = require("../../../server/controllers/whatsappController");

async function runManualEndpointTests() {
  console.log("==================================================");
  console.log("SUITE 3: Manual Real API Test Endpoint & Safety Tests");
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

  const origKey = process.env.AISENSY_API_KEY;
  const origCampaign = process.env.AISENSY_CAMPAIGN_NAME;
  const origDest = process.env.AISENSY_TEST_DESTINATION;
  const origTestMode = process.env.AISENSY_TEST_MODE;
  const origFetch = global.fetch;

  process.env.AISENSY_API_KEY = "test_aisensy_valid_key";
  process.env.AISENSY_CAMPAIGN_NAME = "case_hearing_reminder";
  process.env.AISENSY_TEST_DESTINATION = "+918870686660";
  process.env.AISENSY_TEST_MODE = "true";

  try {
    // 1. Rejection of arbitrary phone number in test mode
    await test("In test mode, arbitrary client number is strictly rejected", async () => {
      const arbitraryNumber = "+919999888877";
      const res = await aisensyService.sendTestMessage({
        destination: arbitraryNumber,
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, "DESTINATION_RESTRICTED_IN_TEST_MODE");
    });

    // 2. Acceptance of configured test destination in test mode
    await test("In test mode, configured AISENSY_TEST_DESTINATION is accepted", async () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          messageId: "msg_aisensy_test_authorized_001",
          status: "ACCEPTED",
        }),
      });

      const res = await aisensyService.sendTestMessage({
        destination: "+918870686660",
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data?.status, "ACCEPTED");
      assert.strictEqual(res.data?.providerMessageId, "msg_aisensy_test_authorized_001");
    });

    // 3. Controller test: Mock Express Req/Res with arbitrary destination
    await test("whatsappController rejects arbitrary destination with HTTP 422", async () => {
      let responseStatus = null;
      let responseBody = null;

      const req = {
        user: { id: 999 },
        ip: "127.0.0.1",
        body: { destination: "+919123456789" }, // Arbitrary number
      };
      const res = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (data) => {
              responseBody = data;
            },
          };
        },
      };

      await whatsappController.testAiSensyConnection(req, res, () => {});

      assert.strictEqual(responseStatus, 422);
      assert.strictEqual(responseBody?.success, false);
      assert.strictEqual(responseBody?.error?.code, "DESTINATION_RESTRICTED_IN_TEST_MODE");
    });

    // 4. Rate Limiting Protection (Max 5 requests per hour)
    await test("Rate limit triggers HTTP 429 when max test messages exceeded", async () => {
      const testUserId = 8888;
      const req = {
        user: { id: testUserId },
        ip: "127.0.0.1",
        body: { destination: "+918870686660" },
      };

      let lastStatus = 200;
      let lastBody = {};

      const createRes = () => ({
        status: (code) => {
          lastStatus = code;
          return {
            json: (data) => {
              lastBody = data;
            },
          };
        },
      });

      // Send 5 permitted requests
      for (let i = 0; i < 5; i++) {
        await whatsappController.testAiSensyConnection(req, createRes(), () => {});
      }

      // 6th request must be rejected with 429
      await whatsappController.testAiSensyConnection(req, createRes(), () => {});

      assert.strictEqual(lastStatus, 429);
      assert.strictEqual(lastBody?.error?.code, "AISENSY_RATE_LIMITED");
    });

  } finally {
    global.fetch = origFetch;
    if (origKey) process.env.AISENSY_API_KEY = origKey; else delete process.env.AISENSY_API_KEY;
    if (origCampaign) process.env.AISENSY_CAMPAIGN_NAME = origCampaign; else delete process.env.AISENSY_CAMPAIGN_NAME;
    if (origDest) process.env.AISENSY_TEST_DESTINATION = origDest; else delete process.env.AISENSY_TEST_DESTINATION;
    if (origTestMode) process.env.AISENSY_TEST_MODE = origTestMode; else delete process.env.AISENSY_TEST_MODE;
  }

  console.log(`\nSUITE 3 RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
  return { passed, failed };
}

if (require.main === module) {
  runManualEndpointTests().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runManualEndpointTests;
