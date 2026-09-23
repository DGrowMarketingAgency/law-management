const assert = require("assert");
const path = require("path");
module.paths.push(path.resolve(__dirname, "../../../server/node_modules"));
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const aisensyService = require("../../../server/services/whatsapp/aisensyService");
const whatsappController = require("../../../server/controllers/whatsappController");
const { maskPhoneNumber } = require("../../../server/utils/phoneUtils");
const { requirePermission } = require("../../../server/middleware/rbacMiddleware");

async function runSecurityTests() {
  console.log("==================================================");
  console.log("SUITE 6: AiSensy Security, Privacy & RBAC Tests");
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

  const testSecretKey = "ultra_confidential_aisensy_jwt_key_998877";
  process.env.AISENSY_API_KEY = testSecretKey;
  process.env.AISENSY_CAMPAIGN_NAME = "case_hearing_reminder";
  process.env.AISENSY_TEST_DESTINATION = "+918870686660";
  process.env.AISENSY_TEST_MODE = "true";

  try {
    // 1. API key never appears in validateConfig response
    await test("API key string never appears in validateConfig() or getStatus()", async () => {
      const config = aisensyService.validateConfig();
      const stringified = JSON.stringify(config);
      assert(!stringified.includes(testSecretKey), "validateConfig() must not contain raw API key");

      let responseBody = null;
      const req = {};
      const res = {
        status: () => ({
          json: (data) => {
            responseBody = data;
          },
        }),
      };
      await whatsappController.getStatus(req, res, () => {});
      const statusStr = JSON.stringify(responseBody);
      assert(!statusStr.includes(testSecretKey), "getStatus controller response must not contain raw API key");
    });

    // 2. API key never appears in error responses
    await test("API key string never appears in normalized error responses", async () => {
      global.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          error: `Unauthorized request with key ${testSecretKey}`,
        }),
      });

      const res = await aisensyService.sendTestMessage({ destination: "+918870686660" });
      assert.strictEqual(res.success, false);
      const resStr = JSON.stringify(res);
      assert(!resStr.includes(testSecretKey), "Error response must redact raw API key");
      assert(resStr.includes("[REDACTED]"), "Raw API key replaced with [REDACTED]");
    });

    // 3. Test destination gating enforces configured safe number in test mode
    await test("Test mode strictly enforces configured test destination and rejects unapproved numbers", async () => {
      const unapprovedNumbers = [
        "+919876543210",
        "+919999999999",
        "+14155552671",
        "+918870686661", // 1 digit off
      ];

      for (const num of unapprovedNumbers) {
        const res = await aisensyService.sendTestMessage({ destination: num });
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.error?.code, "DESTINATION_RESTRICTED_IN_TEST_MODE");
      }
    });

    // 4. RBAC Permission Checks
    await test("RBAC middleware rejects users lacking WHATSAPP_SETTINGS_UPDATE with HTTP 403", async () => {
      const middleware = requirePermission("WHATSAPP_SETTINGS_UPDATE");
      let nextCalled = false;
      let statusCode = null;
      let errorResponse = null;

      const req = {
        user: {
          id: 10,
          role: "JUNIOR_ASSOCIATE",
          permissions: ["CASES_VIEW", "DOCUMENTS_VIEW"], // Missing WHATSAPP_SETTINGS_UPDATE
        },
      };

      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              errorResponse = data;
            },
          };
        },
      };

      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false, "Unauthorized user must NOT proceed to route handler");
      assert.strictEqual(statusCode, 403);
      assert(
        errorResponse?.error?.code === "FORBIDDEN" || errorResponse?.error?.code === "PERMISSION_DENIED",
        `Expected FORBIDDEN, got ${errorResponse?.error?.code}`
      );
    });

    // 5. Authorized Owner / Admin Allowed by RBAC
    await test("RBAC middleware allows Owner/Admin with WHATSAPP_SETTINGS_UPDATE permission", async () => {
      const middleware = requirePermission("WHATSAPP_SETTINGS_UPDATE");
      let nextCalled = false;

      const req = {
        user: {
          id: 1,
          role: "OWNER",
          permissions: ["WHATSAPP_SETTINGS_UPDATE", "WHATSAPP_SETTINGS_VIEW"],
        },
      };

      const res = {
        status: () => ({ json: () => {} }),
      };

      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true, "Authorized user proceeds to next middleware");
    });

    // 6. Phone Privacy Masking
    await test("Phone numbers are masked to protect client privacy in UI and logs", async () => {
      const testPhones = [
        { raw: "+918870686660", expected: "+91******6660" },
        { raw: "+919876543210", expected: "+91******3210" },
      ];

      for (const { raw, expected } of testPhones) {
        const masked = maskPhoneNumber(raw);
        assert.strictEqual(masked, expected);
      }
    });

  } finally {
    global.fetch = origFetch;
    if (origKey) process.env.AISENSY_API_KEY = origKey; else delete process.env.AISENSY_API_KEY;
    if (origCampaign) process.env.AISENSY_CAMPAIGN_NAME = origCampaign; else delete process.env.AISENSY_CAMPAIGN_NAME;
    if (origDest) process.env.AISENSY_TEST_DESTINATION = origDest; else delete process.env.AISENSY_TEST_DESTINATION;
    if (origTestMode) process.env.AISENSY_TEST_MODE = origTestMode; else delete process.env.AISENSY_TEST_MODE;
  }

  console.log(`\nSUITE 6 RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
  return { passed, failed };
}

if (require.main === module) {
  runSecurityTests().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = runSecurityTests;
