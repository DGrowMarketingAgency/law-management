const authService = require("../services/authService");
const userService = require("../services/userService");
const env = require("../config/env");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Extract client IP helper
 */
const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
};

/**
 * Helper to set secure refresh token cookie
 */
const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie("refreshToken", refreshToken, env.cookie);
};

/**
 * POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return errorResponse(res, "Email and password are required.", "VALIDATION_ERROR", null, 400);
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.loginWithPassword(email, password, ip, userAgent);

    if (result.requires2FA) {
      return successResponse(
        res,
        result.message,
        {
          requires2FA: true,
          challengeId: result.challengeId,
          tempToken: result.tempToken,
          maskedEmail: result.maskedEmail,
          method: result.method,
        },
        200
      );
    }

    // Set HttpOnly cookie for refresh token
    setRefreshTokenCookie(res, result.refreshToken);

    return successResponse(
      res,
      "Login successful.",
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/verify-otp or POST /api/v1/auth/2fa/verify
 */
const verifyOTPLogin = async (req, res, next) => {
  try {
    const { challengeId, tempToken, otp } = req.body;
    if ((!challengeId && !tempToken) || !otp) {
      return errorResponse(res, "2FA challenge ID (or token) and verification OTP are required.", "VALIDATION_ERROR", null, 400);
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.verifyLogin2FA({
      challengeId,
      tempToken,
      otp,
      ip,
      userAgent,
    });

    setRefreshTokenCookie(res, result.refreshToken);

    return successResponse(
      res,
      "Two-factor authentication verified successfully.",
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/2fa/resend
 */
const resendLogin2FA = async (req, res, next) => {
  try {
    const { challengeId } = req.body;
    if (!challengeId) {
      return errorResponse(res, "Challenge ID is required to resend 2FA code.", "VALIDATION_ERROR", null, 400);
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.resendLogin2FA(challengeId, ip, userAgent);
    return successResponse(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/refresh
 */
const refresh = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!rawRefreshToken) {
      return errorResponse(
        res,
        "Refresh token not provided in session cookie or request body.",
        "REFRESH_TOKEN_REQUIRED",
        null,
        401
      );
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.refreshSession(rawRefreshToken, ip, userAgent);

    setRefreshTokenCookie(res, result.refreshToken);

    return successResponse(
      res,
      "Session token refreshed successfully.",
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const userId = req.user?.id || null;
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    await authService.logout(rawRefreshToken, userId, ip, userAgent);

    res.clearCookie("refreshToken", {
      httpOnly: env.cookie.httpOnly,
      secure: env.cookie.secure,
      sameSite: env.cookie.sameSite,
      path: env.cookie.path,
    });

    return successResponse(res, "Logged out successfully.", {}, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    return successResponse(res, "Current user profile.", { user: req.user }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/auth/me
 */
const updateMe = async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const updated = await userService.updateUser(req.user.id, { firstName, lastName, phone }, req.user.id);
    return successResponse(res, "Profile updated successfully.", { user: updated }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return errorResponse(res, "Current password and new password are required.", "VALIDATION_ERROR", null, 400);
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.changePassword(req.user.id, currentPassword, newPassword, ip, userAgent);

    res.clearCookie("refreshToken", { path: env.cookie.path });

    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, "Email address is required.", "VALIDATION_ERROR", null, 400);
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.forgotPassword(email, ip, userAgent);

    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, email, otp, newPassword } = req.body;
    if (!newPassword || (!token && (!email || !otp))) {
      return errorResponse(
        res,
        "New password and either a valid reset token or email with OTP code are required.",
        "VALIDATION_ERROR",
        null,
        400
      );
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.resetPassword({
      token,
      email,
      otp,
      newPassword,
      ip,
      userAgent,
    });

    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/2fa/enable
 */
const enable2FA = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const result = await authService.request2FAEnable(req.user.id, ip, userAgent);
    return successResponse(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/2fa/disable
 */
const disable2FA = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      return errorResponse(res, "Password is required to disable two-factor authentication.", "VALIDATION_ERROR", null, 400);
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.disable2FA(req.user.id, password, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/2fa/confirm
 */
const confirm2FA = async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      return errorResponse(res, "OTP code is required to confirm two-factor authentication.", "VALIDATION_ERROR", null, 400);
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.confirm2FAEnable(req.user.id, otp, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/verify-email/send
 */
const sendVerificationEmail = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const result = await authService.sendVerificationEmail(req.user.id, ip, userAgent);
    return successResponse(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/verify-email
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return errorResponse(res, "Verification token is required.", "VALIDATION_ERROR", null, 400);
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.verifyEmailAddress(token, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/sessions
 */
const getActiveSessions = async (req, res, next) => {
  try {
    const currentRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const sessions = await authService.getActiveSessions(req.user.id, currentRefreshToken);
    return successResponse(res, "Active login sessions retrieved.", { sessions }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/sessions/revoke
 */
const revokeSession = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return errorResponse(res, "Session ID is required.", "VALIDATION_ERROR", null, 400);
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.revokeSession(req.user.id, sessionId, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/sessions/revoke-all
 */
const revokeAllSessions = async (req, res, next) => {
  try {
    const currentRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.revokeAllSessions(req.user.id, currentRefreshToken, ip, userAgent);
    return successResponse(res, result.message, {}, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/setup/status
 * Public status check to determine if system requires initial Owner account setup
 */
const getSetupStatus = async (req, res, next) => {
  try {
    const status = await authService.getSetupStatus();
    return successResponse(res, "System setup status retrieved.", status, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/setup
 * Create initial Chambers Owner. Allowed ONLY if 0 Owner accounts exist.
 */
const setupFirstOwner = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password, confirmPassword } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return errorResponse(res, "Full name, email, and password are required.", "VALIDATION_ERROR", null, 400);
    }

    if (password !== confirmPassword) {
      return errorResponse(res, "Passwords do not match.", "PASSWORD_MISMATCH", null, 400);
    }

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.setupFirstOwner({
      firstName,
      lastName,
      email,
      phone,
      password,
      ip,
      userAgent,
    });

    return successResponse(res, result.message, result.user, 201);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  verifyOTPLogin,
  resendLogin2FA,
  refresh,
  logout,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  enable2FA,
  confirm2FA,
  disable2FA,
  sendVerificationEmail,
  verifyEmail,
  getActiveSessions,
  revokeSession,
  revokeAllSessions,
  getSetupStatus,
  setupFirstOwner,
};
