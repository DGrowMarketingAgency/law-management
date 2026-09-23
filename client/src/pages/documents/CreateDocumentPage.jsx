import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { documentService } from "../../services/documentService";
import {
  DOCUMENT_CATEGORIES,
  CONFIDENTIALITY_LEVELS,
  EXTERNAL_PROVIDERS,
} from "../../components/documents/DocumentStatusBadge";
import { IconFileText, IconUpload, IconFolder } from "../../components/common/Icons";
import apiClient from "../../services/api";

const CreateDocumentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "template"
    ? "template"
    : searchParams.get("mode") === "external"
    ? "external"
    : "upload";

  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Large File Detection Modal State
  const [showLargeFileModal, setShowLargeFileModal] = useState(false);
  const [largeFileInfo, setLargeFileInfo] = useState({ name: "", sizeMb: 0 });

  // Metadata dropdowns
  const [cases, setCases] = useState([]);
  const [folders, setFolders] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [templates, setTemplates] = useState([]);

  // Shared metadata
  const [caseId, setCaseId] = useState(searchParams.get("caseId") || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("CASE_DOCUMENT");
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [confidentialityLevel, setConfidentialityLevel] = useState("NORMAL");

  // Mode 1: File Upload State
  const [file, setFile] = useState(null);

  // Mode 2: External Link State
  const [externalProvider, setExternalProvider] = useState("GOOGLE_DRIVE");
  const [externalUrl, setExternalUrl] = useState("");
  const [externalFileName, setExternalFileName] = useState("");
  const [externalFileSize, setExternalFileSize] = useState("");
  const [externalMimeType, setExternalMimeType] = useState("");
  const [externalConfirmed, setExternalConfirmed] = useState(false);

  // Mode 3: Template Instantiation State
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVariables, setTemplateVariables] = useState({});

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplateDetails(selectedTemplateId);
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    if (caseId) {
      fetchCaseFolders(caseId);
      if (mode === "template" && selectedTemplate) {
        prefillCaseContext(caseId);
      }
    }
  }, [caseId]);

  const fetchMetadata = async () => {
    try {
      const [casesRes, typesRes, tmplsRes, foldersRes] = await Promise.all([
        apiClient.get("/cases", { params: { limit: 100 } }),
        documentService.getDocumentTypes(),
        documentService.getTemplates({ status: "ACTIVE" }),
        documentService.getFolders(),
      ]);

      if (casesRes.data?.success) setCases(casesRes.data.data.cases || []);
      if (typesRes.success) setDocumentTypes(typesRes.data || []);
      if (tmplsRes.success) setTemplates(tmplsRes.data || []);
      if (foldersRes.success) setFolders(foldersRes.data || []);
    } catch (err) {
      console.warn("Failed to load metadata:", err.message);
    }
  };

  const fetchCaseFolders = async (cId) => {
    try {
      const res = await documentService.getFolders({ case_id: cId });
      if (res.success) {
        setFolders(res.data);
      }
    } catch (err) {
      console.warn("Failed to load case folders:", err.message);
    }
  };

  const loadTemplateDetails = async (tmplId) => {
    try {
      const res = await documentService.getTemplateById(tmplId);
      if (res.success) {
        const tmpl = res.data;
        setSelectedTemplate(tmpl);
        setTitle(`${tmpl.name} - Draft`);
        setCategory(tmpl.document_type_code?.includes("NOTICE") ? "NOTICE" : "PLEADING");
        if (tmpl.document_type_id) setDocumentTypeId(tmpl.document_type_id);

        const initialVars = {};
        const vars = Array.isArray(tmpl.variables) ? tmpl.variables : [];
        vars.forEach((v) => {
          initialVars[v] = "";
        });
        setTemplateVariables(initialVars);

        if (caseId) {
          prefillCaseContext(caseId);
        }
      }
    } catch (err) {
      console.error("Failed to load template:", err);
    }
  };

  const prefillCaseContext = async (cId) => {
    const selectedCase = cases.find((c) => c.id === parseInt(cId, 10));
    if (selectedCase) {
      setTemplateVariables((prev) => ({
        ...prev,
        CASE_TITLE: selectedCase.title || "",
        CASE_NUMBER: selectedCase.case_number || "",
        CNR_NUMBER: selectedCase.cnr_number || "",
        COURT_NAME: selectedCase.court_name || "",
        CLIENT_NAME: selectedCase.client_name || "",
        OPPOSING_PARTY: selectedCase.opposing_party || "",
        DATE: new Date().toLocaleDateString("en-IN"),
      }));
    }
  };

  // File change handler enforcing strict 10 MB limit
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // 10 MB limit check (10 * 1024 * 1024 = 10,485,760 bytes)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setLargeFileInfo({
        name: selectedFile.name,
        sizeMb: (selectedFile.size / (1024 * 1024)).toFixed(1),
        sizeBytes: selectedFile.size,
      });
      setShowLargeFileModal(true);
      e.target.value = "";
      return;
    }

    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  // Submit Internal Upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a document title.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("category", category);
    formData.append("confidentiality_level", confidentialityLevel);
    if (caseId) formData.append("case_id", caseId);
    if (folderId) formData.append("folder_id", folderId);
    if (documentTypeId) formData.append("document_type_id", documentTypeId);

    try {
      const res = await documentService.createDocument(caseId || null, formData, (percent) => {
        setUploadProgress(percent);
      });

      if (res.success) {
        navigate(`/documents/${res.data.id}`);
      } else {
        setError(res.message || "Failed to upload document.");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit External Link
  const handleExternalSubmit = async (e) => {
    e.preventDefault();
    if (!externalUrl.trim()) {
      setError("Please provide the external document URL.");
      return;
    }
    if (!externalConfirmed) {
      setError("Please confirm that you understand the external provider controls file access permissions.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        title: title.trim() || externalFileName.trim() || "External Document",
        description: description.trim(),
        category,
        document_type_id: documentTypeId ? parseInt(documentTypeId, 10) : null,
        case_id: caseId ? parseInt(caseId, 10) : null,
        folder_id: folderId ? parseInt(folderId, 10) : null,
        confidentiality_level: confidentialityLevel,
        external_provider: externalProvider,
        external_url: externalUrl.trim(),
        external_file_name: externalFileName.trim() || title.trim(),
        external_file_size: externalFileSize ? parseInt(externalFileSize, 10) : null,
        external_mime_type: externalMimeType.trim() || null,
        storage_type: "EXTERNAL",
      };

      const res = await documentService.createExternalDocument(caseId || null, payload);
      if (res.success) {
        navigate(`/documents/${res.data.id}`);
      } else {
        setError(res.message || "Failed to save external link.");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit Template
  const handleTemplateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTemplateId) {
      setError("Please select a legal document template.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a document title.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        template_id: parseInt(selectedTemplateId, 10),
        case_id: caseId ? parseInt(caseId, 10) : null,
        title: title.trim(),
        folder_id: folderId ? parseInt(folderId, 10) : null,
        category,
        confidentiality_level: confidentialityLevel,
        variables: templateVariables,
      };

      const res = await documentService.createFromTemplate(payload);
      if (res.success) {
        navigate(`/documents/${res.data.id}`);
      } else {
        setError(res.message || "Failed to generate document from template.");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", paddingBottom: "3rem" }}>
      {/* Back navigation */}
      <div style={{ marginBottom: "1rem" }}>
        <Link to="/documents" style={{ color: "#0284c7", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
          &larr; Back to Document Repository
        </Link>
      </div>

      <div className="card">
        <h1 className="card-title" style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>
          Create New Document
        </h1>
        <p className="card-subtitle" style={{ marginBottom: "1.5rem" }}>
          Add documents to the chambers repository via internal file upload (up to 10 MB), external cloud storage links, or automated legal templates.
        </p>

        {/* Mode Selector Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setMode("upload");
              setError(null);
            }}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              border: mode === "upload" ? "1px solid #0284c7" : "1px solid #e2e8f0",
              backgroundColor: mode === "upload" ? "#0284c7" : "#ffffff",
              color: mode === "upload" ? "#ffffff" : "#475569",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <IconUpload size={16} />
            Upload File (Max 10 MB)
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("external");
              setError(null);
            }}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              border: mode === "external" ? "1px solid #4338ca" : "1px solid #e2e8f0",
              backgroundColor: mode === "external" ? "#4338ca" : "#ffffff",
              color: mode === "external" ? "#ffffff" : "#475569",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span>🔗</span>
            Add External Link
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("template");
              setError(null);
            }}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              border: mode === "template" ? "1px solid #0284c7" : "1px solid #e2e8f0",
              backgroundColor: mode === "template" ? "#0284c7" : "#ffffff",
              color: mode === "template" ? "#ffffff" : "#475569",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <IconFileText size={16} />
            Draft from Legal Template
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: "#fef2f2", border: "1px solid #f87171", borderRadius: "6px", padding: "0.75rem 1rem", marginBottom: "1.5rem", color: "#b91c1c" }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* MODE 1: INTERNAL FILE UPLOAD (MAX 10 MB) */}
        {mode === "upload" && (
          <form onSubmit={handleUploadSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Document Title <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Bail Petition - Ramesh Kumar vs State"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Associate with Case (Optional)
                </label>
                <select className="form-control" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                  <option value="">-- Firm / Non-case Document --</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number ? `${c.case_number} - ` : ""}
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Repository Folder
                </label>
                <select className="form-control" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                  <option value="">-- Root Folder --</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Document Category <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} required>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Document Type (Classification)
                </label>
                <select className="form-control" value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)}>
                  <option value="">-- General Document --</option>
                  {documentTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.name} ({dt.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Confidentiality Level <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={confidentialityLevel}
                  onChange={(e) => setConfidentialityLevel(e.target.value)}
                  required
                >
                  {CONFIDENTIALITY_LEVELS.map((cl) => (
                    <option key={cl.value} value={cl.value}>
                      {cl.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Description / Draft Notes
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Summary of document contents, purpose, or filing instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Select File <span style={{ color: "#dc2626" }}>*</span>{" "}
                  <span style={{ fontWeight: 400, color: "#64748b", fontSize: "0.8rem" }}>
                    (Maximum internal upload size: <strong>10 MB</strong>)
                  </span>
                </label>
                <div
                  style={{
                    border: "2px dashed #cbd5e1",
                    borderRadius: "8px",
                    padding: "2rem",
                    textAlign: "center",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <input
                    type="file"
                    id="fileUploadInput"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  <label htmlFor="fileUploadInput" style={{ cursor: "pointer" }}>
                    <IconUpload size={32} color="#0284c7" style={{ marginBottom: "0.5rem" }} />
                    <p style={{ margin: 0, fontWeight: 600, color: "#0f172a" }}>
                      {file ? file.name : "Click to select a file or drag and drop"}
                    </p>
                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                      Supported formats: PDF, DOCX, DOC, TXT, JPG, PNG up to <strong>10 MB</strong>
                    </p>
                  </label>
                </div>
              </div>
            </div>

            {loading && uploadProgress > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                  <span>Uploading & Encrypting...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ width: "100%", height: "8px", backgroundColor: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${uploadProgress}%`, height: "100%", backgroundColor: "#0284c7", transition: "width 0.2s" }} />
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <Link to="/documents" className="btn btn-outline">
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={loading || !file}>
                {loading ? "Uploading..." : "Save to Repository"}
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: DIRECT EXTERNAL CLOUD LINK */}
        {mode === "external" && (
          <form onSubmit={handleExternalSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  External Cloud Provider <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  {EXTERNAL_PROVIDERS.map((p) => (
                    <label
                      key={p.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.5rem 1rem",
                        borderRadius: "6px",
                        border: externalProvider === p.value ? `2px solid ${p.color}` : "1px solid #cbd5e1",
                        backgroundColor: externalProvider === p.value ? p.bg : "#ffffff",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="radio"
                        name="externalProvider"
                        value={p.value}
                        checked={externalProvider === p.value}
                        onChange={() => setExternalProvider(p.value)}
                        style={{ display: "none" }}
                      />
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Document Name / Title <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Comprehensive Evidence Bundle 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  External Document URL (HTTPS) <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://drive.google.com/file/d/... or https://onedrive.live.com/..."
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  required
                />
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                  Provide a direct shareable HTTPS link. Our system protects metadata access, but your cloud provider governs actual file access permissions.
                </p>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Associate with Case (Optional)
                </label>
                <select className="form-control" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                  <option value="">-- Firm / Non-case Document --</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number ? `${c.case_number} - ` : ""}
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Repository Folder
                </label>
                <select className="form-control" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                  <option value="">-- Root Folder --</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Document Category <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} required>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Document Type (Classification)
                </label>
                <select className="form-control" value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)}>
                  <option value="">-- General Document --</option>
                  {documentTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.name} ({dt.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Original File Name (Optional)
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. EvidenceBundle_HighCourt.pdf"
                  value={externalFileName}
                  onChange={(e) => setExternalFileName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Approximate File Size (Optional Bytes)
                </label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 45000000 (for ~45 MB)"
                  value={externalFileSize}
                  onChange={(e) => setExternalFileSize(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Confidentiality Level <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={confidentialityLevel}
                  onChange={(e) => setConfidentialityLevel(e.target.value)}
                  required
                >
                  {CONFIDENTIALITY_LEVELS.map((cl) => (
                    <option key={cl.value} value={cl.value}>
                      {cl.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Security Warning for Highly Confidential / Advocate Only external documents */}
              {(confidentialityLevel === "HIGHLY_CONFIDENTIAL" || confidentialityLevel === "ADVOCATE_ONLY") && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    backgroundColor: "#fffbeb",
                    border: "1px solid #f59e0b",
                    borderRadius: "6px",
                    padding: "0.75rem 1rem",
                    color: "#92400e",
                    fontSize: "0.85rem",
                  }}
                >
                  ⚠️ <strong>Privileged Security Notice:</strong> This document is classified as{" "}
                  <strong>{confidentialityLevel}</strong> but is stored outside the application. Please verify that your cloud provider's sharing permissions are strictly restricted to authorized chambers counsel.
                </div>
              )}

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Description / Context Notes
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Notes regarding external file access, who maintains it, or cloud folder location..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Mandatory External Link Confirmation Checkbox */}
              <div
                style={{
                  gridColumn: "1 / -1",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "0.85rem 1rem",
                }}
              >
                <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem", color: "#334155" }}>
                  <input
                    type="checkbox"
                    checked={externalConfirmed}
                    onChange={(e) => setExternalConfirmed(e.target.checked)}
                    style={{ marginTop: "0.2rem" }}
                    required
                  />
                  <span>
                    <strong>I understand that the external provider controls the file's access permissions.</strong>
                    <br />
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      Our platform enforces chambers RBAC for viewing this document's record, but actual file downloads and previews are managed by the host cloud service.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <Link to="/documents" className="btn btn-outline">
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ backgroundColor: "#4338ca", borderColor: "#4338ca" }}
                disabled={loading || !externalConfirmed}
              >
                {loading ? "Saving..." : "Save External Document"}
              </button>
            </div>
          </form>
        )}

        {/* MODE 3: DRAFT FROM TEMPLATE */}
        {mode === "template" && (
          <form onSubmit={handleTemplateSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Choose Legal Template <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  required
                >
                  <option value="">-- Select Standard Legal Template --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.practice_area || "General"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Document Title <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Associate with Case (For Auto-fill)
                </label>
                <select className="form-control" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                  <option value="">-- Select Case to Pre-fill --</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number ? `${c.case_number} - ` : ""}
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Repository Folder
                </label>
                <select className="form-control" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                  <option value="">-- Root Folder --</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Confidentiality Level <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={confidentialityLevel}
                  onChange={(e) => setConfidentialityLevel(e.target.value)}
                  required
                >
                  {CONFIDENTIALITY_LEVELS.map((cl) => (
                    <option key={cl.value} value={cl.value}>
                      {cl.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Dynamic Variables Form */}
              {selectedTemplate && (
                <div style={{ gridColumn: "1 / -1", backgroundColor: "#f8fafc", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", color: "#0f172a" }}>
                    Dynamic Variable Replacements
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "1rem" }}>
                    The placeholders below will be inserted into the template to generate Draft Version 1.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    {Object.keys(templateVariables).map((vKey) => (
                      <div key={vKey}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
                          &#123;&#123;{vKey}&#125;&#125;
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder={`Enter ${vKey.toLowerCase().replace(/_/g, " ")}`}
                          value={templateVariables[vKey]}
                          onChange={(e) =>
                            setTemplateVariables({ ...templateVariables, [vKey]: e.target.value })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <Link to="/documents" className="btn btn-outline">
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={loading || !selectedTemplateId}>
                {loading ? "Generating Draft..." : "Instantiate Legal Draft"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* DEDICATED LARGE FILE MODAL (> 10 MB) */}
      {showLargeFileModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "10px",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  flexShrink: 0,
                }}
              >
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
                  File Too Large
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                  Exceeds internal chambers storage limit
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "0.85rem 1rem",
                marginBottom: "1rem",
                fontSize: "0.85rem",
              }}
            >
              <p style={{ margin: "0 0 0.4rem 0" }}>
                <strong>Selected file:</strong> {largeFileInfo.name}
              </p>
              <p style={{ margin: "0 0 0.4rem 0" }}>
                <strong>File size:</strong> {largeFileInfo.sizeMb} MB
              </p>
              <p style={{ margin: 0, color: "#dc2626", fontWeight: 600 }}>
                Maximum internal upload size: 10 MB
              </p>
            </div>

            <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: 1.5, marginBottom: "1.5rem" }}>
              You can still catalog and track this document by uploading the file to your trusted cloud provider (such as <strong>Google Drive</strong>, <strong>OneDrive</strong>, or <strong>Dropbox</strong>) and saving the link here.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowLargeFileModal(false)}
              >
                Choose Another File
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: "#4338ca", borderColor: "#4338ca" }}
                onClick={() => {
                  setShowLargeFileModal(false);
                  setMode("external");
                  setTitle(largeFileInfo.name.replace(/\.[^/.]+$/, ""));
                  setExternalFileName(largeFileInfo.name);
                }}
              >
                🔗 Add External Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateDocumentPage;
