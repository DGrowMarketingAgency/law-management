const documentPermissionService = require("../services/documentPermissionService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Controller for Document Permissions (granular ACLs)
 */
class DocumentPermissionController {
  async getPermissions(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      if (isNaN(documentId)) {
        return errorResponse(res, "Invalid document identifier.", "INVALID_ID", null, 400);
      }

      const permissions = await documentPermissionService.getDocumentPermissions(documentId, req.user);
      return successResponse(res, "Document permissions retrieved successfully.", permissions, 200);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(res, error.message, "PERMISSION_ERROR", null, error.statusCode);
      }
      next(error);
    }
  }

  async grantPermission(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      if (isNaN(documentId)) {
        return errorResponse(res, "Invalid document identifier.", "INVALID_ID", null, 400);
      }

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const perm = await documentPermissionService.grantDocumentPermission(
        documentId,
        req.body,
        req.user,
        reqInfo
      );

      return successResponse(res, "Permission granted successfully.", perm, 201);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(res, error.message, "PERMISSION_ERROR", null, error.statusCode);
      }
      next(error);
    }
  }

  async revokePermission(req, res, next) {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      const permissionId = parseInt(req.params.permissionId, 10);
      if (isNaN(documentId) || isNaN(permissionId)) {
        return errorResponse(res, "Invalid identifier.", "INVALID_ID", null, 400);
      }

      const reqInfo = { ip: req.ip, userAgent: req.get("User-Agent") };
      const result = await documentPermissionService.revokeDocumentPermission(
        documentId,
        permissionId,
        req.user,
        reqInfo
      );

      return successResponse(res, "Permission revoked successfully.", result, 200);
    } catch (error) {
      if (error.statusCode) {
        return errorResponse(res, error.message, "PERMISSION_ERROR", null, error.statusCode);
      }
      next(error);
    }
  }
}

module.exports = new DocumentPermissionController();
