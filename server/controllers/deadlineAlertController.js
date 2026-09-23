const deadlineAlertService = require("../services/deadlineAlertService");
const { successResponse } = require("../utils/apiResponse");

/**
 * Get all alerts with optional filtering
 * GET /api/v1/deadlines/alerts
 */
const getAlerts = async (req, res, next) => {
  try {
    const alerts = await deadlineAlertService.getAlerts(req.query);
    return successResponse(res, "Deadline alerts retrieved.", { alerts }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger batch processing of pending alerts
 * POST /api/v1/deadlines/alerts/process
 */
const processPendingAlerts = async (req, res, next) => {
  try {
    const result = await deadlineAlertService.processPendingDeadlineAlerts();
    return successResponse(res, "Pending deadline alerts processed.", result, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAlerts,
  processPendingAlerts,
};
