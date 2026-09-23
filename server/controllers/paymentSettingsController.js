const { getPaymentSettings, updatePaymentSettings } = require("../services/paymentSettingsService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Get firm payment gateway and instruction settings
 */
const getSettings = async (req, res, next) => {
  try {
    const settings = await getPaymentSettings();
    return successResponse(res, "Payment settings retrieved successfully.", settings);
  } catch (err) {
    next(err);
  }
};

/**
 * Update firm payment settings
 */
const updateSettings = async (req, res, next) => {
  try {
    const { key, value } = req.body;
    if (!key || !value) {
      return errorResponse(res, "Both 'key' and 'value' are required.", "VALIDATION_ERROR", null, 422);
    }
    const updated = await updatePaymentSettings(key, value, req.user?.id);
    return successResponse(res, "Payment settings updated successfully.", updated);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
