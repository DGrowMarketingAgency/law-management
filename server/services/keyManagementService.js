const crypto = require("crypto");
const documentEncryptionService = require("./documentEncryptionService");

/**
 * KeyManagementService
 * Coordinates multi-tiered envelope encryption:
 * 1. Vault Key generation and KEK derivation (via scrypt / Argon2-compatible parameters)
 * 2. Vault Key encryption/decryption (wrapping/unwrapping with KEK)
 * 3. Document Key (DEK) generation and wrapping with Vault Key
 */
class KeyManagementService {
  constructor() {
    this.defaultKdfAlgorithm = "scrypt";
    this.defaultKdfParams = {
      N: 16384, // CPU/memory cost parameter (2^14)
      r: 8, // Block size parameter
      p: 1, // Parallelization parameter
      maxmem: 64 * 1024 * 1024, // 64MB memory limit
      keylen: 32, // 256-bit derived KEK
    };
  }

  /**
   * Generate a cryptographically secure 256-bit random master Vault Key
   * @returns {Buffer}
   */
  generateVaultKey() {
    return crypto.randomBytes(32);
  }

  /**
   * Generate cryptographically secure random salt for KDF
   * @param {number} length - default 32 bytes (256 bits)
   * @returns {string} hex string
   */
  generateSalt(length = 32) {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Derive a Key Encryption Key (KEK) from the user's Vault Password.
   * Uses cryptographically secure scrypt with tuned memory-hard parameters.
   *
   * @param {string} password - User's Vault Password
   * @param {string} saltHex - Cryptographic salt in hex
   * @param {string} algorithm - 'scrypt'
   * @param {Object} customParams - Custom parameters if any
   * @returns {Buffer} 32-byte KEK Buffer
   */
  deriveKeyEncryptionKey(
    password,
    saltHex,
    algorithm = "scrypt",
    customParams = null,
  ) {
    if (!password || typeof password !== "string") {
      throw new Error("Vault password is required for key derivation.");
    }
    if (!saltHex || typeof saltHex !== "string") {
      throw new Error("KDF Salt is required for key derivation.");
    }

    const saltBuffer = Buffer.from(saltHex, "hex");
    const params = { ...this.defaultKdfParams, ...(customParams || {}) };

    if (algorithm === "scrypt") {
      const derivedKey = crypto.scryptSync(
        password,
        saltBuffer,
        params.keylen || 32,
        {
          N: params.N,
          r: params.r,
          p: params.p,
          maxmem: params.maxmem,
        },
      );
      return derivedKey;
    }

    throw new Error(`Unsupported KDF algorithm '${algorithm}'.`);
  }

  /**
   * Encrypt master Vault Key with password-derived KEK (Key Wrapping)
   * @param {Buffer} vaultKeyBuffer - 32-byte Vault Key
   * @param {Buffer} kekBuffer - 32-byte Key Encryption Key
   * @returns {{ encryptedVaultKey: string, iv: string, authTag: string }}
   */
  encryptVaultKey(vaultKeyBuffer, kekBuffer) {
    const enc = documentEncryptionService.encryptBuffer(
      vaultKeyBuffer,
      kekBuffer,
    );
    return {
      encryptedVaultKey: enc.ciphertext.toString("hex"),
      iv: enc.iv,
      authTag: enc.authTag,
    };
  }

  /**
   * Decrypt master Vault Key using password-derived KEK (Key Unwrapping)
   * @param {string} encryptedVaultKeyHex
   * @param {Buffer} kekBuffer
   * @param {string} ivHex
   * @param {string} authTagHex
   * @returns {Buffer} 32-byte Vault Key Buffer
   */
  decryptVaultKey(encryptedVaultKeyHex, kekBuffer, ivHex, authTagHex) {
    const ciphertext = Buffer.from(encryptedVaultKeyHex, "hex");
    return documentEncryptionService.decryptBuffer(
      ciphertext,
      kekBuffer,
      ivHex,
      authTagHex,
    );
  }

  /**
   * Generate a unique 256-bit random Data Encryption Key (DEK) for a document version
   * @returns {Buffer}
   */
  generateDocumentKey() {
    return documentEncryptionService.generateDataEncryptionKey();
  }

  /**
   * Encrypt (wrap) document DEK with the user's Vault Key
   * @param {Buffer} dekBuffer
   * @param {Buffer} vaultKeyBuffer
   * @returns {{ encryptedDataKey: string, iv: string, authTag: string }}
   */
  encryptDocumentKey(dekBuffer, vaultKeyBuffer) {
    return documentEncryptionService.encryptDataKey(dekBuffer, vaultKeyBuffer);
  }

  /**
   * Decrypt (unwrap) document DEK using the user's Vault Key
   * @param {string} encryptedDekHex
   * @param {Buffer} vaultKeyBuffer
   * @param {string} ivHex
   * @param {string} authTagHex
   * @returns {Buffer} 32-byte DEK Buffer
   */
  decryptDocumentKey(encryptedDekHex, vaultKeyBuffer, ivHex, authTagHex) {
    return documentEncryptionService.decryptDataKey(
      encryptedDekHex,
      vaultKeyBuffer,
      ivHex,
      authTagHex,
    );
  }
}

module.exports = new KeyManagementService();
