import apiClient from "./api";

/**
 * Document API Service for Frontend
 */
export const documentService = {
  // -------------------------------------------------------------
  // Dashboard & Metadata
  // -------------------------------------------------------------
  getDashboardStats: async () => {
    const res = await apiClient.get("/documents/dashboard-stats");
    return res.data;
  },

  getDocumentTypes: async () => {
    const res = await apiClient.get("/documents/types");
    return res.data;
  },

  getFolders: async (params = {}) => {
    const res = await apiClient.get("/documents/folders", { params });
    return res.data;
  },

  createFolder: async (folderData) => {
    const res = await apiClient.post("/documents/folders", folderData);
    return res.data;
  },

  searchDocuments: async (params = {}) => {
    const res = await apiClient.get("/documents/search", { params });
    return res.data;
  },

  // -------------------------------------------------------------
  // Document CRUD & Uploads
  // -------------------------------------------------------------
  getDocuments: async (params = {}) => {
    const res = await apiClient.get("/documents", { params });
    return res.data;
  },

  getDocumentById: async (documentId) => {
    const res = await apiClient.get(`/documents/${documentId}`);
    return res.data;
  },

  createDocument: async (caseId, formData, onProgress = null) => {
    const url = caseId ? `/cases/${caseId}/documents` : "/documents";
    const res = await apiClient.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return res.data;
  },

  createFromTemplate: async (data) => {
    const res = await apiClient.post("/documents/from-template", data);
    return res.data;
  },

  createExternalDocument: async (caseId, data) => {
    const url = "/documents/external-link";
    const res = await apiClient.post(url, { ...data, case_id: caseId || data.case_id, storage_type: "EXTERNAL" });
    return res.data;
  },

  getExternalLink: async (documentId, versionId = null) => {
    const url = versionId 
      ? `/documents/${documentId}/versions/${versionId}/external-link`
      : `/documents/${documentId}/external-link`;
    const res = await apiClient.get(url);
    return res.data;
  },

  createExternalVersion: async (documentId, data) => {
    const res = await apiClient.post(`/documents/${documentId}/versions/external-link`, data);
    return res.data;
  },

  getCaseDocuments: async (caseId, params = {}) => {
    const res = await apiClient.get(`/cases/${caseId}/documents`, { params });
    return res.data;
  },

  updateDocument: async (documentId, data) => {
    const res = await apiClient.patch(`/documents/${documentId}`, data);
    return res.data;
  },

  deleteDocument: async (documentId) => {
    const res = await apiClient.delete(`/documents/${documentId}`);
    return res.data;
  },

  restoreDocument: async (documentId) => {
    const res = await apiClient.post(`/documents/${documentId}/restore`);
    return res.data;
  },

  archiveDocument: async (documentId) => {
    const res = await apiClient.post(`/documents/${documentId}/archive`);
    return res.data;
  },

  downloadDocument: async (documentId, preview = false) => {
    const res = await apiClient.get(`/documents/${documentId}/download`, {
      params: { preview: preview ? "true" : "false" },
      responseType: "blob",
    });
    return res;
  },

  // -------------------------------------------------------------
  // Versions
  // -------------------------------------------------------------
  getVersions: async (documentId) => {
    const res = await apiClient.get(`/documents/${documentId}/versions`);
    return res.data;
  },

  uploadVersion: async (documentId, formData, onProgress = null) => {
    const res = await apiClient.post(`/documents/${documentId}/versions`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return res.data;
  },

  downloadVersion: async (documentId, versionId, preview = false) => {
    const res = await apiClient.get(`/documents/${documentId}/versions/${versionId}/download`, {
      params: { preview: preview ? "true" : "false" },
      responseType: "blob",
    });
    return res;
  },

  // -------------------------------------------------------------
  // Legal Templates
  // -------------------------------------------------------------
  getTemplates: async (params = {}) => {
    const res = await apiClient.get("/documents/templates", { params });
    return res.data;
  },

  getTemplateById: async (templateId) => {
    const res = await apiClient.get(`/documents/templates/${templateId}`);
    return res.data;
  },

  createTemplate: async (templateData) => {
    const res = await apiClient.post("/documents/templates", templateData);
    return res.data;
  },

  updateTemplate: async (templateId, templateData) => {
    const res = await apiClient.put(`/documents/templates/${templateId}`, templateData);
    return res.data;
  },

  previewTemplate: async (templateId, data) => {
    const res = await apiClient.post(`/documents/templates/${templateId}/preview`, data);
    return res.data;
  },

  // -------------------------------------------------------------
  // Reviews & Approvals
  // -------------------------------------------------------------
  submitForReview: async (documentId, data) => {
    const res = await apiClient.post(`/documents/${documentId}/reviews/submit`, data);
    return res.data;
  },

  approveDocument: async (documentId, data = {}) => {
    const res = await apiClient.post(`/documents/${documentId}/reviews/approve`, data);
    return res.data;
  },

  requestChanges: async (documentId, data) => {
    const res = await apiClient.post(`/documents/${documentId}/reviews/request-changes`, data);
    return res.data;
  },

  rejectDocument: async (documentId, data) => {
    const res = await apiClient.post(`/documents/${documentId}/reviews/reject`, data);
    return res.data;
  },

  getDocumentReviews: async (documentId) => {
    const res = await apiClient.get(`/documents/${documentId}/reviews`);
    return res.data;
  },

  // Comments
  addComment: async (documentId, commentData) => {
    const res = await apiClient.post(`/documents/${documentId}/comments`, commentData);
    return res.data;
  },

  getDocumentComments: async (documentId) => {
    const res = await apiClient.get(`/documents/${documentId}/comments`);
    return res.data;
  },

  resolveComment: async (documentId, commentId) => {
    const res = await apiClient.patch(`/documents/${documentId}/comments/${commentId}/resolve`);
    return res.data;
  },

  // -------------------------------------------------------------
  // E-Signatures
  // -------------------------------------------------------------
  createSignatureRequest: async (documentId, signatureData) => {
    const res = await apiClient.post(`/documents/${documentId}/signatures`, signatureData);
    return res.data;
  },

  getSignatureRequest: async (documentId, requestId) => {
    const res = await apiClient.get(`/documents/${documentId}/signatures/${requestId}`);
    return res.data;
  },

  cancelSignatureRequest: async (documentId, requestId, data = {}) => {
    const res = await apiClient.post(`/documents/${documentId}/signatures/${requestId}/cancel`, data);
    return res.data;
  },

  downloadSignedDocument: async (documentId, requestId) => {
    const res = await apiClient.get(`/documents/${documentId}/signatures/${requestId}/download`, {
      responseType: "blob",
    });
    return res;
  },

  getProviderStatus: async () => {
    const res = await apiClient.get("/documents/signatures/provider-status");
    return res.data;
  },

  // -------------------------------------------------------------
  // Permissions & Sharing
  // -------------------------------------------------------------
  getPermissions: async (documentId) => {
    const res = await apiClient.get(`/documents/${documentId}/permissions`);
    return res.data;
  },

  grantPermission: async (documentId, data) => {
    const res = await apiClient.post(`/documents/${documentId}/permissions`, data);
    return res.data;
  },

  revokePermission: async (documentId, permissionId) => {
    const res = await apiClient.delete(`/documents/${documentId}/permissions/${permissionId}`);
    return res.data;
  },

  getShares: async (documentId) => {
    const res = await apiClient.get(`/documents/${documentId}/shares`);
    return res.data;
  },

  createShare: async (documentId, data) => {
    const res = await apiClient.post(`/documents/${documentId}/shares`, data);
    return res.data;
  },

  revokeShare: async (documentId, shareId) => {
    const res = await apiClient.delete(`/documents/${documentId}/shares/${shareId}`);
    return res.data;
  },
};

export default documentService;
