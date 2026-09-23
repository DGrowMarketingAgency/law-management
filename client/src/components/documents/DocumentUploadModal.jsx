import React, { useState, useRef } from "react";
import documentService from "../../services/documentService";
import { useVault } from "../../context/VaultContext";
import {
  DOCUMENT_CATEGORIES,
  CONFIDENTIALITY_LEVELS,
} from "./DocumentStatusBadge";
import {
  IconUpload,
  IconFile,
  IconX,
  IconAlertTriangle,
  IconLock,
} from "../common/Icons";

const DocumentUploadModal = ({
  caseId,
  caseNumber,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { isUnlocked, openUnlockModal } = useVault();
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("CASE_DOCUMENT");
  const [documentType, setDocumentType] = useState("");
  const [confidentialityLevel, setConfidentialityLevel] = useState("NORMAL");
  const [description, setDescription] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelection = (selected) => {
    if (selected) {
      // Check 25MB limit
      if (selected.size > 25 * 1024 * 1024) {
        setError("File size exceeds maximum allowed 25 MB limit.");
        return;
      }
      setFile(selected);
      setError(null);
      if (!title) {
        const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    handleFileSelection(selected);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!file) {
      setError("Please select a document file to upload.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a title for the document.");
      return;
    }

    if (!isUnlocked) {
      openUnlockModal(() => handleSubmit(e));
      return;
    }

    setLoading(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("category", category);
    if (documentType.trim())
      formData.append("document_type", documentType.trim());
    formData.append("confidentiality_level", confidentialityLevel);
    if (description.trim()) formData.append("description", description.trim());
    if (changeSummary.trim())
      formData.append("change_summary", changeSummary.trim());

    try {
      const res = await documentService.createDocument(
        caseId,
        formData,
        (percent) => {
          setUploadProgress(percent);
        },
      );
      if (res.success) {
        onSuccess(res.data);
        onClose();
      } else {
        setError(res.message || "Upload failed.");
      }
    } catch (err) {
      if (
        err.response?.status === 423 ||
        err.response?.data?.error?.code === "VAULT_LOCKED"
      ) {
        openUnlockModal(() => handleSubmit(e));
      } else {
        setError(
          err.response?.data?.message ||
            err.message ||
            "An error occurred during upload.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "620px" }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                margin: 0,
                color: "#09090b",
              }}
            >
              Upload Legal Document
            </h2>
            {caseNumber && (
              <p
                style={{
                  margin: "0.2rem 0 0 0",
                  fontSize: "0.82rem",
                  color: "#71717a",
                }}
              >
                Case Docket:{" "}
                <strong style={{ color: "#09090b" }}>{caseNumber}</strong>
              </p>
            )}
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          <div className="modal-body" style={{ overflowY: "auto", flex: 1 }}>
            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  backgroundColor: "#000000",
                  color: "#ffffff",
                  padding: "0.75rem 1rem",
                  borderRadius: "6px",
                  marginBottom: "1.25rem",
                  fontSize: "0.85rem",
                }}
              >
                <IconAlertTriangle size={18} color="#ffffff" />
                <span style={{ flex: 1 }}>{error}</span>
              </div>
            )}

            {/* File Dropzone Area */}
            <div className="form-group">
              <label className="form-label">
                <span>Select Document File *</span>
                <span className="optional">Max 25 MB</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                disabled={loading}
                style={{ display: "none" }}
              />

              {!file ? (
                <div
                  className={`file-dropzone ${isDragging ? "dragover" : ""}`}
                  onClick={() =>
                    fileInputRef.current && fileInputRef.current.click()
                  }
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="file-dropzone-icon">
                    <IconUpload size={20} color="#ffffff" />
                  </div>
                  <div className="file-dropzone-title">
                    Click to choose file or drag & drop here
                  </div>
                  <div className="file-dropzone-sub">
                    PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, JPG, PNG (Executables
                    prohibited)
                  </div>
                </div>
              ) : (
                <div className="file-selected-box">
                  <div className="file-selected-info">
                    <div className="file-selected-badge">
                      <IconFile size={20} color="#ffffff" />
                    </div>
                    <div className="file-selected-details">
                      <div className="file-selected-name" title={file.name}>
                        {file.name}
                      </div>
                      <div className="file-selected-size">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem" }}
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    disabled={loading}
                  >
                    Change File
                  </button>
                </div>
              )}
            </div>

            {/* Document Title */}
            <div className="form-group">
              <label className="form-label">
                <span>Document Title *</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Writ Petition Final Draft with Annexures"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {/* Category & Confidentiality in 2 Columns */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <label className="form-label">
                  <span>Category *</span>
                </label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={loading}
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">
                  <span>Confidentiality *</span>
                </label>
                <select
                  className="form-select"
                  value={confidentialityLevel}
                  onChange={(e) => setConfidentialityLevel(e.target.value)}
                  disabled={loading}
                >
                  {CONFIDENTIALITY_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Document Sub-Type / Tag */}
            <div className="form-group">
              <label className="form-label">
                <span>Document Sub-Type / Classification</span>
                <span className="optional">Optional</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Counter Affidavit, Rejoinder, Vakalatnama, Memo of Parties"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">
                <span>Summary / Description</span>
                <span className="optional">Optional</span>
              </label>
              <textarea
                className="form-textarea"
                rows="2"
                placeholder="Brief summary of legal context, filing status, or chamber notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Initial Version Note */}
            <div className="form-group" style={{ marginBottom: "0.5rem" }}>
              <label className="form-label">
                <span>Initial Version Note</span>
                <span className="optional">Optional</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Initial drafted version filed before the Hon'ble Court"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Upload Progress Bar */}
            {uploadProgress !== null && (
              <div
                style={{
                  marginTop: "1rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid #e4e4e7",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.8rem",
                    marginBottom: "0.35rem",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#09090b" }}>
                    Uploading to secure chambers storage...
                  </span>
                  <span style={{ fontWeight: 700, color: "#000000" }}>
                    {uploadProgress}%
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "6px",
                    backgroundColor: "#e4e4e7",
                    borderRadius: "3px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${uploadProgress}%`,
                      height: "100%",
                      backgroundColor: "#000000",
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !file}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <IconUpload size={16} color="#ffffff" />
              <span>
                {loading ? "Uploading Document..." : "Upload Document"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocumentUploadModal;
