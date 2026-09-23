const { ALLOWED_FEE_TYPES } = require("../services/feeEntryService");

const validateCreateFeeEntry = (body) => {
  const errors = [];

  if (!body.client_id || isNaN(parseInt(body.client_id, 10))) {
    errors.push("client_id must be a valid integer ID.");
  }

  if (!body.description || !String(body.description).trim()) {
    errors.push("description is required.");
  }

  if (!body.service_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.service_date)) {
    errors.push("service_date must be in YYYY-MM-DD format.");
  }

  if (body.fee_type && !ALLOWED_FEE_TYPES.includes(body.fee_type)) {
    errors.push(`fee_type must be one of: ${ALLOWED_FEE_TYPES.join(", ")}`);
  }

  if (body.fee_type === "TIME") {
    if (!body.duration_minutes || isNaN(parseInt(body.duration_minutes, 10)) || parseInt(body.duration_minutes, 10) <= 0) {
      errors.push("duration_minutes must be a positive integer for TIME billing.");
    }
    if (body.hourly_rate !== undefined && (isNaN(Number(body.hourly_rate)) || Number(body.hourly_rate) <= 0)) {
      errors.push("hourly_rate must be a positive number.");
    }
  }

  if (body.fee_type === "APPEARANCE") {
    if (body.hearing_id !== undefined && (isNaN(parseInt(body.hearing_id, 10)) || parseInt(body.hearing_id, 10) <= 0)) {
      errors.push("hearing_id must be a valid integer.");
    }
  }

  return errors;
};

const validateUpdateFeeEntry = (body) => {
  const errors = [];

  if (body.service_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.service_date)) {
    errors.push("service_date must be in YYYY-MM-DD format.");
  }

  if (body.fee_type && !ALLOWED_FEE_TYPES.includes(body.fee_type)) {
    errors.push(`fee_type must be one of: ${ALLOWED_FEE_TYPES.join(", ")}`);
  }

  return errors;
};

module.exports = {
  validateCreateFeeEntry,
  validateUpdateFeeEntry,
};
