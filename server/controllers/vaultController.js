const vaultService = require("../services/vaultService");
const env = require("../config/env");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Controller for Vault Setup, Unlock, Lock, Status, Password Change, and Session Revocation
 */
class VaultController {
  /**
   * Get Vault configuration and lock status
   * GET /api/v1/vault/status
   */
  async getStatus(req, res, next) {
    try {
      const rawSessionToken =
        req.cookies?.[env.vault.cookieName] ||
        req.headers["x-vault-session"] ||
        null;

      const status = await vaultService.getVaultStatus(
        req.user.id,
        rawSessionToken,
      );
      return successResponse(
        res,
        "Vault status retrieved successfully.",
        status,
        200,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Setup a new Document Vault
   * POST /api/v1/vault/setup
   */
  async setup(req, res, next) {
    try {
      const { vault_password } = req.body;
      if (!vault_password) {
        return errorResponse(
          res,
          "Vault password is required.",
          "VALIDATION_FAILED",
          null,
          422,
        );
      }

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const result = await vaultService.setupVault(
        req.user.id,
        vault_password,
        reqInfo,
      );
      return successResponse(res, result.message, null, 201);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "VAULT_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Unlock Document Vault and establish session
   * POST /api/v1/vault/unlock
   */
  async unlock(req, res, next) {
    try {
      const { vault_password } = req.body;
      if (!vault_password) {
        return errorResponse(
          res,
          "Vault password is required.",
          "VALIDATION_FAILED",
          null,
          422,
        );
      }

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const result = await vaultService.unlockVault(
        req.user.id,
        vault_password,
        reqInfo,
      );

      // Set HttpOnly, secure vault session cookie
      res.cookie(env.vault.cookieName, result.sessionToken, {
        httpOnly: env.vault.cookie.httpOnly,
        secure: env.vault.cookie.secure,
        sameSite: env.vault.cookie.sameSite,
        path: env.vault.cookie.path,
        maxAge: env.vault.cookie.maxAge,
      });

      return successResponse(
        res,
        "Document Vault unlocked successfully.",
        {
          unlocked: true,
          expires_at: result.expiresAt,
          auto_lock_minutes: result.autoLockMinutes,
        },
        200,
      );
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "VAULT_UNLOCK_FAILED",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Lock Document Vault
   * POST /api/v1/vault/lock
   */
  async lock(req, res, next) {
    try {
      const rawSessionToken =
        req.cookies?.[env.vault.cookieName] ||
        req.headers["x-vault-session"] ||
        null;

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      await vaultService.lockVault(req.user.id, rawSessionToken, reqInfo);

      // Clear cookie
      res.clearCookie(env.vault.cookieName, {
        path: env.vault.cookie.path,
      });

      return successResponse(
        res,
        "Document Vault locked successfully.",
        { locked: true },
        200,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change Vault Password (rewraps existing Vault Key)
   * POST /api/v1/vault/change-password
   */
  async changePassword(req, res, next) {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        return errorResponse(
          res,
          "Both current and new vault passwords are required.",
          "VALIDATION_FAILED",
          null,
          422,
        );
      }

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const result = await vaultService.changeVaultPassword(
        req.user.id,
        current_password,
        new_password,
        reqInfo,
      );

      // Clear existing cookie since sessions are revoked
      res.clearCookie(env.vault.cookieName, {
        path: env.vault.cookie.path,
      });

      return successResponse(res, result.message, null, 200);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "VAULT_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Revoke all active vault sessions for the current user
   * POST /api/v1/vault/revoke-all
   */
  async revokeAll(req, res, next) {
    try {
      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const result = await vaultService.revokeAllSessions(req.user.id, reqInfo);

      res.clearCookie(env.vault.cookieName, {
        path: env.vault.cookie.path,
      });

      return successResponse(res, result.message, null, 200);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new VaultController();
