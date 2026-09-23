const db = require("../../config/database");
const whatsAppService = require("./whatsappService");
const { normalizeWhatsAppNumber, maskPhoneNumber } = require("../../utils/phoneUtils");
const { logHearingReminderEvent } = require("../auditService");

/**
 * Client Case Hearing WhatsApp Reminder Service
 * Enforces production business logic, scheduling, lifecycle synchronization,
 * consent validation, privacy masking, and duplicate protection.
 */
class HearingReminderService {
  /**
   * Resolve designated primary client and contact for a case
   * @param {number} caseId 
   * @returns {Promise<object|null>}
   */
  async resolvePrimaryClientForCase(caseId) {
    // 1. Check direct primary_client_id on case
    const [caseRows] = await db.query(
      `SELECT c.id as case_id, c.case_number, c.title as case_title, c.primary_client_id,
              cl.id as client_id, cl.status as client_status,
              co.id as contact_id, co.first_name, co.last_name, co.display_name,
              co.whatsapp_number, co.phone, co.whatsapp_opt_in, co.whatsapp_opt_in_at
       FROM cases c
       LEFT JOIN clients cl ON c.primary_client_id = cl.id
       LEFT JOIN contacts co ON cl.contact_id = co.id
       WHERE c.id = ? AND c.deleted_at IS NULL
       LIMIT 1`,
      [caseId]
    );

    if (caseRows.length > 0 && caseRows[0].client_id) {
      const r = caseRows[0];
      const rawPhone = r.whatsapp_number || r.phone;
      const normalizedNumber = normalizeWhatsAppNumber(rawPhone);

      return {
        caseId: r.case_id,
        caseNumber: r.case_number,
        caseTitle: r.case_title,
        clientId: r.client_id,
        clientStatus: r.client_status,
        contactId: r.contact_id,
        clientName:
          r.display_name ||
          [r.first_name, r.last_name].filter(Boolean).join(" ") ||
          "Valued Client",
        rawPhone,
        whatsappNumber: normalizedNumber,
        whatsappOptIn: Boolean(r.whatsapp_opt_in === 1),
        whatsappOptInAt: r.whatsapp_opt_in_at,
      };
    }

    // 2. Fallback: Query primary party in case_parties
    const [partyRows] = await db.query(
      `SELECT c.id as case_id, c.case_number, c.title as case_title,
              cl.id as client_id, cl.status as client_status,
              co.id as contact_id, co.first_name, co.last_name, co.display_name,
              co.whatsapp_number, co.phone, co.whatsapp_opt_in, co.whatsapp_opt_in_at
       FROM case_parties cp
       JOIN cases c ON cp.case_id = c.id
       JOIN contacts co ON cp.contact_id = co.id
       JOIN clients cl ON cl.contact_id = co.id
       WHERE cp.case_id = ? AND c.deleted_at IS NULL
       ORDER BY cp.is_primary DESC, cp.id ASC
       LIMIT 1`,
      [caseId]
    );

    if (partyRows.length > 0) {
      const r = partyRows[0];
      const rawPhone = r.whatsapp_number || r.phone;
      const normalizedNumber = normalizeWhatsAppNumber(rawPhone);

      return {
        caseId: r.case_id,
        caseNumber: r.case_number,
        caseTitle: r.case_title,
        clientId: r.client_id,
        clientStatus: r.client_status,
        contactId: r.contact_id,
        clientName:
          r.display_name ||
          [r.first_name, r.last_name].filter(Boolean).join(" ") ||
          "Valued Client",
        rawPhone,
        whatsappNumber: normalizedNumber,
        whatsappOptIn: Boolean(r.whatsapp_opt_in === 1),
        whatsappOptInAt: r.whatsapp_opt_in_at,
      };
    }

    return null;
  }

  /**
   * Helper to format date string to YYYY-MM-DD
   */
  formatDateOnly(dateInput) {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Helper to compute scheduled_at datetime string in YYYY-MM-DD HH:mm:ss
   */
  computeScheduledAt(hearingDate, offsetDays, sendTimeStr) {
    const d = new Date(hearingDate);
    d.setDate(d.getDate() - parseInt(offsetDays, 10));

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    const time = sendTimeStr || "10:00:00";
    return `${yyyy}-${mm}-${dd} ${time}`;
  }

  /**
   * Generate scheduled reminders for a hearing
   * Automatically triggered on hearing creation and adjournment
   * @param {number} hearingId 
   * @param {number|null} userId 
   */
  async generateHearingReminders(hearingId, userId = null) {
    // 1. Fetch hearing details
    const [hRows] = await db.query(
      `SELECT ch.*, cs.case_number, cs.title as case_title,
              crt.name as court_name
       FROM case_hearings ch
       JOIN cases cs ON ch.case_id = cs.id
       LEFT JOIN courts crt ON ch.court_id = crt.id
       WHERE ch.id = ?
       LIMIT 1`,
      [hearingId]
    );

    if (hRows.length === 0) return { generated: 0, reason: "HEARING_NOT_FOUND" };
    const hearing = hRows[0];

    // Only schedule for active 'SCHEDULED' hearings
    if (hearing.status !== "SCHEDULED") {
      return { generated: 0, reason: `HEARING_STATUS_${hearing.status}` };
    }

    // 2. Resolve Primary Client
    const clientInfo = await this.resolvePrimaryClientForCase(hearing.case_id);
    if (!clientInfo) {
      return { generated: 0, reason: "NO_PRIMARY_CLIENT_ASSOCIATED" };
    }

    // 3. Load active reminder configuration rules
    const [settings] = await db.query(
      `SELECT * FROM whatsapp_hearing_reminder_settings WHERE enabled = 1 ORDER BY offset_days DESC`
    );

    if (settings.length === 0) {
      return { generated: 0, reason: "NO_REMINDER_SETTINGS_ENABLED" };
    }

    const now = new Date();
    let generatedCount = 0;

    for (const rule of settings) {
      const scheduledAtStr = this.computeScheduledAt(
        hearing.hearing_date,
        rule.offset_days,
        rule.send_time
      );
      const scheduledDate = new Date(scheduledAtStr);

      let initialStatus = "SCHEDULED";
      let failureReason = null;

      // Evaluation criteria
      if (!clientInfo.whatsappOptIn) {
        initialStatus = "SKIPPED";
        failureReason = "CLIENT_NOT_OPTED_IN";
      } else if (!clientInfo.whatsappNumber) {
        initialStatus = "SKIPPED";
        failureReason = "MISSING_WHATSAPP_NUMBER";
      } else if (clientInfo.clientStatus && clientInfo.clientStatus !== "ACTIVE") {
        initialStatus = "SKIPPED";
        failureReason = "CLIENT_INACTIVE";
      } else if (scheduledDate <= now) {
        initialStatus = "SKIPPED";
        failureReason = "SCHEDULED_TIME_ALREADY_PASSED";
      }

      try {
        // Enforce unique constraint: (hearing_id, client_id, reminder_type)
        const [insertRes] = await db.query(
          `INSERT INTO hearing_reminders (
            hearing_id, case_id, client_id, reminder_type,
            scheduled_at, status, whatsapp_number, template_key,
            failure_reason, source, retry_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'AUTO', 0)
          ON DUPLICATE KEY UPDATE
            scheduled_at = VALUES(scheduled_at),
            whatsapp_number = VALUES(whatsapp_number),
            template_key = VALUES(template_key),
            status = IF(status IN ('SENT', 'DELIVERED', 'READ'), status, VALUES(status)),
            failure_reason = IF(status IN ('SENT', 'DELIVERED', 'READ'), failure_reason, VALUES(failure_reason)),
            updated_at = NOW()`,
          [
            hearingId,
            hearing.case_id,
            clientInfo.clientId,
            rule.reminder_type,
            scheduledAtStr,
            initialStatus,
            clientInfo.whatsappNumber || null,
            rule.template_key || "case_hearing_reminder",
            failureReason,
          ]
        );

        if (insertRes.affectedRows > 0) {
          generatedCount++;
          const reminderId = insertRes.insertId;

          await logHearingReminderEvent(
            userId,
            "HEARING_REMINDER_SCHEDULED",
            reminderId,
            null,
            null,
            {
              hearingId,
              caseId: hearing.case_id,
              clientId: clientInfo.clientId,
              reminderType: rule.reminder_type,
              scheduledAt: scheduledAtStr,
              status: initialStatus,
              reason: failureReason,
            }
          );
        }
      } catch (err) {
        console.error(
          `[HearingReminder] Failed to schedule reminder ${rule.reminder_type} for hearing ${hearingId}:`,
          err.message
        );
      }
    }

    return { success: true, generatedCount };
  }

  /**
   * Cancel all pending/scheduled reminders for a hearing
   * Invoked on hearing cancellation, adjournment, or completion
   * @param {number} hearingId 
   * @param {string} reason 
   * @param {number|null} userId 
   */
  async cancelHearingReminders(hearingId, reason = "HEARING_CANCELLED", userId = null) {
    const [rows] = await db.query(
      `SELECT id, reminder_type FROM hearing_reminders 
       WHERE hearing_id = ? AND status IN ('SCHEDULED', 'PROCESSING')`,
      [hearingId]
    );

    if (rows.length === 0) return { cancelled: 0 };

    await db.query(
      `UPDATE hearing_reminders 
       SET status = 'CANCELLED', failure_reason = ?, updated_at = NOW()
       WHERE hearing_id = ? AND status IN ('SCHEDULED', 'PROCESSING')`,
      [reason, hearingId]
    );

    for (const r of rows) {
      await logHearingReminderEvent(
        userId,
        "HEARING_REMINDER_CANCELLED",
        r.id,
        null,
        null,
        { hearingId, reminderType: r.reminder_type, reason }
      );
    }

    return { cancelled: rows.length };
  }

  /**
   * Reschedule reminders when a hearing date/time changes
   * @param {number} hearingId 
   * @param {number|null} userId 
   */
  async rescheduleHearingReminders(hearingId, userId = null) {
    // 1. Cancel existing unsent reminders
    await this.cancelHearingReminders(hearingId, "HEARING_RESCHEDULED", userId);

    // 2. Generate fresh reminders for the updated date/time
    return await this.generateHearingReminders(hearingId, userId);
  }

  /**
   * Cancel reminders when a client opts out of WhatsApp messages
   * @param {number} clientId 
   */
  async handleClientOptOut(clientId) {
    const [rows] = await db.query(
      `SELECT id, hearing_id, reminder_type FROM hearing_reminders 
       WHERE client_id = ? AND status IN ('SCHEDULED', 'PROCESSING')`,
      [clientId]
    );

    if (rows.length === 0) return { cancelled: 0 };

    await db.query(
      `UPDATE hearing_reminders 
       SET status = 'CANCELLED', failure_reason = 'CLIENT_OPTED_OUT', updated_at = NOW()
       WHERE client_id = ? AND status IN ('SCHEDULED', 'PROCESSING')`,
      [clientId]
    );

    for (const r of rows) {
      await logHearingReminderEvent(
        null,
        "HEARING_REMINDER_CANCELLED",
        r.id,
        null,
        null,
        { clientId, hearingId: r.hearing_id, reminderType: r.reminder_type, reason: "CLIENT_OPTED_OUT" }
      );
    }

    return { cancelled: rows.length };
  }

  /**
   * Format hearing date and time for client template
   */
  formatHearingDateTimeForTemplate(hearingDate, hearingTime) {
    let dateStr = "Scheduled Date";
    try {
      const d = new Date(hearingDate);
      dateStr = d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      dateStr = String(hearingDate);
    }

    let timeStr = "Morning Session";
    if (hearingTime) {
      try {
        const parts = hearingTime.split(":");
        if (parts.length >= 2) {
          let hours = parseInt(parts[0], 10);
          const minutes = parts[1];
          const ampm = hours >= 12 ? "PM" : "AM";
          hours = hours % 12 || 12;
          timeStr = `${hours}:${minutes} ${ampm}`;
        }
      } catch {
        timeStr = hearingTime;
      }
    }

    return { dateStr, timeStr };
  }

  /**
   * Process due reminders (Invoked by background scheduler every minute)
   */
  async processDueReminders() {
    // 0. Strict Production Safety: Automatic reminders MUST NOT send in test mode
    if (process.env.AISENSY_ENABLED !== "true" || process.env.AISENSY_TEST_MODE === "true") {
      return { processed: 0, skipped: true, reason: "AUTOMATIC_REMINDERS_DISABLED_IN_TEST_MODE" };
    }

    // 1. Fetch pending reminders due for delivery
    const [dueReminders] = await db.query(
      `SELECT hr.*, 
              ch.status as hearing_status, ch.hearing_date, ch.hearing_time, ch.purpose,
              cs.case_number, cs.title as case_title,
              crt.name as court_name,
              co.first_name, co.last_name, co.display_name,
              co.whatsapp_opt_in, co.whatsapp_number as contact_whatsapp, co.phone as contact_phone,
              cl.status as client_status
       FROM hearing_reminders hr
       JOIN case_hearings ch ON hr.hearing_id = ch.id
       JOIN cases cs ON hr.case_id = cs.id
       LEFT JOIN courts crt ON ch.court_id = crt.id
       JOIN clients cl ON hr.client_id = cl.id
       JOIN contacts co ON cl.contact_id = co.id
       WHERE hr.status = 'SCHEDULED' AND hr.scheduled_at <= NOW()
       ORDER BY hr.scheduled_at ASC
       LIMIT 25`
    );

    if (dueReminders.length === 0) {
      return { processed: 0 };
    }

    let processedCount = 0;

    for (const reminder of dueReminders) {
      // 2. Atomic lock status transition to PROCESSING
      const [lockRes] = await db.query(
        `UPDATE hearing_reminders SET status = 'PROCESSING', updated_at = NOW()
         WHERE id = ? AND status = 'SCHEDULED'`,
        [reminder.id]
      );

      if (lockRes.affectedRows === 0) {
        // Concurrently processed by another worker
        continue;
      }

      // 3. Lifecycle & Consent Verification
      if (reminder.hearing_status !== "SCHEDULED") {
        await db.query(
          `UPDATE hearing_reminders 
           SET status = 'SKIPPED', failure_reason = ?, updated_at = NOW()
           WHERE id = ?`,
          [`HEARING_${reminder.hearing_status}`, reminder.id]
        );
        await logHearingReminderEvent(null, "HEARING_REMINDER_SKIPPED", reminder.id, null, null, {
          reason: `Hearing is ${reminder.hearing_status}`,
        });
        continue;
      }

      if (reminder.whatsapp_opt_in !== 1) {
        await db.query(
          `UPDATE hearing_reminders 
           SET status = 'SKIPPED', failure_reason = 'CLIENT_NOT_OPTED_IN', updated_at = NOW()
           WHERE id = ?`,
          [reminder.id]
        );
        await logHearingReminderEvent(null, "HEARING_REMINDER_SKIPPED", reminder.id, null, null, {
          reason: "Client not opted in",
        });
        continue;
      }

      const activePhone = normalizeWhatsAppNumber(
        reminder.contact_whatsapp || reminder.contact_phone || reminder.whatsapp_number
      );

      if (!activePhone) {
        await db.query(
          `UPDATE hearing_reminders 
           SET status = 'SKIPPED', failure_reason = 'MISSING_WHATSAPP_NUMBER', updated_at = NOW()
           WHERE id = ?`,
          [reminder.id]
        );
        await logHearingReminderEvent(null, "HEARING_REMINDER_SKIPPED", reminder.id, null, null, {
          reason: "Missing phone number",
        });
        continue;
      }

      // Update whatsapp_number if contact number changed
      if (activePhone !== reminder.whatsapp_number) {
        await db.query(`UPDATE hearing_reminders SET whatsapp_number = ? WHERE id = ?`, [
          activePhone,
          reminder.id,
        ]);
      }

      // 4. Build Template Variables
      const clientName =
        reminder.display_name ||
        [reminder.first_name, reminder.last_name].filter(Boolean).join(" ") ||
        "Valued Client";
      const { dateStr, timeStr } = this.formatHearingDateTimeForTemplate(
        reminder.hearing_date,
        reminder.hearing_time
      );
      const courtName = reminder.court_name || "Designated Court";
      const purpose = reminder.purpose || "Court Hearing";

      // Parameters corresponding to template:
      // {{1}} Client Name
      // {{2}} Case Number
      // {{3}} Hearing Date
      // {{4}} Hearing Time
      // {{5}} Court Name
      // {{6}} Hearing Purpose
      const parameters = [
        clientName,
        reminder.case_number || "Case",
        dateStr,
        timeStr,
        courtName,
        purpose,
      ];

      // 5. Dispatch via WhatsApp Service
      const sendResult = await whatsAppService.sendTemplateMessage({
        to: activePhone,
        templateName: reminder.template_key || "case_hearing_reminder",
        languageCode: "en",
        parameters,
      });

      if (sendResult.success) {
        // Mark SENT
        await db.query(
          `UPDATE hearing_reminders 
           SET status = 'SENT', 
               provider_message_id = ?, 
               sent_at = NOW(), 
               failure_reason = NULL,
               updated_at = NOW()
           WHERE id = ?`,
          [sendResult.providerMessageId, reminder.id]
        );

        // Record in message logs
        await db.query(
          `INSERT INTO whatsapp_message_logs (
            hearing_reminder_id, client_id, phone_number, template_key,
            provider_message_id, status, sent_at
          ) VALUES (?, ?, ?, ?, ?, 'SENT', NOW())`,
          [
            reminder.id,
            reminder.client_id,
            activePhone,
            reminder.template_key,
            sendResult.providerMessageId,
          ]
        );

        await logHearingReminderEvent(null, "HEARING_REMINDER_SENT", reminder.id, null, null, {
          providerMessageId: sendResult.providerMessageId,
          recipient: maskPhoneNumber(activePhone),
          reminderType: reminder.reminder_type,
        });

        processedCount++;
      } else {
        // Failure Handling with controlled retry
        const currentRetries = reminder.retry_count || 0;
        const isTransient = sendResult.errorCode === "NETWORK_ERROR" || sendResult.errorCode?.startsWith("HTTP_5");

        if (isTransient && currentRetries < 3) {
          // Controlled backoff: reschedule for 5 minutes later
          await db.query(
            `UPDATE hearing_reminders 
             SET status = 'SCHEDULED', 
                 retry_count = retry_count + 1,
                 scheduled_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE),
                 failure_reason = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [`Transient Failure [Attempt ${currentRetries + 1}/3]: ${sendResult.error}`, reminder.id]
          );
        } else {
          // Permanent failure or retry exhausted
          await db.query(
            `UPDATE hearing_reminders 
             SET status = 'FAILED', 
                 failed_at = NOW(), 
                 failure_reason = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [sendResult.error || "WhatsApp API send failed", reminder.id]
          );

          await db.query(
            `INSERT INTO whatsapp_message_logs (
              hearing_reminder_id, client_id, phone_number, template_key,
              status, error_code, error_message, failed_at
            ) VALUES (?, ?, ?, ?, 'FAILED', ?, ?, NOW())`,
            [
              reminder.id,
              reminder.client_id,
              activePhone,
              reminder.template_key,
              sendResult.errorCode || "API_ERROR",
              sendResult.error,
            ]
          );

          await logHearingReminderEvent(null, "HEARING_REMINDER_FAILED", reminder.id, null, null, {
            error: sendResult.error,
            errorCode: sendResult.errorCode,
            reminderType: reminder.reminder_type,
          });
        }
      }
    }

    return { processed: processedCount };
  }

  /**
   * Manual trigger by authorized chambers staff
   * @param {number} hearingId 
   * @param {number} userId 
   * @param {string} ip 
   * @param {string} userAgent 
   */
  async sendManualReminder(hearingId, userId, ip = null, userAgent = null) {
    // 1. Fetch hearing details
    const [hRows] = await db.query(
      `SELECT ch.*, cs.case_number, cs.title as case_title, crt.name as court_name
       FROM case_hearings ch
       JOIN cases cs ON ch.case_id = cs.id
       LEFT JOIN courts crt ON ch.court_id = crt.id
       WHERE ch.id = ?
       LIMIT 1`,
      [hearingId]
    );

    if (hRows.length === 0) {
      const err = new Error("Hearing not found.");
      err.statusCode = 404;
      throw err;
    }
    const hearing = hRows[0];

    if (hearing.status !== "SCHEDULED") {
      const err = new Error(`Cannot send reminder for hearing with status: ${hearing.status}`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Resolve client
    const clientInfo = await this.resolvePrimaryClientForCase(hearing.case_id);
    if (!clientInfo) {
      const err = new Error("No primary client contact associated with this case.");
      err.statusCode = 422;
      throw err;
    }

    if (!clientInfo.whatsappOptIn) {
      const err = new Error("Client has not opted in for WhatsApp notifications.");
      err.statusCode = 422;
      throw err;
    }

    if (!clientInfo.whatsappNumber) {
      const err = new Error("Client does not have a valid WhatsApp phone number on record.");
      err.statusCode = 422;
      throw err;
    }

    // 3. Idempotency Check: Prevent duplicate clicks within 5 minutes
    const [recentRows] = await db.query(
      `SELECT id, status, sent_at FROM hearing_reminders 
       WHERE hearing_id = ? AND client_id = ? AND reminder_type = 'MANUAL'
       AND (status = 'PROCESSING' OR (status = 'SENT' AND sent_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)))
       LIMIT 1`,
      [hearingId, clientInfo.clientId]
    );

    if (recentRows.length > 0) {
      const err = new Error(
        "A manual reminder was already sent or is currently processing for this hearing. Please wait before re-sending."
      );
      err.statusCode = 409;
      throw err;
    }

    // 4. Create or reuse MANUAL reminder record
    const [upsertRes] = await db.query(
      `INSERT INTO hearing_reminders (
        hearing_id, case_id, client_id, reminder_type,
        scheduled_at, status, whatsapp_number, template_key, source
      ) VALUES (?, ?, ?, 'MANUAL', NOW(), 'PROCESSING', ?, 'case_hearing_reminder', 'MANUAL')
      ON DUPLICATE KEY UPDATE
        status = 'PROCESSING',
        scheduled_at = NOW(),
        whatsapp_number = VALUES(whatsapp_number),
        source = 'MANUAL',
        updated_at = NOW()`,
      [hearingId, hearing.case_id, clientInfo.clientId, clientInfo.whatsappNumber]
    );

    const [reminderRow] = await db.query(
      `SELECT id FROM hearing_reminders WHERE hearing_id = ? AND client_id = ? AND reminder_type = 'MANUAL' LIMIT 1`,
      [hearingId, clientInfo.clientId]
    );
    const reminderId = reminderRow[0]?.id;

    // 5. Build template variables
    const { dateStr, timeStr } = this.formatHearingDateTimeForTemplate(
      hearing.hearing_date,
      hearing.hearing_time
    );

    const parameters = [
      clientInfo.clientName,
      hearing.case_number || "Case",
      dateStr,
      timeStr,
      hearing.court_name || "Designated Court",
      hearing.purpose || "Court Hearing",
    ];

    // 6. Dispatch
    const sendResult = await whatsAppService.sendTemplateMessage({
      to: clientInfo.whatsappNumber,
      templateName: "case_hearing_reminder",
      languageCode: "en",
      parameters,
    });

    if (sendResult.success) {
      await db.query(
        `UPDATE hearing_reminders 
         SET status = 'SENT', provider_message_id = ?, sent_at = NOW(), failure_reason = NULL, updated_at = NOW()
         WHERE id = ?`,
        [sendResult.providerMessageId, reminderId]
      );

      await db.query(
        `INSERT INTO whatsapp_message_logs (
          hearing_reminder_id, client_id, phone_number, template_key,
          provider_message_id, status, sent_at
        ) VALUES (?, ?, ?, 'case_hearing_reminder', ?, 'SENT', NOW())`,
        [reminderId, clientInfo.clientId, clientInfo.whatsappNumber, sendResult.providerMessageId]
      );

      await logHearingReminderEvent(userId, "HEARING_REMINDER_MANUAL_SEND", reminderId, ip, userAgent, {
        hearingId,
        providerMessageId: sendResult.providerMessageId,
        recipient: maskPhoneNumber(clientInfo.whatsappNumber),
      });

      return {
        success: true,
        message: "Manual WhatsApp reminder sent successfully.",
        providerMessageId: sendResult.providerMessageId,
      };
    } else {
      await db.query(
        `UPDATE hearing_reminders 
         SET status = 'FAILED', failed_at = NOW(), failure_reason = ?, updated_at = NOW()
         WHERE id = ?`,
        [sendResult.error, reminderId]
      );

      await db.query(
        `INSERT INTO whatsapp_message_logs (
          hearing_reminder_id, client_id, phone_number, template_key,
          status, error_code, error_message, failed_at
        ) VALUES (?, ?, ?, 'case_hearing_reminder', 'FAILED', ?, ?, NOW())`,
        [reminderId, clientInfo.clientId, clientInfo.whatsappNumber, sendResult.errorCode || "API_ERROR", sendResult.error]
      );

      await logHearingReminderEvent(userId, "HEARING_REMINDER_FAILED", reminderId, ip, userAgent, {
        hearingId,
        error: sendResult.error,
        manual: true,
      });

      const err = new Error(`Failed to send WhatsApp reminder: ${sendResult.error}`);
      err.statusCode = 502;
      throw err;
    }
  }

  /**
   * Handle webhook status event from Meta
   * @param {object} statusUpdate 
   */
  async handleWebhookStatusUpdate(statusUpdate) {
    const { messageId, status, timestamp, error } = statusUpdate;
    if (!messageId) return;

    const [reminders] = await db.query(
      `SELECT id, hearing_id, client_id, status FROM hearing_reminders WHERE provider_message_id = ? LIMIT 1`,
      [messageId]
    );

    if (reminders.length === 0) return;
    const reminder = reminders[0];

    const eventDate = new Date(timestamp * 1000);

    if (status === "DELIVERED") {
      await db.query(
        `UPDATE hearing_reminders 
         SET status = 'DELIVERED', delivered_at = ?, updated_at = NOW() 
         WHERE id = ? AND status IN ('SENT', 'DELIVERED')`,
        [eventDate, reminder.id]
      );

      await db.query(
        `UPDATE whatsapp_message_logs 
         SET status = 'DELIVERED', delivered_at = ?, updated_at = NOW()
         WHERE provider_message_id = ?`,
        [eventDate, messageId]
      );

      await logHearingReminderEvent(null, "HEARING_REMINDER_DELIVERED", reminder.id, null, null, {
        messageId,
      });
    } else if (status === "READ") {
      await db.query(
        `UPDATE hearing_reminders 
         SET status = 'READ', read_at = ?, updated_at = NOW() 
         WHERE id = ? AND status IN ('SENT', 'DELIVERED', 'READ')`,
        [eventDate, reminder.id]
      );

      await db.query(
        `UPDATE whatsapp_message_logs 
         SET status = 'READ', read_at = ?, updated_at = NOW()
         WHERE provider_message_id = ?`,
        [eventDate, messageId]
      );

      await logHearingReminderEvent(null, "HEARING_REMINDER_READ", reminder.id, null, null, {
        messageId,
      });
    } else if (status === "FAILED") {
      const reason = error?.message || "Delivery failed by Meta";
      await db.query(
        `UPDATE hearing_reminders 
         SET status = 'FAILED', failed_at = ?, failure_reason = ?, updated_at = NOW() 
         WHERE id = ?`,
        [eventDate, reason, reminder.id]
      );

      await db.query(
        `UPDATE whatsapp_message_logs 
         SET status = 'FAILED', failed_at = ?, error_code = ?, error_message = ?, updated_at = NOW()
         WHERE provider_message_id = ?`,
        [eventDate, error?.code || "WEBHOOK_FAILED", reason, messageId]
      );

      await logHearingReminderEvent(null, "HEARING_REMINDER_FAILED", reminder.id, null, null, {
        messageId,
        reason,
      });
    }
  }

  /**
   * Get all reminders for a hearing with phone masking
   * @param {number} hearingId 
   */
  async getRemindersForHearing(hearingId) {
    const [rows] = await db.query(
      `SELECT hr.*,
              cl.id as client_id,
              co.display_name, co.first_name, co.last_name, co.whatsapp_opt_in
       FROM hearing_reminders hr
       JOIN clients cl ON hr.client_id = cl.id
       JOIN contacts co ON cl.contact_id = co.id
       WHERE hr.hearing_id = ?
       ORDER BY hr.scheduled_at ASC, hr.id ASC`,
      [hearingId]
    );

    const clientInfo = await this.resolvePrimaryClientForCase(
      (await db.query(`SELECT case_id FROM case_hearings WHERE id = ?`, [hearingId]))[0]?.[0]?.case_id
    );

    return {
      hearingId: parseInt(hearingId, 10),
      primaryClient: clientInfo
        ? {
            clientId: clientInfo.clientId,
            name: clientInfo.clientName,
            whatsappOptIn: clientInfo.whatsappOptIn,
            maskedPhone: maskPhoneNumber(clientInfo.whatsappNumber || clientInfo.rawPhone),
          }
        : null,
      reminders: rows.map((r) => ({
        id: r.id,
        hearingId: r.hearing_id,
        caseId: r.case_id,
        clientId: r.client_id,
        clientName:
          r.display_name ||
          [r.first_name, r.last_name].filter(Boolean).join(" ") ||
          "Client",
        whatsappOptIn: Boolean(r.whatsapp_opt_in === 1),
        reminderType: r.reminder_type,
        scheduledAt: r.scheduled_at,
        status: r.status,
        maskedPhone: maskPhoneNumber(r.whatsapp_number),
        templateKey: r.template_key,
        providerMessageId: r.provider_message_id,
        sentAt: r.sent_at,
        deliveredAt: r.delivered_at,
        readAt: r.read_at,
        failedAt: r.failed_at,
        failureReason: r.failure_reason,
        source: r.source,
        retryCount: r.retry_count,
        createdAt: r.created_at,
      })),
    };
  }

  /**
   * Get reminder configuration rules
   */
  async getSettings() {
    const [settings] = await db.query(
      `SELECT * FROM whatsapp_hearing_reminder_settings ORDER BY offset_days DESC`
    );
    const health = whatsAppService.getHealthStatus();

    return {
      whatsappStatus: health,
      settings: settings.map((s) => ({
        id: s.id,
        reminderType: s.reminder_type,
        enabled: Boolean(s.enabled === 1),
        offsetDays: s.offset_days,
        sendTime: s.send_time,
        templateKey: s.template_key,
        updatedAt: s.updated_at,
      })),
    };
  }

  /**
   * Update reminder configuration rules
   * @param {Array<object>} updates 
   * @param {number} userId 
   */
  async updateSettings(updates, userId) {
    if (!Array.isArray(updates)) {
      const err = new Error("Updates must be an array of settings.");
      err.statusCode = 422;
      throw err;
    }

    for (const item of updates) {
      if (!item.reminderType) continue;

      const enabled = item.enabled !== undefined ? (item.enabled ? 1 : 0) : undefined;
      const sendTime = item.sendTime;

      const setClauses = [];
      const params = [];

      if (enabled !== undefined) {
        setClauses.push("enabled = ?");
        params.push(enabled);
      }
      if (sendTime) {
        setClauses.push("send_time = ?");
        params.push(sendTime);
      }

      if (setClauses.length > 0) {
        setClauses.push("updated_at = NOW()");
        params.push(item.reminderType);
        await db.query(
          `UPDATE whatsapp_hearing_reminder_settings SET ${setClauses.join(", ")} WHERE reminder_type = ?`,
          params
        );
      }
    }

    return await this.getSettings();
  }

  /**
   * Get real-time dashboard reminder aggregates (zero mock data)
   */
  async getDashboardReminderStats() {
    const [rows] = await db.query(`
      SELECT 
        SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END) as scheduled_count,
        SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_count,
        SUM(CASE WHEN status = 'READ' THEN 1 ELSE 0 END) as read_count,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count
      FROM hearing_reminders
    `);

    const stats = rows[0] || {};
    return {
      scheduled: parseInt(stats.scheduled_count, 10) || 0,
      sent: parseInt(stats.sent_count, 10) || 0,
      delivered: parseInt(stats.delivered_count, 10) || 0,
      read: parseInt(stats.read_count, 10) || 0,
      failed: parseInt(stats.failed_count, 10) || 0,
    };
  }
}

module.exports = new HearingReminderService();
