/**
 * Send a standardized success JSON response
 * @param {import('express').Response} res
 * @param {string} message
 * @param {any} data
 * @param {number} statusCode
 */
const successResponse = (res, message = "Request successful", data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send a standardized error JSON response
 * @param {import('express').Response} res
 * @param {string} message
 * @param {string} code
 * @param {any} details
 * @param {number} statusCode
 */
const errorResponse = (
  res,
  message = "Something went wrong",
  code = "INTERNAL_ERROR",
  details = null,
  statusCode = 500
) => {
  const errorPayload = {
    code,
  };

  if (details && process.env.NODE_ENV !== "production") {
    errorPayload.details = details;
  }

  return res.status(statusCode).json({
    success: false,
    message,
    error: errorPayload,
  });
};

module.exports = {
  successResponse,
  errorResponse,
};
