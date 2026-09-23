const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");

const router = express.Router();

// Rate limiting for login and password reset attempts (prevent brute-force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit 15 login attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts from this IP, please try again after 15 minutes.",
    error: { code: "LOGIN_RATE_LIMIT_EXCEEDED" },
  },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password reset requests. Please try again later.",
    error: { code: "RATE_LIMIT_EXCEEDED" },
  },
});

// Initial System Setup routes (Available strictly when NO Owner exists)
router.get("/setup/status", authController.getSetupStatus);
router.post("/setup", authController.setupFirstOwner);

// Public authentication routes
router.post("/login", loginLimiter, authController.login);
router.post("/verify-otp", authController.verifyOTPLogin);
router.post("/2fa/verify", authController.verifyOTPLogin);
router.post("/2fa/resend", authController.resendLogin2FA);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post("/forgot-password", forgotPasswordLimiter, authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/verify-email", authController.verifyEmail);

// Authenticated user routes
router.get("/me", authenticate, authController.getMe);
router.put("/me", authenticate, authController.updateMe);
router.post("/change-password", authenticate, authController.changePassword);
router.post("/2fa/enable", authenticate, authController.enable2FA);
router.post("/2fa/confirm", authenticate, authController.confirm2FA);
router.post("/2fa/disable", authenticate, authController.disable2FA);
router.post("/verify-email/send", authenticate, authController.sendVerificationEmail);

// Session inspection & revocation routes
router.get("/sessions", authenticate, authController.getActiveSessions);
router.post("/sessions/revoke", authenticate, authController.revokeSession);
router.post("/sessions/revoke-all", authenticate, authController.revokeAllSessions);

module.exports = router;
