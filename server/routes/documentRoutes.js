const express = require("express");
const multer = require("multer");
const env = require("../config/env");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { attachVaultIfUnlocked } = require("../middleware/requireVaultUnlock");

const documentController = require("../controllers/documentController");
const documentVersionController = require("../controllers/documentVersionController");
const documentPermissionController = require("../controllers/documentPermissionController");
const documentShareController = require("../controllers/documentShareController");
const documentTemplateController = require("../controllers/documentTemplateController");
const documentReviewController = require("../controllers/documentReviewController");
const documentSignatureController = require("../controllers/documentSignatureController");

// Configure Multer in-memory storage with size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.storage.maxFileSizeMb * 1024 * 1024,
  },
});

const router = express.Router();

// All document routes require authentication
router.use(authenticate);

// -------------------------------------------------------------
// 1. Static & Metadata Routes (Must precede /:documentId)
// -------------------------------------------------------------

// Dashboard KPI statistics
router.get(
  "/dashboard-stats",
  authorize("DOCUMENT_VIEW"),
  documentController.getDashboardStats
);

// Configurable document types
router.get(
  "/types",
  authorize("DOCUMENT_VIEW"),
  documentController.getDocumentTypes
);

// Folders (Case-level or firm-level)
router.get(
  "/folders",
  authorize("DOCUMENT_VIEW"),
  documentController.getFolders
);
router.post(
  "/folders",
  authorize("DOCUMENT_CREATE"),
  documentController.createFolder
);

// Advanced Search
router.get(
  "/search",
  authorize("DOCUMENT_VIEW"),
  documentController.searchDocuments
);

// Create from template
router.post(
  "/from-template",
  authorize("DOCUMENT_CREATE"),
  attachVaultIfUnlocked,
  documentController.createFromTemplate
);

// Template library routes
router.get(
  "/templates",
  authorize("DOCUMENT_VIEW"),
  documentTemplateController.getTemplates
);
router.post(
  "/templates",
  authorize("DOCUMENT_CREATE"),
  documentTemplateController.createTemplate
);
router.get(
  "/templates/:templateId",
  authorize("DOCUMENT_VIEW"),
  documentTemplateController.getTemplateById
);
router.put(
  "/templates/:templateId",
  authorize("DOCUMENT_UPDATE"),
  documentTemplateController.updateTemplate
);
router.post(
  "/templates/:templateId/preview",
  authorize("DOCUMENT_VIEW"),
  documentTemplateController.previewTemplate
);

// eSign provider status
router.get(
  "/signatures/provider-status",
  authorize("DOCUMENT_VIEW"),
  documentSignatureController.getProviderStatus
);

// -------------------------------------------------------------
// 2. Global Document Creation & Listing
// -------------------------------------------------------------

// Upload a new document (firm-level or case-level if case_id passed in body)
router.post(
  "/",
  authorize("DOCUMENT_CREATE"),
  attachVaultIfUnlocked,
  upload.single("file"),
  documentController.createDocument
);

// Dedicated Internal upload endpoint
router.post(
  "/upload",
  authorize("DOCUMENT_CREATE"),
  attachVaultIfUnlocked,
  upload.single("file"),
  documentController.createDocument
);

// Dedicated Direct External Cloud Link creation endpoint
router.post(
  "/external-link",
  authorize("DOCUMENT_CREATE"),
  documentController.createExternalDocument
);

// Search / list documents across chambers (with filters and authorization - metadata only)
router.get(
  "/",
  authorize("DOCUMENT_VIEW"),
  documentController.getDocuments
);

// -------------------------------------------------------------
// 3. Single Document Operations (/:documentId)
// -------------------------------------------------------------

// Get single document details (metadata only)
router.get(
  "/:documentId",
  authorize("DOCUMENT_VIEW"),
  documentController.getDocumentById
);

// Retrieve external link and record audit event
router.get(
  "/:documentId/external-link",
  authorize("DOCUMENT_VIEW"),
  documentController.getExternalLink
);

// Download current version of document (or preview)
router.get(
  "/:documentId/download",
  authorize("DOCUMENT_DOWNLOAD"),
  attachVaultIfUnlocked,
  documentController.downloadDocument
);

// Update document metadata
router.patch(
  "/:documentId",
  authorize("DOCUMENT_UPDATE"),
  documentController.updateDocument
);

// Soft delete document
router.delete(
  "/:documentId",
  authorize("DOCUMENT_DELETE"),
  documentController.deleteDocument
);

// Restore document
router.post(
  "/:documentId/restore",
  authorize("DOCUMENT_DELETE"),
  documentController.restoreDocument
);

// Archive document
router.post(
  "/:documentId/archive",
  authorize("DOCUMENT_UPDATE"),
  documentController.archiveDocument
);

// -------------------------------------------------------------
// 4. Document Versions Routes
// -------------------------------------------------------------

// Get all versions of a document (metadata only)
router.get(
  "/:documentId/versions",
  authorize("DOCUMENT_VIEW"),
  documentVersionController.getVersions
);

// Upload new version to an existing document (internal file)
router.post(
  "/:documentId/versions",
  authorize("DOCUMENT_UPLOAD_VERSION"),
  attachVaultIfUnlocked,
  upload.single("file"),
  documentVersionController.uploadVersion
);

// Add external link revision to an existing document
router.post(
  "/:documentId/versions/external-link",
  authorize("DOCUMENT_UPLOAD_VERSION"),
  documentVersionController.createExternalVersion
);

// Get single version details
router.get(
  "/:documentId/versions/:versionId",
  authorize("DOCUMENT_VIEW"),
  documentVersionController.getVersionById
);

// Retrieve external link for specific version
router.get(
  "/:documentId/versions/:versionId/external-link",
  authorize("DOCUMENT_VIEW"),
  documentController.getExternalLink
);

// Download specific version of a document
router.get(
  "/:documentId/versions/:versionId/download",
  authorize("DOCUMENT_DOWNLOAD"),
  attachVaultIfUnlocked,
  documentVersionController.downloadVersion
);

// -------------------------------------------------------------
// 5. Document Permissions Routes
// -------------------------------------------------------------

router.get(
  "/:documentId/permissions",
  authorize("DOCUMENT_MANAGE_PERMISSION"),
  documentPermissionController.getPermissions
);

router.post(
  "/:documentId/permissions",
  authorize("DOCUMENT_MANAGE_PERMISSION"),
  documentPermissionController.grantPermission
);

router.delete(
  "/:documentId/permissions/:permissionId",
  authorize("DOCUMENT_MANAGE_PERMISSION"),
  documentPermissionController.revokePermission
);

// -------------------------------------------------------------
// 6. Internal Document Sharing Routes
// -------------------------------------------------------------

router.get(
  "/:documentId/shares",
  authorize("DOCUMENT_SHARE"),
  documentShareController.getShares
);

router.post(
  "/:documentId/shares",
  authorize("DOCUMENT_SHARE"),
  documentShareController.createShare
);

router.delete(
  "/:documentId/shares/:shareId",
  authorize("DOCUMENT_SHARE"),
  documentShareController.revokeShare
);

// -------------------------------------------------------------
// 7. Document Review & Approval Workflow
// -------------------------------------------------------------

router.post(
  "/:id/reviews/submit",
  authorize("DOCUMENT_UPDATE"),
  documentReviewController.submitForReview
);

router.post(
  "/:id/reviews/approve",
  authorize("DOCUMENT_UPDATE"),
  documentReviewController.approveDocument
);

router.post(
  "/:id/reviews/request-changes",
  authorize("DOCUMENT_UPDATE"),
  documentReviewController.requestChanges
);

router.post(
  "/:id/reviews/reject",
  authorize("DOCUMENT_UPDATE"),
  documentReviewController.rejectDocument
);

router.get(
  "/:id/reviews",
  authorize("DOCUMENT_VIEW"),
  documentReviewController.getDocumentReviews
);

// Threaded Comments
router.post(
  "/:id/comments",
  authorize("DOCUMENT_VIEW"),
  documentReviewController.addComment
);

router.get(
  "/:id/comments",
  authorize("DOCUMENT_VIEW"),
  documentReviewController.getDocumentComments
);

router.patch(
  "/:id/comments/:commentId/resolve",
  authorize("DOCUMENT_UPDATE"),
  documentReviewController.resolveComment
);

// -------------------------------------------------------------
// 8. E-Signature Workflow
// -------------------------------------------------------------

router.post(
  "/:id/signatures",
  authorize("DOCUMENT_UPDATE"),
  documentSignatureController.createSignatureRequest
);

router.get(
  "/:id/signatures/:requestId",
  authorize("DOCUMENT_VIEW"),
  documentSignatureController.getSignatureRequest
);

router.post(
  "/:id/signatures/:requestId/cancel",
  authorize("DOCUMENT_UPDATE"),
  documentSignatureController.cancelSignatureRequest
);

router.get(
  "/:id/signatures/:requestId/download",
  authorize("DOCUMENT_DOWNLOAD"),
  documentSignatureController.downloadSignedDocument
);

module.exports = {
  documentRouter: router,
  uploadMiddleware: upload,
};
