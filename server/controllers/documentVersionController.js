const documentVersionService = require("../services/documentVersionService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Controller for Document Versions (revisions) and version-specific downloads
 */
class DocumentVersionController {
  /**
   * Upload a new revision to a document
   * POST /api/v1/documents/:documentId/versions
   */
  async uploadVersion(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      if (isNaN(documentId)) {
        return errorResponse(
          res,
          "Invalid document identifier.",
          "INVALID_ID",
          null,
          400,
        );
      }

      if (req.body.storage_type === "EXTERNAL" || req.body.external_url) {
        return await this.createExternalVersion(req, res, next);
      }

      if (!req.file) {
        return errorResponse(
          res,
          "No file uploaded. Please attach a revision file.",
          "FILE_REQUIRED",
          null,
          422,
        );
      }

      const { change_summary } = req.body;
      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };

      const newVersion = await documentVersionService.uploadNewVersion(
        documentId,
        req.file,
        change_summary,
        req.user,
        reqInfo,
        req.vault?.vaultKey || null,
      );

      return successResponse(
        res,
        "New document version uploaded successfully.",
        newVersion,
        201,
      );
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "VERSION_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Add a new external cloud-linked revision to a document
   * POST /api/v1/documents/:documentId/versions/external-link
   */
  async createExternalVersion(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      if (isNaN(documentId)) {
        return errorResponse(
          res,
          "Invalid document identifier.",
          "INVALID_ID",
          null,
          400,
        );
      }

      const {
        external_url,
        external_provider,
        external_file_name,
        external_file_size,
        external_mime_type,
        change_summary,
      } = req.body;

      if (!external_url || !external_url.trim()) {
        return errorResponse(
          res,
          "External URL is required.",
          "VALIDATION_FAILED",
          null,
          422,
        );
      }

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const newVersion = await documentVersionService.createExternalVersion(
        documentId,
        {
          external_url,
          external_provider,
          external_file_name,
          external_file_size,
          external_mime_type,
          change_summary,
        },
        req.user,
        reqInfo,
      );

      return successResponse(
        res,
        "New external document revision created successfully.",
        newVersion,
        201,
      );
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "VERSION_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Get version history for a document
   * GET /api/v1/documents/:documentId/versions
   */
  async getVersions(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      if (isNaN(documentId)) {
        return errorResponse(
          res,
          "Invalid document identifier.",
          "INVALID_ID",
          null,
          400,
        );
      }

      const versions = await documentVersionService.getDocumentVersions(
        documentId,
        req.user,
      );
      return successResponse(
        res,
        "Document versions retrieved successfully.",
        versions,
        200,
      );
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "VERSION_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Download a specific document version
   * GET /api/v1/documents/:documentId/versions/:versionId/download
   */
  async downloadVersion(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      const versionId = parseInt(req.params.versionId, 10);

      if (isNaN(documentId) || isNaN(versionId)) {
        return errorResponse(
          res,
          "Invalid document or version identifier.",
          "INVALID_ID",
          null,
          400,
        );
      }

      const isPreview =
        req.query.preview === "true" || req.query.inline === "true";
      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };

      const downloadData = await documentVersionService.prepareDownload(
        documentId,
        versionId,
        req.user,
        reqInfo,
        req.vault?.vaultKey || null,
      );

      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader(
        "Content-Type",
        downloadData.mimeType || "application/octet-stream",
      );

      const disposition = isPreview ? "inline" : "attachment";
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${encodeURIComponent(downloadData.filename)}"`,
      );

      downloadData.stream.pipe(res);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "DOWNLOAD_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Get single version details
   * GET /api/v1/documents/:documentId/versions/:versionId
   */
  async getVersionById(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      const versionId = parseInt(req.params.versionId, 10);
      if (isNaN(documentId) || isNaN(versionId)) {
        return errorResponse(
          res,
          "Invalid identifier.",
          "INVALID_ID",
          null,
          400,
        );
      }
      const versions = await documentVersionService.getDocumentVersions(
        documentId,
        req.user,
      );
      const version = versions.find((v) => v.id === versionId);
      if (!version) {
        return errorResponse(
          res,
          "Document version not found.",
          "NOT_FOUND",
          null,
          404,
        );
      }
      return successResponse(
        res,
        "Document version retrieved successfully.",
        version,
        200,
      );
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "VERSION_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }
}

module.exports = new DocumentVersionController();
