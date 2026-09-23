const { errorResponse } = require("../utils/apiResponse");
const { canViewCase, canEditCase } = require("../services/authorizationService");

/**
 * Middleware to check resource-level authorization on :caseId (or :id when in case route)
 * @param {'VIEW'|'EDIT'} requiredLevel - default 'VIEW'
 */
const authorizeCaseAccess = (requiredLevel = "VIEW") => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return errorResponse(res, "Authentication required.", "UNAUTHENTICATED", null, 401);
      }

      // Case ID can be in params as caseId or id
      const caseId = req.params.caseId || req.params.id;
      if (!caseId) {
        return next();
      }

      const parsedCaseId = parseInt(caseId, 10);
      if (isNaN(parsedCaseId)) {
        return errorResponse(res, "Invalid case identifier.", "INVALID_CASE_ID", null, 400);
      }

      let hasAccess = false;
      if (requiredLevel === "EDIT") {
        hasAccess = await canEditCase(req.user.id, parsedCaseId);
      } else {
        hasAccess = await canViewCase(req.user.id, parsedCaseId);
      }

      if (!hasAccess) {
        return errorResponse(
          res,
          "Access denied. You do not have permission or are not assigned to this case.",
          "CASE_ACCESS_DENIED",
          null,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = authorizeCaseAccess;
