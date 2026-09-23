const documentShareService = require("../services/documentShareService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Controller for Document Shares (internal authenticated sharing)
 */
class DocumentShareController {
  async getShares(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      if (isNaN(documentId)) {
        return errorResponse(res, "Invalid document identifier.", "INVALID_ID", null, 400);
      }

      const shares = await documentShareService.getDocumentShares(documentId, req.user);
      return successResponse(res, "Document shares retrieved successfully.", shares, 200);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(res, error.message, "SHARE_ERROR", null, error.statusCode);
      }
      next(error);
    }
  }

  async createShare(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      if (isNaN(documentId)) {
        return errorResponse(res, "Invalid document identifier.", "INVALID_ID", null, 400);
      }

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const share = await documentShareService.createDocumentShare(
        documentId,
        req.body,
        req.user,
        reqInfo
      );

      return successResponse(res, "Document shared successfully.", share, 201);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(res, error.message, "SHARE_ERROR", null, error.statusCode);
      }
      next(error);
    }
  }

  async revokeShare(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      const shareId = parseInt(req.params.shareId, 10);
      if (isNaN(documentId) || isNaN(shareId)) {
        return errorResponse(res, "Invalid identifier.", "INVALID_ID", null, 400);
      }

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const result = await documentShareService.revokeDocumentShare(
        documentId,
        shareId,
        req.user,
        reqInfo
      );

      return successResponse(res, "Share revoked successfully.", result, 200);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(res, error.message, "SHARE_ERROR", null, error.statusCode);
      }
      next(error);
    }
  }
}

module.exports = new DocumentShareController();
