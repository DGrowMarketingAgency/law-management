const crypto = require("crypto");
const db = require("../../config/database");
const env = require("../../config/env");

class EmailSecurityService {
  /**
   * Check hourly rate limit for emails sent to a specific recipient address
   * @param {string} recipient
   * @param {string} [templateKey]
   * @returns {Promise<{ allowed: boolean, count: number, max: number }>}
   */
  async checkRateLimit(recipient, templateKey = null) {
    let maxPerHour = env.email.rateLimitPerHour;
    // Security verification codes (2FA / OTP / Password Reset) receive a dedicated higher limit
    if (templateKey === "two_factor_code" || templateKey === "password_reset_otp") {
      maxPerHour = Math.max(maxPerHour, 20);
    }
    const normalizedRecipient = String(recipient || "").trim().toLowerCase();

    try {
      const [rows] = await db.query(
        `SELECT COUNT(*) as cnt FROM email_logs 
         WHERE recipient = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) AND status = 'SENT'`,
        [normalizedRecipient]
      );

      const count = rows[0]?.cnt || 0;
      return {
        allowed: count < maxPerHour,
        count,
        max: maxPerHour,
      };
    } catch (e) {
      console.warn("[Rate Limit Warn]: Rate limit check query error:", e.message);
      return { allowed: true, count: 0, max: maxPerHour };
    }
  }

  /**
   * Check OTP resend cooldown (60 seconds) and max resends (5)
   * @param {number} userId
   * @param {string} purpose
   * @returns {Promise<{ allowed: boolean, message?: string, remainingSeconds?: number }>}
   */
  async checkResendCooldown(userId, purpose) {
    const cooldownSec = env.otp.resendCooldownSeconds;
    const maxResends = env.otp.maxResends;

    const [rows] = await db.query(
      `SELECT id, resend_count, last_sent_at, created_at FROM otp_verifications
       WHERE user_id = ? AND purpose = ? AND verified_at IS NULL AND status = 'PENDING'
       ORDER BY created_at DESC LIMIT 1`,
      [userId, purpose]
    );

    if (rows.length === 0) {
      return { allowed: true };
    }

    const record = rows[0];
    const lastSentTime = record.last_sent_at || record.created_at;
    const elapsedSec = Math.floor((Date.now() - new Date(lastSentTime).getTime()) / 1000);

    if (elapsedSec < cooldownSec) {
      const waitTime = cooldownSec - elapsedSec;
      return {
        allowed: false,
        message: `Please wait ${waitTime} seconds before requesting another code.`,
        remainingSeconds: waitTime,
      };
    }

    if (record.resend_count >= maxResends) {
      return {
        allowed: false,
        message: "Maximum verification code resends exceeded for this session. Please try again later.",
      };
    }

    return { allowed: true, recordId: record.id, resendCount: record.resend_count };
  }

  /**
   * Generate cryptographically secure random token and its SHA-256 hash
   * @param {number} bytes
   * @returns {{ rawToken: string, tokenHash: string }}
   */
  generateSecureToken(bytes = 32) {
    const rawToken = crypto.randomBytes(bytes).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    return { rawToken, tokenHash };
  }

  /**
   * Create a single-use password reset token record
   * @param {number} userId
   * @param {string|null} ip
   * @param {string|null} userAgent
   * @returns {Promise<string>} The raw unhashed token to be embedded in reset link
   */
  async createPasswordResetToken(userId, ip = null, userAgent = null) {
    const { rawToken, tokenHash } = this.generateSecureToken(32);
    const expiresAt = new Date(Date.now() + env.passwordReset.expiresMinutes * 60 * 1000);

    // Invalidate previous active tokens for this user
    await db.query(
      `DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL`,
      [userId]
    );

    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, tokenHash, expiresAt, ip, userAgent ? String(userAgent).slice(0, 255) : null]
    );

    return rawToken;
  }

  /**
   * Verify an incoming password reset token
   * @param {string} rawToken
   * @returns {Promise<{ valid: boolean, user_id?: number, tokenId?: number, message?: string }>}
   */
  async verifyPasswordResetToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
      return { valid: false, message: "Reset token is required." };
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

    const [rows] = await db.query(
      `SELECT * FROM password_reset_tokens WHERE token_hash = ? LIMIT 1`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return { valid: false, message: "Invalid or unrecognized password reset token." };
    }

    const record = rows[0];

    if (record.used_at) {
      return { valid: false, message: "This password reset token has already been used." };
    }

    if (new Date(record.expires_at) < new Date()) {
      return { valid: false, message: "Password reset link has expired. Please request a new one." };
    }

    return {
      valid: true,
      userId: record.user_id,
      tokenId: record.id,
    };
  }

  /**
   * Mark password reset token as used (single-use enforcement)
   * @param {number} tokenId
   */
  async markPasswordResetTokenUsed(tokenId) {
    await db.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?`,
      [tokenId]
    );
  }

  /**
   * Create an authentication challenge record for 2FA or sensitive action
   * @param {number} userId
   * @param {'LOGIN_2FA'|'PASSWORD_RESET'|'EMAIL_VERIFICATION'|'SECURITY_ACTION'} purpose
   * @param {string|null} ip
   * @param {string|null} userAgent
   * @returns {Promise<string>} challengeId (UUID/hex)
   */
  async createAuthChallenge(userId, purpose, ip = null, userAgent = null) {
    const challengeId = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + env.otp.expiresMinutes * 60 * 1000);

    // Cancel old pending challenges for this user and purpose
    await db.query(
      `UPDATE auth_challenges SET status = 'CANCELLED' WHERE user_id = ? AND purpose = ? AND status = 'PENDING'`,
      [userId, purpose]
    );

    await db.query(
      `INSERT INTO auth_challenges (id, user_id, purpose, status, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, 'PENDING', ?, ?, ?)`,
      [challengeId, userId, purpose, expiresAt, ip, userAgent ? String(userAgent).slice(0, 255) : null]
    );

    return challengeId;
  }

  /**
   * Validate an auth challenge without marking it verified yet
   * @param {string} challengeId
   * @param {string} purpose
   * @returns {Promise<{ valid: boolean, userId?: number, message?: string }>}
   */
  async validateAuthChallenge(challengeId, purpose) {
    if (!challengeId) {
      return { valid: false, message: "Challenge ID is required." };
    }

    const [rows] = await db.query(
      `SELECT * FROM auth_challenges WHERE id = ? AND purpose = ? LIMIT 1`,
      [challengeId, purpose]
    );

    if (rows.length === 0) {
      return { valid: false, message: "Authentication challenge not found or invalid." };
    }

    const challenge = rows[0];

    if (challenge.status === "VERIFIED") {
      return { valid: false, message: "Authentication challenge has already been verified." };
    }

    if (challenge.status !== "PENDING") {
      return { valid: false, message: `Challenge is no longer valid (status: ${challenge.status}).` };
    }

    if (new Date(challenge.expires_at) < new Date()) {
      await db.query(`UPDATE auth_challenges SET status = 'EXPIRED' WHERE id = ?`, [challengeId]);
      return { valid: false, message: "Authentication challenge has expired. Please sign in again." };
    }

    return { valid: true, userId: challenge.user_id };
  }

  /**
   * Mark auth challenge as verified
   * @param {string} challengeId
   */
  async markAuthChallengeVerified(challengeId) {
    await db.query(
      `UPDATE auth_challenges SET status = 'VERIFIED', verified_at = NOW() WHERE id = ?`,
      [challengeId]
    );
  }

  /**
   * Legacy wrapper: validate challenge
   */
  async verifyAuthChallenge(challengeId, purpose) {
    return this.validateAuthChallenge(challengeId, purpose);
  }
}

module.exports = new EmailSecurityService();
