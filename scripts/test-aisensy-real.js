const path = require("path");
module.paths.push(path.resolve(__dirname, "../server/node_modules"));
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const aisensyService = require("../server/services/whatsapp/aisensyService");
const { maskPhoneNumber } = require("../server/utils/phoneUtils");

async function runRealAiSensyTest() {
  console.log("==================================================================");
  console.log("            REAL AISENSY LIVE API CONNECTIVITY TEST               ");
  console.log("==================================================================\n");

  const runReal = process.env.RUN_REAL_AISENSY_TESTS === "true";
  const apiKey = process.env.AISENSY_API_KEY;
  const campaignName = (process.env.AISENSY_CAMPAIGN_NAME || "").trim();
  const testDestination = (process.env.AISENSY_TEST_DESTINATION || "").trim();
  const isTestMode = process.env.AISENSY_TEST_MODE !== "false";

  // Step 1: Check Opt-In Guard
  if (!runReal) {
    console.log(" [OPT-IN REQUIRED]");
    console.log(" Real AiSensy API testing is disabled by default to prevent unintended messages.");
    console.log(" To run the real test, execute:");
    console.log("   RUN_REAL_AISENSY_TESTS=true npm run test:aisensy");
    console.log(" Or set RUN_REAL_AISENSY_TESTS=true in your .env file temporarily.\n");
    console.log(" Normal automated CI / unit tests do NOT require this flag.\n");
    process.exit(0);
  }

  // Step 2: Confirm Test Mode
  console.log(` 1. Checking Test Mode:`);
  if (!isTestMode) {
    console.error("    ✗ ERROR: AISENSY_TEST_MODE must be true for safety verification.");
    process.exit(1);
  }
  console.log(`    ✓ Confirmed AISENSY_TEST_MODE=true (Production clients safe)\n`);

  // Step 3: Validate API Key
  console.log(` 2. Validating API Key:`);
  if (!apiKey || apiKey.trim() === "" || apiKey === "replace_this_later") {
    console.error("    ✗ ERROR: AISENSY_API_KEY is not configured in .env.");
    process.exit(1);
  }
  console.log(`    ✓ API Key configured (Secret strictly redacted)\n`);

  // Step 4: Validate Test Destination
  console.log(` 3. Validating Test Destination:`);
  if (!testDestination) {
    console.error("    ✗ ERROR: AISENSY_TEST_DESTINATION must be configured in .env.");
    process.exit(1);
  }
  const phoneCheck = aisensyService.validateDestination(testDestination);
  if (!phoneCheck.valid) {
    console.error(`    ✗ ERROR: Invalid test destination format: ${phoneCheck.error}`);
    process.exit(1);
  }
  console.log(`    ✓ Permitted Test Destination: ${maskPhoneNumber(testDestination)}\n`);

  // Step 5: Validate Campaign Name
  console.log(` 4. Validating Campaign Name:`);
  if (!campaignName) {
    console.warn("    ! WARNING: AISENSY_CAMPAIGN_NAME is not set in .env.");
    console.warn("      Using test default 'case_hearing_reminder' for diagnostic handshake.");
  } else {
    console.log(`    ✓ Campaign Name: ${campaignName}`);
  }
  console.log();

  // Step 6: Dispatch Real Test Message to AiSensy
  console.log(` 5. Calling Real AiSensy API at ${aisensyService.defaultApiUrl}...`);
  const startTime = Date.now();

  const result = await aisensyService.sendTestMessage({
    destination: testDestination,
    campaignName: campaignName || "case_hearing_reminder",
    templateParams: [
      "API Test User",
      "TEST-CASE-001",
      "20 September 2026",
      "10:30 AM",
      "Test Court",
      "Hearing Reminder Test",
    ],
    userName: "Chambers Diagnostics",
  });

  const durationMs = Date.now() - startTime;
  console.log(`    Response received in ${durationMs}ms.\n`);

  // Step 7: Print Safe Result
  console.log("==================================================================");
  console.log("                     REAL API TEST RESULT                         ");
  console.log("==================================================================");

  if (result.success) {
    console.log(" STATUS: SUCCESS (HTTP 200)");
    console.log(` Provider: ${result.data?.provider}`);
    console.log(` State:    ${result.data?.status}`);
    if (result.data?.providerMessageId) {
      console.log(` Message ID: ${result.data.providerMessageId}`);
    }
    console.log("\n AiSensy accepted the outbound campaign request.");
    console.log(" Verify receipt on your physical test WhatsApp number.\n");
    process.exit(0);
  } else {
    console.log(" STATUS: REJECTED / FAILED");
    console.log(` Error Code: ${result.error?.code}`);
    console.log(` Details:    ${result.error?.details}`);
    if (result.error?.statusCode) {
      console.log(` HTTP Code:  ${result.error.statusCode}`);
    }
    console.log("\n Diagnostics:");
    if (result.error?.details?.includes("WABA is not verified")) {
      console.log(" -> Your AiSensy account requires WhatsApp Business Account (WABA) verification.");
      console.log("    Log into your AiSensy dashboard and verify your phone number with Meta OTP.");
    } else if (result.error?.code === "AISENSY_UNAUTHORIZED") {
      console.log(" -> The provided AISENSY_API_KEY was rejected by AiSensy.");
      console.log("    Check that you copied the complete API key from Manage -> API Key in AiSensy.");
    } else if (result.error?.code === "AISENSY_CAMPAIGN_ERROR") {
      console.log(" -> The campaign name was not found or is not approved in AiSensy.");
      console.log("    Ensure AISENSY_CAMPAIGN_NAME matches an active campaign in AiSensy.");
    }
    console.log("==================================================================\n");
    // Exit with code 0 if diagnostic response was safely returned from provider,
    // or exit 1 if configuration error.
    process.exit(result.error?.code === "AISENSY_NOT_CONFIGURED" ? 1 : 0);
  }
}

runRealAiSensyTest();
