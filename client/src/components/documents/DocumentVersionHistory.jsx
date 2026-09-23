import React, { useState } from "react";
import documentService from "../../services/documentService";
import { useVault } from "../../context/VaultContext";
import { DocumentStorageBadge, EXTERNAL_PROVIDERS } from "./DocumentStatusBadge";
import { IconExternalLink, IconDownload, IconAlertTriangle } from "../common/Icons";

const DocumentVersionHistory = ({
  documentId,
  versions,
  onVersionUploaded,
  canUpload = true,
}) => {
  const { isUnlocked, openUnlockModal } = useVault();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [versionMode, setVersionMode] = useState("INTERNAL"); // 'INTERNAL' | 'EXTERNAL'
  
  // Internal upload states
  const [file, setFile] = useState(null);
  
  // External link states
  const [externalProvider, setExternalProvider] = useState("GOOGLE_DRIVE");
  const [externalUrl, setExternalUrl] = useState("");
  const [externalFileName, setExternalFileName] = useState("");
  const [externalConfirmed, setExternalConfirmed] = useState(false);

  // Common
  const [changeSummary, setChangeSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleDownload = async (version) => {
    if (!isUnlocked) {
      openUnlockModal(() => handleDownload(version));
      return;
    }
    setDownloadingId(version.id);
    try {
      const response = await documentService.downloadVersion(
        documentId,
        version.id,
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", version.original_filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (
        err.response?.status === 423 ||
        err.response?.data?.error?.code === "VAULT_LOCKED"
      ) {
        openUnlockModal(() => handleDownload(version));
      } else {
        alert(
          "Failed to download version: " +
            (err.response?.data?.message || err.message),
        );
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenExternalVersion = (version) => {
    if (version.external_url) {
      window.open(version.external_url, "_blank", "noopener,noreferrer");
    } else {
      alert("External URL not found for this version.");
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) {
      setFile(null);
      e.target.value = "";
      setError(`File "${selected.name}" (${(selected.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 10 MB limit. Please switch to "External Link" to save a cloud link instead.`);
      return;
    }
    setFile(selected);
    setError(null);
  };

  const handleSubmitNewVersion = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError(null);

    if (versionMode === "INTERNAL") {
      if (!file) {
        setError("Please select a file to upload as the new revision.");
        return;
      }

      if (!isUnlocked) {
        openUnlockModal(() => handleSubmitNewVersion(e));
        return;
      }

      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);
      if (changeSummary.trim()) {
        formData.append("change_summary", changeSummary.trim());
      }

      try {
        const res = await documentService.uploadVersion(documentId, formData);
        if (res.success) {
          resetModal();
          if (onVersionUploaded) onVersionUploaded();
        } else {
          setError(res.message || "Failed to upload revision.");
        }
      } catch (err) {
        if (
          err.response?.status === 423 ||
          err.response?.data?.error?.code === "VAULT_LOCKED"
        ) {
          openUnlockModal(() => handleSubmitNewVersion(e));
        } else {
          setError(
            err.response?.data?.message ||
              err.message ||
              "An error occurred during version upload.",
          );
        }
      } finally {
        setLoading(false);
      }
    } else {
      // EXTERNAL MODE
      if (!externalUrl.trim()) {
        setError("External URL is required.");
        return;
      }
      if (!externalUrl.startsWith("https://")) {
        setError("External URL must use secure HTTPS (e.g. https://drive.google.com/...)");
        return;
      }
      if (!externalConfirmed) {
        setError("Please confirm that the external provider controls file access permissions.");
        return;
      }

      setLoading(true);
      try {
        const res = await documentService.createExternalVersion(documentId, {
          external_provider: externalProvider,
          external_url: externalUrl.trim(),
          external_file_name: externalFileName.trim() || undefined,
          change_summary: changeSummary.trim() || undefined,
        });

        if (res.success) {
          resetModal();
          if (onVersionUploaded) onVersionUploaded();
        } else {
          setError(res.message || "Failed to create external revision.");
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "An error occurred while creating external revision.",
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const resetModal = () => {
    setShowUploadModal(false);
    setFile(null);
    setExternalUrl("");
    setExternalFileName("");
    setExternalConfirmed(false);
    setChangeSummary("");
    setError(null);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
          Version History ({versions ? versions.length : 0})
        </h3>
        {canUpload && (
          <button
            className="btn btn-primary"
            style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
            onClick={() => setShowUploadModal(true)}
          >
            + Create New Revision
          </button>
        )}
      </div>

      {!versions || versions.length === 0 ? (
        <p style={{ color: "#64748b", fontStyle: "italic" }}>
          No version history recorded.
        </p>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          {versions.map((ver) => (
            <div
              key={ver.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem 1rem",
                borderRadius: "8px",
                border: ver.is_current
                  ? "2px solid #3b82f6"
                  : "1px solid #e2e8f0",
                backgroundColor: ver.is_current ? "#eff6ff" : "#ffffff",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.25rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      color: ver.is_current ? "#1d4ed8" : "#334155",
                    }}
                  >
                    Version {ver.version_number}
                  </span>
                  {ver.is_current && (
                    <span
                      style={{
                        backgroundColor: "#2563eb",
                        color: "#ffffff",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                      }}
                    >
                      CURRENT
                    </span>
                  )}
                  <DocumentStorageBadge
                    storageType={ver.storage_type || "INTERNAL"}
                    provider={ver.external_provider}
                  />
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                    • {ver.storage_type === "EXTERNAL"
                        ? (ver.external_file_name || "External Cloud Link")
                        : `${ver.original_filename} (${formatFileSize(ver.file_size)})`}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: "0.8rem", color: "#475569" }}>
                  {ver.change_summary || "No notes recorded for this revision."}
                </p>

                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#94a3b8",
                    marginTop: "0.25rem",
                  }}
                >
                  Created by {ver.uploader_first_name} {ver.uploader_last_name}{" "}
                  on {new Date(ver.uploaded_at).toLocaleString()}
                  <span
                    style={{ marginLeft: "0.75rem", fontFamily: "monospace" }}
                  >
                    SHA-256:{" "}
                    {ver.checksum ? ver.checksum.slice(0, 10) + "..." : "N/A (External Link)"}
                  </span>
                </div>
              </div>

              {ver.storage_type === "EXTERNAL" ? (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  onClick={() => handleOpenExternalVersion(ver)}
                >
                  <IconExternalLink size={12} /> Open Link
                </button>
              ) : (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  onClick={() => handleDownload(ver)}
                  disabled={downloadingId === ver.id}
                >
                  <IconDownload size={12} />
                  {downloadingId === ver.id ? "Downloading..." : "Download"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload/Link Revision Modal */}
      {showUploadModal && (
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
            zIndex: 10000,
            padding: "1rem",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              margin: 0,
              padding: "1.5rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                Create New Document Revision
              </h3>
              <button
                onClick={resetModal}
                disabled={loading}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.4rem",
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
              >
                &times;
              </button>
            </div>

            {/* Revision Mode Tabs */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: "1rem",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                style={{
                  padding: "0.5rem 1rem",
                  background: "none",
                  border: "none",
                  borderBottom:
                    versionMode === "INTERNAL"
                      ? "2px solid #0284c7"
                      : "2px solid transparent",
                  fontWeight: versionMode === "INTERNAL" ? 700 : 500,
                  color: versionMode === "INTERNAL" ? "#0284c7" : "#64748b",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
                onClick={() => {
                  setVersionMode("INTERNAL");
                  setError(null);
                }}
              >
                📄 Upload File (≤ 10 MB)
              </button>
              <button
                type="button"
                style={{
                  padding: "0.5rem 1rem",
                  background: "none",
                  border: "none",
                  borderBottom:
                    versionMode === "EXTERNAL"
                      ? "2px solid #0284c7"
                      : "2px solid transparent",
                  fontWeight: versionMode === "EXTERNAL" ? 700 : 500,
                  color: versionMode === "EXTERNAL" ? "#0284c7" : "#64748b",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
                onClick={() => {
                  setVersionMode("EXTERNAL");
                  setError(null);
                }}
              >
                🔗 External Link (Cloud)
              </button>
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: "#fee2e2",
                  color: "#b91c1c",
                  padding: "0.65rem",
                  borderRadius: "6px",
                  marginBottom: "1rem",
                  fontSize: "0.85rem",
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitNewVersion}>
              {versionMode === "INTERNAL" ? (
                <div style={{ marginBottom: "1rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "0.35rem",
                    }}
                  >
                    Select Updated File * (Max 10 MB)
                  </label>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px dashed #cbd5e1",
                      borderRadius: "6px",
                      backgroundColor: "#f8fafc",
                      cursor: "pointer",
                    }}
                    required
                  />
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                    Allowed: PDF, DOCX, DOC, TXT, PNG, JPG (≤ 10 MB)
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        marginBottom: "0.35rem",
                      }}
                    >
                      Cloud Storage Provider *
                    </label>
                    <select
                      className="form-control"
                      value={externalProvider}
                      onChange={(e) => setExternalProvider(e.target.value)}
                      required
                    >
                      {EXTERNAL_PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: "0.75rem" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        marginBottom: "0.35rem",
                      }}
                    >
                      External Document URL * (HTTPS only)
                    </label>
                    <input
                      type="url"
                      className="form-control"
                      placeholder="https://drive.google.com/file/d/..."
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: "0.75rem" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        marginBottom: "0.35rem",
                      }}
                    >
                      External File Name (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Revised-Affidavit-2026.pdf"
                      value={externalFileName}
                      onChange={(e) => setExternalFileName(e.target.value)}
                    />
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.5rem",
                        fontSize: "0.8rem",
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={externalConfirmed}
                        onChange={(e) => setExternalConfirmed(e.target.checked)}
                        style={{ marginTop: "0.2rem" }}
                        required
                      />
                      <span>
                        I confirm that the external cloud provider controls file access permissions and that version history will retain this external link securely.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "0.35rem",
                  }}
                >
                  Revision Summary / Change Notes
                </label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="e.g. Incorporated advocate comments on paragraph 14"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetModal}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Saving Revision..." : "Save Revision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentVersionHistory;
