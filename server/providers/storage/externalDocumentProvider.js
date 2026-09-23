const env = require("../../config/env");

/**
 * ExternalDocumentProvider
 * Manages validation, normalization, and provider inference for external cloud storage links.
 * 
 * IMPORTANT:
 * - Does NOT fetch or download external files.
 * - Does NOT proxy external files through the backend.
 * - Enforces strict protocol security (HTTPS only by default).
 * - Prevents script and executable protocol injection (javascript:, data:, file:, etc.).
 */
class ExternalDocumentProvider {
  /**
   * Validate user-supplied external document URL
   * @param {string} rawUrl 
   * @returns {{ valid: boolean, error?: string, normalizedUrl?: string }}
   */
  validateUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
      return { valid: false, error: "External URL is required." };
    }

    const trimmed = rawUrl.trim();

    // Check for whitespace within the URL
    if (/\s/.test(trimmed)) {
      return { valid: false, error: "External URL must not contain whitespace." };
    }

    // Explicitly reject hazardous / executable protocols
    const forbiddenProtocols = ["javascript:", "data:", "file:", "vbscript:", "blob:"];
    const lower = trimmed.toLowerCase();
    for (const proto of forbiddenProtocols) {
      if (lower.startsWith(proto) || lower.includes(` ${proto}`)) {
        return {
          valid: false,
          error: `Hazardous protocol '${proto}' is strictly prohibited for security reasons.`,
        };
      }
    }

    // Parse URL with standard URL parser
    let parsedUrl;
    try {
      parsedUrl = new URL(trimmed);
    } catch (e) {
      return { valid: false, error: "Invalid URL format. Please provide a well-formed URL." };
    }

    // Protocol check
    const httpsOnly = env.storage.externalLinkHttpsOnly !== false;
    if (httpsOnly && parsedUrl.protocol !== "https:") {
      return {
        valid: false,
        error: "Only secure HTTPS URLs are permitted for legal document links.",
      };
    }

    if (!["https:", "http:"].includes(parsedUrl.protocol)) {
      return {
        valid: false,
        error: `Protocol '${parsedUrl.protocol}' is not supported. Use HTTPS.`,
      };
    }

    return {
      valid: true,
      normalizedUrl: parsedUrl.toString(),
      provider: this.getDisplayProvider(parsedUrl.toString()),
    };
  }

  /**
   * Normalize an external URL (trims, standardizes)
   * @param {string} rawUrl 
   * @returns {string}
   */
  normalizeUrl(rawUrl) {
    const validation = this.validateUrl(rawUrl);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    return validation.normalizedUrl;
  }

  /**
   * Infer external provider from domain if not provided, or normalize
   * @param {string} url 
   * @param {string|null} preferredProvider 
   * @returns {'GOOGLE_DRIVE'|'ONEDRIVE'|'DROPBOX'|'OTHER'}
   */
  getDisplayProvider(url, preferredProvider = null) {
    const validProviders = ["GOOGLE_DRIVE", "ONEDRIVE", "DROPBOX", "OTHER"];
    if (preferredProvider && validProviders.includes(preferredProvider.toUpperCase())) {
      return preferredProvider.toUpperCase();
    }

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (host.includes("drive.google.com") || host.includes("docs.google.com")) {
        return "GOOGLE_DRIVE";
      }
      if (host.includes("onedrive") || host.includes("sharepoint.com") || host.includes("1drv.ms")) {
        return "ONEDRIVE";
      }
      if (host.includes("dropbox.com")) {
        return "DROPBOX";
      }
    } catch (e) {
      // Fallback to OTHER
    }

    return "OTHER";
  }
}

module.exports = new ExternalDocumentProvider();
