const { errorResponse } = require("../utils/apiResponse");

/**
 * 404 Not Found middleware for unmapped routes
 */
const notFound = (req, res, next) => {
  return errorResponse(
    res,
    `Cannot ${req.method} ${req.originalUrl}`,
    "ROUTE_NOT_FOUND",
    null,
    404
  );
};

module.exports = notFound;
