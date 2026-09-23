const { errorResponse } = require("../utils/apiResponse");

/**
 * Permission-based Authorization Middleware
 * Supports single permission string or array of permissions.
 * Checks against req.user.permissions with centralized OWNER override.
 * @param {string|string[]} requiredPermissions
 * @param {'ANY'|'ALL'} matchMode - default 'ANY'
 */
const authorize = (requiredPermissions, matchMode = "ANY") => {
  return (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
      return errorResponse(
        res,
        "Authentication required prior to permission check.",
        "UNAUTHENTICATED",
        null,
        401
      );
    }

    // Centralized Owner override: OWNER has full access to all permissions
    if (req.user.isOwner || (req.user.roles && req.user.roles.includes("OWNER"))) {
      return next();
    }

    const perms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    const userPerms = req.user.permissions || [];

    const hasAccess = matchMode === "ALL"
      ? perms.every((p) => userPerms.includes(p))
      : perms.some((p) => userPerms.includes(p));

    if (!hasAccess) {
      return errorResponse(
        res,
        `Access denied. You lack the required permission: [${perms.join(", ")}].`,
        "FORBIDDEN",
        null,
        403
      );
    }

    next();
  };
};

module.exports = authorize;
