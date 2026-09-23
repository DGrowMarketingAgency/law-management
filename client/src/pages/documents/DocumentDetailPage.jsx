import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import documentService from "../../services/documentService";
import {
  DocumentCategoryBadge,
  ConfidentialityBadge,
  DocumentWorkflowStatusBadge,
  DocumentStorageBadge,
  DOCUMENT_CATEGORIES,
  CONFIDENTIALITY_LEVELS,
} from "../../components/documents/DocumentStatusBadge";
import DocumentPreview from "../../components/documents/DocumentPreview";
import DocumentVersionHistory from "../../components/documents/DocumentVersionHistory";
import DocumentPermissionsModal from "../../components/documents/DocumentPermissionsModal";
import DocumentShareModal from "../../components/documents/DocumentShareModal";
import {
  IconDownload,
  IconEdit,
  IconShield,
  IconShare,
  IconTrash,
  IconAlertTriangle,
  IconLock,
  IconFileText,
  IconExternalLink,
} from "../../components/common/Icons";
import { useVault } from "../../context/VaultContext";
import apiClient from "../../services/api";

const DocumentDetailPage = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { isUnlocked, openUnlockModal } = useVault();

  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [comments, setComments] = useState([]);
  const [sigRequest, setSigRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tabs: 'PREVIEW' | 'VERSIONS' | 'REVIEW' | 'COMMENTS' | 'ESIGN'
  const [activeTab, setActiveTab] = useState("PREVIEW");

  // Modals
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Review Workflow Action Form
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Threaded Comment Form
  const [newComment, setNewComment] = useState("");
  const [commentPage, setCommentPage] = useState("");
  const [replyParentId, setReplyParentId] = useState(null);
  const [commentLoading, setCommentLoading] = useState(false);

  // E-Sign Request Form
  const [esignProvider, setEsignProvider] = useState("DIGIO");
  const [esignOrder, setEsignOrder] = useState("PARALLEL");
  const [signersList, setSignersList] = useState([
    { name: "", email: "", phone: "", role: "CLIENT" },
  ]);
  const [esignLoading, setEsignLoading] = useState(false);

  // Edit metadata form states
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editConfidentiality, setEditConfidentiality] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  useEffect(() => {
    fetchDocumentData();
  }, [documentId]);

  const fetchDocumentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [docRes, verRes, revRes, comRes] = await Promise.all([
        documentService.getDocumentById(documentId),
        documentService.getVersions(documentId),
        documentService.getDocumentReviews(documentId).catch(() => ({ data: [] })),
        documentService.getDocumentComments(documentId).catch(() => ({ data: [] })),
      ]);

      if (docRes.success) {
        const doc = docRes.data;
        setDocument(doc);
        setEditTitle(doc.title);
        setEditDescription(doc.description || "");
        setEditCategory(doc.category);
        setEditConfidentiality(doc.confidentiality_level);

        // Pre-fill primary client for e-sign
        if (doc.client_name || doc.client_email) {
          setSignersList([
            {
              name: doc.client_name || "",
              email: doc.client_email || "",
              phone: doc.client_phone || "",
              role: "CLIENT",
            },
          ]);
        }
      }

      if (verRes.success) setVersions(verRes.data);
      if (revRes.success) setReviews(revRes.data);
      if (comRes.success) setComments(comRes.data);

      // Check if signature request exists
      fetchSignatureStatus();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load document.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSignatureStatus = async () => {
    try {
      const res = await apiClient.get(`/documents/${documentId}/signatures/1`).catch(() => null);
      if (res?.data?.success) {
        setSigRequest(res.data.data);
      }
    } catch (e) {
      // no-op
    }
  };

  const handleDownloadCurrent = async () => {
    try {
      const response = await documentService.downloadDocument(documentId, false);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", document.original_filename || `${document.title}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err.response?.status === 423 || err.response?.data?.error?.code === "VAULT_LOCKED") {
        openUnlockModal(() => handleDownloadCurrent());
      } else {
        alert("Download failed: " + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleDownloadSigned = async () => {
    if (!sigRequest?.id) return;
    try {
      const res = await documentService.downloadSignedDocument(documentId, sigRequest.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Signed_${document.title}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Signed download failed: " + (err.response?.data?.message || err.message));
    }
  };

  const handleOpenExternal = async () => {
    try {
      const res = await documentService.getExternalLink(documentId);
      if (res.success && res.data?.external_url) {
        window.open(res.data.external_url, "_blank", "noopener,noreferrer");
      } else {
        alert("Failed to retrieve external URL: " + (res.message || "Unknown error"));
      }
    } catch (err) {
      alert("Cannot open external document: " + (err.response?.data?.message || err.message));
    }
  };

  // Review Workflow Actions
  const handleSubmitForReview = async () => {
    setReviewActionLoading(true);
    setActionError(null);
    try {
      const res = await documentService.submitForReview(documentId, {
        notes: reviewNotes.trim(),
      });
      if (res.success) {
        alert("Document submitted for review successfully.");
        setReviewNotes("");
        fetchDocumentData();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleApproveDocument = async () => {
    if (!window.confirm("Approve this document? This will finalize the draft and lock it against modifications.")) {
      return;
    }
    setReviewActionLoading(true);
    setActionError(null);
    try {
      const res = await documentService.approveDocument(documentId, {
        comments: reviewNotes.trim() || "Approved by Advocate",
      });
      if (res.success) {
        alert("Document successfully approved and locked.");
        setReviewNotes("");
        fetchDocumentData();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!reviewNotes.trim()) {
      setActionError("Please provide specific feedback/notes on what changes are required.");
      return;
    }
    setReviewActionLoading(true);
    setActionError(null);
    try {
      const res = await documentService.requestChanges(documentId, {
        comments: reviewNotes.trim(),
      });
      if (res.success) {
        alert("Changes requested. Document unlocked for author revisions.");
        setReviewNotes("");
        fetchDocumentData();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setReviewActionLoading(false);
    }
  };

  // Threaded Comments
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommentLoading(true);
    try {
      const res = await documentService.addComment(documentId, {
        commentText: newComment.trim(),
        parentCommentId: replyParentId,
        pageNumber: commentPage ? parseInt(commentPage, 10) : null,
      });
      if (res.success) {
        setNewComment("");
        setCommentPage("");
        setReplyParentId(null);
        const cRes = await documentService.getDocumentComments(documentId);
        if (cRes.success) setComments(cRes.data);
      }
    } catch (err) {
      alert("Failed to post comment: " + (err.response?.data?.message || err.message));
    } finally {
      setCommentLoading(false);
    }
  };

  const handleResolveComment = async (commentId) => {
    try {
      await documentService.resolveComment(documentId, commentId);
      const cRes = await documentService.getDocumentComments(documentId);
      if (cRes.success) setComments(cRes.data);
    } catch (err) {
      alert("Failed to resolve comment: " + (err.response?.data?.message || err.message));
    }
  };

  // E-Sign Request
  const handleAddSigner = () => {
    setSignersList([...signersList, { name: "", email: "", phone: "", role: "CLIENT" }]);
  };

  const handleSignerChange = (idx, field, val) => {
    const updated = [...signersList];
    updated[idx][field] = val;
    setSignersList(updated);
  };

  const handleRemoveSigner = (idx) => {
    if (signersList.length <= 1) return;
    setSignersList(signersList.filter((_, i) => i !== idx));
  };

  const handleCreateEsignRequest = async (e) => {
    e.preventDefault();
    const validSigners = signersList.filter((s) => s.email && s.name);
    if (validSigners.length === 0) {
      alert("Please specify at least one signer with Name and Email.");
      return;
    }

    setEsignLoading(true);
    setActionError(null);
    try {
      const res = await documentService.createSignatureRequest(documentId, {
        signers: validSigners,
        provider: esignProvider,
        signingOrder: esignOrder,
      });
      if (res.success) {
        alert("E-Signature request initiated successfully!");
        setSigRequest(res.data);
        fetchDocumentData();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setEsignLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);

    try {
      const res = await documentService.updateDocument(documentId, {
        title: editTitle,
        description: editDescription,
        category: editCategory,
        confidentiality_level: editConfidentiality,
      });
      if (res.success) {
        setDocument(res.data);
        setShowEditModal(false);
      } else {
        setEditError(res.message);
      }
    } catch (err) {
      setEditError(err.response?.data?.message || err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Move this document to trash? It can be restored later by authorized advocates.")) {
      return;
    }
    try {
      await documentService.deleteDocument(documentId);
      alert("Document moved to trash.");
      navigate(document.case_id ? `/cases/${document.case_id}` : "/documents");
    } catch (err) {
      alert("Delete failed: " + (err.response?.data?.message || err.message));
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: "#64748b" }}>
        Loading legal document details...
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
        <h3 style={{ color: "#ef4444" }}>Document Error</h3>
        <p style={{ color: "#64748b" }}>{error || "Document not found or access denied."}</p>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "3rem" }}>
      {/* Top Banner / Breadcrumb */}
      <div style={{ marginBottom: "1rem", fontSize: "0.85rem", color: "#64748b" }}>
        <Link to="/documents" style={{ color: "#0284c7", textDecoration: "none", fontWeight: 600 }}>
          Documents
        </Link>
        {" / "}
        {document.case_id ? (
          <>
            <Link to={`/cases/${document.case_id}`} style={{ color: "#0284c7", textDecoration: "none", fontWeight: 600 }}>
              Case {document.case_number || `#${document.case_id}`}
            </Link>
            {" / "}
          </>
        ) : (
          <span>Firm Repository / </span>
        )}
        <span style={{ color: "#0f172a", fontWeight: 600 }}>{document.document_number || document.title}</span>
      </div>

      {document.deleted_at && (
        <div
          style={{
            backgroundColor: "#000000",
            border: "1px solid #000000",
            padding: "0.75rem 1.25rem",
            borderRadius: "6px",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#ffffff", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <IconAlertTriangle size={16} color="#ffffff" /> This document is in the trash (Soft Deleted).
          </span>
          <button
            className="btn btn-secondary"
            style={{ backgroundColor: "#ffffff", color: "#000000" }}
            onClick={async () => {
              await documentService.restoreDocument(documentId);
              fetchDocumentData();
            }}
          >
            Restore Document
          </button>
        </div>
      )}

      {/* Main Metadata Header Card */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", fontSize: "0.9rem", fontWeight: 700, color: "#0369a1", backgroundColor: "#e0f2fe", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
                {document.document_number || `DOC-${document.id}`}
              </span>
              <h1 className="card-title" style={{ fontSize: "1.5rem", margin: 0 }}>
                {document.title}
              </h1>
              <DocumentCategoryBadge category={document.category} />
              <ConfidentialityBadge level={document.confidentiality_level} />
              <DocumentWorkflowStatusBadge status={document.status} />
              <DocumentStorageBadge storageType={document.storage_type} provider={document.external_provider} />
              {document.is_locked ? (
                <span title="Locked against unauthorized modifications" style={{ display: "inline-flex", alignItems: "center", gap: "3px", backgroundColor: "#fee2e2", color: "#b91c1c", fontSize: "0.72rem", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: "4px" }}>
                  <IconLock size={12} /> LOCKED
                </span>
              ) : null}
            </div>

            {document.case_id ? (
              <p style={{ color: "#64748b", margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>
                Linked Matter: <strong>{document.case_number}</strong> — {document.case_title}
              </p>
            ) : (
              <p style={{ color: "#64748b", margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>
                Classification: <strong>Firm-Level Document</strong> {document.folder_name ? `• 📁 ${document.folder_name}` : ""}
              </p>
            )}

            {document.description && (
              <p style={{ color: "#475569", margin: "0 0 0.75rem 0", fontSize: "0.85rem" }}>
                {document.description}
              </p>
            )}

            {document.storage_type === "EXTERNAL" && (
              <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "0.6rem 0.85rem", marginBottom: "0.75rem", fontSize: "0.82rem", color: "#166534" }}>
                <strong>External Cloud Document:</strong> Hosted on <strong>{document.external_provider || "External Cloud"}</strong>.
                {document.external_file_name && <> File Name: <code>{document.external_file_name}</code> &bull; </>}
                Status: <span style={{ fontWeight: 600 }}>{document.external_url_status || "NOT_CHECKED"}</span>
                <p style={{ margin: "0.25rem 0 0 0", color: "#15803d", fontSize: "0.78rem" }}>
                  ℹ️ Access to the physical file is controlled by the external provider. Application-level RBAC is strictly enforced and each external link opening event is recorded in the immutable audit log.
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.8rem", color: "#64748b", flexWrap: "wrap" }}>
              <span>
                Current Version: <strong>v{document.version_number || 1}</strong>
              </span>
              <span>
                Filename: <strong>{document.original_filename || document.external_file_name || document.title}</strong>
              </span>
              <span>
                Created by: {document.creator_first_name} {document.creator_last_name}
              </span>
              <span>
                Last Modified: {new Date(document.updated_at || document.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {document.storage_type === "EXTERNAL" ? (
              <button
                className="btn btn-primary"
                onClick={handleOpenExternal}
                style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <IconExternalLink size={14} /> Open External Document (v{document.version_number || 1})
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleDownloadCurrent}
                style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <IconDownload size={14} /> Download Current (v{document.version_number || 1})
              </button>
            )}
            {document.status === "SIGNED" && (
              <button
                className="btn btn-outline"
                onClick={handleDownloadSigned}
                style={{ fontSize: "0.85rem", borderColor: "#059669", color: "#059669" }}
              >
                📜 Download Signed PDF
              </button>
            )}
            {!document.is_locked && (
              <button
                className="btn btn-secondary"
                onClick={() => setShowEditModal(true)}
                style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <IconEdit size={14} /> Edit
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => setShowPermissionsModal(true)}
              style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <IconShield size={14} /> Permissions
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowShareModal(true)}
              style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <IconShare size={14} /> Share
            </button>
            {!document.deleted_at && (
              <button
                className="btn btn-secondary"
                onClick={handleDelete}
                style={{ fontSize: "0.85rem", color: "#dc2626", borderColor: "#fca5a5" }}
              >
                <IconTrash size={14} /> Trash
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid #e2e8f0" }}>
        {[
          { id: "PREVIEW", label: "Document Preview" },
          { id: "VERSIONS", label: `Version History (${versions.length})` },
          { id: "REVIEW", label: `Review & Approval (${reviews.length})` },
          { id: "COMMENTS", label: `Threaded Comments (${comments.length})` },
          { id: "ESIGN", label: "E-Signatures" },
        ].map((tab) => (
          <button
            key={tab.id}
            style={{
              padding: "0.6rem 1.2rem",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "3px solid #0284c7" : "3px solid transparent",
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? "#0284c7" : "#64748b",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PREVIEW */}
      {activeTab === "PREVIEW" && (
        <div className="card">
          {document.storage_type === "EXTERNAL" ? (
            <div
              style={{
                padding: "3rem 1.5rem",
                textAlign: "center",
                backgroundColor: "#f8fafc",
                borderRadius: "8px",
                border: "2px dashed #cbd5e1",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>☁️</div>
              <h3 style={{ margin: "0 0 0.5rem 0", color: "#0f172a", fontSize: "1.25rem" }}>
                External Cloud Document
              </h3>
              <p style={{ color: "#64748b", maxWidth: "560px", margin: "0 auto 1.5rem auto", fontSize: "0.9rem", lineHeight: "1.5" }}>
                This legal document is stored externally on <strong>{document.external_provider || "Cloud Storage"}</strong>.
                For legal confidentiality and security, our servers do not mirror or proxy external files.
              </p>
              <div style={{ display: "inline-flex", flexDirection: "column", gap: "0.6rem", alignItems: "center" }}>
                <button
                  className="btn btn-primary"
                  onClick={handleOpenExternal}
                  style={{
                    fontSize: "0.95rem",
                    padding: "0.65rem 1.5rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: 600,
                  }}
                >
                  <IconExternalLink size={16} /> Open Document in {document.external_provider || "Cloud"}
                </button>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Safe navigation via target="_blank" rel="noopener noreferrer" &bull; Access audited
                </span>
              </div>
            </div>
          ) : (
            <DocumentPreview
              documentId={document.id}
              mimeType={document.mime_type}
              filename={document.original_filename}
            />
          )}
        </div>
      )}

      {/* TAB 2: VERSIONS */}
      {activeTab === "VERSIONS" && (
        <div className="card">
          <DocumentVersionHistory
            documentId={document.id}
            versions={versions}
            onVersionUploaded={fetchDocumentData}
          />
        </div>
      )}

      {/* TAB 3: REVIEW & APPROVAL WORKFLOW */}
      {activeTab === "REVIEW" && (
        <div className="card">
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
            Internal Review & Advocate Approval Workflow
          </h2>

          {actionError && (
            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #f87171", borderRadius: "6px", padding: "0.75rem 1rem", marginBottom: "1rem", color: "#b91c1c" }}>
              {actionError}
            </div>
          )}

          {/* Workflow Action Panel based on document.status */}
          <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1.25rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                  Current Review State:
                </span>
                <div style={{ marginTop: "0.25rem" }}>
                  <DocumentWorkflowStatusBadge status={document.status} />
                </div>
              </div>
            </div>

            {/* If DRAFT: Submit for review */}
            {document.status === "DRAFT" && (
              <div>
                <p style={{ fontSize: "0.85rem", color: "#475569", margin: "0 0 0.75rem 0" }}>
                  This document is currently in <strong>DRAFT</strong>. Once drafted, submit it to an advocate for formal review.
                </p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Review request notes or instructions..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    style={{ maxWidth: "400px" }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmitForReview}
                    disabled={reviewActionLoading}
                  >
                    {reviewActionLoading ? "Submitting..." : "Submit for Internal Review"}
                  </button>
                </div>
              </div>
            )}

            {/* If IN_REVIEW: Advocate decision buttons */}
            {document.status === "IN_REVIEW" && (
              <div>
                <p style={{ fontSize: "0.85rem", color: "#475569", margin: "0 0 0.75rem 0" }}>
                  This document is awaiting formal <strong>Advocate Approval</strong>. Only advocates can approve; paralegals and interns cannot approve formal pleadings.
                </p>
                <div style={{ marginBottom: "0.75rem" }}>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Approval comments or feedback regarding requested changes..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    className="btn btn-primary"
                    style={{ backgroundColor: "#059669", borderColor: "#059669" }}
                    onClick={handleApproveDocument}
                    disabled={reviewActionLoading}
                  >
                    ✓ Approve & Lock Document
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ borderColor: "#dc2626", color: "#dc2626" }}
                    onClick={handleRequestChanges}
                    disabled={reviewActionLoading}
                  >
                    ✎ Request Changes
                  </button>
                </div>
              </div>
            )}

            {/* If APPROVED: Ready for eSign */}
            {document.status === "APPROVED" && (
              <div style={{ color: "#065f46" }}>
                <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600 }}>
                  ✓ Document has been formally approved and locked.
                </p>
                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                  You can now send this approved document for client and counsel E-Signatures in the <strong>E-Signatures</strong> tab.
                </p>
              </div>
            )}

            {/* If CHANGES_REQUESTED */}
            {document.status === "CHANGES_REQUESTED" && (
              <div style={{ color: "#991b1b" }}>
                <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600 }}>
                  ⚠️ Changes have been requested by the reviewing counsel.
                </p>
                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                  Please upload a revised version in the <strong>Version History</strong> tab to re-submit for approval.
                </p>
              </div>
            )}
          </div>

          {/* Historical Reviews List */}
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>Review History</h3>
          {reviews.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>No formal review records logged yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.85rem 1rem", backgroundColor: "#ffffff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      Requested by {r.requester_first_name} {r.requester_last_name} &rarr; Reviewer: {r.reviewer_first_name || "Advocate"}
                    </span>
                    <DocumentWorkflowStatusBadge status={r.status} />
                  </div>
                  {r.comments && (
                    <p style={{ margin: "0.35rem 0", fontSize: "0.85rem", color: "#334155", fontStyle: "italic" }}>
                      "{r.comments}"
                    </p>
                  )}
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    Requested: {new Date(r.requested_at).toLocaleString()}
                    {r.reviewed_at && ` • Reviewed: ${new Date(r.reviewed_at).toLocaleString()}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: THREADED COMMENTS */}
      {activeTab === "COMMENTS" && (
        <div className="card">
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
            Draft Annotations & Internal Comments
          </h2>

          {/* New Comment Input */}
          <form onSubmit={handleAddComment} style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                type="text"
                className="form-control"
                placeholder={replyParentId ? "Write a reply to comment..." : "Add a comment, note, or legal objection..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                required
              />
              <input
                type="number"
                className="form-control"
                placeholder="Page #"
                value={commentPage}
                onChange={(e) => setCommentPage(e.target.value)}
                style={{ width: "90px" }}
              />
              <button type="submit" className="btn btn-primary" disabled={commentLoading}>
                {commentLoading ? "Posting..." : replyParentId ? "Reply" : "Post"}
              </button>
              {replyParentId && (
                <button type="button" className="btn btn-outline" onClick={() => setReplyParentId(null)}>
                  Cancel Reply
                </button>
              )}
            </div>
          </form>

          {/* Comments List */}
          {comments.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>No comments yet on this document.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {comments
                .filter((c) => !c.parent_comment_id)
                .map((c) => (
                  <div key={c.id} style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.85rem 1rem", backgroundColor: c.status === "RESOLVED" ? "#f8fafc" : "#ffffff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#0f172a" }}>
                        {c.first_name} {c.last_name}
                      </span>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        {c.status === "RESOLVED" ? (
                          <span style={{ fontSize: "0.7rem", color: "#059669", fontWeight: 700 }}>✓ RESOLVED</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => handleResolveComment(c.id)}
                            style={{ padding: "0.15rem 0.5rem", fontSize: "0.7rem" }}
                          >
                            Mark Resolved
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => setReplyParentId(c.id)}
                          style={{ padding: "0.15rem 0.5rem", fontSize: "0.7rem" }}
                        >
                          Reply
                        </button>
                      </div>
                    </div>

                    <p style={{ margin: "0.25rem 0", fontSize: "0.85rem", color: "#334155" }}>
                      {c.comment}
                    </p>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {new Date(c.created_at).toLocaleString()}
                    </div>

                    {/* Replies */}
                    {comments
                      .filter((child) => child.parent_comment_id === c.id)
                      .map((reply) => (
                        <div
                          key={reply.id}
                          style={{
                            marginTop: "0.5rem",
                            marginLeft: "1.5rem",
                            padding: "0.5rem 0.75rem",
                            borderLeft: "2px solid #0284c7",
                            backgroundColor: "#f8fafc",
                            borderRadius: "0 4px 4px 0",
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "#0f172a" }}>
                            {reply.first_name} {reply.last_name}
                          </div>
                          <p style={{ margin: "0.15rem 0", fontSize: "0.8rem", color: "#334155" }}>
                            {reply.comment}
                          </p>
                          <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                            {new Date(reply.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: E-SIGNATURE WORKFLOW */}
      {activeTab === "ESIGN" && (
        <div className="card">
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
            E-Signature & Digital Certificate Workflow
          </h2>

          {actionError && (
            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #f87171", borderRadius: "6px", padding: "0.75rem 1rem", marginBottom: "1rem", color: "#b91c1c" }}>
              {actionError}
            </div>
          )}

          {document.storage_type === "EXTERNAL" ? (
            <div style={{ backgroundColor: "#fef3c7", border: "1px solid #fde68a", borderRadius: "8px", padding: "1.5rem", color: "#92400e" }}>
              <h3 style={{ margin: "0 0 0.5rem 0", display: "flex", alignItems: "center", gap: "8px", fontSize: "1.05rem" }}>
                <IconAlertTriangle size={20} color="#b45309" />
                E-Sign Unavailable for External Linked Documents
              </h3>
              <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem", lineHeight: "1.5" }}>
                External linked documents cannot be directly sent for eSign from this application.
                Legal electronic signature providers require direct access to the signable PDF artifact to apply digital certificates and audit trails.
              </p>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#78350f" }}>
                💡 <em>To initiate an electronic signature workflow, please upload a supported legal document (≤ 10 MB) into the internal repository.</em>
              </p>
            </div>
          ) : sigRequest ? (
            <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <span style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                    Active Request:
                  </span>
                  <div style={{ fontFamily: "monospace", fontSize: "1.1rem", fontWeight: 700, color: "#0369a1" }}>
                    {sigRequest.request_code}
                  </div>
                </div>
                <DocumentWorkflowStatusBadge status={sigRequest.status} />
              </div>

              {/* Signers list */}
              <h4 style={{ fontSize: "0.85rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#334155" }}>
                Designated Signers ({sigRequest.signers?.length || 0}):
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                {(sigRequest.signers || []).map((s, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0.75rem", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "4px" }}>
                    <div>
                      <strong>{s.name}</strong> ({s.email}) &bull; Role: {s.role}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: "0.8rem", color: s.status === "SIGNED" ? "#059669" : "#d97706" }}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>

              {sigRequest.status === "SIGNED" && (
                <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleDownloadSigned}
                    style={{ backgroundColor: "#059669", borderColor: "#059669" }}
                  >
                    📜 Download Certified Signed PDF
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Initiate E-Sign Form */
            <div>
              {document.status !== "APPROVED" ? (
                <div style={{ backgroundColor: "#fef3c7", border: "1px solid #fde68a", borderRadius: "6px", padding: "1rem", color: "#92400e", marginBottom: "1rem" }}>
                  <strong>Notice:</strong> Document must be formally <strong>APPROVED</strong> by an advocate before initiating e-signatures. Please submit for review in the Review & Approval tab.
                </div>
              ) : (
                <form onSubmit={handleCreateEsignRequest}>
                  <p style={{ fontSize: "0.85rem", color: "#475569", marginBottom: "1rem" }}>
                    This approved document is ready for electronic signatures. Configure signers below to dispatch signature invitations via licensed Indian E-Sign providers.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                        E-Sign Provider
                      </label>
                      <select className="form-control" value={esignProvider} onChange={(e) => setEsignProvider(e.target.value)}>
                        <option value="DIGIO">Digio (Aadhaar / DSC eSign)</option>
                        <option value="LEEGALITY">Leegality (Aadhaar / Virtual Sign)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                        Signing Sequence
                      </label>
                      <select className="form-control" value={esignOrder} onChange={(e) => setEsignOrder(e.target.value)}>
                        <option value="PARALLEL">Parallel (All signers receive at once)</option>
                        <option value="SEQUENTIAL">Sequential (In designated order)</option>
                      </select>
                    </div>
                  </div>

                  {/* Signers dynamic inputs */}
                  <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>Designated Signers</h4>
                  {signersList.map((signer, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr auto", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Signer Full Name"
                        value={signer.name}
                        onChange={(e) => handleSignerChange(idx, "name", e.target.value)}
                        required
                      />
                      <input
                        type="email"
                        className="form-control"
                        placeholder="Signer Email"
                        value={signer.email}
                        onChange={(e) => handleSignerChange(idx, "email", e.target.value)}
                        required
                      />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Phone (Optional)"
                        value={signer.phone}
                        onChange={(e) => handleSignerChange(idx, "phone", e.target.value)}
                      />
                      <select
                        className="form-control"
                        value={signer.role}
                        onChange={(e) => handleSignerChange(idx, "role", e.target.value)}
                      >
                        <option value="CLIENT">Client</option>
                        <option value="ADVOCATE">Advocate</option>
                        <option value="OPPOSING_PARTY">Opposing Party</option>
                        <option value="WITNESS">Witness</option>
                      </select>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => handleRemoveSigner(idx)}
                        disabled={signersList.length <= 1}
                        style={{ color: "#dc2626", borderColor: "#fca5a5" }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <div style={{ marginBottom: "1.5rem" }}>
                    <button type="button" className="btn btn-outline" onClick={handleAddSigner} style={{ fontSize: "0.8rem" }}>
                      + Add Another Signer
                    </button>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="btn btn-primary" disabled={esignLoading}>
                      {esignLoading ? "Sending Invitations..." : "Dispatch Signature Requests"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Permissions Modal */}
      <DocumentPermissionsModal
        documentId={document.id}
        documentTitle={document.title}
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
      />

      {/* Share Modal */}
      <DocumentShareModal
        documentId={document.id}
        documentTitle={document.title}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      {/* Edit Metadata Modal */}
      {showEditModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div className="card" style={{ width: "500px", maxWidth: "90%", padding: "1.5rem" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
              Edit Document Metadata
            </h2>

            {editError && (
              <div style={{ backgroundColor: "#fef2f2", border: "1px solid #f87171", borderRadius: "6px", padding: "0.5rem 0.75rem", marginBottom: "1rem", color: "#b91c1c", fontSize: "0.85rem" }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Document Title
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Category
                </label>
                <select className="form-control" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} required>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Confidentiality Level
                </label>
                <select className="form-control" value={editConfidentiality} onChange={(e) => setEditConfidentiality(e.target.value)} required>
                  {CONFIDENTIALITY_LEVELS.map((cl) => (
                    <option key={cl.value} value={cl.value}>
                      {cl.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Description
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentDetailPage;
