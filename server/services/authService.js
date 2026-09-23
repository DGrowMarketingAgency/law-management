const db = require("../config/database");
const env = require("../config/env");
const { validatePasswordStrength, hashPassword, comparePassword } = require("../utils/password");
const {
  generateAccessToken,
  generateTemp2FAToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
} = require("../utils/token");
const { createOTP, resendOTP, verifyOTP } = require("./otpService");
const { logAuthEvent } = require("./auditService");
const { getUserPermissions } = require("./authorizationService");
const centralEmailService = require("./email/emailService");
const emailSecurityService = require("./email/emailSecurityService");

/**
 * Mask an email for safe display (e.g. n****e@example.com)
 */
const maskEmail = (email) => {
  if (!email || typeof email !== "string") return "";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  return `${name[0]}${"*".repeat(name.length - 2)}${name[name.length - 1]}@${domain}`;
};

/**
 * Parse user-agent string into a friendly device & browser description
 */
const parseDeviceInfo = (userAgent) => {
  if (!userAgent) return "Unknown Device";
  const ua = String(userAgent);
  let browser = "Browser";
  let os = "OS";

  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browser} on ${os}`;
};

/**
 * Sanitize user object for API responses
 */
const sanitizeUser = (user, roles = [], permissions = []) => {
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    twoFactorEnabled: Boolean(user.two_factor_enabled),
    twoFactorMethod: user.two_factor_method || (user.two_factor_enabled ? "EMAIL_OTP" : null),
    emailVerified: Boolean(user.email_verified_at),
    emailVerifiedAt: user.email_verified_at,
    roles,
    permissions,
    lastLoginAt: user.last_login_at,
  };
};

/**
 * Store a new hashed refresh token in database with metadata
 */
const storeRefreshToken = async (userId, rawToken, ip = null, userAgent = null) => {
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.cookie.maxAge);
  const deviceInfo = parseDeviceInfo(userAgent);

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent, device_info, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [userId, tokenHash, expiresAt, ip, userAgent ? String(userAgent).slice(0, 255) : null, deviceInfo]
  );
};

/**
 * Email + Password Login
 */
const loginWithPassword = async (email, password, ip = null, userAgent = null) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  const [rows] = await db.query(
    `SELECT * FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
    [normalizedEmail]
  );

  const user = rows[0];

  // Prevent account enumeration
  if (!user) {
    await logAuthEvent(null, "LOGIN_FAILED", ip, userAgent, { email: normalizedEmail, reason: "USER_NOT_FOUND" });
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  // Check account status
  if (user.status !== "ACTIVE") {
    await logAuthEvent(user.id, "LOGIN_BLOCKED", ip, userAgent, { status: user.status });
    const err = new Error("Your account is not active. Please contact chambers administration.");
    err.statusCode = 403;
    err.code = "ACCOUNT_INACTIVE";
    throw err;
  }

  // Verify bcrypt password
  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    await logAuthEvent(user.id, "LOGIN_FAILED", ip, userAgent, { reason: "INVALID_PASSWORD" });
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  // Check 2FA requirement
  if (user.two_factor_enabled) {
    const challengeId = await emailSecurityService.createAuthChallenge(user.id, "LOGIN_2FA", ip, userAgent);
    const otp = await createOTP(user.id, "TWO_FACTOR");
    const tempToken = generateTemp2FAToken(user.id);

    // Dispatch email with OTP asynchronously
    centralEmailService.sendTwoFactorOtpEmail({
      to: user.email,
      otp,
      firstName: user.first_name,
      ip,
      userAgent: parseDeviceInfo(userAgent),
    }).catch((err) => console.warn("[Email 2FA Send Error]:", err.message));

    await logAuthEvent(user.id, "LOGIN_2FA_CHALLENGE", ip, userAgent, { challengeId });

    return {
      requires2FA: true,
      challengeId,
      tempToken,
      method: "EMAIL_OTP",
      maskedEmail: maskEmail(user.email),
      message: `Two-factor verification code sent to ${maskEmail(user.email)}.`,
    };
  }

  // 2FA Disabled: Issue session tokens immediately
  const rawRefreshToken = generateRefreshToken();
  await storeRefreshToken(user.id, rawRefreshToken, ip, userAgent);
  const accessToken = generateAccessToken(user);

  await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);
  await logAuthEvent(user.id, "LOGIN_SUCCESS", ip, userAgent);

  // Send login alert email
  centralEmailService.sendLoginAlertEmail({
    to: user.email,
    firstName: user.first_name,
    ip,
    userAgent: parseDeviceInfo(userAgent),
    time: new Date().toUTCString(),
  }).catch((e) => console.warn("[Login Alert Email Error]:", e.message));

  const { roles, permissions } = await getUserPermissions(user.id);

  return {
    requires2FA: false,
    accessToken,
    refreshToken: rawRefreshToken,
    user: sanitizeUser(user, roles, permissions),
  };
};

/**
 * Verify 2FA OTP for login (accepts challengeId or legacy tempToken)
 */
const verifyLogin2FA = async ({ challengeId, tempToken, otp, ip = null, userAgent = null }) => {
  let userId = null;

  if (challengeId) {
    const challengeResult = await emailSecurityService.validateAuthChallenge(challengeId, "LOGIN_2FA");
    if (!challengeResult.valid) {
      const err = new Error(challengeResult.message || "Invalid 2FA challenge.");
      err.statusCode = 401;
      err.code = "INVALID_2FA_CHALLENGE";
      throw err;
    }
    userId = challengeResult.userId;
  } else if (tempToken) {
    let decoded;
    try {
      decoded = verifyAccessToken(tempToken);
    } catch {
      const err = new Error("Invalid or expired 2FA session token. Please log in again.");
      err.statusCode = 401;
      err.code = "INVALID_2FA_TOKEN";
      throw err;
    }
    if (decoded.type !== "2fa_temp") {
      const err = new Error("Invalid token type for 2FA verification.");
      err.statusCode = 401;
      err.code = "INVALID_TOKEN_TYPE";
      throw err;
    }
    userId = decoded.sub;
  } else {
    const err = new Error("2FA challenge ID or token is required.");
    err.statusCode = 400;
    throw err;
  }

  // Verify OTP for purpose TWO_FACTOR (or legacy LOGIN)
  let otpResult = await verifyOTP(userId, "TWO_FACTOR", otp);
  if (!otpResult.valid) {
    // Fallback check for legacy LOGIN purpose
    otpResult = await verifyOTP(userId, "LOGIN", otp);
  }

  if (!otpResult.valid) {
    await logAuthEvent(userId, "LOGIN_2FA_FAILED", ip, userAgent, { reason: otpResult.message });
    const err = new Error(otpResult.message || "Invalid two-factor code.");
    err.statusCode = 401;
    err.code = "INVALID_OTP";
    throw err;
  }

  // OTP verified successfully: mark challenge as verified
  if (challengeId) {
    await emailSecurityService.markAuthChallengeVerified(challengeId);
  }

  // Load user
  const [rows] = await db.query(`SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`, [userId]);
  const user = rows[0];

  if (!user || user.status !== "ACTIVE") {
    const err = new Error("User account is inactive or deleted.");
    err.statusCode = 403;
    err.code = "ACCOUNT_INACTIVE";
    throw err;
  }

  // Issue session tokens
  const rawRefreshToken = generateRefreshToken();
  await storeRefreshToken(user.id, rawRefreshToken, ip, userAgent);
  const accessToken = generateAccessToken(user);

  await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);
  await logAuthEvent(user.id, "LOGIN_SUCCESS_2FA", ip, userAgent);

  // Send login alert email
  centralEmailService.sendLoginAlertEmail({
    to: user.email,
    firstName: user.first_name,
    ip,
    userAgent: parseDeviceInfo(userAgent),
    time: new Date().toUTCString(),
  }).catch((e) => console.warn("[Login Alert Email Error]:", e.message));

  const { roles, permissions } = await getUserPermissions(user.id);

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: sanitizeUser(user, roles, permissions),
  };
};

/**
 * Resend 2FA Login OTP
 */
const resendLogin2FA = async (challengeId, ip = null, userAgent = null) => {
  if (!challengeId) {
    const err = new Error("Challenge ID is required.");
    err.statusCode = 400;
    throw err;
  }

  const [rows] = await db.query(
    `SELECT user_id, expires_at, status FROM auth_challenges WHERE id = ? AND purpose = 'LOGIN_2FA' LIMIT 1`,
    [challengeId]
  );

  if (rows.length === 0 || rows[0].status !== "PENDING") {
    const err = new Error("Active 2FA challenge not found. Please log in again.");
    err.statusCode = 400;
    throw err;
  }

  const userId = rows[0].user_id;
  const resendResult = await resendOTP(userId, "TWO_FACTOR");

  if (!resendResult.allowed) {
    const err = new Error(resendResult.message);
    err.statusCode = 429;
    err.remainingSeconds = resendResult.remainingSeconds;
    throw err;
  }

  const [userRows] = await db.query(`SELECT email, first_name FROM users WHERE id = ?`, [userId]);
  const user = userRows[0];

  centralEmailService.sendTwoFactorOtpEmail({
    to: user.email,
    otp: resendResult.otp,
    firstName: user.first_name,
    ip,
    userAgent: parseDeviceInfo(userAgent),
  }).catch((err) => console.warn("[Email 2FA Resend Error]:", err.message));

  return {
    success: true,
    message: "A new two-factor code has been sent to your email.",
    cooldownSeconds: env.otp.resendCooldownSeconds,
  };
};

/**
 * Refresh Access Token using rotating refresh session
 */
const refreshSession = async (rawRefreshToken, ip = null, userAgent = null) => {
  if (!rawRefreshToken) {
    const err = new Error("Refresh token is required.");
    err.statusCode = 401;
    err.code = "REFRESH_TOKEN_REQUIRED";
    throw err;
  }

  const tokenHash = hashToken(rawRefreshToken);

  const [rows] = await db.query(
    `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.status
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token_hash = ? AND u.deleted_at IS NULL
     LIMIT 1`,
    [tokenHash]
  );

  if (!rows || rows.length === 0) {
    const err = new Error("Invalid refresh session.");
    err.statusCode = 401;
    err.code = "INVALID_REFRESH_TOKEN";
    throw err;
  }

  const session = rows[0];

  if (session.revoked_at) {
    await db.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ?`, [session.user_id]);
    await logAuthEvent(session.user_id, "TOKEN_REUSE_DETECTED", ip, userAgent);
    const err = new Error("Refresh session has been revoked. Please log in again.");
    err.statusCode = 401;
    err.code = "REVOKED_REFRESH_TOKEN";
    throw err;
  }

  if (new Date(session.expires_at) < new Date()) {
    const err = new Error("Refresh session has expired. Please log in again.");
    err.statusCode = 401;
    err.code = "EXPIRED_REFRESH_TOKEN";
    throw err;
  }

  if (session.status !== "ACTIVE") {
    const err = new Error("User account is inactive or suspended.");
    err.statusCode = 403;
    err.code = "ACCOUNT_INACTIVE";
    throw err;
  }

  // Revoke old refresh token (Rotate)
  await db.query(`UPDATE refresh_tokens SET revoked_at = NOW(), last_used_at = NOW() WHERE id = ?`, [session.id]);

  // Issue new refresh token
  const newRawRefreshToken = generateRefreshToken();
  await storeRefreshToken(session.user_id, newRawRefreshToken, ip, userAgent);

  const [userRows] = await db.query(`SELECT * FROM users WHERE id = ?`, [session.user_id]);
  const newAccessToken = generateAccessToken(userRows[0]);

  await logAuthEvent(session.user_id, "TOKEN_REFRESH", ip, userAgent);

  return {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
  };
};

/**
 * Logout and revoke refresh token session
 */
const logout = async (rawRefreshToken, userId = null, ip = null, userAgent = null) => {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL`,
      [tokenHash]
    );
  }

  if (userId) {
    await logAuthEvent(userId, "LOGOUT", ip, userAgent);
  }

  return { success: true };
};

/**
 * Change authenticated user's password
 */
const changePassword = async (userId, currentPassword, newPassword, ip = null, userAgent = null) => {
  const validation = validatePasswordStrength(newPassword);
  if (!validation.valid) {
    const err = new Error(validation.message);
    err.statusCode = 400;
    err.code = "WEAK_PASSWORD";
    throw err;
  }

  const [rows] = await db.query(`SELECT email, first_name, password_hash FROM users WHERE id = ? AND deleted_at IS NULL`, [userId]);
  if (!rows || rows.length === 0) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  const user = rows[0];
  const isMatch = await comparePassword(currentPassword, user.password_hash);
  if (!isMatch) {
    await logAuthEvent(userId, "PASSWORD_CHANGE_FAILED", ip, userAgent, { reason: "CURRENT_PASSWORD_INCORRECT" });
    const err = new Error("Current password is incorrect.");
    err.statusCode = 400;
    err.code = "INCORRECT_PASSWORD";
    throw err;
  }

  const newHash = await hashPassword(newPassword);
  await db.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, userId]);

  // Invalidate other refresh sessions
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`,
    [userId]
  );

  await logAuthEvent(userId, "PASSWORD_CHANGE_SUCCESS", ip, userAgent);

  // Send security alert email
  centralEmailService.sendPasswordChangedEmail({
    to: user.email,
    firstName: user.first_name,
    ip,
    userAgent: parseDeviceInfo(userAgent),
    time: new Date().toUTCString(),
  }).catch((e) => console.warn("[Password Changed Email Warn]:", e.message));

  return { success: true, message: "Password updated successfully. Please log in with your new password." };
};

/**
 * Request password reset (Generic response to prevent enumeration)
 */
const forgotPassword = async (email, ip = null, userAgent = null) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  const [rows] = await db.query(
    `SELECT id, first_name, email, status FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
    [normalizedEmail]
  );

  const user = rows[0];

  if (user && user.status === "ACTIVE") {
    // Generate secure link token
    const rawToken = await emailSecurityService.createPasswordResetToken(user.id, ip, userAgent);
    // Also create fallback OTP for direct OTP reset form
    await createOTP(user.id, "PASSWORD_RESET");

    centralEmailService.sendPasswordResetEmail({
      to: user.email,
      resetToken: rawToken,
      firstName: user.first_name,
      ip,
      userAgent: parseDeviceInfo(userAgent),
    }).catch((e) => console.warn("[Password Reset Email Error]:", e.message));

    await logAuthEvent(user.id, "PASSWORD_RESET_REQUESTED", ip, userAgent);
  }

  return {
    success: true,
    message: "If the email is registered in our chambers system, password reset instructions have been sent.",
  };
};

/**
 * Reset password using Token or OTP
 */
const resetPassword = async ({ token, email, otp, newPassword, ip = null, userAgent = null }) => {
  const validation = validatePasswordStrength(newPassword);
  if (!validation.valid) {
    const err = new Error(validation.message);
    err.statusCode = 400;
    err.code = "WEAK_PASSWORD";
    throw err;
  }

  let userId = null;
  let tokenId = null;

  // Path A: Reset via 32-byte crypto token link
  if (token) {
    const tokenResult = await emailSecurityService.verifyPasswordResetToken(token);
    if (!tokenResult.valid) {
      const err = new Error(tokenResult.message);
      err.statusCode = 400;
      err.code = "INVALID_RESET_TOKEN";
      throw err;
    }
    userId = tokenResult.userId;
    tokenId = tokenResult.tokenId;
  }
  // Path B: Reset via Email + 6-digit OTP
  else if (email && otp) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const [rows] = await db.query(
      `SELECT id, status FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
      [normalizedEmail]
    );
    const user = rows[0];
    if (!user) {
      const err = new Error("Invalid request or expired verification code.");
      err.statusCode = 400;
      err.code = "INVALID_REQUEST";
      throw err;
    }
    userId = user.id;

    const otpResult = await verifyOTP(userId, "PASSWORD_RESET", otp);
    if (!otpResult.valid) {
      await logAuthEvent(userId, "PASSWORD_RESET_FAILED", ip, userAgent, { reason: otpResult.message });
      const err = new Error(otpResult.message || "Invalid verification code.");
      err.statusCode = 400;
      err.code = "INVALID_OTP";
      throw err;
    }
  } else {
    const err = new Error("Either reset token or email with verification code is required.");
    err.statusCode = 400;
    throw err;
  }

  // Update password & mark user active
  const newHash = await hashPassword(newPassword);
  await db.query(
    `UPDATE users SET password_hash = ?, status = 'ACTIVE' WHERE id = ?`,
    [newHash, userId]
  );

  // Invalidate single-use token if token path was used
  if (tokenId) {
    await emailSecurityService.markPasswordResetTokenUsed(tokenId);
  }

  // Invalidate all active refresh sessions
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`,
    [userId]
  );

  await logAuthEvent(userId, "PASSWORD_RESET_SUCCESS", ip, userAgent);

  // Fetch user details for notification
  const [userRows] = await db.query(`SELECT email, first_name FROM users WHERE id = ?`, [userId]);
  if (userRows.length > 0) {
    centralEmailService.sendPasswordChangedEmail({
      to: userRows[0].email,
      firstName: userRows[0].first_name,
      ip,
      userAgent: parseDeviceInfo(userAgent),
      time: new Date().toUTCString(),
    }).catch((e) => console.warn("[Password Reset Confirmation Email Warn]:", e.message));
  }

  return { success: true, message: "Password has been successfully reset. You can now log in." };
};

/**
 * Request enabling 2FA (Generates email OTP)
 */
const request2FAEnable = async (userId, ip = null, userAgent = null) => {
  const [userRows] = await db.query(`SELECT email, first_name FROM users WHERE id = ?`, [userId]);
  if (userRows.length === 0) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }
  const user = userRows[0];

  const otp = await createOTP(userId, "TWO_FACTOR_SETUP");

  centralEmailService.sendTwoFactorOtpEmail({
    to: user.email,
    otp,
    firstName: user.first_name,
    ip,
    userAgent: parseDeviceInfo(userAgent),
  }).catch((e) => console.warn("[2FA Setup Email Error]:", e.message));

  return {
    success: true,
    message: `Two-factor verification code sent to ${maskEmail(user.email)}.`,
    maskedEmail: maskEmail(user.email),
  };
};

/**
 * Confirm 2FA enablement with OTP
 */
const confirm2FAEnable = async (userId, otp, ip = null, userAgent = null) => {
  const otpResult = await verifyOTP(userId, "TWO_FACTOR_SETUP", otp);
  if (!otpResult.valid) {
    const err = new Error(otpResult.message || "Invalid verification code.");
    err.statusCode = 400;
    err.code = "INVALID_OTP";
    throw err;
  }

  await db.query(
    `UPDATE users SET two_factor_enabled = 1, two_factor_method = 'EMAIL_OTP' WHERE id = ?`,
    [userId]
  );
  await logAuthEvent(userId, "2FA_ENABLED", ip, userAgent);

  const [userRows] = await db.query(`SELECT email, first_name FROM users WHERE id = ?`, [userId]);
  if (userRows.length > 0) {
    centralEmailService.sendTwoFactorEnabledEmail({
      to: userRows[0].email,
      firstName: userRows[0].first_name,
      ip,
      userAgent: parseDeviceInfo(userAgent),
      time: new Date().toUTCString(),
    }).catch((e) => console.warn("[2FA Enabled Alert Warn]:", e.message));
  }

  return { success: true, message: "Two-factor authentication has been successfully enabled." };
};

/**
 * Disable 2FA (Requires current password confirmation)
 */
const disable2FA = async (userId, password, ip = null, userAgent = null) => {
  const [rows] = await db.query(`SELECT email, first_name, password_hash FROM users WHERE id = ?`, [userId]);
  if (!rows || rows.length === 0) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  const user = rows[0];
  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    await logAuthEvent(userId, "2FA_DISABLE_FAILED", ip, userAgent, { reason: "INCORRECT_PASSWORD" });
    const err = new Error("Incorrect password confirmation.");
    err.statusCode = 400;
    err.code = "INCORRECT_PASSWORD";
    throw err;
  }

  await db.query(`UPDATE users SET two_factor_enabled = 0, two_factor_method = NULL WHERE id = ?`, [userId]);
  await logAuthEvent(userId, "2FA_DISABLED", ip, userAgent);

  centralEmailService.sendTwoFactorDisabledEmail({
    to: user.email,
    firstName: user.first_name,
    ip,
    userAgent: parseDeviceInfo(userAgent),
    time: new Date().toUTCString(),
  }).catch((e) => console.warn("[2FA Disabled Alert Warn]:", e.message));

  return { success: true, message: "Two-factor authentication has been disabled." };
};

/**
 * Send email verification link/code
 */
const sendVerificationEmail = async (userId, ip = null, userAgent = null) => {
  const [rows] = await db.query(`SELECT email, first_name, email_verified_at FROM users WHERE id = ?`, [userId]);
  if (rows.length === 0) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }
  const user = rows[0];

  if (user.email_verified_at) {
    return { success: true, message: "Your email is already verified." };
  }

  const token = await emailSecurityService.createPasswordResetToken(userId, ip, userAgent); // reusable secure token
  centralEmailService.sendEmailVerification({
    to: user.email,
    verificationToken: token,
    firstName: user.first_name,
  }).catch((e) => console.warn("[Email Verification Send Warn]:", e.message));

  return {
    success: true,
    message: `Verification link sent to ${maskEmail(user.email)}.`,
  };
};

/**
 * Confirm email address verification
 */
const verifyEmailAddress = async (token, ip = null, userAgent = null) => {
  const tokenResult = await emailSecurityService.verifyPasswordResetToken(token);
  if (!tokenResult.valid) {
    const err = new Error(tokenResult.message);
    err.statusCode = 400;
    err.code = "INVALID_VERIFICATION_TOKEN";
    throw err;
  }

  const userId = tokenResult.userId;
  await db.query(`UPDATE users SET email_verified_at = NOW() WHERE id = ?`, [userId]);
  await emailSecurityService.markPasswordResetTokenUsed(tokenResult.tokenId);
  await logAuthEvent(userId, "EMAIL_VERIFIED", ip, userAgent);

  return { success: true, message: "Email address verified successfully." };
};

/**
 * Get active sessions for a user
 */
const getActiveSessions = async (userId, currentRefreshToken = null) => {
  const currentTokenHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;

  const [rows] = await db.query(
    `SELECT id, token_hash, ip_address, user_agent, device_info, created_at, last_used_at, expires_at
     FROM refresh_tokens
     WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY last_used_at DESC, created_at DESC`,
    [userId]
  );

  return rows.map((session) => ({
    id: session.id,
    ipAddress: session.ip_address || "Unknown IP",
    userAgent: session.user_agent,
    deviceInfo: session.device_info || parseDeviceInfo(session.user_agent),
    createdAt: session.created_at,
    lastUsedAt: session.last_used_at || session.created_at,
    expiresAt: session.expires_at,
    isCurrent: currentTokenHash ? session.token_hash === currentTokenHash : false,
  }));
};

/**
 * Revoke specific session
 */
const revokeSession = async (userId, sessionId, ip = null, userAgent = null) => {
  const [rows] = await db.query(
    `SELECT id FROM refresh_tokens WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
    [sessionId, userId]
  );

  if (rows.length === 0) {
    const err = new Error("Session not found or already revoked.");
    err.statusCode = 404;
    throw err;
  }

  await db.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?`, [sessionId]);
  await logAuthEvent(userId, "SESSION_REVOKED", ip, userAgent, { sessionId });

  return { success: true, message: "Session successfully revoked." };
};

/**
 * Revoke all sessions except optionally the current one
 */
const revokeAllSessions = async (userId, keepCurrentToken = null, ip = null, userAgent = null) => {
  if (keepCurrentToken) {
    const currentHash = hashToken(keepCurrentToken);
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND token_hash != ? AND revoked_at IS NULL`,
      [userId, currentHash]
    );
  } else {
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`,
      [userId]
    );
  }

  await logAuthEvent(userId, "ALL_SESSIONS_REVOKED", ip, userAgent);

  return { success: true, message: "All other sessions have been logged out." };
};

/**
 * Check whether initial system setup is required (i.e. No OWNER account exists)
 * @returns {Promise<{ setupRequired: boolean, ownerCount: number }>}
 */
const getSetupStatus = async () => {
  const [rows] = await db.query(
    `SELECT COUNT(DISTINCT u.id) as count
     FROM users u
     JOIN user_roles ur ON u.id = ur.user_id
     JOIN roles r ON ur.role_id = r.id
     WHERE r.name = 'OWNER' AND u.deleted_at IS NULL`
  );
  const ownerCount = rows[0]?.count || 0;
  return {
    setupRequired: ownerCount === 0,
    ownerCount,
  };
};

/**
 * Perform First-Time System Setup (Create initial Chambers OWNER)
 * Strictly permitted ONLY when 0 OWNER accounts exist.
 * Permanently locks once the first Owner account is created.
 * @param {object} params
 */
const setupFirstOwner = async ({ firstName, lastName, email, phone = null, password, ip = null, userAgent = null }) => {
  // 1. Strict Guard: Check if OWNER already exists
  const status = await getSetupStatus();
  if (!status.setupRequired) {
    const err = new Error("Initial setup has already been completed. First Owner account already exists.");
    err.statusCode = 403;
    err.code = "SETUP_ALREADY_COMPLETED";
    throw err;
  }

  // 2. Validate input fields
  const cleanFirstName = String(firstName || "").trim();
  const cleanLastName = String(lastName || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPhone = phone ? String(phone).trim() : null;

  if (!cleanFirstName || !cleanLastName) {
    const err = new Error("First name and last name are required.");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    const err = new Error("A valid email address is required.");
    err.statusCode = 400;
    err.code = "INVALID_EMAIL";
    throw err;
  }

  // 3. Validate strong password
  const pwdValidation = validatePasswordStrength(password);
  if (!pwdValidation.valid) {
    const err = new Error(pwdValidation.message);
    err.statusCode = 400;
    err.code = "WEAK_PASSWORD";
    throw err;
  }

  // 4. Check if user with this email already exists
  const [existing] = await db.query(
    `SELECT id FROM users WHERE email = ? LIMIT 1`,
    [cleanEmail]
  );
  if (existing && existing.length > 0) {
    const err = new Error("An account with this email address already exists.");
    err.statusCode = 409;
    err.code = "EMAIL_ALREADY_EXISTS";
    throw err;
  }

  // 5. Hash password with bcrypt (12 rounds)
  const passwordHash = await hashPassword(password);

  // 6. Insert User into MySQL
  const [insertRes] = await db.query(
    `INSERT INTO users (first_name, last_name, email, phone, password_hash, status, two_factor_enabled)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', FALSE)`,
    [cleanFirstName, cleanLastName, cleanEmail, cleanPhone, passwordHash]
  );
  const userId = insertRes.insertId;

  // 7. Assign OWNER and ADMIN roles
  const [roles] = await db.query(
    `SELECT id, name FROM roles WHERE name IN ('OWNER', 'ADMIN')`
  );
  for (const r of roles) {
    await db.query(
      `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`,
      [userId, r.id]
    );
  }

  // 8. Log Audit Event
  await logAuthEvent(userId, "SYSTEM_SETUP_OWNER_CREATED", ip, userAgent, {
    email: cleanEmail,
    name: `${cleanFirstName} ${cleanLastName}`,
  });

  return {
    success: true,
    message: "Chambers Owner account successfully initialized. You may now sign in.",
    user: {
      id: userId,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      email: cleanEmail,
      roles: ["OWNER", "ADMIN"],
      status: "ACTIVE",
    },
  };
};

module.exports = {
  sanitizeUser,
  loginWithPassword,
  verifyLogin2FA,
  resendLogin2FA,
  refreshSession,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  request2FAEnable,
  confirm2FAEnable,
  disable2FA,
  sendVerificationEmail,
  verifyEmailAddress,
  getActiveSessions,
  revokeSession,
  revokeAllSessions,
  getSetupStatus,
  setupFirstOwner,
};
