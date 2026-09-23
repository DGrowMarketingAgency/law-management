import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import documentService from "../../services/documentService";
import { IconFolder, IconShield, IconFileText } from "../../components/common/Icons";
import apiClient from "../../services/api";

const DocumentSettingsPage = () => {
  const [types, setTypes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [retentionPolicies, setRetentionPolicies] = useState([]);
  const [providerStatus, setProviderStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // New Folder Modal
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderLoading, setFolderLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [tRes, fRes, pRes] = await Promise.all([
        documentService.getDocumentTypes(),
        documentService.getFolders(),
        documentService.getProviderStatus().catch(() => ({ data: null })),
      ]);

      if (tRes.success) setTypes(tRes.data || []);
      if (fRes.success) setFolders(fRes.data || []);
      if (pRes?.success) setProviderStatus(pRes.data);

      // Fetch retention policies
      const rRes = await apiClient.get("/documents/retention-policies").catch(() => ({ data: { success: false } }));
      if (rRes.data?.success) setRetentionPolicies(rRes.data.data);
    } catch (err) {
      console.warn("Failed to load document settings:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setFolderLoading(true);
    try {
      const res = await documentService.createFolder({
        name: folderName.trim(),
        description: folderDescription.trim(),
      });
      if (res.success) {
        setShowFolderModal(false);
        setFolderName("");
        setFolderDescription("");
        const fRes = await documentService.getFolders();
        if (fRes.success) setFolders(fRes.data);
      }
    } catch (err) {
      alert("Failed to create folder: " + (err.response?.data?.message || err.message));
    } finally {
      setFolderLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: "3rem" }}>
      {/* Header */}
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
          <h1 className="card-title" style={{ fontSize: "1.6rem", margin: 0 }}>
            Document Management Configuration
          </h1>
          <p className="card-subtitle" style={{ margin: "0.25rem 0 0 0" }}>
            Configure legal document classifications, default case folder structures, and e-signature integrations.
          </p>
        </div>

        <Link to="/documents" className="btn btn-outline">
          &larr; Document Repository
        </Link>
      </div>

      {/* Section 1: E-Signature Integration Status */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <IconShield size={20} color="#059669" />
          E-Signature Provider Integration
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 1rem 0" }}>
          Pluggable ASP provider abstraction compliant with the Information Technology Act, 2000.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "1rem", backgroundColor: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <strong>Digio E-Sign</strong>
              <span style={{ color: "#d97706", fontWeight: 700, fontSize: "0.8rem" }}>READY (Configurable)</span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#475569", margin: "0 0 0.5rem 0" }}>
              Licensed Application Service Provider (ASP) integration for Aadhaar OTP & USB Token DSC eSigns in India.
            </p>
            <div style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#64748b" }}>
              Webhook: /api/v1/webhooks/esign/digio
            </div>
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "1rem", backgroundColor: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <strong>Leegality</strong>
              <span style={{ color: "#d97706", fontWeight: 700, fontSize: "0.8rem" }}>READY (Configurable)</span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#475569", margin: "0 0 0.5rem 0" }}>
              Enterprise legal e-signature and digital documentation gateway with stamp duty integration.
            </p>
            <div style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#64748b" }}>
              Webhook: /api/v1/webhooks/esign/leegality
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Repository Folder Structure */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <IconFolder size={20} color="#0284c7" />
              Standard Case Folder Hierarchy
            </h2>
            <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
              Auto-provisioned standard folder structures for pleadings, applications, affidavits, orders, and evidence.
            </p>
          </div>

          <button className="btn btn-outline" onClick={() => setShowFolderModal(true)}>
            + Custom Folder
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
          {folders.map((f) => (
            <div
              key={f.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "0.75rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                backgroundColor: "#ffffff",
              }}
            >
              <span style={{ fontSize: "1.25rem" }}>📁</span>
              <div>
                <strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>{f.name}</strong>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  {f.description || "System folder"} &bull; {f.document_count || 0} docs
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Configurable Document Types */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
            Configurable Legal Document Classifications ({types.length})
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
            Types defining court filing requirements, mandatory advocate approval, and retention rules.
          </p>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", margin: 0, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#64748b" }}>CODE</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#64748b" }}>NAME</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#64748b" }}>CATEGORY</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center", fontSize: "0.75rem", color: "#64748b" }}>ADVOCATE APPROVAL REQ</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center", fontSize: "0.75rem", color: "#64748b" }}>RETENTION (YRS)</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center", fontSize: "0.75rem", color: "#64748b" }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.65rem 1rem", fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700, color: "#0369a1" }}>
                    {t.code}
                  </td>
                  <td style={{ padding: "0.65rem 1rem", fontWeight: 600, fontSize: "0.85rem" }}>
                    {t.name}
                  </td>
                  <td style={{ padding: "0.65rem 1rem", fontSize: "0.8rem", color: "#64748b" }}>
                    {t.category}
                  </td>
                  <td style={{ padding: "0.65rem 1rem", textAlign: "center" }}>
                    {t.requires_advocate_approval ? (
                      <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.75rem" }}>MANDATORY</span>
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Optional</span>
                    )}
                  </td>
                  <td style={{ padding: "0.65rem 1rem", textAlign: "center", fontSize: "0.8rem", fontWeight: 600 }}>
                    {t.default_retention_years ? `${t.default_retention_years} Yrs` : "Indefinite"}
                  </td>
                  <td style={{ padding: "0.65rem 1rem", textAlign: "center" }}>
                    <span style={{ backgroundColor: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0", padding: "0.15rem 0.45rem", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: 700 }}>
                      ACTIVE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Folder Modal */}
      {showFolderModal && (
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
          <div className="card" style={{ width: "450px", maxWidth: "90%", padding: "1.5rem" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
              Create Custom Repository Folder
            </h2>

            <form onSubmit={handleCreateFolder}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Folder Name <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Expert_Witness_Reports"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Description
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Purpose of folder..."
                  value={folderDescription}
                  onChange={(e) => setFolderDescription(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowFolderModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={folderLoading}>
                  {folderLoading ? "Creating..." : "Create Folder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentSettingsPage;
