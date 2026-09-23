const { maskPhoneNumber, normalizeWhatsAppNumber } = require("../../utils/phoneUtils");

/**
 * AiSensy WhatsApp Business API Service
 * Encapsulates outbound campaign messaging, environment diagnostics, 
 * safe error normalization, retry handling, and strict test-mode safety gating.
 */
class AiSensyService {
  constructor() {
    this.defaultApiUrl = "https://backend.aisensy.com/campaign/t1/api/v2";
  }

  /**
   * Safe check of AiSensy configuration status without leaking secrets.
   * @returns {object}
   */
  validateConfig() {
    const isEnabled = process.env.AISENSY_ENABLED === "true";
    const isTestMode = process.env.AISENSY_TEST_MODE !== "false"; // Defaults to true for safety
    const apiKey = process.env.AISENSY_API_KEY;
    const campaignName = process.env.AISENSY_CAMPAIGN_NAME;
    const testDestination = process.env.AISENSY_TEST_DESTINATION;
    const apiUrl = process.env.AISENSY_API_URL || this.defaultApiUrl;
    const timeoutMs = parseInt(process.env.AISENSY_TIMEOUT_MS, 10) || 15000;
    const maxRetries = parseInt(process.env.AISENSY_MAX_RETRIES, 10) || 3;

    const apiKeyConfigured = Boolean(
      apiKey &&
      typeof apiKey === "string" &&
      apiKey.trim() !== "" &&
      apiKey !== "replace_this_later"
    );

    const campaignConfigured = Boolean(
      campaignName &&
      typeof campaignName === "string" &&
      campaignName.trim() !== ""
    );

    const testDestinationConfigured = Boolean(
      testDestination &&
      typeof testDestination === "string" &&
      testDestination.trim() !== ""
    );

    return {
      provider: "AISENSY",
      enabled: isEnabled,
      testMode: isTestMode,
      configured: isEnabled && apiKeyConfigured,
      apiConfigured: apiKeyConfigured,
      apiKeyConfigured,
      campaignConfigured,
      campaignName: campaignConfigured ? campaignName.trim() : null,
      testDestinationConfigured,
      testDestinationMasked: testDestinationConfigured ? maskPhoneNumber(testDestination.trim()) : null,
      apiUrl,
      timeoutMs,
      maxRetries,
    };
  }

  /**
   * Quick boolean readiness check
   * @returns {{ ready: boolean, reason?: string }}
   */
  checkConfiguration() {
    const config = this.validateConfig();
    if (!config.apiKeyConfigured) {
      return { ready: false, code: "AISENSY_NOT_CONFIGURED", reason: "API key is not configured" };
    }
    if (!config.campaignConfigured) {
      return { ready: false, code: "AISENSY_CAMPAIGN_NOT_CONFIGURED", reason: "Campaign name is not configured" };
    }
    return { ready: true };
  }

  /**
   * Validate destination phone number format (E.164 with + and country code)
   * @param {string} destination 
   * @returns {{ valid: boolean, cleaned?: string, error?: string }}
   */
  validateDestination(destination) {
    if (!destination || typeof destination !== "string") {
      return { valid: false, error: "Destination phone number is required." };
    }

    const trimmed = destination.trim();
    // Valid international format with leading + (10 to 15 digits)
    const phoneRegex = /^\+[1-9]\d{9,14}$/;

    if (!phoneRegex.test(trimmed)) {
      return {
        valid: false,
        error: "Destination must be in valid international format with country code (e.g. +91XXXXXXXXXX).",
      };
    }

    return { valid: true, cleaned: trimmed };
  }

  /**
   * Normalizes raw successful provider response into standard application format
   * @param {object} responseBody 
   * @param {number} statusCode 
   * @returns {object}
   */
  normalizeProviderResponse(responseBody, statusCode = 200) {
    const providerMessageId =
      responseBody?.messageId ||
      responseBody?.data?.messageId ||
      responseBody?.id ||
      responseBody?.data?.id ||
      null;

    const rawStatus = responseBody?.status || responseBody?.data?.status || "ACCEPTED";

    return {
      provider: "AISENSY",
      status: "ACCEPTED",
      providerMessageId,
      rawStatus,
      statusCode,
    };
  }

  /**
   * Normalizes and sanitizes provider error responses, ensuring no secret exposure
   * @param {Error|object} error 
   * @param {number} [statusCode] 
   * @param {object} [responseBody] 
   * @returns {object}
   */
  normalizeProviderError(error, statusCode = 500, responseBody = {}) {
    const apiKey = process.env.AISENSY_API_KEY || "";
    let code = "AISENSY_PROVIDER_ERROR";
    let message = "AiSensy provider encountered an error";
    let isTransient = false;

    if (error?.name === "TimeoutError" || error?.name === "AbortError" || error?.code === "ETIMEDOUT") {
      code = "AISENSY_TIMEOUT";
      message = "AiSensy did not respond within the allowed time.";
      isTransient = true;
    } else if (statusCode === 401 || statusCode === 403) {
      code = "AISENSY_UNAUTHORIZED";
      message = "AiSensy rejected the request due to invalid API credentials.";
      isTransient = false;
    } else if (statusCode === 429) {
      code = "AISENSY_RATE_LIMITED";
      message = "AiSensy rate limit exceeded. Please retry later.";
      isTransient = true;
    } else if (statusCode === 400) {
      const rawText = JSON.stringify(responseBody || "").toLowerCase();
      if (rawText.includes("campaign") || rawText.includes("template")) {
        code = "AISENSY_CAMPAIGN_ERROR";
        message = "Configured campaign was rejected or not found in AiSensy.";
      } else if (rawText.includes("destination") || rawText.includes("phone") || rawText.includes("recipient")) {
        code = "AISENSY_INVALID_DESTINATION";
        message = "Destination phone number was rejected by AiSensy.";
      } else {
        code = "AISENSY_BAD_REQUEST";
        message = "AiSensy rejected the request payload.";
      }
      isTransient = false;
    } else if (statusCode === 404) {
      code = "AISENSY_CAMPAIGN_ERROR";
      message = "The requested AiSensy resource or campaign endpoint was not found.";
      isTransient = false;
    } else if (statusCode >= 500) {
      code = "AISENSY_PROVIDER_ERROR";
      message = "AiSensy server error. Transient failure.";
      isTransient = true;
    }

    // Extract detail string and strictly redact apiKey
    let rawDetails =
      responseBody?.message ||
      responseBody?.error ||
      responseBody?.details ||
      error?.message ||
      "Provider error";

    if (typeof rawDetails === "object") {
      rawDetails = JSON.stringify(rawDetails);
    }
    const safeDetails = apiKey
      ? String(rawDetails).split(apiKey).join("[REDACTED]")
      : String(rawDetails);

    return {
      code,
      message,
      details: safeDetails,
      statusCode,
      isTransient,
    };
  }

  /**
   * Executes HTTP POST against AiSensy API with timeout and retry logic
   * @private
   */
  async _executePost(payload, timeoutMs = 15000, maxRetries = 3) {
    const apiUrl = process.env.AISENSY_API_URL || this.defaultApiUrl;
    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        });

        const responseBody = await response.json().catch(() => ({}));

        if (!response.ok) {
          const normalized = this.normalizeProviderError(null, response.status, responseBody);
          // Only retry transient errors
          if (normalized.isTransient && attempt <= maxRetries) {
            console.warn(`[AiSensy] Attempt ${attempt}/${maxRetries + 1} failed (${normalized.code}). Retrying in 1s...`);
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            lastError = normalized;
            continue;
          }
          return {
            success: false,
            message: normalized.message,
            error: normalized,
          };
        }

        // 200 OK
        const normalized = this.normalizeProviderResponse(responseBody, response.status);
        return {
          success: true,
          message: "AiSensy request accepted",
          data: normalized,
        };
      } catch (err) {
        const normalized = this.normalizeProviderError(err, 500, {});
        if (normalized.isTransient && attempt <= maxRetries) {
          console.warn(`[AiSensy] Attempt ${attempt}/${maxRetries + 1} network error (${normalized.code}). Retrying in 1s...`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          lastError = normalized;
          continue;
        }
        return {
          success: false,
          message: normalized.message,
          error: normalized,
        };
      }
    }

    return {
      success: false,
      message: lastError?.message || "AiSensy request failed after retries",
      error: lastError || { code: "AISENSY_PROVIDER_ERROR", details: "Max retries exhausted" },
    };
  }

  /**
   * Generic Campaign Template Dispatcher
   * @param {object} params
   * @param {string} params.destination
   * @param {string} [params.campaignName]
   * @param {Array<string>} [params.templateParams]
   * @param {string} [params.userName]
   * @returns {Promise<object>}
   */
  async sendTemplateMessage({
    destination,
    campaignName = null,
    templateParams = [],
    userName = "Valued Client",
  }) {
    // 1. Config validation
    const configCheck = this.checkConfiguration();
    if (!configCheck.ready) {
      return {
        success: false,
        message: configCheck.reason,
        error: { code: configCheck.code, details: configCheck.reason },
      };
    }

    // 2. Phone validation
    const phoneCheck = this.validateDestination(destination);
    if (!phoneCheck.valid) {
      return {
        success: false,
        message: "Invalid recipient phone number",
        error: { code: "INVALID_PHONE_NUMBER", details: phoneCheck.error },
      };
    }

    const cleanDestination = phoneCheck.cleaned;
    const targetCampaign = (campaignName || process.env.AISENSY_CAMPAIGN_NAME || "").trim();
    const apiKey = process.env.AISENSY_API_KEY;
    const timeoutMs = parseInt(process.env.AISENSY_TIMEOUT_MS, 10) || 15000;
    const maxRetries = parseInt(process.env.AISENSY_MAX_RETRIES, 10) || 3;

    const payload = {
      apiKey,
      campaignName: targetCampaign,
      destination: cleanDestination,
      userName: String(userName || "Valued Client").trim(),
      templateParams: Array.isArray(templateParams) ? templateParams : [],
    };

    return this._executePost(payload, timeoutMs, maxRetries);
  }

  /**
   * Manual Real API Test Message
   * Strictly enforces destination safety: when AISENSY_TEST_MODE=true,
   * only AISENSY_TEST_DESTINATION is accepted.
   * @param {object} params
   * @param {string} params.destination
   * @param {string} [params.campaignName]
   * @param {Array<string>} [params.templateParams]
   * @param {string} [params.userName]
   * @returns {Promise<object>}
   */
  async sendTestMessage({
    destination,
    campaignName = null,
    templateParams = null,
    userName = "API Test User",
  }) {
    const isTestMode = process.env.AISENSY_TEST_MODE !== "false";
    const allowedTestDestination = (process.env.AISENSY_TEST_DESTINATION || "").trim();

    // 1. Check basic configuration
    const config = this.validateConfig();
    if (!config.apiKeyConfigured) {
      return {
        success: false,
        message: "AiSensy is not configured.",
        error: {
          code: "AISENSY_NOT_CONFIGURED",
          details: "AISENSY_API_KEY is missing or empty.",
        },
      };
    }

    const targetCampaign = (campaignName || process.env.AISENSY_CAMPAIGN_NAME || "").trim();
    if (!targetCampaign) {
      return {
        success: false,
        message: "AiSensy campaign is not configured.",
        error: {
          code: "AISENSY_CAMPAIGN_NOT_CONFIGURED",
          details: "AISENSY_CAMPAIGN_NAME must be configured.",
        },
      };
    }

    // 2. Destination Validation
    const phoneCheck = this.validateDestination(destination);
    if (!phoneCheck.valid) {
      return {
        success: false,
        message: "Invalid recipient phone number",
        error: {
          code: "INVALID_PHONE_NUMBER",
          details: phoneCheck.error,
        },
      };
    }

    const cleanDestination = phoneCheck.cleaned;

    // 3. STRICT TEST-MODE DESTINATION SAFETY GATE
    if (isTestMode) {
      if (!allowedTestDestination) {
        return {
          success: false,
          message: "AiSensy test destination is not configured in environment.",
          error: {
            code: "AISENSY_TEST_DESTINATION_NOT_CONFIGURED",
            details: "AISENSY_TEST_DESTINATION must be set in environment when in test mode.",
          },
        };
      }

      if (cleanDestination !== allowedTestDestination) {
        return {
          success: false,
          message: "Destination is restricted in test mode.",
          error: {
            code: "DESTINATION_RESTRICTED_IN_TEST_MODE",
            details: `In test mode, messages may only be sent to the configured test number (${maskPhoneNumber(allowedTestDestination)}).`,
          },
        };
      }
    }

    // 4. Default Test Variables (as specified in Section 13)
    const testVariables = Array.isArray(templateParams) && templateParams.length > 0
      ? templateParams
      : [
          "API Test User",        // Client Name
          "TEST-CASE-001",        // Case Number
          "20 September 2026",    // Hearing Date
          "10:30 AM",             // Hearing Time
          "Test Court",           // Court Name
          "Hearing Reminder Test" // Purpose
        ];

    const maskedPhone = maskPhoneNumber(cleanDestination);
    console.log(`[AiSensy Test] Dispatching test message to ${maskedPhone} [Campaign: ${targetCampaign}]`);

    const payload = {
      apiKey: process.env.AISENSY_API_KEY,
      campaignName: targetCampaign,
      destination: cleanDestination,
      userName: String(userName || "API Test User").trim(),
      templateParams: testVariables,
    };

    const timeoutMs = parseInt(process.env.AISENSY_TIMEOUT_MS, 10) || 15000;
    const maxRetries = parseInt(process.env.AISENSY_MAX_RETRIES, 10) || 3;

    return this._executePost(payload, timeoutMs, maxRetries);
  }
}

module.exports = new AiSensyService();
