import React, { useState, useEffect } from "react";
import deadlineRuleService from "../../services/deadlineRuleService";
import { useAuth } from "../../context/AuthContext";
import { IconBook } from "../../components/common/Icons";

const DeadlineRulesPage = () => {
  const { hasPermission } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    act_name: "Limitation Act, 1963",
    act_version: "1963",
    article_reference: "",
    section_reference: "",
    proceeding_type: "Civil Suit",
    description: "",
    limitation_days: "",
    limitation_months: "",
    limitation_years: "",
    trigger_type: "CAUSE_OF_ACTION",
    exclusion_notes: "",
    source_reference: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    fetchRules();
  }, [search, activeFilter]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      setError("");
      const params = { limit: 100 };
      if (search) params.search = search;
      if (activeFilter !== "") params.is_active = activeFilter;
      const res = await deadlineRuleService.getRules(params);
      setRules(res.data?.rules || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load limitation rules.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (rule) => {
    try {
      await deadlineRuleService.toggleRuleActive(rule.id, !rule.is_active);
      fetchRules();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to toggle rule status.");
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalError("");

    const days = formData.limitation_days ? parseInt(formData.limitation_days, 10) : null;
    const months = formData.limitation_months ? parseInt(formData.limitation_months, 10) : null;
    const years = formData.limitation_years ? parseInt(formData.limitation_years, 10) : null;

    if (!days && !months && !years) {
      setModalError("At least one limitation period (days, months, or years) must be specified.");
      setSaving(false);
      return;
    }

    try {
      await deadlineRuleService.createRule({
        ...formData,
        limitation_days: days,
        limitation_months: months,
        limitation_years: years,
      });
      setShowCreateModal(false);
      setFormData({
        act_name: "Limitation Act, 1963",
        act_version: "1963",
        article_reference: "",
        section_reference: "",
        proceeding_type: "Civil Suit",
        description: "",
        limitation_days: "",
        limitation_months: "",
        limitation_years: "",
        trigger_type: "CAUSE_OF_ACTION",
        exclusion_notes: "",
        source_reference: "",
        is_active: true,
      });
      fetchRules();
    } catch (err) {
      setModalError(err.response?.data?.message || "Failed to create limitation rule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "0 0 0.3rem", color: "#0f172a" }}>
            Limitation Act Rules Registry
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
            Data-driven statutory limitation provisions, periods, and calculation triggers.
          </p>
        </div>

        {hasPermission("DEADLINE_RULE_MANAGE") && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}
          >
            + Configure New Rule
          </button>
        )}
      </div>

      {/* Safety Notice */}
      <div
        style={{
          background: "#f4f4f5",
          border: "1px solid #e4e4e7",
          borderRadius: "8px",
          padding: "0.85rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        <IconBook size={22} color="#000000" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: "0.82rem", color: "#18181b", lineHeight: 1.4 }}>
          <strong>RULE DATA INTEGRITY:</strong> In compliance with chambers security, limitation
          provisions are not fabricated or assumed. Rules must be configured from verified
          statutory sources by authorized advocates.
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Search & Filters */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          background: "#ffffff",
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ flex: 2, minWidth: "220px" }}>
          <input
            type="text"
            placeholder="Search by Act Name, Article, Section, or Description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
          />
        </div>

        <div style={{ flex: 1, minWidth: "160px" }}>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
          >
            <option value="">All Statuses (Active & Inactive)</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Rules Table */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
            Loading statutory limitation rules...
          </div>
        ) : rules.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
            No limitation rules match the selected criteria.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "0.75rem 1rem", color: "#475569" }}>Statute / Provision</th>
                  <th style={{ padding: "0.75rem 1rem", color: "#475569" }}>Proceeding Type</th>
                  <th style={{ padding: "0.75rem 1rem", color: "#475569" }}>Limitation Period</th>
                  <th style={{ padding: "0.75rem 1rem", color: "#475569" }}>Trigger Event</th>
                  <th style={{ padding: "0.75rem 1rem", color: "#475569" }}>Status</th>
                  {hasPermission("DEADLINE_RULE_MANAGE") && (
                    <th style={{ padding: "0.75rem 1rem", color: "#475569", textAlign: "right" }}>Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => {
                  let periodText = "";
                  if (r.limitation_years) periodText = `${r.limitation_years} Year(s)`;
                  else if (r.limitation_months) periodText = `${r.limitation_months} Month(s)`;
                  else if (r.limitation_days) periodText = `${r.limitation_days} Day(s)`;

                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{r.act_name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {r.article_reference || r.section_reference || "General Provision"} (v{r.act_version || "1963"})
                        </div>
                      </td>

                      <td style={{ padding: "0.75rem 1rem", color: "#334155" }}>
                        {r.proceeding_type}
                      </td>

                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "#0f766e",
                            background: "#ccfbf1",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                          }}
                        >
                          {periodText}
                        </span>
                      </td>

                      <td style={{ padding: "0.75rem 1rem", color: "#64748b" }}>
                        {r.trigger_type}
                      </td>

                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span
                          style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: r.is_active ? "#dcfce7" : "#fee2e2",
                            color: r.is_active ? "#166534" : "#991b1b",
                          }}
                        >
                          {r.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {hasPermission("DEADLINE_RULE_MANAGE") && (
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <button
                            onClick={() => handleToggleActive(r)}
                            className="btn btn-secondary"
                            style={{
                              padding: "0.3rem 0.6rem",
                              fontSize: "0.75rem",
                              color: r.is_active ? "#b91c1c" : "#15803d",
                            }}
                          >
                            {r.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "580px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#0f172a" }}>Configure Limitation Rule</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#94a3b8" }}
              >
                &times;
              </button>
            </div>

            {modalError && (
              <div
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  padding: "0.6rem",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Act Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.act_name}
                    onChange={(e) => setFormData({ ...formData, act_name: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Act Version
                  </label>
                  <input
                    type="text"
                    value={formData.act_version}
                    onChange={(e) => setFormData({ ...formData, act_version: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Article Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Article 54"
                    value={formData.article_reference}
                    onChange={(e) => setFormData({ ...formData, article_reference: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Section Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Section 34(3)"
                    value={formData.section_reference}
                    onChange={(e) => setFormData({ ...formData, section_reference: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Proceeding Type *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Specific Performance Suit, Civil Appeal, Leave to Defend"
                  value={formData.proceeding_type}
                  onChange={(e) => setFormData({ ...formData, proceeding_type: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                />
              </div>

              {/* Limitation Period: Days / Months / Years */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Limitation Period (Specify one) *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <input
                      type="number"
                      min="1"
                      placeholder="Years (e.g. 3)"
                      value={formData.limitation_years}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          limitation_years: e.target.value,
                          limitation_months: "",
                          limitation_days: "",
                        })
                      }
                      style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                    />
                    <span style={{ fontSize: "0.7rem", color: "#64748b" }}>Years</span>
                  </div>

                  <div>
                    <input
                      type="number"
                      min="1"
                      placeholder="Months (e.g. 3)"
                      value={formData.limitation_months}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          limitation_months: e.target.value,
                          limitation_years: "",
                          limitation_days: "",
                        })
                      }
                      style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                    />
                    <span style={{ fontSize: "0.7rem", color: "#64748b" }}>Months</span>
                  </div>

                  <div>
                    <input
                      type="number"
                      min="1"
                      placeholder="Days (e.g. 90)"
                      value={formData.limitation_days}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          limitation_days: e.target.value,
                          limitation_years: "",
                          limitation_months: "",
                        })
                      }
                      style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                    />
                    <span style={{ fontSize: "0.7rem", color: "#64748b" }}>Days</span>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Trigger Event Type *
                </label>
                <select
                  value={formData.trigger_type}
                  onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                >
                  <option value="CAUSE_OF_ACTION">Cause of Action Accrues</option>
                  <option value="DATE_OF_ORDER">Date of Order / Decree</option>
                  <option value="DATE_OF_JUDGMENT">Date of Judgment</option>
                  <option value="DATE_OF_KNOWLEDGE">Date of Knowledge of Fact</option>
                  <option value="DATE_OF_DEFAULT">Date of Default</option>
                  <option value="DATE_OF_RECEIPT_OF_AWARD">Date of Receipt of Arbitral Award</option>
                  <option value="DATE_FIXED_FOR_PERFORMANCE">Date Fixed for Performance</option>
                  <option value="OTHER">Other Specified Statutory Event</option>
                </select>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Exclusion Notes / Statutory Condition (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g., Section 12 time requisite for obtaining certified copy excluded..."
                  value={formData.exclusion_notes}
                  onChange={(e) => setFormData({ ...formData, exclusion_notes: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Source Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., AIR 2022 SC 1234 or Limitation Act Schedule Entry"
                  value={formData.source_reference}
                  onChange={(e) => setFormData({ ...formData, source_reference: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: "0.5rem 1rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ padding: "0.5rem 1.25rem" }}
                >
                  {saving ? "Saving..." : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeadlineRulesPage;
