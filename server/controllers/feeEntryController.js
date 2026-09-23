const feeEntryService = require("../services/feeEntryService");
const { validateCreateFeeEntry, validateUpdateFeeEntry } = require("../validators/feeEntryValidator");
const { successResponse, errorResponse } = require("../utils/apiResponse");

const createFeeEntry = async (req, res, next) => {
  try {
    const errors = validateCreateFeeEntry(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], "VALIDATION_ERROR", errors, 422);
    }

    const entry = await feeEntryService.createFeeEntry(
      req.body,
      req.user.id,
      req.ip,
      req.get("user-agent")
    );

    return successResponse(res, "Billable fee entry recorded successfully.", entry, 201);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, err.code || "FEE_ENTRY_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

const getFeeEntries = async (req, res, next) => {
  try {
    const result = await feeEntryService.getFeeEntries(req.query);
    return successResponse(res, "Fee entries retrieved successfully.", result);
  } catch (err) {
    next(err);
  }
};

const getFeeEntryById = async (req, res, next) => {
  try {
    const entry = await feeEntryService.getFeeEntryById(req.params.id);
    return successResponse(res, "Fee entry details retrieved.", entry);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "NOT_FOUND", null, err.statusCode);
    }
    next(err);
  }
};

const updateFeeEntry = async (req, res, next) => {
  try {
    const errors = validateUpdateFeeEntry(req.body);
    if (errors.length > 0) {
      return errorResponse(res, errors[0], "VALIDATION_ERROR", errors, 422);
    }

    const entry = await feeEntryService.updateFeeEntry(
      req.params.id,
      req.body,
      req.user.id,
      req.ip,
      req.get("user-agent")
    );

    return successResponse(res, "Fee entry updated successfully.", entry);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "FEE_ENTRY_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

const cancelFeeEntry = async (req, res, next) => {
  try {
    const result = await feeEntryService.cancelFeeEntry(
      req.params.id,
      req.user.id,
      req.ip,
      req.get("user-agent")
    );

    return successResponse(res, result.message, null);
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, err.message, "FEE_ENTRY_ERROR", null, err.statusCode);
    }
    next(err);
  }
};

const getUnbilledFeeEntries = async (req, res, next) => {
  try {
    const query = { ...req.query, is_billed: "false", status: "UNBILLED" };
    const result = await feeEntryService.getFeeEntries(query);
    return successResponse(res, "Unbilled fee entries retrieved successfully.", result);
  } catch (err) {
    next(err);
  }
};

const deleteFeeEntry = cancelFeeEntry;

module.exports = {
  createFeeEntry,
  getFeeEntries,
  getUnbilledFeeEntries,
  getFeeEntryById,
  updateFeeEntry,
  cancelFeeEntry,
  deleteFeeEntry,
};
