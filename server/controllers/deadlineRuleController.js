const deadlineRuleService = require("../services/deadlineRuleService");
const { validateRuleInput } = require("../validators/deadlineValidator");
const { successResponse, errorResponse } = require("../utils/apiResponse");

const getRules = async (req, res, next) => {
  try {
    const { search, proceeding_type, trigger_type, is_active, limit, offset } = req.query;
    const result = await deadlineRuleService.getRules({
      search,
      proceeding_type,
      trigger_type,
      is_active,
      limit,
      offset,
    });
    return successResponse(res, "Limitation rules retrieved successfully.", result, 200);
  } catch (error) {
    next(error);
  }
};

const getRuleById = async (req, res, next) => {
  try {
    const rule = await deadlineRuleService.getRuleById(req.params.id);
    if (!rule) {
      return errorResponse(res, "Limitation rule not found.", "NOT_FOUND", null, 404);
    }
    return successResponse(res, "Limitation rule retrieved successfully.", { rule }, 200);
  } catch (error) {
    next(error);
  }
};

const createRule = async (req, res, next) => {
  try {
    const validationErrors = validateRuleInput(req.body);
    if (validationErrors.length > 0) {
      return errorResponse(res, validationErrors[0], "VALIDATION_ERROR", { errors: validationErrors }, 422);
    }

    const rule = await deadlineRuleService.createRule(req.body, req.user.id);
    return successResponse(res, "Limitation rule created successfully.", { rule }, 201);
  } catch (error) {
    next(error);
  }
};

const updateRule = async (req, res, next) => {
  try {
    const validationErrors = validateRuleInput(req.body);
    if (validationErrors.length > 0) {
      return errorResponse(res, validationErrors[0], "VALIDATION_ERROR", { errors: validationErrors }, 422);
    }

    const rule = await deadlineRuleService.updateRule(req.params.id, req.body, req.user.id);
    if (!rule) {
      return errorResponse(res, "Limitation rule not found.", "NOT_FOUND", null, 404);
    }
    return successResponse(res, "Limitation rule updated successfully.", { rule }, 200);
  } catch (error) {
    next(error);
  }
};

const toggleRuleActive = async (req, res, next) => {
  try {
    const { is_active } = req.body;
    const rule = await deadlineRuleService.toggleRuleActive(req.params.id, is_active, req.user.id);
    if (!rule) {
      return errorResponse(res, "Limitation rule not found.", "NOT_FOUND", null, 404);
    }
    return successResponse(res, `Limitation rule ${is_active ? "activated" : "deactivated"} successfully.`, { rule }, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRules,
  getRuleById,
  createRule,
  updateRule,
  toggleRuleActive,
};
