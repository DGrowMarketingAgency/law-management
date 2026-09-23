const crypto = require("crypto");

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 * @returns {string} 6-digit OTP string
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hash an OTP using SHA-256 for secure database storage
 * @param {string} otp
 * @returns {string}
 */
const hashOTP = (otp) => {
  return crypto.createHash("sha256").update(String(otp).trim()).digest("hex");
};

/**
 * Compare two hashes in constant time to prevent timing attacks
 * @param {string} hash1
 * @param {string} hash2
 * @returns {boolean}
 */
const timingSafeEqual = (hash1, hash2) => {
  if (!hash1 || !hash2) return false;
  const buf1 = Buffer.from(hash1, "utf8");
  const buf2 = Buffer.from(hash2, "utf8");
  if (buf1.length !== buf2.length) return false;
  return crypto.timingSafeEqual(buf1, buf2);
};

module.exports = {
  generateOTP,
  hashOTP,
  timingSafeEqual,
};
