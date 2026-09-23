const db = require("../config/database");
const { verifyAccessToken } = require("../utils/token");
const { errorResponse } = require("../utils/apiResponse");
const { getUserPermissions } = require("../services/authorizationService");

/**
 * Authentication Middleware
 * 1. Reads Authorization header
 * 2. Extracts Bearer token
 * 3. Verifies JWT
 * 4. Validates token type ('access')
 * 5. Loads user from database and checks status ('ACTIVE')
 * 6. Attaches sanitized req.user with roles & permissions (no password_hash)
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(
        res,
        "Authentication token required. Please provide a valid Bearer token in the Authorization header.",
        "UNAUTHENTICATED",
        null,
        401
      );
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = verifyAccessToken(token);
    } catch (jwtError) {
      const message = jwtError.name === "TokenExpiredError"
        ? "Access token has expired. Please refresh your session."
        : "Invalid access token.";
      return errorResponse(res, message, "INVALID_TOKEN", null, 401);
    }

    if (decoded.type !== "access") {
      return errorResponse(res, "Invalid token type.", "INVALID_TOKEN_TYPE", null, 401);
    }

    const userId = decoded.sub;

    // Load user record from MySQL
    const [rows] = await db.execute(
      `SELECT id, first_name, last_name, email, phone, status, two_factor_enabled, last_login_at
       FROM users
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [userId]
    );

    const user = rows[0];

    if (!user) {
      return errorResponse(res, "User associated with this token does not exist.", "USER_NOT_FOUND", null, 401);
    }

    if (user.status !== "ACTIVE") {
      return errorResponse(res, "User account is inactive or suspended.", "ACCOUNT_INACTIVE", null, 403);
    }

    // Resolve user's roles & permissions
    const { roles, permissions, isOwner } = await getUserPermissions(user.id);

    // Attach sanitized user to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      status: user.status,
      twoFactorEnabled: Boolean(user.two_factor_enabled),
      roles,
      permissions,
      isOwner,
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;
