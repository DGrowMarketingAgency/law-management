const db = require("../config/database");
const authService = require("../services/authService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * GET /api/v1/security/overview
 * Overview of the authenticated user's security posture
 */
const getSecurityOverview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    const [userRows] = await db.query(
      `SELECT id, email, first_name, last_name, two_factor_enabled, two_factor_method,
              email_verified_at, last_login_at, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    if (userRows.length === 0) {
      return errorResponse(res, "User not found.", "NOT_FOUND", null, 404);
    }

    const user = userRows[0];
    const sessions = await authService.getActiveSessions(userId, currentRefreshToken);

    // Fetch recent 10 auth audit events
    const [auditRows] = await db.query(
      `SELECT event, ip_address, user_agent, details, created_at
       FROM audit_logs
       WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );

    return successResponse(
      res,
      "Security overview retrieved.",
      {
        profile: {
          id: user.id,
          email: user.email,
          twoFactorEnabled: Boolean(user.two_factor_enabled),
          twoFactorMethod: user.two_factor_method || (user.two_factor_enabled ? "EMAIL_OTP" : null),
          emailVerified: Boolean(user.email_verified_at),
          emailVerifiedAt: user.email_verified_at,
          lastLoginAt: user.last_login_at,
          accountCreated: user.created_at,
        },
        activeSessionsCount: sessions.length,
        sessions,
        recentActivity: auditRows.map((a) => ({
          event: a.event,
          ip: a.ip_address,
          userAgent: a.user_agent,
          details: typeof a.details === "string" ? JSON.parse(a.details || "{}") : a.details,
          createdAt: a.created_at,
        })),
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/security/audit-logs
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const page = parseInt(req.query.page, 10) || 1;
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT id, event, ip_address, user_agent, details, created_at
       FROM audit_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE user_id = ?`,
      [userId]
    );

    const total = countRows[0]?.total || 0;

    return successResponse(
      res,
      "Security audit logs retrieved.",
      {
        logs: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSecurityOverview,
  getAuditLogs,
};
