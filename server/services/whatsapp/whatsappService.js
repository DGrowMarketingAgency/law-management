const crypto = require("crypto");
const { toMetaApiNumber } = require("../../utils/phoneUtils");

/**
 * Official WhatsApp Business Platform (Cloud API) Service
 * Direct integration with Meta Graph API v20.0
 * Zero unofficial libraries, zero mock successes.
 */
class WhatsAppService {
  constructor() {
    this.defaultVersion = process.env.WHATSAPP_API_VERSION || "v20.0";
    this.defaultBaseUrl =
      process.env.WHATSAPP_API_BASE_URL ||
      `https://graph.facebook.com/${this.defaultVersion}`;
  }

  /**
   * Check if WhatsApp Business API credentials are fully configured
   * @returns {boolean}
   */
  isConfigured() {
    const isEnabled = process.env.WHATSAPP_ENABLED !== "false";
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    return Boolean(
      isEnabled &&
      token &&
      token.trim() !== "" &&
      token !== "replace_this_later" &&
      phoneId &&
      phoneId.trim() !== ""
    );
  }

  /**
   * Get safe health status for chambers settings UI without exposing secrets
   */
  getHealthStatus() {
    const configured = this.isConfigured();
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const version = process.env.WHATSAPP_API_VERSION || "v20.0";
    const hasWebhookVerifyToken = Boolean(
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
    );

    return {
      configured,
      status: configured ? "CONFIGURED" : "NOT_CONFIGURED",
      provider: "OFFICIAL_META_CLOUD_API",
      apiVersion: version,
      phoneNumberIdConfigured: Boolean(phoneId),
      phoneNumberIdMasked: phoneId
        ? `${phoneId.slice(0, 4)}****${phoneId.slice(-4)}`
        : null,
      businessAccountIdConfigured: Boolean(wabaId),
      webhookVerifyTokenConfigured: hasWebhookVerifyToken,
    };
  }

  /**
   * Sends an approved template message via Meta Cloud API
   * @param {object} params
   * @param {string} params.to E.164 phone number
   * @param {string} params.templateName Approved template name e.g. 'case_hearing_reminder'
   * @param {string} params.languageCode Default 'en'
   * @param {Array<string>} params.parameters Ordered template variable strings [{{1}}, {{2}}, ...]
   * @returns {Promise<{ success: boolean, providerMessageId?: string, error?: string, errorCode?: string }>}
   */
  async sendTemplateMessage({
    to,
    templateName,
    languageCode = "en",
    parameters = [],
  }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "WhatsApp Business API is not configured on this server.",
        errorCode: "WHATSAPP_NOT_CONFIGURED",
      };
    }

    const recipientPhone = toMetaApiNumber(to);
    if (!recipientPhone || recipientPhone.length < 10) {
      return {
        success: false,
        error: "Invalid recipient phone number.",
        errorCode: "INVALID_PHONE_NUMBER",
      };
    }

    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const baseUrl = this.defaultBaseUrl;

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode || "en",
        },
        components: [
          {
            type: "body",
            parameters: parameters.map((val) => ({
              type: "text",
              text: String(val !== undefined && val !== null ? val : "-"),
            })),
          },
        ],
      },
    };

    try {
      const response = await fetch(`${baseUrl}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        const metaError = responseBody?.error;
        const errorMessage =
          metaError?.message ||
          metaError?.error_data?.details ||
          `Meta API responded with HTTP ${response.status}`;
        const errorCode = metaError?.code ? String(metaError.code) : `HTTP_${response.status}`;

        return {
          success: false,
          error: errorMessage,
          errorCode,
        };
      }

      const providerMessageId = responseBody?.messages?.[0]?.id || null;
      if (!providerMessageId) {
        return {
          success: false,
          error: "Meta API did not return a message ID.",
          errorCode: "NO_MESSAGE_ID",
        };
      }

      return {
        success: true,
        providerMessageId,
      };
    } catch (networkError) {
      return {
        success: false,
        error: `Network failure connecting to Meta Cloud API: ${networkError.message}`,
        errorCode: "NETWORK_ERROR",
      };
    }
  }

  /**
   * Verifies incoming Meta Webhook Challenge during webhook setup
   * @param {string} mode hub.mode
   * @param {string} token hub.verify_token
   * @param {string} challenge hub.challenge
   * @returns {string|null} challenge string if valid, null otherwise
   */
  verifyWebhook(mode, token, challenge) {
    const configuredToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (mode === "subscribe" && configuredToken && token === configuredToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Validates webhook signature using HMAC-SHA256 if WHATSAPP_WEBHOOK_SECRET is set
   * @param {string|Buffer} rawBody 
   * @param {string} signatureHeader e.g. 'sha256=...'
   * @returns {boolean}
   */
  validateWebhookSignature(rawBody, signatureHeader) {
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!secret) {
      // If secret is not configured, pass-through if verify token matched
      return true;
    }
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
      return false;
    }

    try {
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

      const providedSig = signatureHeader.slice(7);
      const bufProvided = Buffer.from(providedSig, "hex");
      const bufExpected = Buffer.from(expectedSig, "hex");

      if (bufProvided.length !== bufExpected.length) {
        return false;
      }

      return crypto.timingSafeEqual(bufProvided, bufExpected);
    } catch (err) {
      return false;
    }
  }

  /**
   * Parse status updates from a Meta Webhook payload
   * @param {object} payload 
   * @returns {Array<{ messageId: string, status: string, timestamp: number, recipientId: string, error?: object }>}
   */
  extractStatusUpdates(payload) {
    const updates = [];
    if (!payload || !Array.isArray(payload.entry)) return updates;

    for (const entry of payload.entry) {
      if (!Array.isArray(entry.changes)) continue;
      for (const change of entry.changes) {
        const statuses = change.value?.statuses;
        if (!Array.isArray(statuses)) continue;

        for (const st of statuses) {
          updates.push({
            messageId: st.id,
            status: String(st.status).toUpperCase(), // 'SENT', 'DELIVERED', 'READ', 'FAILED'
            timestamp: parseInt(st.timestamp, 10) || Math.floor(Date.now() / 1000),
            recipientId: st.recipient_id,
            error: st.errors?.[0] || null,
          });
        }
      }
    }
    return updates;
  }
}

module.exports = new WhatsAppService();
