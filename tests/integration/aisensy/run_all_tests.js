const path = require("path");
module.paths.push(path.resolve(__dirname, "../../../server/node_modules"));
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const runConfigTests = require("./aisensy.config.test");
const runServiceTests = require("./aisensy.service.test");
const runManualTests = require("./aisensy.manual.test");
const runSchedulerTests = require("./aisensy.scheduler.test");
const runWebhookTests = require("./aisensy.webhook.test");
const runSecurityTests = require("./aisensy.security.test");
const runFailureTests = require("./aisensy.failure.test");
const runIdempotencyTests = require("./aisensy.idempotency.test");

async function runMasterSuite() {
  console.log("==================================================================");
  console.log("    AISENSY WHATSAPP INTEGRATION: COMPLETE AUTOMATED TEST MATRIX   ");
  console.log("   (Isolated Test Environment — ZERO Real Messages Dispatched)    ");
  console.log("==================================================================\n");

  const startTime = Date.now();
  let totalPassed = 0;
  let totalFailed = 0;

  const suites = [
    { name: "Suite 1: Configuration & Validation", fn: runConfigTests },
    { name: "Suite 2: Service & Error Normalization", fn: runServiceTests },
    { name: "Suite 3: Manual Endpoint & Safety Gating", fn: runManualTests },
    { name: "Suite 4: Scheduler & Lifecycle Safety", fn: runSchedulerTests },
    { name: "Suite 5: Webhook Status & Signatures", fn: runWebhookTests },
    { name: "Suite 6: Security, Secrets & RBAC", fn: runSecurityTests },
    { name: "Suite 7: Failure, Timeout & Retries", fn: runFailureTests },
    { name: "Suite 8: Duplicate Protection & Idempotency", fn: runIdempotencyTests },
  ];

  const summary = [];

  for (const suite of suites) {
    try {
      const res = await suite.fn();
      totalPassed += res.passed;
      totalFailed += res.failed;
      summary.push({ name: suite.name, passed: res.passed, failed: res.failed, status: res.failed === 0 ? "PASSED" : "FAILED" });
    } catch (err) {
      totalFailed++;
      console.error(`FATAL ERROR in ${suite.name}:`, err.message);
      summary.push({ name: suite.name, passed: 0, failed: 1, status: "ERROR" });
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("==================================================================");
  console.log("                    AUTOMATED TEST SUMMARY                        ");
  console.log("==================================================================");
  summary.forEach((s) => {
    const symbol = s.status === "PASSED" ? "✓" : "✗";
    console.log(` ${symbol} ${s.name.padEnd(45)} [${s.status}] (${s.passed} passed, ${s.failed} failed)`);
  });
  console.log("------------------------------------------------------------------");
  console.log(`TOTAL: ${totalPassed} PASSED, ${totalFailed} FAILED (${durationSec}s)`);
  console.log("==================================================================\n");

  process.exit(totalFailed > 0 ? 1 : 0);
}

runMasterSuite();
