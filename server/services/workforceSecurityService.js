const crypto = require("crypto");
const env = require("../config/env");

/**
 * WorkforceSecurityService
 * Provides AES-256-GCM encryption and masking for sensitive financial and identity records.
 */
class WorkforceSecurityService {
  static getMasterKey() {
    // Derive a reliable 32-byte key from APP_SECRET or JWT_SECRET
    const secret = env.JWT_SECRET || env.APP_SECRET || "default_secure_legal_key_32_bytes!!";
    return crypto.createHash("sha256").update(secret).digest();
  }

  /**
   * Encrypt sensitive string
   * @param {string} text 
   * @returns {string} iv:authTag:encryptedHex
   */
  static encrypt(text) {
    if (!text) return null;
    const key = this.getMasterKey();
    const iv = crypto.randomBytes(12); // standard 96-bit IV for GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt sensitive string
   * @param {string} cipherText 
   * @returns {string}
   */
  static decrypt(cipherText) {
    if (!cipherText || !cipherText.includes(":")) return null;
    try {
      const [ivHex, authTagHex, encryptedHex] = cipherText.split(":");
      const key = this.getMasterKey();
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(ivHex, "hex")
      );
      decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (e) {
      console.error("[WorkforceSecurityService Decrypt Error]:", e.message);
      return null;
    }
  }

  /**
   * Mask account number: e.g. "•••• •••• 4567"
   */
  static maskAccountNumber(accountNumber) {
    if (!accountNumber) return "";
    const clean = String(accountNumber).trim();
    if (clean.length <= 4) return clean;
    const last4 = clean.slice(-4);
    return `•••• •••• ${last4}`;
  }

  /**
   * Mask IFSC code: e.g. "SBIN••••456"
   */
  static maskIfsc(ifsc) {
    if (!ifsc) return "";
    const clean = String(ifsc).trim();
    if (clean.length <= 4) return clean;
    const first4 = clean.slice(0, 4);
    const last3 = clean.slice(-3);
    return `${first4}••••${last3}`;
  }
}

module.exports = WorkforceSecurityService;
