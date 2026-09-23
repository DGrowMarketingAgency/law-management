const fs = require("fs");
const path = require("path");
const env = require("../config/env");

/**
 * LocalStorageProvider
 * Manages physical file storage on the server's private filesystem.
 * Enforces strict path sanitization to prevent path traversal attacks.
 */
class LocalStorageProvider {
  constructor() {
    this.basePath = path.resolve(env.storage.localBasePath);
    this._ensureDirectory(this.basePath);
  }

  /**
   * Ensure directory recursively exists
   */
  _ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Resolve and sanitize the full filesystem path for a given storageKey.
   * Strictly prevents directory traversal (../, relative escapes, absolute root overrides).
   */
  _resolvePath(storageKey) {
    if (!storageKey || typeof storageKey !== "string") {
      throw new Error("Invalid storage key provided");
    }

    // Normalize and remove leading slashes/backslashes
    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\\/g, "/");

    // Prevent any directory traversal components
    const parts = cleanKey.split("/");
    for (const part of parts) {
      if (part === ".." || part === "." || part === "") {
        throw new Error("Path traversal attempted in storage key");
      }
    }

    const resolved = path.resolve(this.basePath, cleanKey);

    // Verify resolved path is strictly within basePath
    if (!resolved.startsWith(this.basePath)) {
      throw new Error("Storage access violation: Path is outside base directory");
    }

    return resolved;
  }

  /**
   * Save a file buffer to local private storage
   * @param {Buffer} buffer - File binary buffer
   * @param {string} storageKey - Relative unique storage key
   * @returns {Promise<{ storageKey: string, size: number }>}
   */
  async uploadFile(buffer, storageKey) {
    const fullPath = this._resolvePath(storageKey);
    const parentDir = path.dirname(fullPath);
    this._ensureDirectory(parentDir);

    await fs.promises.writeFile(fullPath, buffer);
    return {
      storageKey,
      size: buffer.length,
    };
  }

  /**
   * Get a readable stream for the file
   * @param {string} storageKey
   * @returns {fs.ReadStream}
   */
  getFileStream(storageKey) {
    const fullPath = this._resolvePath(storageKey);
    if (!fs.existsSync(fullPath)) {
      const err = new Error("File not found on storage");
      err.code = "ENOENT";
      throw err;
    }
    return fs.createReadStream(fullPath);
  }

  /**
   * Read entire file into buffer (for hashing/scanning if needed)
   * @param {string} storageKey
   * @returns {Promise<Buffer>}
   */
  async getFileBuffer(storageKey) {
    const fullPath = this._resolvePath(storageKey);
    return await fs.promises.readFile(fullPath);
  }

  /**
   * Delete a file from storage
   * @param {string} storageKey
   * @returns {Promise<boolean>}
   */
  async deleteFile(storageKey) {
    try {
      const fullPath = this._resolvePath(storageKey);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Failed to delete file for key ${storageKey}:`, err);
      return false;
    }
  }

  /**
   * Check if file exists on storage
   * @param {string} storageKey
   * @returns {Promise<boolean>}
   */
  async fileExists(storageKey) {
    try {
      const fullPath = this._resolvePath(storageKey);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   * @param {string} storageKey
   * @returns {Promise<{ size: number, mtime: Date }>}
   */
  async getMetadata(storageKey) {
    const fullPath = this._resolvePath(storageKey);
    const stats = await fs.promises.stat(fullPath);
    return {
      size: stats.size,
      mtime: stats.mtime,
    };
  }
}

module.exports = new LocalStorageProvider();
