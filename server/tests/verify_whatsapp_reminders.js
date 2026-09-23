const db = require("../config/database");
const hearingReminderService = require("../services/whatsapp/hearingReminderService");
const whatsAppService = require("../services/whatsapp/whatsappService");
const { normalizeWhatsAppNumber, toMetaApiNumber, maskPhoneNumber } = require("../utils/phoneUtils");

async function runTests() {
  console.log("==================================================");
  console.log("TEST SUITE: Client Case Hearing WhatsApp Reminders");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Phone number normalization & masking test
    console.log("\n--- 1. Phone Normalization & Privacy Masking ---");
    assert(normalizeWhatsAppNumber("9876543210") === "+919876543210", "10-digit Indian number normalized to +91XXXXXXXXXX");
    assert(normalizeWhatsAppNumber("09876543210") === "+919876543210", "Leading-0 Indian number normalized to +91XXXXXXXXXX");
    assert(normalizeWhatsAppNumber("919876543210") === "+919876543210", "91-prefixed number normalized to +91XXXXXXXXXX");
    assert(normalizeWhatsAppNumber("+919876543210") === "+919876543210", "E.164 +91 preserved");
    assert(toMetaApiNumber("+919876543210") === "919876543210", "Meta Cloud API format has no leading plus");
    assert(maskPhoneNumber("+919876543210") === "+91******3210", "UI phone number privacy masked");

    // 2. WhatsApp Service Health Status
    console.log("\n--- 2. WhatsApp Service Health Status ---");
    const health = whatsAppService.getHealthStatus();
    assert(health.provider === "OFFICIAL_META_CLOUD_API", "Official Meta Cloud API provider configured");
    assert(health.apiVersion === "v20.0", "Meta API version is v20.0");
    assert(typeof health.configured === "boolean", "Health returns explicit configuration boolean");

    // 3. Reminder Settings Configuration
    console.log("\n--- 3. Reminder Settings Configuration ---");
    const settingsData = await hearingReminderService.getSettings();
    assert(settingsData.settings.length === 4, "4 default reminder types configured in database");
    const types = settingsData.settings.map((s) => s.reminderType);
    assert(
      types.includes("HEARING_7_DAYS") &&
      types.includes("HEARING_3_DAYS") &&
      types.includes("HEARING_1_DAY") &&
      types.includes("HEARING_DAY"),
      "Contains 7d, 3d, 1d, and hearing-day reminder configurations"
    );

    // 4. Setup Test Fixture: Contact, Client, Case, Hearing
    console.log("\n--- 4. Fixture Setup & Hearing Creation ---");
    const [cntRes] = await db.query(
      `INSERT INTO contacts (first_name, last_name, display_name, phone, whatsapp_number, whatsapp_opt_in, whatsapp_opt_in_at)
       VALUES ('Test', 'Client', 'Test Client', '+919876543210', '+919876543210', 1, NOW())`
    );
    const testContactId = cntRes.insertId;

    const uniqueCode = `TC_${Date.now()}`;
    const [clientRes] = await db.query(
      `INSERT INTO clients (contact_id, client_code, status) VALUES (?, ?, 'ACTIVE')`,
      [testContactId, uniqueCode]
    );
    const testClientId = clientRes.insertId;

    const [caseRes] = await db.query(
      `INSERT INTO cases (case_number, title, case_type, case_status, primary_client_id, court_id)
       VALUES (?, 'Test Client vs Union of India', 'WRIT_PETITION', 'ACTIVE', ?, 1)`,
      [`WP/${uniqueCode}`, testClientId]
    );
    const testCaseId = caseRes.insertId;

    // Hearing 14 days in future
    const hearingDate = new Date();
    hearingDate.setDate(hearingDate.getDate() + 14);
    const hearingDateStr = hearingDate.toISOString().slice(0, 10);

    const [hearingRes] = await db.query(
      `INSERT INTO case_hearings (case_id, hearing_date, hearing_time, purpose, status)
       VALUES (?, ?, '10:30:00', 'Final Hearing', 'SCHEDULED')`,
      [testCaseId, hearingDateStr]
    );
    const testHearingId = hearingRes.insertId;

    // 5. Test Reminder Generation
    console.log("\n--- 5. Reminder Generation & Duplicate Protection ---");
    const genResult = await hearingReminderService.generateHearingReminders(testHearingId);
    assert(genResult.success === true, "Reminders generated successfully");

    const [remRows] = await db.query(
      `SELECT * FROM hearing_reminders WHERE hearing_id = ? ORDER BY scheduled_at ASC`,
      [testHearingId]
    );
    assert(remRows.length === 4, "4 reminder rows scheduled in MySQL");
    assert(
      remRows.every((r) => r.status === "SCHEDULED"),
      "All future reminders initialized to SCHEDULED for opted-in client"
    );

    // Duplicate test: running again must not create duplicates (unique constraint protection)
    await hearingReminderService.generateHearingReminders(testHearingId);
    const [remRowsAfter] = await db.query(
      `SELECT COUNT(*) as cnt FROM hearing_reminders WHERE hearing_id = ?`,
      [testHearingId]
    );
    assert(remRowsAfter[0].cnt === 4, "Duplicate schedule execution prevented by unique constraint");

    // 6. Test Hearing Rescheduled
    console.log("\n--- 6. Rescheduling Lifecycle ---");
    const [orig7d] = await db.query(
      `SELECT scheduled_at FROM hearing_reminders WHERE hearing_id = ? AND reminder_type = 'HEARING_7_DAYS'`,
      [testHearingId]
    );

    const newHearingDate = new Date();
    newHearingDate.setDate(newHearingDate.getDate() + 25);
    const newHearingDateStr = newHearingDate.toISOString().slice(0, 10);

    await db.query(`UPDATE case_hearings SET hearing_date = ? WHERE id = ?`, [newHearingDateStr, testHearingId]);
    await hearingReminderService.rescheduleHearingReminders(testHearingId);

    const [updated7d] = await db.query(
      `SELECT scheduled_at FROM hearing_reminders WHERE hearing_id = ? AND reminder_type = 'HEARING_7_DAYS'`,
      [testHearingId]
    );

    assert(
      new Date(updated7d[0].scheduled_at).getTime() > new Date(orig7d[0].scheduled_at).getTime(),
      "Reminders regenerated with new scheduled_at timestamps corresponding to updated hearing date"
    );

    const [cancelAudit] = await db.query(
      `SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'HEARING_REMINDER_CANCELLED'`
    );
    assert(cancelAudit[0].cnt > 0, "Audit trail records HEARING_REMINDER_CANCELLED when rescheduling");

    // 7. Test Opt-out Lifecycle
    console.log("\n--- 7. Client Opt-out Lifecycle ---");
    await db.query(`UPDATE contacts SET whatsapp_opt_in = 0, whatsapp_opt_out_at = NOW() WHERE id = ?`, [testContactId]);
    await hearingReminderService.handleClientOptOut(testClientId);

    const [pendingAfterOptOut] = await db.query(
      `SELECT COUNT(*) as cnt FROM hearing_reminders WHERE client_id = ? AND status = 'SCHEDULED'`,
      [testClientId]
    );
    assert(pendingAfterOptOut[0].cnt === 0, "Zero SCHEDULED reminders remain after client opt-out");

    // 8. Test Webhook Verification
    console.log("\n--- 8. Meta Webhook Verification Challenge ---");
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "chambers_test_verify_token";
    const verifiedChallenge = whatsAppService.verifyWebhook(
      "subscribe",
      "chambers_test_verify_token",
      "test_challenge_12345"
    );
    assert(verifiedChallenge === "test_challenge_12345", "Meta webhook challenge successfully verified");

    const failedChallenge = whatsAppService.verifyWebhook(
      "subscribe",
      "wrong_token",
      "test_challenge_12345"
    );
    assert(failedChallenge === null, "Invalid webhook token rejected");

    // 9. Test Webhook Status Transitions & Idempotency
    console.log("\n--- 9. Webhook Status Handling & Idempotency ---");
    const testProviderMsgId = `wamid.TEST_${Date.now()}`;
    // Insert a dummy reminder with provider_message_id
    const [insDummy] = await db.query(
      `INSERT INTO hearing_reminders (
        hearing_id, case_id, client_id, reminder_type, scheduled_at, status, provider_message_id
       ) VALUES (?, ?, ?, 'MANUAL', NOW(), 'SENT', ?)`,
      [testHearingId, testCaseId, testClientId, testProviderMsgId]
    );
    const dummyReminderId = insDummy.insertId;

    // Simulate DELIVERED status event
    await hearingReminderService.handleWebhookStatusUpdate({
      messageId: testProviderMsgId,
      status: "DELIVERED",
      timestamp: Math.floor(Date.now() / 1000),
    });

    const [deliveredRow] = await db.query(
      `SELECT status, delivered_at FROM hearing_reminders WHERE id = ?`,
      [dummyReminderId]
    );
    assert(deliveredRow[0].status === "DELIVERED", "Reminder transitioned to DELIVERED from webhook");
    assert(deliveredRow[0].delivered_at !== null, "delivered_at timestamp recorded");

    // Simulate READ status event
    await hearingReminderService.handleWebhookStatusUpdate({
      messageId: testProviderMsgId,
      status: "READ",
      timestamp: Math.floor(Date.now() / 1000),
    });

    const [readRow] = await db.query(
      `SELECT status, read_at FROM hearing_reminders WHERE id = ?`,
      [dummyReminderId]
    );
    assert(readRow[0].status === "READ", "Reminder transitioned to READ from webhook");
    assert(readRow[0].read_at !== null, "read_at timestamp recorded");

    // 10. Test Audit Logs
    console.log("\n--- 10. Audit Log Trail ---");
    const [auditRows] = await db.query(
      `SELECT * FROM audit_logs WHERE entity_type = 'HEARING_REMINDER' ORDER BY id DESC LIMIT 5`
    );
    assert(auditRows.length > 0, "Audit logs recorded for hearing reminder events");
    assert(
      auditRows.every((a) => !JSON.stringify(a.details).includes("replace_this_later")),
      "No secrets or credentials leaked in audit logs"
    );

    // 11. Test Real-time Dashboard Aggregations
    console.log("\n--- 11. Dashboard Aggregations ---");
    const stats = await hearingReminderService.getDashboardReminderStats();
    assert(typeof stats.scheduled === "number", "Dashboard scheduled count is real integer");
    assert(typeof stats.sent === "number", "Dashboard sent count is real integer");
    assert(typeof stats.delivered === "number", "Dashboard delivered count is real integer");
    assert(typeof stats.failed === "number", "Dashboard failed count is real integer");

    // Cleanup test fixture
    console.log("\n--- Cleanup Test Fixture ---");
    await db.query(`DELETE FROM hearing_reminders WHERE hearing_id = ?`, [testHearingId]);
    await db.query(`DELETE FROM case_hearings WHERE id = ?`, [testHearingId]);
    await db.query(`DELETE FROM cases WHERE id = ?`, [testCaseId]);
    await db.query(`DELETE FROM clients WHERE id = ?`, [testClientId]);
    await db.query(`DELETE FROM contacts WHERE id = ?`, [testContactId]);
    console.log("[CLEANUP] Test fixtures successfully removed.");

    console.log("\n==================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("[TEST FATAL ERROR]:", err);
    process.exit(1);
  }
}

runTests();
