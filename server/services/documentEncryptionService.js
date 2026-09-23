const crypto = require("crypto");

/**
 * DocumentEncryptionService
 * Handles low-level cryptographic operations for legal documents and per-file encryption keys (DEKs)
 * using AES-256-GCM authenticated encryption.
 */
class DocumentEncryptionService {
  constructor() {
    this.algorithm = "aes-256-gcm";
    this.ivLength = 12; // 96-bit standard IV for GCM
    this.tagLength = 16; // 128-bit authentication tag
    this.keyLength = 32; // 256-bit AES key
  }

  /**
   * Generate a cryptographically secure 256-bit random Data Encryption Key (DEK)
   * @returns {Buffer}
   */
  generateDataEncryptionKey() {
    return crypto.randomBytes(this.keyLength);
  }

  /**
   * Calculate SHA-256 checksum of plaintext buffer
   * @param {Buffer} buffer
   * @returns {string} hex digest
   */
  calculateChecksum(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Encrypt a plaintext buffer using AES-256-GCM with a specific key.
   * Generates a unique 12-byte IV for every encryption call.
   *
   * @param {Buffer} plaintextBuffer
   * @param {Buffer} keyBuffer - 32-byte encryption key
   * @returns {{ ciphertext: Buffer, iv: string, authTag: string }}
   */
  encryptBuffer(plaintextBuffer, keyBuffer) {
    if (!Buffer.isBuffer(plaintextBuffer)) {
      throw new Error("Plaintext must be provided as a Buffer.");
    }
    if (!Buffer.isBuffer(keyBuffer) || keyBuffer.length !== this.keyLength) {
      throw new Error(
        `Encryption key must be a ${this.keyLength}-byte Buffer.`,
      );
    }

    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, keyBuffer, iv, {
      authTagLength: this.tagLength,
    });

    const encryptedChunks = [cipher.update(plaintextBuffer), cipher.final()];
    const ciphertext = Buffer.concat(encryptedChunks);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  }

  /**
   * Decrypt AES-256-GCM ciphertext buffer.
   * Enforces GCM authentication tag verification. If authentication fails,
   * FAILS CLOSED immediately without releasing any plaintext.
   *
   * @param {Buffer} ciphertextBuffer
   * @param {Buffer} keyBuffer - 32-byte encryption key
   * @param {string} ivHex - Hex encoded IV
   * @param {string} authTagHex - Hex encoded authentication tag
   * @returns {Buffer} Plaintext buffer
   */
  decryptBuffer(ciphertextBuffer, keyBuffer, ivHex, authTagHex) {
    if (!Buffer.isBuffer(ciphertextBuffer)) {
      throw new Error("Ciphertext must be provided as a Buffer.");
    }
    if (!Buffer.isBuffer(keyBuffer) || keyBuffer.length !== this.keyLength) {
      throw new Error(
        `Encryption key must be a ${this.keyLength}-byte Buffer.`,
      );
    }
    if (!ivHex || !authTagHex) {
      throw new Error(
        "IV and Authentication Tag are required for AES-GCM decryption.",
      );
    }

    try {
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");

      const decipher = crypto.createDecipheriv(this.algorithm, keyBuffer, iv, {
        authTagLength: this.tagLength,
      });
      decipher.setAuthTag(authTag);

      const decryptedChunks = [
        decipher.update(ciphertextBuffer),
        decipher.final(),
      ];
      return Buffer.concat(decryptedChunks);
    } catch (err) {
      const authErr = new Error(
        "Decryption failed: Ciphertext integrity verification or authentication tag check failed.",
      );
      authErr.code = "AUTH_TAG_VERIFICATION_FAILED";
      authErr.statusCode = 422;
      throw authErr;
    }
  }

  /**
   * Encrypt a Data Encryption Key (DEK) with the Vault Key (Key Wrapping)
   * @param {Buffer} dekBuffer - 32-byte DEK
   * @param {Buffer} vaultKeyBuffer - 32-byte Vault Key
   * @returns {{ encryptedDataKey: string, iv: string, authTag: string }}
   */
  encryptDataKey(dekBuffer, vaultKeyBuffer) {
    const enc = this.encryptBuffer(dekBuffer, vaultKeyBuffer);
    return {
      encryptedDataKey: enc.ciphertext.toString("hex"),
      iv: enc.iv,
      authTag: enc.authTag,
    };
  }

  /**
   * Decrypt an encrypted Data Encryption Key using the Vault Key (Key Unwrapping)
   * @param {string} encryptedDataKeyHex
   * @param {Buffer} vaultKeyBuffer
   * @param {string} ivHex
   * @param {string} authTagHex
   * @returns {Buffer} 32-byte DEK buffer
   */
  decryptDataKey(encryptedDataKeyHex, vaultKeyBuffer, ivHex, authTagHex) {
    const ciphertext = Buffer.from(encryptedDataKeyHex, "hex");
    return this.decryptBuffer(ciphertext, vaultKeyBuffer, ivHex, authTagHex);
  }

  /**
   * Helper to verify if an authentication tag is valid format
   * @param {string} authTagHex
   * @returns {boolean}
   */
  verifyAuthenticationTag(authTagHex) {
    if (!authTagHex || typeof authTagHex !== "string") return false;
    const tag = Buffer.from(authTagHex, "hex");
    return tag.length === this.tagLength;
  }
}

module.exports = new DocumentEncryptionService();
