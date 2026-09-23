import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import documentService from "../../services/documentService";
import { IconFileText, IconPlus } from "../../components/common/Icons";

const DocumentTemplatesPage = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter
  const [search, setSearch] = useState("");
  const [caseTypeFilter, setCaseTypeFilter] = useState("");

  // Create Template Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCaseType, setNewCaseType] = useState("");
  const [newContent, setNewContent] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Preview Modal
  const [previewTemplate, setPreviewTemplate] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentService.getTemplates();
      if (res.success) {
        setTemplates(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    try {
      const res = await documentService.createTemplate({
        templateCode: newCode.trim() || undefined,
        name: newName.trim(),
        description: newDescription.trim(),
        caseType: newCaseType || undefined,
        content: newContent,
      });

      if (res.success) {
        setShowCreateModal(false);
        setNewCode("");
        setNewName("");
        setNewDescription("");
        setNewContent("");
        fetchTemplates();
      }
    } catch (err) {
      setCreateError(err.response?.data?.message || err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.template_code.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()));

    const matchesCaseType = !caseTypeFilter || t.case_type === caseTypeFilter;
    return matchesSearch && matchesCaseType;
  });

  return (
    <div style={{ paddingBottom: "3rem" }}>
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
            <IconFileText size={24} color="#0284c7" />
            Legal Document Templates
          </h1>
          <p className="card-subtitle" style={{ margin: "0.25rem 0 0 0" }}>
            Standardized pleadings, notices, petitions & affidavits with dynamic placeholder validation.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link to="/documents" className="btn btn-outline">
            &larr; Repository
          </Link>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <IconPlus size={16} /> New Template
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search templates by name, code or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: "350px" }}
          />

          <select
            className="form-control"
            value={caseTypeFilter}
            onChange={(e) => setCaseTypeFilter(e.target.value)}
            style={{ maxWidth: "200px" }}
          >
            <option value="">All Practice Areas</option>
            <option value="CRIMINAL">Criminal Law</option>
            <option value="CIVIL">Civil Litigation</option>
            <option value="COMMERCIAL">Commercial & Corporate</option>
            <option value="FAMILY">Family & Matrimonial</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: "#fef2f2", border: "1px solid #f87171", borderRadius: "6px", padding: "0.85rem 1rem", marginBottom: "1.5rem", color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {/* Template Cards Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
          Loading legal templates...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ margin: 0, fontWeight: 600 }}>No templates found matching filters.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {filteredTemplates.map((tmpl) => {
            const vars = Array.isArray(tmpl.variables)
              ? tmpl.variables
              : typeof tmpl.variables === "string"
              ? JSON.parse(tmpl.variables || "[]")
              : [];

            return (
              <div
                key={tmpl.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "box-shadow 0.2s",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 700, color: "#0369a1", backgroundColor: "#e0f2fe", padding: "0.15rem 0.4rem", borderRadius: "4px" }}>
                      {tmpl.template_code}
                    </span>
                    {tmpl.case_type && (
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#475569", backgroundColor: "#f1f5f9", padding: "0.15rem 0.45rem", borderRadius: "4px" }}>
                        {tmpl.case_type}
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.35rem 0", color: "#0f172a" }}>
                    {tmpl.name}
                  </h3>

                  <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 0.75rem 0", minHeight: "38px" }}>
                    {tmpl.description || "Standard legal template."}
                  </p>

                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                      PLACEHOLDERS ({vars.length}):
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                      {vars.slice(0, 5).map((v) => (
                        <span key={v} style={{ fontSize: "0.68rem", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", padding: "0.1rem 0.35rem", borderRadius: "3px", fontFamily: "monospace", color: "#334155" }}>
                          {`{{${v}}}`}
                        </span>
                      ))}
                      {vars.length > 5 && (
                        <span style={{ fontSize: "0.68rem", color: "#94a3b8", padding: "0.1rem 0.2rem" }}>
                          +{vars.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.75rem" }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setPreviewTemplate(tmpl)}
                    style={{ flex: 1, fontSize: "0.8rem", padding: "0.35rem" }}
                  >
                    View Text
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate(`/documents/new?mode=template&templateId=${tmpl.id}`)}
                    style={{ flex: 1, fontSize: "0.8rem", padding: "0.35rem" }}
                  >
                    Use Template
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Text Modal */}
      {previewTemplate && (
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
          <div className="card" style={{ width: "700px", maxWidth: "90%", maxHeight: "80vh", display: "flex", flexDirection: "column", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
                {previewTemplate.name}
              </h2>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setPreviewTemplate(null)}
                style={{ padding: "0.2rem 0.5rem" }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "1rem", whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.85rem", color: "#1e293b", lineHeight: 1.5 }}>
              {previewTemplate.content}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="button" className="btn btn-outline" onClick={() => setPreviewTemplate(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const tId = previewTemplate.id;
                  setPreviewTemplate(null);
                  navigate(`/documents/new?mode=template&templateId=${tId}`);
                }}
              >
                Instantiate Draft &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
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
          <div className="card" style={{ width: "650px", maxWidth: "90%", maxHeight: "85vh", overflowY: "auto", padding: "1.5rem" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
              Create Legal Document Template
            </h2>

            {createError && (
              <div style={{ backgroundColor: "#fef2f2", border: "1px solid #f87171", borderRadius: "6px", padding: "0.5rem 0.75rem", marginBottom: "1rem", color: "#b91c1c", fontSize: "0.85rem" }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTemplate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    Template Code
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. TMPL_AFFIDAVIT"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    Practice Area
                  </label>
                  <select className="form-control" value={newCaseType} onChange={(e) => setNewCaseType(e.target.value)}>
                    <option value="">General Practice</option>
                    <option value="CRIMINAL">Criminal Law</option>
                    <option value="CIVIL">Civil Litigation</option>
                    <option value="COMMERCIAL">Commercial & Corporate</option>
                    <option value="FAMILY">Family Law</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Template Name <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Verification Affidavit"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Description
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Brief note on legal purpose and context..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Template Content (Use `{"{{VAR_NAME}}"}` for placeholders) <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  className="form-control"
                  rows={8}
                  placeholder={`IN THE COURT OF {{COURT_NAME}}\nCASE NO: {{CASE_NUMBER}}\n\nBETWEEN:\n{{CLIENT_NAME}} ...Petitioner\nVERSUS\n{{OPPOSING_PARTY}} ...Respondent\n\n...`}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createLoading}>
                  {createLoading ? "Creating..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentTemplatesPage;
