const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Validate GSTIN format without claiming government verification
 * @param {string} gstin
 * @returns {'GSTIN_NOT_PROVIDED'|'GSTIN_VALID_FORMAT'|'GSTIN_INVALID_FORMAT'}
 */
const validateGstinFormat = (gstin) => {
  if (!gstin || !String(gstin).trim()) return "GSTIN_NOT_PROVIDED";
  const trimmed = String(gstin).trim().toUpperCase();
  return GSTIN_REGEX.test(trimmed) ? "GSTIN_VALID_FORMAT" : "GSTIN_INVALID_FORMAT";
};

const validateCreateInvoice = (body) => {
  const errors = [];

  // Normalize invoice_date from issue_date if provided
  if (!body.invoice_date && body.issue_date) {
    body.invoice_date = body.issue_date;
  }
  if (body.invoice_date) {
    const match = String(body.invoice_date).match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (match) {
      body.invoice_date = `${match[3]}-${match[2]}-${match[1]}`;
    }
  }
  if (body.due_date) {
    const match = String(body.due_date).match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (match) {
      body.due_date = `${match[3]}-${match[2]}-${match[1]}`;
    }
  }

  if (!body.client_id || isNaN(parseInt(body.client_id, 10))) {
    errors.push("client_id must be a valid integer ID.");
  }

  if (!body.invoice_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.invoice_date)) {
    errors.push("invoice_date must be in YYYY-MM-DD format.");
  }

  if (!body.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)) {
    errors.push("due_date must be in YYYY-MM-DD format.");
  }

  if (body.invoice_date && body.due_date && new Date(body.due_date) < new Date(body.invoice_date)) {
    errors.push("due_date cannot be earlier than invoice_date.");
  }

  if (body.discount_type && !["PERCENTAGE", "FIXED"].includes(body.discount_type)) {
    errors.push("discount_type must be either 'PERCENTAGE' or 'FIXED'.");
  }

  if (body.discount_type === "PERCENTAGE") {
    const val = Number(body.discount_value);
    if (isNaN(val) || val < 0 || val > 100) {
      errors.push("Percentage discount must be between 0 and 100.");
    }
  } else if (body.discount_value !== undefined) {
    const val = Number(body.discount_value);
    if (isNaN(val) || val < 0) {
      errors.push("Fixed discount must be a non-negative number.");
    }
  }

  if (body.gst_mode && !["STANDARD", "RCM", "EXEMPT", "NOT_APPLICABLE", "MANUAL_REVIEW"].includes(body.gst_mode)) {
    errors.push("gst_mode must be one of: STANDARD, RCM, EXEMPT, NOT_APPLICABLE, MANUAL_REVIEW.");
  }

  if (body.client_gstin) {
    const gstinStatus = validateGstinFormat(body.client_gstin);
    if (gstinStatus === "GSTIN_INVALID_FORMAT") {
      errors.push("Client GSTIN format is invalid. Must be 15 alphanumeric characters (e.g. 33AAAAA0000A1Z5).");
    }
  }

  const customItemsList = body.custom_items || body.items || [];
  const hasFeeEntries = Array.isArray(body.fee_entry_ids) && body.fee_entry_ids.length > 0;
  const hasCustomItems = Array.isArray(customItemsList) && customItemsList.length > 0;

  if (!hasFeeEntries && !hasCustomItems) {
    errors.push("Invoice must contain at least one billable fee entry (fee_entry_ids) or line item (custom_items).");
  }

  return errors;
};

module.exports = {
  validateGstinFormat,
  validateCreateInvoice,
};
