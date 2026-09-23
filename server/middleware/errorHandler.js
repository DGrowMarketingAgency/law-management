const env = require("../config/env");
const { errorResponse } = require("../utils/apiResponse");

/**
 * Centralized global error handling middleware
 * Catches all uncaught errors and formats a consistent JSON response.
 * Sanitizes errors in production to avoid leaking database details, internal paths, or stack traces.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE" || err.code === "FILE_TOO_LARGE") {
    return errorResponse(
      res,
      `File exceeds the ${env.storage.maxFileSizeMb} MB upload limit. Please use Add External Link and store the file in Google Drive, OneDrive, Dropbox, or another trusted cloud provider.`,
      "FILE_TOO_LARGE",
      null,
      413
    );
  }

  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || "INTERNAL_SERVER_ERROR";

  // Detailed debug info in development only
  let details = null;
  if (env.isDevelopment) {
    details = {
      message: err.message,
      stack: err.stack,
    };
  }

  // Safe client-facing message
  let message = err.message || "An unexpected error occurred on the server";

  // Prevent database/internal information leakage on unexpected 500 errors in production
  if (statusCode === 500 && env.isProduction) {
    message = "Internal server error";
  }

  // Always log unexpected internal errors on the server console for diagnostics
  if (statusCode >= 500) {
    console.error("[Internal Error Handler]:", err);
  }

  return errorResponse(res, message, errorCode, details, statusCode);
};

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
  }
}

module.exports = errorHandler;
module.exports.ApiError = ApiError;
