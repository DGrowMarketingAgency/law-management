const deadlineService = require("../services/deadlineService");
const deadlineRuleService = require("../services/deadlineRuleService");
const limitationService = require("../services/limitationService");
const {
  validateCalculateInput,
  validateCreateDeadlineInput,
  validateOverrideInput,
  validateWaiveInput,
} = require("../validators/deadlineValidator");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Preview / Calculate limitation deadline on the fly
 * POST /api/v1/deadlines/calculate
 */
const calculateLimitation = async (req, res, next) => {
  try {
    const errors = validateCalculateInput(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], "VALIDATION_ERROR", { errors }, 422);
    }

    const ruleId = req.body.deadline_rule_id || req.body.rule_id;
    const rule = await deadlineRuleService.getRuleById(ruleId);

    if (!rule) {
      return errorResponse(
        res,
        "Applicable limitation rule not configured. Manual deadline entry is required.",
        "RULE_NOT_FOUND",
        null,
        404
      );
    }

    const result = limitationService.calculateDeadline(
      req.body.trigger_date,
      rule,
      req.body.notes
    );

    return successResponse(res, "Limitation deadline calculated.", result, 200);
  } catch (error) {
    if (error.message.includes("not configured") || error.message.includes("inactive")) {
      return errorResponse(res, error.message, "LIMITATION_RULE_ERROR", null, 422);
    }
    next(error);
  }
};

/**
 * Get Chambers Limitation Deadlines Dashboard
 * GET /api/v1/deadlines/dashboard
 */
const getDeadlinesDashboard = async (req, res, next) => {
  try {
    const result = await deadlineService.getDeadlinesDashboard(req.user.id, req.query);
    return successResponse(res, "Deadlines dashboard retrieved.", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all deadlines for a case
 * GET /api/v1/cases/:caseId/deadlines
 */
const getCaseDeadlines = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const result = await deadlineService.getCaseDeadlines(caseId, req.query);
    return successResponse(res, "Case limitation deadlines retrieved.", result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single deadline for a case
 * GET /api/v1/cases/:caseId/deadlines/:deadlineId
 */
const getDeadlineById = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const deadlineId = parseInt(req.params.deadlineId, 10);

    const deadline = await deadlineService.getDeadlineById(caseId, deadlineId);
    if (!deadline) {
      return errorResponse(res, "Case deadline not found.", "NOT_FOUND", null, 404);
    }

    return successResponse(res, "Case deadline retrieved.", { deadline }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new deadline for a case
 * POST /api/v1/cases/:caseId/deadlines
 */
const createCaseDeadline = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const errors = validateCreateDeadlineInput(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], "VALIDATION_ERROR", { errors }, 422);
    }

    const deadline = await deadlineService.createCaseDeadline(caseId, req.body, req.user.id);
    return successResponse(res, "Case limitation deadline created successfully.", { deadline }, 201);
  } catch (error) {
    if (error.message.includes("not configured") || error.message.includes("inactive") || error.message.includes("mandatory")) {
      return errorResponse(res, error.message, "LIMITATION_CALCULATION_ERROR", null, 422);
    }
    next(error);
  }
};

/**
 * Override a case deadline with mandatory justification
 * POST /api/v1/cases/:caseId/deadlines/:deadlineId/override
 */
const overrideCaseDeadline = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const deadlineId = parseInt(req.params.deadlineId, 10);

    const errors = validateOverrideInput(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], "VALIDATION_ERROR", { errors }, 422);
    }

    const updated = await deadlineService.overrideCaseDeadline(
      caseId,
      deadlineId,
      req.body,
      req.user.id
    );

    return successResponse(res, "Case deadline overridden successfully.", { deadline: updated }, 200);
  } catch (error) {
    if (error.message.includes("mandatory") || error.message.includes("Cannot override")) {
      return errorResponse(res, error.message, "OVERRIDE_ERROR", null, 422);
    }
    if (error.message.includes("not found")) {
      return errorResponse(res, error.message, "NOT_FOUND", null, 404);
    }
    next(error);
  }
};

/**
 * Mark a case deadline as completed
 * POST /api/v1/cases/:caseId/deadlines/:deadlineId/complete
 */
const completeCaseDeadline = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const deadlineId = parseInt(req.params.deadlineId, 10);

    const completed = await deadlineService.completeCaseDeadline(
      caseId,
      deadlineId,
      req.body,
      req.user.id
    );

    return successResponse(res, "Case deadline marked as completed.", { deadline: completed }, 200);
  } catch (error) {
    if (error.message.includes("already marked")) {
      return errorResponse(res, error.message, "DEADLINE_LIFECYCLE_ERROR", null, 422);
    }
    if (error.message.includes("not found")) {
      return errorResponse(res, error.message, "NOT_FOUND", null, 404);
    }
    next(error);
  }
};

/**
 * Waive a case deadline with mandatory justification
 * POST /api/v1/cases/:caseId/deadlines/:deadlineId/waive
 */
const waiveCaseDeadline = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const deadlineId = parseInt(req.params.deadlineId, 10);

    const errors = validateWaiveInput(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], "VALIDATION_ERROR", { errors }, 422);
    }

    const waived = await deadlineService.waiveCaseDeadline(
      caseId,
      deadlineId,
      req.body,
      req.user.id
    );

    return successResponse(res, "Case deadline waived successfully.", { deadline: waived }, 200);
  } catch (error) {
    if (error.message.includes("mandatory") || error.message.includes("already marked")) {
      return errorResponse(res, error.message, "DEADLINE_WAIVER_ERROR", null, 422);
    }
    if (error.message.includes("not found")) {
      return errorResponse(res, error.message, "NOT_FOUND", null, 404);
    }
    next(error);
  }
};

module.exports = {
  calculateLimitation,
  getDeadlinesDashboard,
  getCaseDeadlines,
  getDeadlineById,
  createCaseDeadline,
  overrideCaseDeadline,
  completeCaseDeadline,
  waiveCaseDeadline,
};
