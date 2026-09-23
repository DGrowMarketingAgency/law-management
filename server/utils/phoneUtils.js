/**
 * Phone Number Utilities for WhatsApp and Messaging
 * Ensures compliance with canonical international E.164 formats
 * and Meta WhatsApp Cloud API requirements.
 */

/**
 * Normalizes a phone number to canonical international format (e.g. +91XXXXXXXXXX for India)
 * @param {string} phone 
 * @param {string} defaultCountryCode Defaults to '91' (India)
 * @returns {string|null}
 */
const normalizeWhatsAppNumber = (phone, defaultCountryCode = "91") => {
  if (!phone || typeof phone !== "string") return null;

  // Strip all non-digit characters except leading '+'
  let trimmed = phone.trim();
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  if (!digits) return null;

  // Handle leading 0 (common in India: e.g. 09876543210)
  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  // If 10 digits without country code, prefix default country code
  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`;
  }

  // If starts with 91 and is 12 digits (e.g. 919876543210)
  if (digits.length === 12 && digits.startsWith(defaultCountryCode)) {
    return `+${digits}`;
  }

  // If international with leading plus already provided
  if (hasPlus) {
    return `+${digits}`;
  }

  // Fallback: standard canonical with leading +
  return `+${digits}`;
};

/**
 * Formats canonical number for Meta WhatsApp Cloud API (digits only, no '+')
 * e.g., '+919876543210' -> '919876543210'
 * @param {string} canonicalPhone 
 * @returns {string}
 */
const toMetaApiNumber = (canonicalPhone) => {
  if (!canonicalPhone) return "";
  return String(canonicalPhone).replace(/\D/g, "");
};

/**
 * Masks a phone number for UI privacy
 * e.g., '+919876543210' -> '+91******3210'
 * @param {string} phone 
 * @returns {string}
 */
const maskPhoneNumber = (phone) => {
  if (!phone) return "-";
  const str = String(phone).trim();
  if (str.length < 8) return str;

  // Keep first 3 characters (e.g. '+91') and last 4 characters
  const start = str.slice(0, 3);
  const end = str.slice(-4);
  const maskedMiddle = "*".repeat(Math.max(3, str.length - 7));
  return `${start}${maskedMiddle}${end}`;
};

module.exports = {
  normalizeWhatsAppNumber,
  toMetaApiNumber,
  maskPhoneNumber,
};
