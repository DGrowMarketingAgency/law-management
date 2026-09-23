const crypto = require("crypto");
const db = require("../config/database");
const env = require("../config/env");
const keyManagementService = require("./keyManagementService");
const { logAuthEvent } = require("./auditService");

/**
 * Ephemeral In-Memory Vault Key Cache
 * Maps session_token_hash -> { vaultKey: Buffer, userId: number, expiresAt: number }
 * Plaintext Vault Keys exist ONLY in server RAM during active sessions and are NEVER persisted.
 */
const activeVaultKeys = new Map();

// Periodic cleanup of expired in-memory keys every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [hash, entry] of activeVaultKeys.entries()) {
    if (entry.expiresAt <= now) {
      // Securely zero-out buffer before deleting
      if (Buffer.isBuffer(entry.vaultKey)) {
        entry.vaultKey.fill(0);
      }
      activeVaultKeys.delete(hash);
    }
  }
}, 60 * 1000).unref();

class VaultService {
  /**
   * Helper to hash an opaque session token using SHA-256
   */
  hashSessionToken(token) {
    return crypto.createHash("sha256").update(String(token)).digest("hex");
  }

  /**
   * Validate password strength for Document Vault
   */
  validatePasswordStrength(password) {
    if (!password || typeof password !== "string") {
      return { valid: false, message: "Vault password cannot be empty." };
    }
    if (password.length < 8) {
      return {
        valid: false,
        message: "Vault password must be at least 8 characters long.",
      };
    }
    const weakPasswords = [
      "password",
      "12345678",
      "qwerty123",
      "vault1234",
      "password123",
    ];
    if (weakPasswords.includes(password.toLowerCase().trim())) {
      return {
        valid: false,
        message:
          "Vault password is too common. Please choose a stronger password.",
      };
    }
    return { valid: true };
  }

  /**
   * Get vault configuration and lock status for a user
   * @param {number} userId
   * @param {string|null} rawSessionToken
   * @returns {Promise<Object>}
   */
  async getVaultStatus(userId, rawSessionToken = null) {
    const [vaultRows] = await db.execute(
      `SELECT id, failed_attempts, locked_until, last_unlocked_at, last_locked_at, created_at
       FROM user_vaults WHERE user_id = ?`,
      [userId],
    );

    const autoLockMinutes = env.vault.autoLockMinutes;

    if (vaultRows.length === 0) {
      return {
        configured: false,
        locked: true,
        auto_lock_minutes: autoLockMinutes,
        last_unlocked_at: null,
      };
    }

    const vault = vaultRows[0];
    const isLockedOut =
      vault.locked_until && new Date(vault.locked_until) > new Date();

    let isUnlocked = false;
    let activeSession = null;

    if (rawSessionToken && !isLockedOut) {
      const sessionCheck = await this.validateVaultSession(
        userId,
        rawSessionToken,
      );
      if (sessionCheck.valid) {
        isUnlocked = true;
        activeSession = sessionCheck.session;
      }
    }

    return {
      configured: true,
      locked: !isUnlocked,
      last_unlocked_at: vault.last_unlocked_at,
      last_locked_at: vault.last_locked_at,
      auto_lock_minutes: autoLockMinutes,
      failed_attempts: vault.failed_attempts,
      is_locked_out: isLockedOut,
      locked_until: isLockedOut ? vault.locked_until : null,
      session_expires_at: activeSession ? activeSession.expires_at : null,
    };
  }

  /**
   * Configure a new Document Vault for a user
   * @param {number} userId
   * @param {string} vaultPassword
   * @param {Object} reqInfo { ip, userAgent }
   */
  async setupVault(userId, vaultPassword, reqInfo = {}) {
    // 1. Validate password strength
    const strength = this.validatePasswordStrength(vaultPassword);
    if (!strength.valid) {
      const err = new Error(strength.message);
      err.statusCode = 422;
      throw err;
    }

    // 2. Check if already configured
    const [existing] = await db.execute(
      `SELECT id FROM user_vaults WHERE user_id = ?`,
      [userId],
    );
    if (existing.length > 0) {
      const err = new Error(
        "Document vault is already configured for this account.",
      );
      err.statusCode = 409;
      throw err;
    }

    // 3. Generate salt, derive KEK, generate Vault Key, and wrap with KEK
    const saltHex = keyManagementService.generateSalt(32);
    const kek = keyManagementService.deriveKeyEncryptionKey(
      vaultPassword,
      saltHex,
      "scrypt",
    );
    const vaultKey = keyManagementService.generateVaultKey();
    const wrappedVaultKey = keyManagementService.encryptVaultKey(vaultKey, kek);

    // 4. Save encrypted vault config to DB
    const kdfParameters = {
      N: 16384,
      r: 8,
      p: 1,
      keylen: 32,
    };

    await db.execute(
      `INSERT INTO user_vaults (
        user_id, kdf_algorithm, kdf_salt, kdf_parameters,
        encrypted_vault_key, vault_key_iv, vault_key_auth_tag
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        "scrypt",
        saltHex,
        JSON.stringify(kdfParameters),
        wrappedVaultKey.encryptedVaultKey,
        wrappedVaultKey.iv,
        wrappedVaultKey.authTag,
      ],
    );

    // 5. Audit setup (Zero secrets logged)
    await logAuthEvent(userId, "VAULT_SETUP", reqInfo.ip, reqInfo.userAgent, {
      kdf_algorithm: "scrypt",
      action: "VAULT_SETUP_COMPLETED",
    });

    return {
      success: true,
      message:
        "Document vault configured successfully. You may now unlock your vault.",
    };
  }

  /**
   * Unlock user's Document Vault
   * @param {number} userId
   * @param {string} vaultPassword
   * @param {Object} reqInfo { ip, userAgent }
   * @returns {Promise<{ sessionToken: string, expiresAt: string, autoLockMinutes: number }>}
   */
  async unlockVault(userId, vaultPassword, reqInfo = {}) {
    // 1. Fetch user vault
    const [vaultRows] = await db.execute(
      `SELECT * FROM user_vaults WHERE user_id = ?`,
      [userId],
    );
    if (vaultRows.length === 0) {
      const err = new Error(
        "Document vault is not configured. Please set up your vault first.",
      );
      err.statusCode = 404;
      throw err;
    }

    const vault = vaultRows[0];

    // 2. Check if currently locked out due to failed attempts
    if (vault.locked_until && new Date(vault.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil(
        (new Date(vault.locked_until).getTime() - Date.now()) / (60 * 1000),
      );
      const err = new Error(
        `Vault is temporarily locked due to excessive failed attempts. Please retry after ${remainingMinutes} minute(s).`,
      );
      err.statusCode = 423;
      throw err;
    }

    // 3. Derive KEK and attempt to unwrap Vault Key
    let kdfParams = {};
    try {
      kdfParams =
        typeof vault.kdf_parameters === "string"
          ? JSON.parse(vault.kdf_parameters)
          : vault.kdf_parameters;
    } catch {
      kdfParams = {};
    }

    let decryptedVaultKey = null;
    try {
      const kek = keyManagementService.deriveKeyEncryptionKey(
        vaultPassword,
        vault.kdf_salt,
        vault.kdf_algorithm || "scrypt",
        kdfParams,
      );

      decryptedVaultKey = keyManagementService.decryptVaultKey(
        vault.encrypted_vault_key,
        kek,
        vault.vault_key_iv,
        vault.vault_key_auth_tag,
      );
    } catch (decryptErr) {
      // Invalid password or corrupted key wrapping
      const newFailedAttempts = (vault.failed_attempts || 0) + 1;
      let lockoutDate = null;

      if (newFailedAttempts >= env.vault.maxFailedAttempts) {
        lockoutDate = new Date(
          Date.now() + env.vault.lockoutMinutes * 60 * 1000,
        );
      }

      await db.execute(
        `UPDATE user_vaults SET failed_attempts = ?, locked_until = ? WHERE id = ?`,
        [newFailedAttempts, lockoutDate, vault.id],
      );

      await logAuthEvent(
        userId,
        "VAULT_UNLOCK_FAILED",
        reqInfo.ip,
        reqInfo.userAgent,
        {
          failed_attempts: newFailedAttempts,
          is_locked_out: Boolean(lockoutDate),
        },
      );

      const err = new Error(
        "Unable to unlock vault. Please verify your vault password.",
      );
      err.statusCode = 401;
      throw err;
    }

    // 4. Successful verification: Reset failed attempts & update last_unlocked_at
    await db.execute(
      `UPDATE user_vaults SET failed_attempts = 0, locked_until = NULL, last_unlocked_at = NOW() WHERE id = ?`,
      [vault.id],
    );

    // 5. Generate secure random opaque session token
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionTokenHash = this.hashSessionToken(sessionToken);
    const sessionTtlMs = env.vault.autoLockMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + sessionTtlMs);

    // Save session record to DB
    await db.execute(
      `INSERT INTO vault_sessions (
        user_id, session_token_hash, created_at, last_activity_at, expires_at, ip_address, user_agent
      ) VALUES (?, ?, NOW(), NOW(), ?, ?, ?)`,
      [
        userId,
        sessionTokenHash,
        expiresAt,
        reqInfo.ip ? String(reqInfo.ip).slice(0, 45) : null,
        reqInfo.userAgent ? String(reqInfo.userAgent).slice(0, 255) : null,
      ],
    );

    // Store in ephemeral memory cache for fast decryption
    activeVaultKeys.set(sessionTokenHash, {
      vaultKey: decryptedVaultKey,
      userId,
      expiresAt: expiresAt.getTime(),
    });

    await logAuthEvent(
      userId,
      "VAULT_UNLOCK_SUCCESS",
      reqInfo.ip,
      reqInfo.userAgent,
      {
        auto_lock_minutes: env.vault.autoLockMinutes,
      },
    );

    return {
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      autoLockMinutes: env.vault.autoLockMinutes,
    };
  }

  /**
   * Validate vault session and retrieve ephemeral Vault Key in server memory
   * @param {number} userId
   * @param {string} rawSessionToken
   * @param {Object} reqInfo { ip, userAgent }
   * @returns {Promise<{ valid: boolean, session?: Object, vaultKey?: Buffer, reason?: string }>}
   */
  async validateVaultSession(userId, rawSessionToken, reqInfo = {}) {
    if (!rawSessionToken) {
      return { valid: false, reason: "NO_VAULT_SESSION" };
    }

    const sessionTokenHash = this.hashSessionToken(rawSessionToken);

    // Query active session in DB
    const [rows] = await db.execute(
      `SELECT * FROM vault_sessions 
       WHERE session_token_hash = ? AND user_id = ? AND revoked_at IS NULL`,
      [sessionTokenHash, userId],
    );

    if (rows.length === 0) {
      activeVaultKeys.delete(sessionTokenHash);
      return { valid: false, reason: "INVALID_OR_REVOKED_SESSION" };
    }

    const session = rows[0];
    const now = Date.now();
    const lastActivity = new Date(session.last_activity_at).getTime();
    const inactivityTimeoutMs = env.vault.autoLockMinutes * 60 * 1000;
    const isInactiveTimeout = now - lastActivity > inactivityTimeoutMs;
    const isExpired = new Date(session.expires_at).getTime() <= now;

    if (isInactiveTimeout || isExpired) {
      // Auto-lock session
      await db.execute(
        `UPDATE vault_sessions SET revoked_at = NOW() WHERE id = ?`,
        [session.id],
      );
      activeVaultKeys.delete(sessionTokenHash);

      await logAuthEvent(
        userId,
        "VAULT_AUTO_LOCK",
        reqInfo.ip,
        reqInfo.userAgent,
        {
          reason: isInactiveTimeout ? "INACTIVITY_TIMEOUT" : "EXPIRED",
        },
      );

      return { valid: false, reason: "VAULT_AUTO_LOCKED" };
    }

    // Refresh activity timestamp and extend expiration
    const newExpiresAt = new Date(now + inactivityTimeoutMs);
    await db.execute(
      `UPDATE vault_sessions SET last_activity_at = NOW(), expires_at = ? WHERE id = ?`,
      [newExpiresAt, session.id],
    );

    // Retrieve cached Vault Key Buffer
    let cached = activeVaultKeys.get(sessionTokenHash);
    if (!cached || !cached.vaultKey) {
      // If server was restarted but DB session is valid, vault must be re-unlocked for security
      return { valid: false, reason: "SESSION_KEY_NOT_IN_MEMORY" };
    }

    cached.expiresAt = newExpiresAt.getTime();

    return {
      valid: true,
      session: {
        ...session,
        expires_at: newExpiresAt.toISOString(),
      },
      vaultKey: cached.vaultKey,
    };
  }

  /**
   * Lock Document Vault for current session
   * @param {number} userId
   * @param {string|null} rawSessionToken
   * @param {Object} reqInfo
   */
  async lockVault(userId, rawSessionToken = null, reqInfo = {}) {
    if (rawSessionToken) {
      const sessionTokenHash = this.hashSessionToken(rawSessionToken);
      await db.execute(
        `UPDATE vault_sessions SET revoked_at = NOW() WHERE session_token_hash = ? AND user_id = ?`,
        [sessionTokenHash, userId],
      );
      const cached = activeVaultKeys.get(sessionTokenHash);
      if (cached && Buffer.isBuffer(cached.vaultKey)) {
        cached.vaultKey.fill(0);
      }
      activeVaultKeys.delete(sessionTokenHash);
    }

    await db.execute(
      `UPDATE user_vaults SET last_locked_at = NOW() WHERE user_id = ?`,
      [userId],
    );

    await logAuthEvent(userId, "VAULT_LOCK", reqInfo.ip, reqInfo.userAgent, {
      action: "MANUAL_LOCK",
    });

    return { success: true, message: "Document vault locked successfully." };
  }

  /**
   * Change Vault Password and re-wrap the Master Vault Key with the new KEK.
   * NOTE: Per envelope encryption architecture, existing documents are NOT re-encrypted.
   *
   * @param {number} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   * @param {Object} reqInfo
   */
  async changeVaultPassword(
    userId,
    currentPassword,
    newPassword,
    reqInfo = {},
  ) {
    // 1. Validate new password strength
    const strength = this.validatePasswordStrength(newPassword);
    if (!strength.valid) {
      const err = new Error(strength.message);
      err.statusCode = 422;
      throw err;
    }

    if (currentPassword === newPassword) {
      const err = new Error(
        "New vault password must be different from current password.",
      );
      err.statusCode = 422;
      throw err;
    }

    // 2. Fetch user vault
    const [vaultRows] = await db.execute(
      `SELECT * FROM user_vaults WHERE user_id = ?`,
      [userId],
    );
    if (vaultRows.length === 0) {
      const err = new Error("Document vault not configured.");
      err.statusCode = 404;
      throw err;
    }
    const vault = vaultRows[0];

    // 3. Decrypt existing Master Vault Key using current password
    let kdfParams = {};
    try {
      kdfParams =
        typeof vault.kdf_parameters === "string"
          ? JSON.parse(vault.kdf_parameters)
          : vault.kdf_parameters;
    } catch {
      kdfParams = {};
    }

    let existingVaultKey = null;
    try {
      const currentKek = keyManagementService.deriveKeyEncryptionKey(
        currentPassword,
        vault.kdf_salt,
        vault.kdf_algorithm || "scrypt",
        kdfParams,
      );

      existingVaultKey = keyManagementService.decryptVaultKey(
        vault.encrypted_vault_key,
        currentKek,
        vault.vault_key_iv,
        vault.vault_key_auth_tag,
      );
    } catch {
      const err = new Error("Unable to verify current vault password.");
      err.statusCode = 401;
      throw err;
    }

    // 4. Generate new salt and derive new KEK
    const newSaltHex = keyManagementService.generateSalt(32);
    const newKek = keyManagementService.deriveKeyEncryptionKey(
      newPassword,
      newSaltHex,
      "scrypt",
    );

    // 5. Re-wrap the SAME Master Vault Key with the new KEK
    const newWrappedVaultKey = keyManagementService.encryptVaultKey(
      existingVaultKey,
      newKek,
    );

    // 6. Update DB with new wrapped key and salt
    await db.execute(
      `UPDATE user_vaults 
       SET kdf_salt = ?, encrypted_vault_key = ?, vault_key_iv = ?, vault_key_auth_tag = ?, failed_attempts = 0, locked_until = NULL
       WHERE id = ?`,
      [
        newSaltHex,
        newWrappedVaultKey.encryptedVaultKey,
        newWrappedVaultKey.iv,
        newWrappedVaultKey.authTag,
        vault.id,
      ],
    );

    // 7. Revoke all existing sessions to enforce re-authentication with new password
    await this.revokeAllSessions(userId, reqInfo);

    await logAuthEvent(
      userId,
      "VAULT_PASSWORD_CHANGED",
      reqInfo.ip,
      reqInfo.userAgent,
      {
        action: "VAULT_KEY_REWRAPPED",
      },
    );

    return {
      success: true,
      message:
        "Vault password changed successfully. Please unlock your vault with your new password.",
    };
  }

  /**
   * Revoke all active vault sessions for a user
   * @param {number} userId
   * @param {Object} reqInfo
   */
  async revokeAllSessions(userId, reqInfo = {}) {
    // Mark DB sessions as revoked
    await db.execute(
      `UPDATE vault_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`,
      [userId],
    );

    // Clear active keys from in-memory cache
    for (const [hash, entry] of activeVaultKeys.entries()) {
      if (entry.userId === userId) {
        if (Buffer.isBuffer(entry.vaultKey)) {
          entry.vaultKey.fill(0);
        }
        activeVaultKeys.delete(hash);
      }
    }

    await logAuthEvent(
      userId,
      "VAULT_ALL_SESSIONS_REVOKED",
      reqInfo.ip,
      reqInfo.userAgent,
      {
        revoked_by: userId,
      },
    );

    return { success: true, message: "All active vault sessions revoked." };
  }
}

module.exports = new VaultService();
