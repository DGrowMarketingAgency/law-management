const { isValidDateString } = require("../utils/dateUtils");

/**
 * Validates calculate limitation request
 */
const validateCalculateInput = (body) => {
  const errors = [];
  if (!body.trigger_date || !isValidDateString(body.trigger_date)) {
    errors.push("A valid trigger_date (YYYY-MM-DD) is required.");
  }
  if (!body.deadline_rule_id && !body.rule_id) {
    errors.push("A valid deadline_rule_id is required for limitation calculation.");
  }
  return errors;
};

/**
 * Validates create case deadline request
 */
const validateCreateDeadlineInput = (body) => {
  const errors = [];
  if (!body.trigger_date || !isValidDateString(body.trigger_date)) {
    errors.push("A valid trigger_date (YYYY-MM-DD) is required.");
  }

  if (body.is_manual) {
    if (!body.manual_deadline || !isValidDateString(body.manual_deadline)) {
      errors.push("A valid manual_deadline (YYYY-MM-DD) is required for manual entries.");
    }
    if (!body.manual_reason || String(body.manual_reason).trim() === "") {
      errors.push("A manual_reason justification is mandatory for manual entries.");
    }
  } else {
    if (!body.deadline_rule_id) {
      errors.push("deadline_rule_id is required unless is_manual is true.");
    }
  }

  if (body.priority && !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(body.priority)) {
    errors.push("priority must be one of: LOW, MEDIUM, HIGH, CRITICAL.");
  }

  return errors;
};

/**
 * Validates override deadline request
 */
const validateOverrideInput = (body) => {
  const errors = [];
  if (!body.override_deadline || !isValidDateString(body.override_deadline)) {
    errors.push("A valid override_deadline (YYYY-MM-DD) is required.");
  }
  if (!body.reason || String(body.reason).trim() === "") {
    errors.push("A professional legal justification (reason) is mandatory for overrides.");
  }
  return errors;
};

/**
 * Validates waiver request
 */
const validateWaiveInput = (body) => {
  const errors = [];
  if (!body.reason || String(body.reason).trim() === "") {
    errors.push("A waiver justification (reason) is mandatory.");
  }
  return errors;
};

/**
 * Validates rule creation or update input
 */
const validateRuleInput = (body) => {
  const errors = [];
  if (!body.act_name || String(body.act_name).trim() === "") {
    errors.push("act_name is required.");
  }
  if (!body.proceeding_type || String(body.proceeding_type).trim() === "") {
    errors.push("proceeding_type is required.");
  }
  if (!body.trigger_type || String(body.trigger_type).trim() === "") {
    errors.push("trigger_type is required.");
  }

  const days = parseInt(body.limitation_days, 10);
  const months = parseInt(body.limitation_months, 10);
  const years = parseInt(body.limitation_years, 10);

  const hasValidDays = Number.isInteger(days) && days > 0;
  const hasValidMonths = Number.isInteger(months) && months > 0;
  const hasValidYears = Number.isInteger(years) && years > 0;

  if (!hasValidDays && !hasValidMonths && !hasValidYears) {
    errors.push("At least one limitation period (limitation_days, limitation_months, or limitation_years) must be a positive integer.");
  }

  return errors;
};

module.exports = {
  validateCalculateInput,
  validateCreateDeadlineInput,
  validateOverrideInput,
  validateWaiveInput,
  validateRuleInput,
};
