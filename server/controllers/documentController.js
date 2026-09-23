const documentService = require("../services/documentService");
const documentVersionService = require("../services/documentVersionService");
const documentFolderService = require("../services/documentFolderService");
const documentSearchService = require("../services/documentSearchService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Controller for Document creation, listing, details, update, soft delete, and restore
 */
class DocumentController {
  /**
   * Upload and create a new document (case or firm level)
   * POST /api/v1/cases/:caseId/documents or POST /api/v1/documents
   */
  async createDocument(req, res, next) {
    try {
      const rawCaseId = req.params.caseId || req.body.case_id || req.body.caseId;
      const caseId = rawCaseId ? parseInt(rawCaseId, 10) : null;
      if (rawCaseId && isNaN(caseId)) {
        return errorResponse(
          res,
          "Invalid case identifier.",
          "INVALID_ID",
          null,
          400,
        );
      }

      // If client requested an external link document instead of local file
      if (req.body.storage_type === "EXTERNAL" || req.body.external_url) {
        return await this.createExternalDocument(req, res, next);
      }

      if (!req.file) {
        return errorResponse(
          res,
          "No file uploaded. Please attach a document.",
          "FILE_REQUIRED",
          null,
          422,
        );
      }

      const {
        title,
        description,
        category,
        document_type,
        document_type_id,
        folder_id,
        confidentiality_level,
        change_summary,
        source,
      } = req.body;
      if (!title || !title.trim()) {
        return errorResponse(
          res,
          "Document title is required.",
          "VALIDATION_FAILED",
          null,
          422,
        );
      }

      if (!category) {
        return errorResponse(
          res,
          "Document category is required.",
          "VALIDATION_FAILED",
          null,
          422,
        );
      }

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };

      const newDoc = await documentService.createDocument(
        caseId,
        {
          title,
          description,
          category,
          document_type,
          document_type_id,
          folder_id,
          source,
          confidentiality_level,
          change_summary,
        },
        req.file,
        req.user,
        reqInfo,
        req.vault?.vaultKey || null,
      );

      return successResponse(
        res,
        "Document created and uploaded successfully.",
        newDoc,
        201,
      );
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "DOCUMENT_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Create a new document referencing an external cloud link
   * POST /api/v1/documents/external-link
   */
  async createExternalDocument(req, res, next) {
    try {
      const rawCaseId = req.params.caseId || req.body.case_id || req.body.caseId;
      const caseId = rawCaseId ? parseInt(rawCaseId, 10) : null;
      if (rawCaseId && isNaN(caseId)) {
        return errorResponse(
          res,
          "Invalid case identifier.",
          "INVALID_ID",
          null,
          400,
        );
      }

      const {
        title,
        description,
        category,
        document_type,
        document_type_id,
        folder_id,
        confidentiality_level,
        external_provider,
        external_url,
        external_file_name,
        external_file_size,
        external_mime_type,
        change_summary,
        status,
      } = req.body;

      if (!title || !title.trim()) {
        return errorResponse(
          res,
          "Document title is required.",
          "VALIDATION_FAILED",
          null,
          422,
        );
      }

      if (!external_url || !external_url.trim()) {
        return errorResponse(
          res,
          "External document URL is required.",
          "VALIDATION_FAILED",
          null,
          422,
        );
      }

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };

      const newDoc = await documentService.createExternalDocument(
        caseId,
        {
          title,
          description,
          category: category || "CASE_DOCUMENT",
          document_type,
          document_type_id,
          folder_id,
          confidentiality_level,
          external_provider,
          external_url,
          external_file_name,
          external_file_size,
          external_mime_type,
          change_summary,
          status,
        },
        req.user,
        reqInfo,
      );

      return successResponse(
        res,
        "External document link saved successfully.",
        newDoc,
        201,
      );
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "DOCUMENT_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Securely retrieve external document link and record audit event
   * GET /api/v1/documents/:documentId/external-link
   * GET /api/v1/documents/:documentId/versions/:versionId/external-link
   */
  async getExternalLink(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      const versionId = req.params.versionId
        ? parseInt(req.params.versionId, 10)
        : null;
      if (isNaN(documentId)) {
        return errorResponse(
          res,
          "Invalid document identifier.",
          "INVALID_ID",
          null,
          400,
        );
      }

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const linkData = await documentService.getExternalLink(
        documentId,
        versionId,
        req.user,
        reqInfo,
      );

      return successResponse(
        res,
        "External document link retrieved successfully.",
        linkData,
        200,
      );
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "DOCUMENT_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Get all documents with search, filter, pagination
   * GET /api/v1/documents
   */
  async getDocuments(req, res, next) {
    try {
      const result = await documentService.getDocuments(req.query, req.user);
      return successResponse(
        res,
        "Documents retrieved successfully.",
        result,
        200,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get documents specifically linked to a case
   * GET /api/v1/cases/:caseId/documents
   */
  async getCaseDocuments(req, res, next) {
    try {
      const caseId = parseInt(req.params.caseId, 10);
      if (isNaN(caseId)) {
        return errorResponse(
          res,
          "Invalid case identifier.",
          "INVALID_ID",
          null,
          400,
        );
      }

      const queryParams = { ...req.query, case_id: caseId };
      const result = await documentService.getDocuments(queryParams, req.user);
      return successResponse(
        res,
        "Case documents retrieved successfully.",
        result,
        200,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single document by ID
   * GET /api/v1/documents/:documentId
   */
  async getDocumentById(req, res, next) {
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

      const doc = await documentService.getDocumentById(documentId, req.user);
      return successResponse(res, "Document retrieved successfully.", doc, 200);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "DOCUMENT_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Update document metadata
   * PATCH /api/v1/documents/:documentId
   */
  async updateDocument(req, res, next) {
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

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const updated = await documentService.updateDocument(
        documentId,
        req.body,
        req.user,
        reqInfo,
      );
      return successResponse(
        res,
        "Document updated successfully.",
        updated,
        200,
      );
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "DOCUMENT_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Soft delete document
   * DELETE /api/v1/documents/:documentId
   */
  async deleteDocument(req, res, next) {
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

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const result = await documentService.softDeleteDocument(
        documentId,
        req.user,
        reqInfo,
      );
      return successResponse(
        res,
        "Document deleted successfully.",
        result,
        200,
      );
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "DOCUMENT_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Restore document
   * POST /api/v1/documents/:documentId/restore
   */
  async restoreDocument(req, res, next) {
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

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const result = await documentService.restoreDocument(
        documentId,
        req.user,
        reqInfo,
      );
      return successResponse(
        res,
        "Document restored successfully.",
        result,
        200,
      );
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(
          res,
          error.message,
          "DOCUMENT_ERROR",
          null,
          error.statusCode,
        );
      }
      next(error);
    }
  }

  /**
   * Download / preview current version of a document
   * GET /api/v1/documents/:documentId/download
   */
  async downloadDocument(req, res, next) {
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

      const isPreview =
        req.query.preview === "true" || req.query.inline === "true";
      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };

      const downloadData = await documentVersionService.prepareDownload(
        documentId,
        null,
        req.user,
        reqInfo,
        req.vault?.vaultKey || null,
      );

      // Safe headers
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
   * Get KPI dashboard metrics
   * GET /api/v1/documents/dashboard-stats
   */
  async getDashboardStats(req, res, next) {
    try {
      const stats = await documentService.getDashboardStats(req.user);
      return successResponse(res, "Dashboard statistics retrieved successfully.", stats, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Archive document
   * POST /api/v1/documents/:documentId/archive
   */
  async archiveDocument(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const result = await documentService.archiveDocument(documentId, req.user, reqInfo);
      return successResponse(res, "Document archived successfully.", result, 200);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(res, error.message, "DOCUMENT_ERROR", null, error.statusCode);
      }
      next(error);
    }
  }

  /**
   * Create document from template
   * POST /api/v1/documents/from-template
   */
  async createFromTemplate(req, res, next) {
    try {
      const {
        template_id,
        case_id,
        title,
        variables,
        folder_id,
        category,
        confidentiality_level
      } = req.body;

      if (!template_id) {
        return errorResponse(res, "Template ID is required.", "VALIDATION_FAILED", null, 422);
      }

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const doc = await documentService.createFromTemplate({
        templateId: template_id,
        caseId: case_id || null,
        title,
        variables: variables || {},
        folderId: folder_id || null,
        category,
        confidentialityLevel: confidentiality_level,
        user: req.user,
        reqInfo,
        vaultKey: req.vault?.vaultKey || null
      });

      return successResponse(res, "Document created from template successfully.", doc, 201);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(res, error.message, "DOCUMENT_ERROR", null, error.statusCode);
      }
      next(error);
    }
  }

  /**
   * Get all configurable document types
   * GET /api/v1/documents/types
   */
  async getDocumentTypes(req, res, next) {
    try {
      const types = await documentService.getDocumentTypes();
      return successResponse(res, "Document types retrieved successfully.", types, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get folders (case-specific or firm-level)
   * GET /api/v1/documents/folders
   */
  async getFolders(req, res, next) {
    try {
      const caseId = req.query.case_id ? parseInt(req.query.case_id, 10) : null;
      const folders = await documentFolderService.getFolders({ caseId, userId: req.user.id });
      return successResponse(res, "Folders retrieved successfully.", folders, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create folder
   * POST /api/v1/documents/folders
   */
  async createFolder(req, res, next) {
    try {
      const { case_id, parent_folder_id, name, description } = req.body;
      const folder = await documentFolderService.createFolder({
        caseId: case_id || null,
        parentFolderId: parent_folder_id || null,
        name,
        description,
        userId: req.user.id
      });
      return successResponse(res, "Folder created successfully.", folder, 201);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(res, error.message, "FOLDER_ERROR", null, error.statusCode);
      }
      next(error);
    }
  }

  /**
   * Advanced search for documents
   * GET /api/v1/documents/search
   */
  async searchDocuments(req, res, next) {
    try {
      const results = await documentSearchService.searchDocuments(req.query, req.user);
      return successResponse(res, "Search completed successfully.", results, 200);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DocumentController();
