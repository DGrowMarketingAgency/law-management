const db = require("../config/database");
const env = require("../config/env");
const { generateOTP, hashOTP, timingSafeEqual } = require("../utils/otp");
const emailSecurityService = require("./email/emailSecurityService");

/**
 * Generate a new single-use OTP for a user and purpose
 * Automatically expires any previous unverified OTPs for that user and purpose.
 * @param {number} userId
 * @param {'LOGIN'|'PASSWORD_RESET'|'TWO_FACTOR_SETUP'|'TWO_FACTOR'|'EMAIL_VERIFICATION'|'INVITATION'} purpose
 * @returns {Promise<string>} The raw 6-digit OTP
 */
const createOTP = async (userId, purpose) => {
  const otp = generateOTP();
  const otpHash = hashOTP(otp);
  const expiresAt = new Date(Date.now() + env.otp.expiresMinutes * 60 * 1000);

  // Invalidate any existing unverified OTP for this user and purpose
  await db.query(
    `UPDATE otp_verifications SET status = 'EXPIRED'
     WHERE user_id = ? AND purpose = ? AND verified_at IS NULL AND status = 'PENDING'`,
    [userId, purpose]
  );

  // Insert new OTP record with hash
  await db.query(
    `INSERT INTO otp_verifications (user_id, purpose, otp_hash, expires_at, attempt_count, resend_count, last_sent_at, status)
     VALUES (?, ?, ?, ?, 0, 0, NOW(), 'PENDING')`,
    [userId, purpose, otpHash, expiresAt]
  );

  return otp;
};

/**
 * Resend OTP with cooldown enforcement
 * @param {number} userId
 * @param {string} purpose
 * @returns {Promise<{ allowed: boolean, otp?: string, message?: string, remainingSeconds?: number }>}
 */
const resendOTP = async (userId, purpose) => {
  const cooldownCheck = await emailSecurityService.checkResendCooldown(userId, purpose);
  if (!cooldownCheck.allowed) {
    return cooldownCheck;
  }

  const otp = generateOTP();
  const otpHash = hashOTP(otp);
  const expiresAt = new Date(Date.now() + env.otp.expiresMinutes * 60 * 1000);

  if (cooldownCheck.recordId) {
    await db.query(
      `UPDATE otp_verifications SET 
        otp_hash = ?, 
        expires_at = ?, 
        attempt_count = 0,
        resend_count = resend_count + 1,
        last_sent_at = NOW(),
        status = 'PENDING'
       WHERE id = ?`,
      [otpHash, expiresAt, cooldownCheck.recordId]
    );
  } else {
    await db.query(
      `INSERT INTO otp_verifications (user_id, purpose, otp_hash, expires_at, attempt_count, resend_count, last_sent_at, status)
       VALUES (?, ?, ?, ?, 0, 1, NOW(), 'PENDING')`,
      [userId, purpose, otpHash, expiresAt]
    );
  }

  return { allowed: true, otp };
};

/**
 * Verify an incoming OTP for a user and purpose
 * Checks:
 * 1. Record exists and not already verified
 * 2. Not expired
 * 3. Attempt count < maxAttempts
 * 4. Timing-safe hash comparison
 * @param {number} userId
 * @param {string} purpose
 * @param {string} inputOtp
 * @returns {Promise<{ valid: boolean, message?: string }>}
 */
const verifyOTP = async (userId, purpose, inputOtp) => {
  if (!inputOtp || String(inputOtp).trim().length === 0) {
    return { valid: false, message: "OTP is required" };
  }

  const [rows] = await db.query(
    `SELECT id, otp_hash, expires_at, attempt_count, verified_at, status
     FROM otp_verifications
     WHERE user_id = ? AND purpose = ? AND verified_at IS NULL AND status = 'PENDING'
     ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose]
  );

  if (!rows || rows.length === 0) {
    return { valid: false, message: "No active verification request found. Please request a new code." };
  }

  const record = rows[0];

  // 1. Check max attempts
  if (record.attempt_count >= env.otp.maxAttempts) {
    await db.query(`UPDATE otp_verifications SET status = 'FAILED' WHERE id = ?`, [record.id]);
    return { valid: false, message: "Maximum verification attempts exceeded. Please request a new code." };
  }

  // 2. Check expiration
  if (new Date(record.expires_at) < new Date()) {
    await db.query(`UPDATE otp_verifications SET status = 'EXPIRED' WHERE id = ?`, [record.id]);
    return { valid: false, message: "Verification code has expired. Please request a new code." };
  }

  // 3. Hash input and compare
  const inputHash = hashOTP(inputOtp);
  const isMatch = timingSafeEqual(record.otp_hash, inputHash);

  if (!isMatch) {
    const nextAttempts = record.attempt_count + 1;
    const isExceeded = nextAttempts >= env.otp.maxAttempts;
    await db.query(
      `UPDATE otp_verifications SET attempt_count = ?, status = ? WHERE id = ?`,
      [nextAttempts, isExceeded ? "FAILED" : "PENDING", record.id]
    );

    const remaining = env.otp.maxAttempts - nextAttempts;
    const attemptWarning = remaining > 0 ? ` (${remaining} attempts remaining)` : " (No attempts remaining)";
    return { valid: false, message: `Invalid verification code${attemptWarning}.` };
  }

  // 4. Mark verified
  await db.query(
    `UPDATE otp_verifications SET verified_at = NOW(), status = 'VERIFIED' WHERE id = ?`,
    [record.id]
  );

  return { valid: true };
};

module.exports = {
  createOTP,
  resendOTP,
  verifyOTP,
};
