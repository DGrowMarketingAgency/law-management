import React, { useState, useEffect } from "react";
import emailAdminService from "../../services/emailAdminService";
import { Link } from "react-router-dom";

const CATEGORIES = ["ALL", "AUTH", "BILLING", "PAYMENT", "DOCUMENT", "WORKFORCE", "SYSTEM", "SECURITY"];

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState(null);

  // Edit Drawer / Modal state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    subject_template: "",
    html_template: "",
    text_template: "",
    status: "ACTIVE",
  });
  const [saving, setSaving] = useState(false);
  const [previewTab, setPreviewTab] = useState("editor"); // 'editor' | 'preview'

  useEffect(() => {
    fetchTemplates();
  }, [category]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const catParam = category === "ALL" ? null : category;
      const data = await emailAdminService.listTemplates(catParam);
      setTemplates(data);
    } catch (err) {
      setMsg({ type: "error", text: "Failed to load email templates." });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = async (tmpl) => {
    try {
      const full = await emailAdminService.getTemplateByKey(tmpl.template_key);
      setSelectedTemplate(full || tmpl);
      setEditForm({
        name: full.name || "",
        subject_template: full.subject_template || "",
        html_template: full.html_template || "",
        text_template: full.text_template || "",
        status: full.status || "ACTIVE",
      });
      setPreviewTab("editor");
    } catch (err) {
      setMsg({ type: "error", text: "Failed to retrieve full template content." });
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    setSaving(true);
    setMsg(null);
    try {
      await emailAdminService.updateTemplate(selectedTemplate.id, editForm);
      setMsg({ type: "success", text: `Template '${selectedTemplate.name}' updated successfully.` });
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.message || "Failed to update template." });
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const query = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(query) ||
      t.template_key.toLowerCase().includes(query) ||
      t.subject_template.toLowerCase().includes(query)
    );
  });

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: "900", color: "#0f172a", margin: 0 }}>
            Chambers Email Templates
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.35rem" }}>
            Customize transactional communications, notification layouts, and automated legal notices.
          </p>
        </div>

        <Link to="/settings/email" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
          &larr; SMTP Connection Settings
        </Link>
      </div>

      {/* Global Status Banner */}
      {msg && (
        <div style={{
          padding: "0.75rem 1.25rem",
          borderRadius: "8px",
          fontSize: "0.875rem",
          backgroundColor: msg.type === "success" ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          color: msg.type === "success" ? "#166534" : "#991b1b"
        }}>
          {msg.text}
        </div>
      )}

      {/* Filters & Search */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "20px",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: "1px solid",
                borderColor: category === cat ? "var(--color-accent, #2563eb)" : "#e2e8f0",
                backgroundColor: category === cat ? "var(--color-accent, #2563eb)" : "#fff",
                color: category === cat ? "#fff" : "#475569",
                cursor: "pointer"
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div>
          <input
            type="text"
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by name, key, or subject line..."
            style={{ fontSize: "0.85rem" }}
          />
        </div>
      </div>

      {/* Templates List */}
      <div className="card">
        {loading ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
            Loading templates...
          </div>
        ) : filteredTemplates.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filteredTemplates.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.85rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  gap: "1rem"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>{t.name}</strong>
                    <span style={{
                      fontSize: "0.65rem",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      background: "#e2e8f0",
                      color: "#475569",
                      fontWeight: 700
                    }}>
                      {t.category}
                    </span>
                    <span style={{
                      fontSize: "0.65rem",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      background: t.status === "ACTIVE" ? "#dcfce7" : "#fee2e2",
                      color: t.status === "ACTIVE" ? "#166534" : "#991b1b",
                      fontWeight: 700
                    }}>
                      {t.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    Key: <code style={{ color: "#334155" }}>{t.template_key}</code> &bull; Subject: <em>{t.subject_template}</em>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem", whiteSpace: "nowrap" }}
                  onClick={() => handleEditClick(t)}
                >
                  Edit Template
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>
            No email templates match your filter.
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {selectedTemplate && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem"
        }}>
          <div className="card" style={{ maxWidth: "750px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Edit Template: {selectedTemplate.name}
                </h3>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Key: <code>{selectedTemplate.template_key}</code> ({selectedTemplate.category})
                </span>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setPreviewTab("editor")}
                  style={{
                    padding: "0.3rem 0.6rem",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    border: "1px solid #cbd5e1",
                    background: previewTab === "editor" ? "#0f172a" : "#fff",
                    color: previewTab === "editor" ? "#fff" : "#475569",
                    cursor: "pointer"
                  }}
                >
                  Code Editor
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("preview")}
                  style={{
                    padding: "0.3rem 0.6rem",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    border: "1px solid #cbd5e1",
                    background: previewTab === "preview" ? "#0f172a" : "#fff",
                    color: previewTab === "preview" ? "#fff" : "#475569",
                    cursor: "pointer"
                  }}
                >
                  Visual Preview
                </button>
              </div>
            </div>

            {/* Placeholder Variables */}
            {selectedTemplate.variables && (
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "0.5rem 0.75rem",
                fontSize: "0.78rem",
                marginBottom: "1rem"
              }}>
                <span style={{ fontWeight: 600, color: "#475569" }}>Supported Dynamic Tags: </span>
                {(Array.isArray(selectedTemplate.variables)
                  ? selectedTemplate.variables
                  : typeof selectedTemplate.variables === "string"
                  ? JSON.parse(selectedTemplate.variables || "[]")
                  : []
                ).map((v) => (
                  <code key={v} style={{ marginRight: "6px", color: "#0284c7" }}>{`{{${v}}}`}</code>
                ))}
              </div>
            )}

            {previewTab === "editor" ? (
              <form onSubmit={handleSaveTemplate} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.8rem" }}>Template Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.8rem" }}>Subject Template</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.subject_template}
                    onChange={(e) => setEditForm({ ...editForm, subject_template: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.8rem" }}>HTML Template</label>
                  <textarea
                    className="form-input"
                    rows={8}
                    style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                    value={editForm.html_template}
                    onChange={(e) => setEditForm({ ...editForm, html_template: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.8rem" }}>Plaintext Template (Optional Fallback)</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                    value={editForm.text_template}
                    onChange={(e) => setEditForm({ ...editForm, text_template: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.8rem" }}>Status</label>
                  <select
                    className="form-input"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedTemplate(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? "Saving Changes..." : "Save Template"}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "1.25rem", background: "#fff" }}>
                <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Subject: </span>
                  <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>{editForm.subject_template}</strong>
                </div>
                <div
                  dangerouslySetInnerHTML={{ __html: editForm.html_template }}
                  style={{ minHeight: "200px" }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
