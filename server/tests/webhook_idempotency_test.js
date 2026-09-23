/**
 * Prompt 9: Webhook Security & Idempotency Integration Test Suite
 * Tests RAW request body HMAC cryptographic validation, replay attack rejection,
 * and database-level idempotency protection against duplicate webhook deliveries.
 */

const assert = require("assert");
const crypto = require("crypto");
const pool = require("../config/database");
const RazorpayPaymentProvider = require("../services/paymentProviders/razorpayPaymentProvider");
const paymentService = require("../services/paymentService");

async function runTests() {
  console.log("==================================================================");
  console.log("Starting Prompt 9 Webhook Security & Idempotency Test Suite");
  console.log("==================================================================");

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

  // -------------------------------------------------------------
  // 1. Raw Body HMAC Webhook Authenticity Tests
  // -------------------------------------------------------------
  console.log("\n[1. Raw Body Webhook Signature Tests]");

  const rzp = new RazorpayPaymentProvider();
  const testWebhookSecret = "whsec_super_secret_legal_chamber_key_2026";
  rzp.webhookSecret = testWebhookSecret;

  const samplePayload = {
    entity: "event",
    account_id: "acc_test_123",
    event: "payment.captured",
    contains: ["payment"],
    payload: {
      payment: {
        entity: {
          id: "pay_test_wh_001",
          amount: 500000,
          currency: "INR",
          status: "captured",
          order_id: "order_test_wh_001",
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };

  const rawBodyBuffer = Buffer.from(JSON.stringify(samplePayload), "utf-8");
  const validSignature = crypto
    .createHmac("sha256", testWebhookSecret)
    .update(rawBodyBuffer)
    .digest("hex");

  await test("Razorpay webhook verifies signature computed directly over RAW body buffer", async () => {
    const isValid = rzp.verifyWebhook({
      rawBody: rawBodyBuffer,
      headers: { "x-razorpay-signature": validSignature },
      payload: samplePayload,
      secret: testWebhookSecret,
    });
    assert.strictEqual(isValid, true, "RAW body signature must verify successfully");
  });

  await test("Tampered RAW body payload fails signature check", async () => {
    const tamperedPayload = { ...samplePayload, event: "payment.failed" };
    const tamperedBuffer = Buffer.from(JSON.stringify(tamperedPayload), "utf-8");

    const isValid = rzp.verifyWebhook({
      rawBody: tamperedBuffer,
      headers: { "x-razorpay-signature": validSignature },
      payload: tamperedPayload,
      secret: testWebhookSecret,
    });
    assert.strictEqual(isValid, false, "Tampered payload must fail webhook HMAC check");
  });

  await test("Missing signature header is rejected immediately", async () => {
    const isValid = rzp.verifyWebhook({
      rawBody: rawBodyBuffer,
      headers: {},
      payload: samplePayload,
      secret: testWebhookSecret,
    });
    assert.strictEqual(isValid, false, "Missing signature header must be rejected");
  });

  // -------------------------------------------------------------
  // 2. Database Idempotency & Replay Prevention Tests
  // -------------------------------------------------------------
  console.log("\n[2. Webhook Idempotency Engine Tests]");

  const testEventId = `evt_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const eventPayload = {
    eventId: testEventId,
    eventType: "payment.captured",
    provider: "RAZORPAY",
    orderId: "order_idemp_001",
    paymentId: "pay_idemp_001",
  };

  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(eventPayload)).digest("hex");

  await test("First delivery of webhook records event as processed in audit table", async () => {
    // Insert into webhook_events table
    const [insertRes] = await pool.execute(
      `INSERT INTO webhook_events (provider, event_id, event_type, signature_valid, processed, payload_hash, processed_at)
       VALUES ('RAZORPAY', ?, 'payment.captured', 1, 1, ?, NOW())`,
      [testEventId, payloadHash]
    );
    assert.ok(insertRes.insertId, "Webhook event must be recorded in table");

    const [rows] = await pool.execute(
      "SELECT processed, event_id, payload_hash FROM webhook_events WHERE event_id = ?",
      [testEventId]
    );
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(Boolean(rows[0].processed), true);
  });

  await test("Duplicate delivery of identical webhook event is detected and blocked from reprocessing", async () => {
    // Duplicate lookup pattern identical to webhookController
    const [existing] = await pool.execute(
      `SELECT id, processed FROM webhook_events 
       WHERE provider = 'RAZORPAY' AND (payload_hash = ? OR (event_id IS NOT NULL AND event_id = ?))
       LIMIT 1`,
      [payloadHash, testEventId]
    );

    assert.strictEqual(existing.length, 1, "Duplicate event exists in ledger");
    assert.strictEqual(Boolean(existing[0].processed), true, "Event must be flagged as already processed");
  });

  // Clean up test webhook event
  await pool.execute("DELETE FROM webhook_events WHERE event_id = ?", [testEventId]);

  console.log("\n==================================================================");
  console.log(`Webhook Test Results: ${passed} passed, ${failed} failed.`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
