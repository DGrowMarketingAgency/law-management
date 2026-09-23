const bcrypt = require("bcryptjs");

const BCRYPT_ROUNDS = 12;

/**
 * Validate password strength
 * Requirements: Minimum 8 chars, at least 1 uppercase, 1 lowercase, 1 number
 * @param {string} password
 * @returns {{ valid: boolean, message?: string }}
 */
const validatePasswordStrength = (password) => {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password is required" };
  }

  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one numeric digit" };
  }

  if (!/[!@#$%^&*(),.?":{}|<>_~\`\-+=/\\\[\]]/.test(password)) {
    return { valid: false, message: "Password must contain at least one special character (!@#$%^&*...)" };
  }

  return { valid: true };
};

/**
 * Hash a plain text password using bcrypt
 * @param {string} password
 * @returns {Promise<string>}
 */
const hashPassword = async (password) => {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
};

/**
 * Compare plain text password with stored bcrypt hash
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
const comparePassword = async (password, hash) => {
  if (!password || !hash) return false;
  return await bcrypt.compare(password, hash);
};

module.exports = {
  validatePasswordStrength,
  hashPassword,
  comparePassword,
};
