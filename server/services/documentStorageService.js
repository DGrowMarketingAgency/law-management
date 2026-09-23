const crypto = require("crypto");
const env = require("../config/env");
const localStorageProvider = require("../storage/localStorageProvider");

/**
 * DocumentStorageService
 * Pluggable abstraction layer over physical/cloud storage providers.
 * Generates secure, unguessable storage keys and coordinates storage operations.
 */
class DocumentStorageService {
  constructor() {
    this.providerType = env.storage.provider || "local";
    if (this.providerType === "local") {
      this.provider = localStorageProvider;
    } else {
      // Future S3 / Object Storage provider plug point
      this.provider = localStorageProvider;
    }
  }

  /**
   * Generate an unguessable, secure storage key.
   * Format: cases/{caseId}/documents/{documentId}/v{versionNumber}_{timestamp}_{randomHex}.bin
   * Note: The original user-provided filename is NEVER used in the storage key.
   *
   * @param {number|string} caseId
   * @param {number|string} documentId
   * @param {number} versionNumber
   * @returns {string}
   */
  generateStorageKey(caseId, documentId, versionNumber) {
    const randomHex = crypto.randomBytes(8).toString("hex");
    const timestamp = Date.now();
    return `cases/${caseId}/documents/${documentId}/v${versionNumber}_${timestamp}_${randomHex}.bin`;
  }

  /**
   * Upload file buffer to storage
   * @param {Buffer} buffer
   * @param {string} storageKey
   */
  async uploadFile(buffer, storageKey) {
    return await this.provider.uploadFile(buffer, storageKey);
  }

  /**
   * Get file readable stream for download/preview
   * @param {string} storageKey
   * @returns {ReadableStream}
   */
  getFileStream(storageKey) {
    return this.provider.getFileStream(storageKey);
  }

  /**
   * Delete a file from storage (used during rollback / cleanup)
   * @param {string} storageKey
   */
  async deleteFile(storageKey) {
    return await this.provider.deleteFile(storageKey);
  }

  /**
   * Check if file exists
   * @param {string} storageKey
   */
  async fileExists(storageKey) {
    return await this.provider.fileExists(storageKey);
  }

  /**
   * Get metadata
   * @param {string} storageKey
   */
  async getMetadata(storageKey) {
    return await this.provider.getMetadata(storageKey);
  }
}

module.exports = new DocumentStorageService();
