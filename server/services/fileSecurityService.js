const crypto = require("crypto");
const path = require("path");
const env = require("../config/env");

/**
 * Controlled list of permitted file extensions and MIME types
 */
const ALLOWED_MIME_TYPES = {
  // Documents
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/csv": [".csv"],
  "text/plain": [".txt"],
  // Images
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

const DANGEROUS_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".sh", ".bash", ".ps1", ".vbs", ".js", ".mjs",
  ".php", ".phtml", ".html", ".htm", ".svg", ".dll", ".so", ".jar", ".war",
  ".py", ".pl", ".rb", ".cgi", ".asp", ".aspx", ".jsp", ".msi", ".com", ".scr"
];

/**
 * FileSecurityService
 * Handles strict validation of uploaded files:
 * 1. Extension & MIME type verification against controlled allowlist
 * 2. Strict rejection of dangerous executable/script extensions
 * 3. File signature (magic bytes) validation
 * 4. Maximum size enforcement
 * 5. Filename sanitization
 * 6. Cryptographic SHA-256 calculation
 * 7. Antivirus placeholder interface
 */
class FileSecurityService {
  /**
   * Sanitize display filename: strip path components, null bytes, control characters, limit length.
   * @param {string} originalName
   * @returns {string}
   */
  sanitizeFilename(originalName) {
    if (!originalName || typeof originalName !== "string") {
      return "document";
    }

    // Strip path components
    let base = path.basename(originalName);

    // Remove null bytes and control characters
    base = base.replace(/[\x00-\x1F\x7F]/g, "");

    // Replace invalid/risky characters with underscores
    base = base.replace(/[^a-zA-Z0-9.\-_ ()[\]]/g, "_");

    // Prevent hidden files (leading dot)
    if (base.startsWith(".")) {
      base = "file" + base;
    }

    // Truncate to maximum 200 characters while preserving extension
    if (base.length > 200) {
      const ext = path.extname(base);
      const name = path.basename(base, ext).substring(0, 190);
      base = `${name}${ext}`;
    }

    return base;
  }

  /**
   * Calculate cryptographic SHA-256 checksum of file buffer
   * @param {Buffer} buffer
   * @returns {string} hex digest
   */
  calculateChecksum(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Validate magic bytes for common formats
   * @param {Buffer} buffer
   * @param {string} ext
   * @returns {boolean}
   */
  checkMagicBytes(buffer, ext) {
    if (!buffer || buffer.length < 4) return false;

    const lowerExt = ext.toLowerCase();

    // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46)
    if (lowerExt === ".pdf") {
      return buffer.slice(0, 4).toString("ascii") === "%PDF";
    }

    // PNG magic bytes: \x89PNG (0x89 0x50 0x4E 0x47)
    if (lowerExt === ".png") {
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    }

    // JPEG magic bytes: \xFF\xD8\xFF
    if (lowerExt === ".jpg" || lowerExt === ".jpeg") {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    // Office Open XML (DOCX, XLSX) are ZIP files: PK\x03\x04
    if (lowerExt === ".docx" || lowerExt === ".xlsx") {
      return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    }

    // Legacy Office (DOC, XLS): OLE Compound Document: \xD0\xCF\x11\xE0
    if (lowerExt === ".doc" || lowerExt === ".xls") {
      return buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
    }

    // Plain text / CSV: Check that it does not contain binary NULL bytes in the first 512 bytes
    if (lowerExt === ".txt" || lowerExt === ".csv") {
      const sample = buffer.slice(0, Math.min(buffer.length, 512));
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0) return false; // Contains NULL byte -> binary file masquerading as text
      }
      return true;
    }

    return true;
  }

  /**
   * Validate entire file: size, extension, mime type, magic bytes, danger check
   * @param {Object} file - Express/Multer file object { originalname, mimetype, size, buffer }
   * @returns {{ valid: boolean, sanitizedFilename: string, error?: string, checksum?: string }}
   */
  validateFile(file) {
    if (!file || !file.buffer) {
      return { valid: false, error: "No file content uploaded" };
    }

    const sanitizedFilename = this.sanitizeFilename(file.originalname);
    const ext = path.extname(sanitizedFilename).toLowerCase();

    // 1. Check dangerous executable/script extensions
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        sanitizedFilename,
        error: `Executable and script files (${ext}) are strictly prohibited.`,
      };
    }

    // 2. Validate against permitted extensions list
    const allAllowedExts = Object.values(ALLOWED_MIME_TYPES).flat();
    if (!allAllowedExts.includes(ext)) {
      return {
        valid: false,
        sanitizedFilename,
        error: `Unsupported file extension '${ext}'. Allowed types: PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, JPG, JPEG, PNG.`,
      };
    }

    // 3. Validate size against configured MAX_DOCUMENT_SIZE_MB (Strictly 10 MB default)
    const maxSizeBytes = env.storage.maxFileSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        sanitizedFilename,
        code: "FILE_TOO_LARGE",
        statusCode: 413,
        error: `File exceeds the ${env.storage.maxFileSizeMb} MB upload limit. Please use Add External Link and store the file in Google Drive, OneDrive, Dropbox, or another trusted cloud provider.`,
      };
    }

    // 4. Validate MIME type
    const validMimes = Object.keys(ALLOWED_MIME_TYPES);
    // Allow octet-stream only if the extension matches a valid known extension and magic bytes pass
    const isGenericMime = file.mimetype === "application/octet-stream";
    if (!validMimes.includes(file.mimetype) && !isGenericMime) {
      return {
        valid: false,
        sanitizedFilename,
        error: `MIME type '${file.mimetype}' is not permitted for legal documents.`,
      };
    }

    // 5. Verify magic bytes / file signature
    if (!this.checkMagicBytes(file.buffer, ext)) {
      return {
        valid: false,
        sanitizedFilename,
        error: `File signature mismatch: file content does not match extension '${ext}'.`,
      };
    }

    // 6. Generate SHA-256 checksum
    const checksum = this.calculateChecksum(file.buffer);

    return {
      valid: true,
      sanitizedFilename,
      checksum,
    };
  }

  /**
   * Future-ready malware scan abstraction
   * In this version, returns NOT_CONFIGURED per prompt specification.
   */
  async scan(buffer) {
    // Documented limitation: Production deployments must plug in ClamAV or equivalent scanner
    return {
      status: "NOT_CONFIGURED",
      message: "Malware scanner is not configured in this environment.",
    };
  }
}

module.exports = new FileSecurityService();
