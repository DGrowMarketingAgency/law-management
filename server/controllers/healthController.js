const db = require("../config/database");
const { successResponse } = require("../utils/apiResponse");

/**
 * Health check controller
 * Checks API status and validates MySQL database connectivity using SELECT 1
 */
const getHealth = async (req, res, next) => {
  try {
    const dbStatus = await db.checkHealth();

    const responseData = {
      status: "ok",
      database: dbStatus.connected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };

    return successResponse(res, "API is healthy", responseData, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHealth,
};
