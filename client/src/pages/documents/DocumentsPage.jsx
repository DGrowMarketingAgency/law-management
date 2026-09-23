import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { documentService } from "../../services/documentService";
import {
  DocumentCategoryBadge,
  ConfidentialityBadge,
  DocumentWorkflowStatusBadge,
  DocumentStorageBadge,
  DOCUMENT_CATEGORIES,
  CONFIDENTIALITY_LEVELS,
  EXTERNAL_PROVIDERS,
} from "../../components/documents/DocumentStatusBadge";
import { IconFolder, IconLock, IconScale, IconFileText } from "../../components/common/Icons";

const DocumentsPage = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    internal: 0,
    external: 0,
    draft: 0,
    in_review: 0,
    changes_requested: 0,
    approved: 0,
    signature_pending: 0,
    signed: 0,
    archived: 0,
    external_breakdown: {
      google_drive: 0,
      onedrive: 0,
      dropbox: 0,
      other: 0,
    },
  });

  // Folders & Types
  const [folders, setFolders] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [storageTypeFilter, setStorageTypeFilter] = useState("ALL");
  const [providerFilter, setProviderFilter] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [confidentialityLevel, setConfidentialityLevel] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });

  useEffect(() => {
    fetchDashboardStats();
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [page, category, statusFilter, storageTypeFilter, providerFilter, folderFilter, confidentialityLevel]);

  const fetchDashboardStats = async () => {
    try {
      const res = await documentService.getDashboardStats();
      if (res.success && res.data) {
        const d = res.data;
        setStats({
          total: d.total ?? d.overview?.total_documents ?? 0,
          internal: d.internal ?? d.overview?.internal_documents ?? 0,
          external: d.external ?? d.overview?.external_documents ?? 0,
          draft: d.draft ?? d.overview?.drafts ?? 0,
          in_review: d.in_review ?? d.overview?.in_review ?? 0,
          changes_requested: d.changes_requested ?? d.overview?.changes_requested ?? 0,
          approved: d.approved ?? d.overview?.approved ?? 0,
          signature_pending: d.signature_pending ?? d.overview?.awaiting_signature ?? 0,
          signed: d.signed ?? d.overview?.signed ?? 0,
          archived: d.archived ?? d.overview?.archived ?? 0,
          external_breakdown: d.external_breakdown || {
            google_drive: 0,
            onedrive: 0,
            dropbox: 0,
            other: 0,
          },
        });
      }
    } catch (err) {
      console.warn("Failed to load dashboard stats:", err.message);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [fRes, tRes] = await Promise.all([
        documentService.getFolders(),
        documentService.getDocumentTypes(),
      ]);
      if (fRes.success) setFolders(fRes.data || []);
      if (tRes.success) setDocumentTypes(tRes.data || []);
    } catch (err) {
      console.warn("Failed to fetch document folders or types:", err.message);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 15,
        query: search.trim() || undefined,
        search: search.trim() || undefined,
        category: category || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        storage_type: storageTypeFilter !== "ALL" ? storageTypeFilter : undefined,
        provider: providerFilter || undefined,
        folder_id: folderFilter || undefined,
        confidentiality_level: confidentialityLevel || undefined,
      };
      const res = await documentService.getDocuments(params);
      if (res.success) {
        setDocuments(res.data.documents || res.data || []);
        setPagination(res.data.pagination || { totalPages: 1, total: (res.data.documents || res.data || []).length });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDocuments();
  };

  const handleDownload = async (docId, fileName) => {
    try {
      const res = await documentService.downloadDocument(docId, false);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName || `Document_${docId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to download document.");
    }
  };

  const handleOpenExternal = async (docId) => {
    try {
      const res = await documentService.getExternalLink(docId);
      if (res.success && res.data?.external_url) {
        window.open(res.data.external_url, "_blank", "noopener,noreferrer");
      } else {
        alert(res.message || "Failed to retrieve external document link.");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to retrieve external document link.");
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "--";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div style={{ paddingBottom: "2rem" }}>
      {/* Header Banner */}
      <div
        className="card"
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 className="card-title" style={{ fontSize: "1.6rem", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <IconFolder size={24} color="#0284c7" />
            Legal Document Repository
          </h1>
          <p className="card-subtitle" style={{ margin: "0.25rem 0 0 0" }}>
            Enterprise legal documents: internal files (≤ 10 MB), external cloud links, advocate approvals & e-signatures.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link to="/documents/templates" className="btn btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <IconFileText size={16} />
            Template Library
          </Link>
          <Link to="/documents/new?mode=external" className="btn btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", borderColor: "#4338ca", color: "#4338ca" }}>
            <span>🔗</span> Add External Link
          </Link>
          <Link to="/documents/new?mode=upload" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            + Upload File (≤10 MB)
          </Link>
          <Link to="/documents/settings" className="btn btn-outline" title="Document Configuration">
            ⚙️ Settings
          </Link>
        </div>
      </div>

      {/* KPI Metrics Dashboard Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.85rem",
          marginBottom: "1rem",
        }}
      >
        <div className="card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #0284c7" }}>
          <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>TOTAL REPO</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginTop: "0.2rem" }}>
            {stats.total || 0}
          </div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #0f766e" }}>
          <div style={{ fontSize: "0.75rem", color: "#0f766e", fontWeight: 600 }}>INTERNAL (≤10MB)</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#115e59", marginTop: "0.2rem" }}>
            {stats.internal || 0}
          </div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #4338ca" }}>
          <div style={{ fontSize: "0.75rem", color: "#4338ca", fontWeight: 600 }}>EXTERNAL LINKS</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#3730a3", marginTop: "0.2rem" }}>
            {stats.external || 0}
          </div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #64748b" }}>
          <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>DRAFTS</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#334155", marginTop: "0.2rem" }}>
            {stats.draft || 0}
          </div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #d97706" }}>
          <div style={{ fontSize: "0.75rem", color: "#d97706", fontWeight: 600 }}>IN REVIEW</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#b45309", marginTop: "0.2rem" }}>
            {stats.in_review || 0}
          </div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #dc2626" }}>
          <div style={{ fontSize: "0.75rem", color: "#dc2626", fontWeight: 600 }}>CHANGES REQ</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#b91c1c", marginTop: "0.2rem" }}>
            {stats.changes_requested || 0}
          </div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #059669" }}>
          <div style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 600 }}>APPROVED</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#047857", marginTop: "0.2rem" }}>
            {stats.approved || 0}
          </div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #2563eb" }}>
          <div style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 600 }}>AWAITING SIGN</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1d4ed8", marginTop: "0.2rem" }}>
            {stats.signature_pending || 0}
          </div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #10b981" }}>
          <div style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 600 }}>SIGNED & CERT</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#065f46", marginTop: "0.2rem" }}>
            {stats.signed || 0}
          </div>
        </div>

        <div className="card" style={{ padding: "0.85rem 1rem", borderLeft: "4px solid #94a3b8" }}>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>ARCHIVED</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#475569", marginTop: "0.2rem" }}>
            {stats.archived || 0}
          </div>
        </div>
      </div>

      {/* External Cloud Storage Breakdown Strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          padding: "0.6rem 1rem",
          backgroundColor: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          marginBottom: "1.5rem",
          fontSize: "0.825rem",
          color: "#475569",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, color: "#334155" }}>External Cloud Breakdown:</span>
        <span>📁 Google Drive: <strong>{stats.external_breakdown?.google_drive || 0}</strong></span>
        <span>☁️ OneDrive: <strong>{stats.external_breakdown?.onedrive || 0}</strong></span>
        <span>📦 Dropbox: <strong>{stats.external_breakdown?.dropbox || 0}</strong></span>
        <span>🔗 Other / Firm Links: <strong>{stats.external_breakdown?.other || 0}</strong></span>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <form onSubmit={handleSearchSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "0.75rem", alignItems: "center" }}>
            {/* Search Input */}
            <div>
              <input
                type="text"
                className="form-control"
                placeholder="Search title, doc #, case, or CNR..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Storage Type Filter */}
            <div>
              <select
                className="form-control"
                value={storageTypeFilter}
                onChange={(e) => {
                  setStorageTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Storage Modes</option>
                <option value="INTERNAL">Internal Files (≤10 MB)</option>
                <option value="EXTERNAL">External Cloud Links</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                className="form-control"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Drafts</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="CHANGES_REQUESTED">Changes Requested</option>
                <option value="APPROVED">Approved</option>
                <option value="SIGNATURE_PENDING">Awaiting Signature</option>
                <option value="SIGNED">Signed & Certified</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            {/* Confidentiality Filter */}
            <div>
              <select
                className="form-control"
                value={confidentialityLevel}
                onChange={(e) => {
                  setConfidentialityLevel(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Confidentiality</option>
                {CONFIDENTIALITY_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ height: "38px" }}>
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ backgroundColor: "#fef2f2", border: "1px solid #f87171", borderRadius: "6px", padding: "0.85rem 1rem", marginBottom: "1.5rem", color: "#b91c1c" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Documents Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", margin: 0, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#64748b" }}>DOC #</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#64748b" }}>TITLE & STORAGE</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#64748b" }}>LINKED MATTER</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#64748b" }}>VERSION</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#64748b" }}>STATUS</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#64748b" }}>LAST UPDATED</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "#64748b" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                    Loading documents repository...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                    <IconFolder size={36} color="#cbd5e1" style={{ marginBottom: "0.5rem" }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No documents found matching the filter criteria.</p>
                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem" }}>Upload a file (≤10 MB), save an external cloud link, or draft from a template.</p>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" }}>
                    {/* Document Number */}
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700, color: "#0369a1" }}>
                      {doc.document_number || `DOC-${doc.id}`}
                    </td>

                    {/* Title & Storage Badge */}
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <Link
                          to={`/documents/${doc.id}`}
                          style={{ fontWeight: 600, color: "#0f172a", textDecoration: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#0284c7")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#0f172a")}
                        >
                          {doc.title}
                        </Link>
                        {doc.is_locked ? (
                          <span title="Locked against modifications">
                            <IconLock size={12} color="#dc2626" />
                          </span>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
                        <DocumentStorageBadge storageType={doc.storage_type} provider={doc.external_provider} />
                        <DocumentCategoryBadge category={doc.category} />
                        <ConfidentialityBadge level={doc.confidentiality_level} />
                        {doc.folder_name && (
                          <span style={{ fontSize: "0.7rem", color: "#64748b" }}>📁 {doc.folder_name}</span>
                        )}
                      </div>
                    </td>

                    {/* Linked Case or Firm */}
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem" }}>
                      {doc.case_id ? (
                        <div>
                          <Link to={`/cases/${doc.case_id}`} style={{ fontWeight: 600, color: "#0f172a", textDecoration: "none" }}>
                            {doc.case_number || `Case #${doc.case_id}`}
                          </Link>
                          <div style={{ fontSize: "0.75rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px", whiteSpace: "nowrap" }}>
                            {doc.case_title}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", backgroundColor: "#f1f5f9", padding: "0.15rem 0.4rem", borderRadius: "4px" }}>
                          🏢 Firm Repository
                        </span>
                      )}
                    </td>

                    {/* Version & Size */}
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        style={{
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "4px",
                          padding: "0.15rem 0.45rem",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#334155",
                        }}
                      >
                        v{doc.version_number || 1}
                      </span>
                      <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.15rem" }}>
                        {doc.storage_type === "EXTERNAL"
                          ? (doc.external_file_size ? formatFileSize(doc.external_file_size) : "Cloud Link")
                          : formatFileSize(doc.file_size || doc.internal_file_size)}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <DocumentWorkflowStatusBadge status={doc.status} />
                    </td>

                    {/* Last Updated */}
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", color: "#64748b" }}>
                      <div>{new Date(doc.updated_at || doc.created_at).toLocaleDateString("en-IN")}</div>
                      <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                        by {doc.creator_first_name ? `${doc.creator_first_name} ${doc.creator_last_name}` : "Counsel"}
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                        <Link to={`/documents/${doc.id}`} className="btn btn-outline" style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}>
                          View
                        </Link>
                        {doc.storage_type === "EXTERNAL" ? (
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => handleOpenExternal(doc.id)}
                            style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", color: "#4338ca", borderColor: "#c7d2fe", backgroundColor: "#eef2ff" }}
                            title="Open External Document (New Window)"
                          >
                            🔗 Open
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => handleDownload(doc.id, doc.original_filename || doc.internal_file_name || `${doc.title}.pdf`)}
                            style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
                            title="Download Internal Document"
                          >
                            ⬇
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.85rem 1.25rem",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Showing <strong>{documents.length}</strong> of <strong>{pagination.total}</strong> documents (Page {pagination.page || page} of {pagination.totalPages || 1})
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn btn-outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem" }}
            >
              Previous
            </button>
            <button
              className="btn btn-outline"
              disabled={page >= (pagination.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
              style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentsPage;
