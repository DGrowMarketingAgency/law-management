import React, { useState } from "react";
import deadlineService from "../../services/deadlineService";

const DeadlineOverrideModal = ({ caseId, deadline, onClose, onSuccess }) => {
  const [overrideDate, setOverrideDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const originalDate = deadline.calculated_deadline
    ? String(deadline.calculated_deadline).slice(0, 10)
    : "N/A (Manual Entry)";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!overrideDate) {
      setError("Please select a new override deadline date.");
      return;
    }
    if (!reason.trim()) {
      setError("A professional legal justification (reason) is mandatory for manual overrides.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await deadlineService.overrideCaseDeadline(caseId, deadline.id, {
        override_deadline: overrideDate,
        reason: reason.trim(),
        notes: notes.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to override deadline.");
    } finally {
      setSaving(false);
    }
  };

  return (
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
          maxWidth: "520px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8fafc",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>
              Manual Deadline Override
            </h3>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
              {deadline.title}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              cursor: "pointer",
              color: "#94a3b8",
            }}
          >
            &times;
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          {error && (
            <div
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                padding: "0.6rem 0.8rem",
                borderRadius: "6px",
                fontSize: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              {error}
            </div>
          )}

          {/* Legal Safety Banner */}
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "6px",
              padding: "0.75rem",
              marginBottom: "1rem",
              fontSize: "0.8rem",
              color: "#1e40af",
            }}
          >
            <strong>Preservation Notice:</strong> Overriding will change the effective
            deadline and regenerate alert schedules, but the original calculated date (
            <strong>{originalDate}</strong>) and statutory snapshot remain permanently
            preserved in the chambers audit trail.
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.3rem",
              }}
            >
              Original Calculated Deadline
            </label>
            <input
              type="text"
              readOnly
              value={originalDate}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                color: "#64748b",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.3rem",
              }}
            >
              New Overridden Deadline *
            </label>
            <input
              type="date"
              required
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.3rem",
              }}
            >
              Professional Justification / Legal Reason *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g., Section 14 Limitation Act exclusion; High Court extension order dated dd/mm/yyyy; court vacation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.85rem",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.3rem",
              }}
            >
              Internal Chambers Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Additional internal briefing notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.85rem",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}
            >
              {saving ? "Saving Override..." : "Save Override"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeadlineOverrideModal;
