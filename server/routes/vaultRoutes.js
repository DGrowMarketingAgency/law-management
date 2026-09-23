const express = require("express");
const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const authenticate = require("../middleware/authenticate");
const vaultController = require("../controllers/vaultController");

const router = express.Router();

// Strict rate limiting for vault unlock attempts to prevent brute force attacks
const vaultUnlockLimiter = rateLimit({
  windowMs: env.vault.unlockRateLimitWindowMs,
  max: env.vault.unlockRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many vault unlock attempts from this IP. Please try again later.",
    error: { code: "TOO_MANY_UNLOCK_ATTEMPTS" },
  },
});

// All vault routes require standard JWT authentication
router.use(authenticate);

// Get current vault status (configured, locked/unlocked, lockout timer)
router.get("/status", vaultController.getStatus);

// Setup new vault password and master vault key
router.post("/setup", vaultController.setup);

// Unlock vault with strict rate limiter
router.post("/unlock", vaultUnlockLimiter, vaultController.unlock);

// Lock vault and revoke active session
router.post("/lock", vaultController.lock);

// Change vault password (rewraps master vault key)
router.post("/change-password", vaultController.changePassword);

// Revoke all active vault sessions for current user
router.post("/revoke-all", vaultController.revokeAll);

module.exports = router;
