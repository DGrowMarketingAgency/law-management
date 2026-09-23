const env = require("../config/env");
const vaultService = require("../services/vaultService");
const { errorResponse } = require("../utils/apiResponse");

/**
 * requireVaultUnlock Middleware
 * Enforces that the current authenticated user has an active, valid, non-expired Vault Session.
 * Attaches decrypted Vault Key to req.vault for internal server-side cryptographic operations.
 */
const requireVaultUnlock = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(
        res,
        "Authentication required prior to vault verification.",
        "UNAUTHORIZED",
        null,
        401,
      );
    }

    // Read session token from HttpOnly cookie or header fallback
    const rawSessionToken =
      req.cookies?.[env.vault.cookieName] ||
      req.headers["x-vault-session"] ||
      null;

    if (!rawSessionToken) {
      return errorResponse(
        res,
        "Document Vault is locked. Please unlock the vault with your document vault password.",
        "VAULT_LOCKED",
        null,
        423,
      );
    }

    const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
    const validation = await vaultService.validateVaultSession(
      req.user.id,
      rawSessionToken,
      reqInfo,
    );

    if (!validation.valid) {
      let message = "Document Vault is locked. Please unlock your vault.";
      if (validation.reason === "VAULT_AUTO_LOCKED") {
        message =
          "Vault locked automatically due to inactivity. Please unlock your vault again.";
      } else if (validation.reason === "SESSION_KEY_NOT_IN_MEMORY") {
        message =
          "Vault session expired due to server restart. Please unlock your vault.";
      }

      return errorResponse(
        res,
        message,
        "VAULT_LOCKED",
        { reason: validation.reason },
        423,
      );
    }

    // Attach server-side vault context
    // Plaintext vaultKey is kept isolated in memory for the duration of the request
    req.vault = {
      session: validation.session,
      vaultKey: validation.vaultKey,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * attachVaultIfUnlocked Middleware
 * If user has an active unlocked vault session, attaches decrypted Vault Key to req.vault.
 * If not unlocked, passes through gracefully (req.vault = null) so non-encrypted documents can still be accessed.
 */
const attachVaultIfUnlocked = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      req.vault = null;
      return next();
    }

    const rawSessionToken =
      req.cookies?.[env.vault.cookieName] ||
      req.headers["x-vault-session"] ||
      null;

    if (!rawSessionToken) {
      req.vault = null;
      return next();
    }

    const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
    const validation = await vaultService.validateVaultSession(
      req.user.id,
      rawSessionToken,
      reqInfo,
    );

    if (validation.valid && validation.vaultKey) {
      req.vault = {
        session: validation.session,
        vaultKey: validation.vaultKey,
      };
    } else {
      req.vault = null;
    }

    next();
  } catch (error) {
    req.vault = null;
    next();
  }
};

module.exports = requireVaultUnlock;
module.exports.requireVaultUnlock = requireVaultUnlock;
module.exports.attachVaultIfUnlocked = attachVaultIfUnlocked;

