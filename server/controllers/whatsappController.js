const crypto = require("crypto");
const whatsAppService = require("../services/whatsapp/whatsappService");
const hearingReminderService = require("../services/whatsapp/hearingReminderService");
const aisensyService = require("../services/whatsapp/aisensyService");
const db = require("../config/database");

/**
 * In-memory rate limiting tracker for AiSensy test endpoint
 * Max 5 test requests per hour per user/IP (Section 45)
 */
const testRateLimits = new Map();

const checkRateLimit = (key, max = 5, windowMs = 60 * 60 * 1000) => {
  const now = Date.now();
  const history = testRateLimits.get(key) || [];
  const recent = history.filter((ts) => now - ts < windowMs);

  if (recent.length >= max) {
    return false;
  }

  recent.push(now);
  testRateLimits.set(key, recent);
  return true;
};

/**
 * WhatsApp Controller for Settings, Health Status, and Webhooks
 */

// GET /api/v1/whatsapp/aisensy/status & /api/v1/whatsapp/status
const getStatus = async (req, res, next) => {
  try {
    const aisensyStatus = aisensyService.validateConfig();

    return res.status(200).json({
      success: true,
      data: {
        provider: "AISENSY",
        enabled: aisensyStatus.enabled,
        testMode: aisensyStatus.testMode,
        apiConfigured: aisensyStatus.apiKeyConfigured,
        campaignConfigured: aisensyStatus.campaignConfigured,
        campaignName: aisensyStatus.campaignName,
        testDestinationConfigured: aisensyStatus.testDestinationConfigured,
        testDestinationMasked: aisensyStatus.testDestinationMasked,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/whatsapp/aisensy/test
const testAiSensyConnection = async (req, res, next) => {
  try {
    const rateLimitKey = `aisensy_test_${req.user?.id || req.ip}`;
    if (!checkRateLimit(rateLimitKey)) {
      return res.status(429).json({
        success: false,
        message: "Test rate limit reached. Maximum 5 test messages per hour allowed.",
        error: {
          code: "AISENSY_RATE_LIMITED",
          details: "Maximum 5 test messages per hour per authorized user.",
        },
      });
    }

    const { destination, campaignName, templateParams, userName } = req.body || {};
    const targetDestination = destination || process.env.AISENSY_TEST_DESTINATION;

    if (!targetDestination) {
      return res.status(422).json({
        success: false,
        message: "Destination phone number is required.",
        error: {
          code: "INVALID_PHONE_NUMBER",
          details: "Destination must be provided in request or configured in AISENSY_TEST_DESTINATION.",
        },
      });
    }

    const result = await aisensyService.sendTestMessage({
      destination: targetDestination,
      campaignName,
      templateParams,
      userName: userName || "API Test User",
    });

    if (!result.success) {
      const code = result.error?.code;
      const statusCode =
        code === "AISENSY_NOT_CONFIGURED" || code === "AISENSY_CAMPAIGN_NOT_CONFIGURED" || code === "AISENSY_TEST_DESTINATION_NOT_CONFIGURED"
          ? 503
          : code === "INVALID_PHONE_NUMBER" || code === "DESTINATION_RESTRICTED_IN_TEST_MODE"
          ? 422
          : code === "AISENSY_UNAUTHORIZED"
          ? 401
          : code === "AISENSY_RATE_LIMITED"
          ? 429
          : code === "AISENSY_TIMEOUT"
          ? 504
          : result.error?.statusCode || 502;

      return res.status(statusCode).json({
        success: false,
        message: result.message,
        error: {
          code: result.error?.code || "AISENSY_PROVIDER_ERROR",
          details: result.error?.details,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        provider: "AISENSY",
        status: result.data?.status || "ACCEPTED",
        providerMessageId: result.data?.providerMessageId || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/whatsapp/settings
const getSettings = async (req, res, next) => {
  try {
    const data = await hearingReminderService.getSettings();
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/whatsapp/settings
const updateSettings = async (req, res, next) => {
  try {
    const { settings } = req.body;
    if (!settings || !Array.isArray(settings)) {
      return res.status(422).json({
        success: false,
        message: "Request body must include 'settings' array.",
      });
    }

    const updated = await hearingReminderService.updateSettings(settings, req.user?.id);
    return res.status(200).json({
      success: true,
      message: "WhatsApp reminder settings updated successfully.",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/webhooks/whatsapp (Meta Webhook Challenge)
const verifyWebhook = async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifiedChallenge = whatsAppService.verifyWebhook(mode, token, challenge);
  if (verifiedChallenge) {
    return res.status(200).send(verifiedChallenge);
  }

  return res.status(403).send("Verification token mismatch");
};

// POST /api/v1/webhooks/whatsapp (Meta Webhook Delivery Events)
const handleWebhook = async (req, res) => {
  const rawBody = JSON.stringify(req.body || {});
  const signature = req.headers["x-hub-signature-256"];

  // 1. Signature check if secret is configured
  if (!whatsAppService.validateWebhookSignature(rawBody, signature)) {
    console.warn("[WhatsApp Webhook] Invalid signature rejected.");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");

  try {
    // 2. Parse status updates
    const updates = whatsAppService.extractStatusUpdates(req.body);

    for (const update of updates) {
      // 3. Webhook Idempotency protection using webhook_events table
      const eventKey = `${update.messageId}_${update.status}`;
      
      const [existing] = await db.query(
        `SELECT id, processed FROM webhook_events WHERE provider = 'WHATSAPP' AND event_id = ? LIMIT 1`,
        [eventKey]
      );

      if (existing.length > 0 && existing[0].processed) {
        // Already processed duplicate event
        continue;
      }

      // Record incoming event
      const [insRes] = await db.query(
        `INSERT INTO webhook_events (provider, event_id, event_type, signature_valid, payload_hash)
         VALUES ('WHATSAPP', ?, ?, 1, ?)
         ON DUPLICATE KEY UPDATE payload_hash = VALUES(payload_hash)`,
        [eventKey, update.status, payloadHash]
      );

      // Process delivery status transition
      await hearingReminderService.handleWebhookStatusUpdate(update);

      // Mark event as processed
      await db.query(
        `UPDATE webhook_events SET processed = 1, processed_at = NOW() WHERE provider = 'WHATSAPP' AND event_id = ?`,
        [eventKey]
      );
    }

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("[WhatsApp Webhook Error]:", err.message);
    // Always return 200 to Meta so it does not endlessly retry failed parsing
    return res.status(200).json({ status: "error_logged", message: err.message });
  }
};

module.exports = {
  getStatus,
  getSettings,
  updateSettings,
  verifyWebhook,
  handleWebhook,
  testAiSensyConnection,
};
