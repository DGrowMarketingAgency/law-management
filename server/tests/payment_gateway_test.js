/**
 * Prompt 9: Payment Gateway & Verification Integration Test Suite
 * Tests Razorpay HMAC-SHA256, PayU SHA-512, manual verification/rejection,
 * cheque clearance, refund engine, and reconciliation.
 */

const assert = require("assert");
const crypto = require("crypto");
const pool = require("../config/database");
const { paymentProviderFactory } = require("../services/paymentProviderFactory");
const RazorpayPaymentProvider = require("../services/paymentProviders/razorpayPaymentProvider");
const PayUPaymentProvider = require("../services/paymentProviders/payuPaymentProvider");
const paymentService = require("../services/paymentService");
const { reconcilePayments } = require("../services/paymentReconciliationService");

async function runTests() {
  console.log("==================================================================");
  console.log("Starting Prompt 9 Payment Gateway & Verification Test Suite");
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
  // 1. Payment Provider Factory Resolution Tests
  // -------------------------------------------------------------
  console.log("\n[1. Payment Provider Factory Tests]");

  await test("Factory resolves Razorpay, PayU, and Manual providers correctly", async () => {
    const rzp = paymentProviderFactory.getProvider("RAZORPAY");
    assert.strictEqual(rzp.name, "RAZORPAY");

    const payu = paymentProviderFactory.getProvider("PAYU");
    assert.strictEqual(payu.name, "PAYU");

    const manual = paymentProviderFactory.getProvider("MANUAL");
    assert.strictEqual(manual.name, "MANUAL");

    assert.throws(() => {
      paymentProviderFactory.getProvider("UNSUPPORTED_PROVIDER");
    }, /Unsupported payment provider/);
  });

  // -------------------------------------------------------------
  // 2. Cryptographic HMAC & Hash Verification Tests
  // -------------------------------------------------------------
  console.log("\n[2. Cryptographic Verification Tests]");

  await test("Razorpay HMAC SHA-256 verifies valid signature and rejects tampered data", async () => {
    const rzp = new RazorpayPaymentProvider();
    const secret = "rzp_test_secret_key_12345";
    const orderId = "order_O8xK9ZABC12345";
    const paymentId = "pay_P8xK9ZABC67890";

    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    // Verification with valid signature
    const validResult = await rzp.verifyPayment({
      orderId,
      paymentId,
      signature: validSignature,
      secret,
    });
    assert.strictEqual(validResult.verified, true, "Valid Razorpay HMAC signature must verify as true");

    // Tampered payment ID
    const tamperedResult = await rzp.verifyPayment({
      orderId,
      paymentId: "pay_TAMPERED_00000",
      signature: validSignature,
      secret,
    });
    assert.strictEqual(tamperedResult.verified, false, "Tampered payment ID must fail verification");

    // Tampered signature
    const badSigResult = await rzp.verifyPayment({
      orderId,
      paymentId,
      signature: "0000000000000000000000000000000000000000000000000000000000000000",
      secret,
    });
    assert.strictEqual(badSigResult.verified, false, "Invalid signature must fail verification");
  });

  await test("PayU SHA-512 reverse hash verifies valid response and rejects tampered data", async () => {
    const payu = new PayUPaymentProvider();
    const salt = "payu_test_salt_998877";
    const key = "payu_key_112233";
    const txnid = "TXN_PAYU_001";
    const amount = "15000.00";
    const productinfo = "Legal Representation";
    const firstname = "John";
    const email = "client@example.com";
    const status = "success";
    const udf1 = "inv_101";

    // Set instance salt for testing
    payu.salt = salt;
    payu.key = key;

    const validHash = payu.calculateResponseHash({
      key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      udf1,
      salt,
    });

    const responsePayload = {
      key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      udf1,
      hash: validHash,
    };

    const validRes = await payu.verifyPayment(responsePayload);
    assert.strictEqual(validRes.verified, true, "Valid PayU SHA-512 hash must verify as true");

    // Tampered amount (e.g. client attempts to pay ₹1.00 instead of ₹15,000.00)
    const tamperedPayload = { ...responsePayload, amount: "1.00" };
    const tamperedRes = await payu.verifyPayment(tamperedPayload);
    assert.strictEqual(tamperedRes.verified, false, "Tampered payment amount must fail PayU hash verification");
  });

  // -------------------------------------------------------------
  // 3. Database Fixture Setup for Financial Operations
  // -------------------------------------------------------------
  console.log("\n[3. Setting up Database Test Fixtures]");

  let testClientId;
  let testInvoiceId;
  let testAdminUserId = 1;

  // Retrieve existing client or create temporary contact/client
  const [existingClients] = await pool.execute(
    "SELECT id FROM clients WHERE status = 'ACTIVE' LIMIT 1"
  );

  if (existingClients.length > 0) {
    testClientId = existingClients[0].id;
  } else {
    // Insert test contact & client
    const [cRes] = await pool.execute(
      `INSERT INTO contacts (contact_type, display_name, email, phone, created_at)
       VALUES ('CLIENT', 'Prompt9 Test Client', 'p9test@chambers.internal', '+919876543210', NOW())`
    );
    const [clRes] = await pool.execute(
      `INSERT INTO clients (contact_id, client_code, status, created_at)
       VALUES (?, 'CL-P9-001', 'ACTIVE', NOW())`,
      [cRes.insertId]
    );
    testClientId = clRes.insertId;
  }

  // Create test invoice for ₹20,000
  const testInvNumber = `INV-TEST-P9-${Date.now()}`;

  const [invRes] = await pool.execute(
    `INSERT INTO invoices (
      client_id, invoice_number, status, invoice_date, due_date,
      billing_name, billing_email, billing_phone,
      subtotal, tax_amount, discount_amount, total_amount, amount_paid, amount_due,
      currency, created_by, created_at
    ) VALUES (?, ?, 'ISSUED', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY),
      'Prompt9 Test Client', 'p9test@chambers.internal', '+919876543210',
      20000.00, 0.00, 0.00, 20000.00, 0.00, 20000.00, 'INR', ?, NOW())`,
    [testClientId, testInvNumber, testAdminUserId]
  );
  testInvoiceId = invRes.insertId;

  console.log(`  -> Created test invoice ID ${testInvoiceId} (${testInvNumber}) for ₹20,000.00`);

  // -------------------------------------------------------------
  // 4. Manual Payment Recording & Verification Lifecycle Tests
  // -------------------------------------------------------------
  console.log("\n[4. Manual & Offline Payment Lifecycle Tests]");

  let manualPaymentId;

  await test("Recording manual BANK_TRANSFER sets status to PENDING_VERIFICATION without marking invoice paid", async () => {
    const res = await paymentService.recordManualPayment(
      {
        invoice_id: testInvoiceId,
        payment_method: "BANK_TRANSFER",
        amount: 8000.0,
        payment_date: "2026-09-12",
        reference_number: "UTR-TEST-BANK-001",
        bank_name: "HDFC Bank",
        branch_name: "Fort Mumbai",
        notes: "RTGS transferred via corporate netbanking",
      },
      testAdminUserId,
      "127.0.0.1",
      "Mozilla/Test"
    );

    assert.ok(res.id, "Payment record must be created");
    manualPaymentId = res.id;
    assert.strictEqual(res.status, "PENDING_VERIFICATION");
    assert.strictEqual(res.payment_type, "MANUAL");
    assert.strictEqual(res.reference_number, "UTR-TEST-BANK-001");

    // Check invoice has NOT been credited yet (amount_due remains 20,000)
    const [invCheck] = await pool.execute("SELECT amount_paid, amount_due, status FROM invoices WHERE id = ?", [testInvoiceId]);
    assert.strictEqual(parseFloat(invCheck[0].amount_due), 20000.0, "Invoice due must NOT decrease before verification");
    assert.strictEqual(parseFloat(invCheck[0].amount_paid), 0.0, "Invoice paid must NOT increase before verification");
  });

  await test("Staff verification of manual payment clears receipt and updates invoice balance", async () => {
    const verified = await paymentService.verifyManualPayment(
      manualPaymentId,
      testAdminUserId,
      "127.0.0.1",
      "Mozilla/Test"
    );

    assert.strictEqual(verified.status, "SUCCESS");
    assert.ok(verified.verified_at, "verified_at timestamp must be set");
    assert.strictEqual(verified.verified_by, testAdminUserId);
    assert.ok(verified.receipt_number, "Official receipt number REC-YYYY-XXXXXX must be generated");

    // Check invoice updated: amount_paid = 8,000, amount_due = 12,000, status = PARTIALLY_PAID
    const [invCheck] = await pool.execute("SELECT amount_paid, amount_due, status FROM invoices WHERE id = ?", [testInvoiceId]);
    assert.strictEqual(parseFloat(invCheck[0].amount_paid), 8000.0);
    assert.strictEqual(parseFloat(invCheck[0].amount_due), 12000.0);
    assert.strictEqual(invCheck[0].status, "PARTIALLY_PAID");
  });

  await test("Cheque payment initiates as PENDING_CLEARANCE", async () => {
    const res = await paymentService.recordManualPayment(
      {
        invoice_id: testInvoiceId,
        payment_method: "CHEQUE",
        amount: 2000.0,
        payment_date: "2026-09-12",
        reference_number: "CHQ-882200",
        bank_name: "State Bank of India",
        cheque_date: "2026-09-10",
        notes: "Account payee cheque presented at registry",
      },
      testAdminUserId
    );

    assert.strictEqual(res.status, "PENDING_CLEARANCE", "Cheque must be in PENDING_CLEARANCE state");

    // Rejecting this cheque
    const rejected = await paymentService.rejectManualPayment(
      res.id,
      "Cheque returned unpaid: signature mismatch reported by clearing house",
      testAdminUserId
    );

    assert.strictEqual(rejected.status, "REJECTED");
    assert.strictEqual(rejected.rejection_reason, "Cheque returned unpaid: signature mismatch reported by clearing house");

    // Verify invoice due balance was not affected by rejected payment
    const [invCheck] = await pool.execute("SELECT amount_due FROM invoices WHERE id = ?", [testInvoiceId]);
    assert.strictEqual(parseFloat(invCheck[0].amount_due), 12000.0);
  });

  // -------------------------------------------------------------
  // 5. Payment Refund Engine Tests
  // -------------------------------------------------------------
  console.log("\n[5. Payment Refund Engine Tests]");

  await test("Partial refund on verified payment updates invoice due and creates refund audit record", async () => {
    // Verified payment has ₹8,000. Refund ₹3,000.
    const res = await paymentService.refundPayment(
      manualPaymentId,
      "Partial dispute settlement on fee breakdown",
      3000.0,
      testAdminUserId
    );

    assert.strictEqual(res.status, "PARTIALLY_REFUNDED");
    assert.strictEqual(parseFloat(res.amount_refunded), 3000.0);

    // Invoice due must increase back from 12,000 to 15,000
    const [invCheck] = await pool.execute("SELECT amount_paid, amount_due FROM invoices WHERE id = ?", [testInvoiceId]);
    assert.strictEqual(parseFloat(invCheck[0].amount_paid), 5000.0);
    assert.strictEqual(parseFloat(invCheck[0].amount_due), 15000.0);

    // Verify audit entry in payment_refunds table
    const [refundRows] = await pool.execute(
      "SELECT * FROM payment_refunds WHERE payment_id = ? ORDER BY id DESC LIMIT 1",
      [manualPaymentId]
    );
    assert.strictEqual(refundRows.length, 1);
    assert.strictEqual(parseFloat(refundRows[0].amount), 3000.0);
    assert.strictEqual(refundRows[0].status, "SUCCESS");
  });

  await test("Refunding more than the remaining paid amount is rejected", async () => {
    // Current paid amount remaining on payment is ₹5,000 (8,000 - 3,000). Try refunding ₹6,000.
    await assert.rejects(
      async () => {
        await paymentService.refundPayment(
          manualPaymentId,
          "Excessive refund attempt",
          6000.0,
          testAdminUserId
        );
      },
      /exceeds/
    );
  });

  // -------------------------------------------------------------
  // 6. Payment Reconciliation Tests
  // -------------------------------------------------------------
  console.log("\n[6. Payment Reconciliation Engine Tests]");

  await test("Reconciliation audit executes and returns structured report", async () => {
    const report = await reconcilePayments();

    assert.ok(report, "Report must be returned");
    assert.ok(report.summary, "Report must include summary");
    assert.ok(typeof report.summary.total_examined === "number");
    assert.ok(typeof report.summary.matched_count === "number");
    assert.ok(Array.isArray(report.items), "Items must be an array");

    console.log(`    -> Examined ${report.summary.total_examined} transactions, ${report.summary.matched_count} matched.`);
  });

  // Clean up test invoice & payments
  await pool.execute("DELETE FROM payment_refunds WHERE payment_id = ?", [manualPaymentId]);
  await pool.execute("DELETE FROM payments WHERE invoice_id = ?", [testInvoiceId]);
  await pool.execute("DELETE FROM invoices WHERE id = ?", [testInvoiceId]);

  console.log("\n==================================================================");
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
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
