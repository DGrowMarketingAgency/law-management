const {
  isValidDateString,
  getTodayDateString,
  addCalendarDays,
  addCalendarMonths,
  addCalendarYears,
  diffCalendarDays,
} = require("../utils/dateUtils");

const MANDATORY_DISCLAIMER =
  "System-generated limitation date. Verify against the applicable law, facts, exclusions, extensions, court orders, and professional legal judgment.";

/**
 * Validates a limitation rule for active status and period validity.
 * @param {object} rule
 */
const validateRule = (rule) => {
  if (!rule) {
    throw new Error("Applicable limitation rule not configured. Manual deadline entry is required.");
  }

  if (!rule.is_active && rule.is_active !== 1) {
    throw new Error("The selected limitation rule is inactive. Manual deadline entry is required.");
  }

  const hasDays = Number.isInteger(rule.limitation_days) && rule.limitation_days > 0;
  const hasMonths = Number.isInteger(rule.limitation_months) && rule.limitation_months > 0;
  const hasYears = Number.isInteger(rule.limitation_years) && rule.limitation_years > 0;

  if (!hasDays && !hasMonths && !hasYears) {
    throw new Error("Limitation rule period is not properly defined in days, months, or years.");
  }

  return true;
};

/**
 * Calculates a limitation deadline given a trigger date and a verified rule.
 * Uses pure calendar arithmetic without UTC timezone shifts.
 * @param {string} triggerDate - YYYY-MM-DD
 * @param {object} rule - Record from deadline_rules
 * @param {string} notes - Optional user notes
 * @returns {object} Calculation output
 */
const calculateDeadline = (triggerDate, rule, notes = "") => {
  if (!isValidDateString(triggerDate)) {
    throw new Error("Invalid trigger date format. Expected YYYY-MM-DD.");
  }

  validateRule(rule);

  let calculatedDeadline = triggerDate;
  let calculationMethod = "";
  let periodDescription = "";

  if (Number.isInteger(rule.limitation_years) && rule.limitation_years > 0) {
    calculatedDeadline = addCalendarYears(triggerDate, rule.limitation_years);
    calculationMethod = "CALENDAR_YEARS";
    periodDescription = `${rule.limitation_years} Year(s)`;
  } else if (Number.isInteger(rule.limitation_months) && rule.limitation_months > 0) {
    calculatedDeadline = addCalendarMonths(triggerDate, rule.limitation_months);
    calculationMethod = "CALENDAR_MONTHS";
    periodDescription = `${rule.limitation_months} Month(s)`;
  } else if (Number.isInteger(rule.limitation_days) && rule.limitation_days > 0) {
    calculatedDeadline = addCalendarDays(triggerDate, rule.limitation_days);
    calculationMethod = "CALENDAR_DAYS";
    periodDescription = `${rule.limitation_days} Day(s)`;
  }

  const explanation = `Trigger Date (${triggerDate}) + ${periodDescription} according to ${rule.act_name || "Limitation Act"} ${
    rule.article_reference ? "Article " + rule.article_reference : ""
  } ${rule.section_reference ? "Section " + rule.section_reference : ""} (${calculationMethod}).`;

  const snapshot = {
    act_name: rule.act_name,
    act_version: rule.act_version || "1963",
    article_reference: rule.article_reference || null,
    section_reference: rule.section_reference || null,
    proceeding_type: rule.proceeding_type,
    limitation_period: periodDescription,
    limitation_days: rule.limitation_days || null,
    limitation_months: rule.limitation_months || null,
    limitation_years: rule.limitation_years || null,
    trigger_type: rule.trigger_type,
    trigger_date: triggerDate,
    calculated_deadline: calculatedDeadline,
    calculation_method: calculationMethod,
    calculation_explanation: explanation,
    calculated_at: new Date().toISOString(),
    notes: notes || null,
  };

  return {
    trigger_date: triggerDate,
    rule: {
      id: rule.id,
      act_name: rule.act_name,
      act_version: rule.act_version,
      article_reference: rule.article_reference,
      section_reference: rule.section_reference,
      proceeding_type: rule.proceeding_type,
      limitation_period: periodDescription,
      trigger_type: rule.trigger_type,
      exclusion_notes: rule.exclusion_notes,
    },
    calculated_deadline: calculatedDeadline,
    calculation_method: calculationMethod,
    calculation_explanation: explanation,
    calculation_snapshot: snapshot,
    manual_override: false,
    verification_required: true,
    disclaimer: MANDATORY_DISCLAIMER,
  };
};

/**
 * Determine deadline status based on effective date and lifecycle flags.
 * @param {string} effectiveDeadline - YYYY-MM-DD
 * @param {boolean} isCompleted
 * @param {boolean} isWaived
 * @param {boolean} isManualReview
 * @returns {'COMPLETED'|'WAIVED'|'MANUAL_REVIEW_REQUIRED'|'OVERDUE'|'DUE_TODAY'|'DUE_SOON'|'UPCOMING'}
 */
const determineDeadlineStatus = (
  effectiveDeadline,
  isCompleted = false,
  isWaived = false,
  isManualReview = false
) => {
  if (isCompleted) return "COMPLETED";
  if (isWaived) return "WAIVED";
  if (isManualReview) return "MANUAL_REVIEW_REQUIRED";

  const today = getTodayDateString();
  const diff = diffCalendarDays(effectiveDeadline, today);

  if (diff < 0) return "OVERDUE";
  if (diff === 0) return "DUE_TODAY";
  if (diff <= 15) return "DUE_SOON";
  return "UPCOMING";
};

module.exports = {
  MANDATORY_DISCLAIMER,
  validateRule,
  calculateDeadline,
  determineDeadlineStatus,
};
