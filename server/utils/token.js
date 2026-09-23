const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

/**
 * Generate a short-lived JWT access token
 * Payload contains only minimal identity fields per security specifications.
 * @param {object} user
 * @returns {string}
 */
const generateAccessToken = (user) => {
  const payload = {
    sub: user.id,
    type: "access",
  };

  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
};

/**
 * Verify a JWT access token
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, env.jwt.secret);
};

/**
 * Generate a temporary token for 2FA verification step
 * Valid for 5 minutes only.
 * @param {number} userId
 * @returns {string}
 */
const generateTemp2FAToken = (userId) => {
  const payload = {
    sub: userId,
    type: "2fa_temp",
  };

  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: "5m",
  });
};

/**
 * Generate a cryptographically random refresh token (64 bytes hex)
 * @returns {string} raw refresh token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

/**
 * Compute SHA-256 hash of a token for database storage
 * @param {string} token
 * @returns {string}
 */
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  generateTemp2FAToken,
  generateRefreshToken,
  hashToken,
};
