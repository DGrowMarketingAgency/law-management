/**
 * Prompt 9: Payment Reminders, Notification Deduplication & RBAC Test Suite
 * Tests Email and WhatsApp template rendering, same-day duplicate dispatch blocking,
 * and RBAC financial restriction enforcement on Junior Associates.
 */

const assert = require("assert");
const pool = require("../config/database");
const { getTemplate } = require("../services/emailService");
const { formatWhatsAppPayload } = require("../services/whatsappService");
const { isDuplicateReminder } = require("../services/paymentReminderService");

async function runTests() {
  console.log("==================================================================");
  console.log("Starting Prompt 9 Payment Reminders & RBAC Test Suite");
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
  // 1. Email Template Interpolation Tests
  // -------------------------------------------------------------
  console.log("\n[1. Email Template Interpolation Tests]");

  await test("Email template correctly interpolates client, invoice, and payment link variables", async () => {
    const templateName = "payment_reminder_before_due";
    const data = {
      client_name: "Adani Enterprises Legal",
      invoice_number: "INV-2026-000456",
      amount_due: "75,000.00",
      due_date: "25 Sep 2026",
      payment_link: "https://chambers.internal/pay/inv_456",
      firm_name: "Apex Law Chambers",
    };

    const rendered = getTemplate(templateName, data);
    assert.ok(rendered.subject.includes("INV-2026-000456"), "Subject must include invoice number");
    assert.ok(rendered.subject.includes("Apex Law Chambers"), "Subject must include firm name");
    assert.ok(rendered.html.includes("Adani Enterprises Legal"), "Body must include client name");
    assert.ok(rendered.html.includes("₹75,000.00"), "Body must include amount due with rupee symbol");
    assert.ok(rendered.html.includes("https://chambers.internal/pay/inv_456"), "Body must include direct payment URL");
    assert.ok(!rendered.html.includes("{{"), "All template variables must be resolved without raw tags");
  });

  // -------------------------------------------------------------
  // 2. WhatsApp Cloud API Payload Generation Tests
  // -------------------------------------------------------------
  console.log("\n[2. WhatsApp Business Cloud API Payload Tests]");

  await test("WhatsApp Cloud API payload matches official Meta Graph API specifications", async () => {
    const toPhone = "+919876543210";
    const templateName = "payment_overdue_reminder";
    const params = {
      client_name: "Mr. Rajesh Sharma",
      invoice_number: "INV-2026-000789",
      amount_due: "42000.00",
      due_date: "10 Sep 2026",
      payment_link: "https://chambers.in/pay/789",
    };

    const payload = formatWhatsAppPayload(toPhone, templateName, params);

    assert.strictEqual(payload.messaging_product, "whatsapp");
    assert.strictEqual(payload.to, "919876543210");
    assert.strictEqual(payload.type, "template");
    assert.strictEqual(payload.template.name, templateName);
    assert.ok(Array.isArray(payload.template.components), "Components array must be present");

    // Check body parameters
    const bodyComponent = payload.template.components.find((c) => c.type === "body");
    assert.ok(bodyComponent, "Body component must exist in template");
    assert.ok(bodyComponent.parameters.length >= 4, "Must have at least 4 parameter variables");

    const textValues = bodyComponent.parameters.map((p) => p.text);
    assert.ok(textValues.includes("Mr. Rajesh Sharma"));
    assert.ok(textValues.includes("INV-2026-000789"));
  });

  // -------------------------------------------------------------
  // 3. Same-Day Duplicate Dispatch Prevention Tests
  // -------------------------------------------------------------
  console.log("\n[3. Notification Deduplication Engine Tests]");

  const testInvoiceId = 999991;
  const channel = "EMAIL";
  const templateKey = "payment_reminder_before_due";

  await test("isDuplicateReminder returns false when no notification has been dispatched today", async () => {
    const isDup = await isDuplicateReminder(testInvoiceId, channel, templateKey);
    assert.strictEqual(isDup, false, "Must return false prior to dispatch");
  });

  await test("Recording sent notification causes isDuplicateReminder to block subsequent dispatches today", async () => {
    // Record sent notification in notification_logs
    await pool.execute(
      `INSERT INTO notification_logs (
        entity_type, entity_id, channel, recipient, template, status, sent_at, created_at
      ) VALUES (
        'INVOICE', ?, ?, 'test@client.internal', ?, 'SENT', NOW(), NOW()
      )`,
      [testInvoiceId, channel, templateKey]
    );

    const isDup = await isDuplicateReminder(testInvoiceId, channel, templateKey);
    assert.strictEqual(isDup, true, "Must return true after notification has already been sent today");
  });

  // Clean up notification log
  await pool.execute("DELETE FROM notification_logs WHERE entity_id = ?", [testInvoiceId]);

  // -------------------------------------------------------------
  // 4. Strict RBAC Enforcement Tests
  // -------------------------------------------------------------
  console.log("\n[4. Role-Based Access Control (RBAC) Security Tests]");

  await test("Junior Associate role has ZERO financial or payment permissions", async () => {
    const [rows] = await pool.execute(
      `SELECT p.name AS permission_name
       FROM role_permissions rp
       JOIN roles r ON rp.role_id = r.id
       JOIN permissions p ON rp.permission_id = p.id
       WHERE r.name = 'JUNIOR_ASSOCIATE'`
    );

    const juniorPermissions = new Set(rows.map((r) => r.permission_name));

    // Strict assertions: Junior Associate must not possess any payment/billing privileges
    const forbiddenFinancialPermissions = [
      "PAYMENT_VIEW",
      "PAYMENT_CREATE",
      "PAYMENT_VERIFY",
      "PAYMENT_RECONCILE",
      "PAYMENT_GATEWAY_CONFIG",
      "REMINDER_SEND",
      "INVOICE_CREATE",
      "INVOICE_ISSUE",
      "INVOICE_VOID",
      "FEE_ENTRY_APPROVE",
    ];

    for (const perm of forbiddenFinancialPermissions) {
      assert.strictEqual(
        juniorPermissions.has(perm),
        false,
        `SECURITY VIOLATION: JUNIOR_ASSOCIATE must NOT possess permission '${perm}'`
      );
    }
  });

  await test("Chambers OWNER role possesses all financial gateway and reminder permissions", async () => {
    const [rows] = await pool.execute(
      `SELECT p.name AS permission_name
       FROM role_permissions rp
       JOIN roles r ON rp.role_id = r.id
       JOIN permissions p ON rp.permission_id = p.id
       WHERE r.name = 'OWNER'`
    );

    const ownerPermissions = new Set(rows.map((r) => r.permission_name));

    const requiredOwnerPermissions = [
      "PAYMENT_GATEWAY_CONFIG",
      "PAYMENT_VERIFY",
      "PAYMENT_RECONCILE",
      "REMINDER_SEND",
    ];

    for (const perm of requiredOwnerPermissions) {
      assert.strictEqual(
        ownerPermissions.has(perm),
        true,
        `OWNER must possess financial permission '${perm}'`
      );
    }
  });

  console.log("\n==================================================================");
  console.log(`Reminder & RBAC Test Results: ${passed} passed, ${failed} failed.`);
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
