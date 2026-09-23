import React, { useState } from "react";
import DeadlineStatusBadge from "./DeadlineStatusBadge";
import DeadlineOverrideModal from "./DeadlineOverrideModal";
import deadlineService from "../../services/deadlineService";
import { useAuth } from "../../context/AuthContext";
import { IconCalendar, IconZap } from "../common/Icons";

const DeadlineList = ({ caseId, deadlines, onRefresh }) => {
  const { hasPermission } = useAuth();

  // Modals state
  const [selectedDeadline, setSelectedDeadline] = useState(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showWaiveModal, setShowWaiveModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Form states for complete / waive
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().slice(0, 10));
  const [completionNotes, setCompletionNotes] = useState("");
  const [waiverReason, setWaiverReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const openOverride = (dl) => {
    setSelectedDeadline(dl);
    setShowOverrideModal(true);
  };

  const openComplete = (dl) => {
    setSelectedDeadline(dl);
    setCompletionDate(new Date().toISOString().slice(0, 10));
    setCompletionNotes("");
    setActionError("");
    setShowCompleteModal(true);
  };

  const openWaive = (dl) => {
    setSelectedDeadline(dl);
    setWaiverReason("");
    setActionError("");
    setShowWaiveModal(true);
  };

  const openDetail = (dl) => {
    setSelectedDeadline(dl);
    setShowDetailModal(true);
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError("");
    try {
      await deadlineService.completeCaseDeadline(caseId, selectedDeadline.id, {
        completed_at: completionDate,
        notes: completionNotes.trim(),
      });
      setShowCompleteModal(false);
      onRefresh();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to mark completed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWaiveSubmit = async (e) => {
    e.preventDefault();
    if (!waiverReason.trim()) {
      setActionError("A reason is mandatory to waive a limitation deadline.");
      return;
    }
    setSubmitting(true);
    setActionError("");
    try {
      await deadlineService.waiveCaseDeadline(caseId, selectedDeadline.id, {
        reason: waiverReason.trim(),
      });
      setShowWaiveModal(false);
      onRefresh();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to waive deadline.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!deadlines || deadlines.length === 0) {
    return (
      <div
        style={{
          padding: "2.5rem 1rem",
          textAlign: "center",
          background: "#f8fafc",
          borderRadius: "8px",
          border: "1px dashed #cbd5e1",
          color: "#64748b",
        }}
      >
        <div style={{ marginBottom: "0.5rem", display: "flex", justifyContent: "center" }}>
          <IconCalendar size={36} color="var(--color-primary)" />
        </div>
        <h4 style={{ margin: "0 0 0.3rem", color: "#334155" }}>No Limitation Deadlines</h4>
        <p style={{ margin: 0, fontSize: "0.85rem" }}>
          No statutory or manual deadlines have been tracked for this case dossier yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
              <th style={{ padding: "0.75rem 1rem", color: "#475569" }}>Status</th>
              <th style={{ padding: "0.75rem 1rem", color: "#475569" }}>Title / Rule</th>
              <th style={{ padding: "0.75rem 1rem", color: "#475569" }}>Trigger Date</th>
              <th style={{ padding: "0.75rem 1rem", color: "#475569" }}>Effective Deadline</th>
              <th style={{ padding: "0.75rem 1rem", color: "#475569" }}>Priority</th>
              <th style={{ padding: "0.75rem 1rem", color: "#475569", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deadlines.map((dl) => {
              const isOverridden = dl.is_manual_override || dl.overridden_deadline;
              const isClosed = dl.status === "COMPLETED" || dl.status === "WAIVED";

              return (
                <tr
                  key={dl.id}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    background: dl.status === "DUE_TODAY" ? "#fef2f2" : "#ffffff",
                  }}
                >
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <DeadlineStatusBadge status={dl.status} />
                  </td>

                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ fontWeight: 600, color: "#1e293b" }}>{dl.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {dl.act_name
                        ? `${dl.act_name} ${dl.article_reference || dl.section_reference || ""}`
                        : "Manual Limitation Entry"}
                    </div>
                  </td>

                  <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                    {String(dl.trigger_date).slice(0, 10)}
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{dl.trigger_type}</div>
                  </td>

                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: dl.status === "OVERDUE" ? "#b91c1c" : "#0f172a",
                        fontFamily: "monospace",
                        fontSize: "0.95rem",
                      }}
                    >
                      {String(dl.effective_deadline).slice(0, 10)}
                    </div>
                    {isOverridden && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          color: "#b45309",
                          background: "#fef3c7",
                          padding: "0.15rem 0.4rem",
                          borderRadius: "4px",
                          fontWeight: 600,
                        }}
                        title={`Original Calculated: ${String(dl.calculated_deadline).slice(0, 10)}. Reason: ${dl.override_reason}`}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                          <IconZap size={11} /> Overridden (Orig: {String(dl.calculated_deadline).slice(0, 10)})
                        </span>
                      </span>
                    )}
                  </td>

                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        border: "1px solid",
                        background:
                          dl.priority === "CRITICAL"
                            ? "#000000"
                            : dl.priority === "HIGH"
                            ? "#f4f4f5"
                            : "#ffffff",
                        color:
                          dl.priority === "CRITICAL"
                            ? "#ffffff"
                            : dl.priority === "HIGH"
                            ? "#000000"
                            : "#52525b",
                        borderColor:
                          dl.priority === "CRITICAL"
                            ? "#000000"
                            : dl.priority === "HIGH"
                            ? "#000000"
                            : "#e4e4e7",
                      }}
                    >
                      {dl.priority}
                    </span>
                  </td>

                  <td style={{ padding: "0.75rem 1rem", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => openDetail(dl)}
                      className="btn btn-secondary"
                      style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", marginRight: "0.4rem" }}
                      title="View calculation audit & alerts"
                    >
                      Audit
                    </button>

                    {!isClosed && hasPermission("DEADLINE_OVERRIDE") && (
                      <button
                        onClick={() => openOverride(dl)}
                        className="btn btn-secondary"
                        style={{
                          padding: "0.3rem 0.6rem",
                          fontSize: "0.75rem",
                          marginRight: "0.4rem",
                          color: "#b45309",
                        }}
                        title="Override calculated deadline"
                      >
                        Override
                      </button>
                    )}

                    {!isClosed && hasPermission("DEADLINE_COMPLETE") && (
                      <button
                        onClick={() => openComplete(dl)}
                        className="btn btn-primary"
                        style={{
                          padding: "0.3rem 0.6rem",
                          fontSize: "0.75rem",
                          marginRight: "0.4rem",
                          background: "#15803d",
                        }}
                        title="Mark as completed"
                      >
                        Complete
                      </button>
                    )}

                    {!isClosed && hasPermission("DEADLINE_WAIVE") && (
                      <button
                        onClick={() => openWaive(dl)}
                        className="btn btn-secondary"
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                        title="Waive deadline"
                      >
                        Waive
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Override Modal */}
      {showOverrideModal && selectedDeadline && (
        <DeadlineOverrideModal
          caseId={caseId}
          deadline={selectedDeadline}
          onClose={() => setShowOverrideModal(false)}
          onSuccess={() => {
            setShowOverrideModal(false);
            onRefresh();
          }}
        />
      )}

      {/* Complete Modal */}
      {showCompleteModal && selectedDeadline && (
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
              maxWidth: "460px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              padding: "1.5rem",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", color: "#0f172a" }}>Mark Deadline as Completed</h3>
            <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#64748b" }}>
              {selectedDeadline.title} (Effective: {String(selectedDeadline.effective_deadline).slice(0, 10)})
            </p>

            {actionError && (
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
                {actionError}
              </div>
            )}

            <form onSubmit={handleCompleteSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Completion Date *
                </label>
                <input
                  type="date"
                  required
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Completion Notes / Outcome (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Petition filed in registry before deadline..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: "0.5rem 1rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ padding: "0.5rem 1.25rem", background: "#15803d" }}
                >
                  {submitting ? "Confirming..." : "Confirm Complete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Waive Modal */}
      {showWaiveModal && selectedDeadline && (
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
              maxWidth: "460px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              padding: "1.5rem",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", color: "#0f172a" }}>Waive Limitation Deadline</h3>
            <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#64748b" }}>
              {selectedDeadline.title}
            </p>

            {actionError && (
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
                {actionError}
              </div>
            )}

            <form onSubmit={handleWaiveSubmit}>
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Mandatory Waiver Justification *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Document why this deadline was waived (e.g., matter compromised out-of-court; client instructed not to file appeal)..."
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowWaiveModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: "0.5rem 1rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ padding: "0.5rem 1.25rem" }}
                >
                  {submitting ? "Waiving..." : "Confirm Waiver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Detail Modal */}
      {showDetailModal && selectedDeadline && (
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
              maxWidth: "550px",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#0f172a" }}>Limitation Calculation Audit</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#94a3b8" }}
              >
                &times;
              </button>
            </div>

            <div style={{ marginBottom: "1rem", fontSize: "0.85rem", color: "#334155" }}>
              <div><strong>Title:</strong> {selectedDeadline.title}</div>
              <div><strong>Status:</strong> {selectedDeadline.status}</div>
              <div><strong>Trigger Date:</strong> {String(selectedDeadline.trigger_date).slice(0, 10)} ({selectedDeadline.trigger_type})</div>
              <div><strong>Original Calculated Date:</strong> {selectedDeadline.calculated_deadline ? String(selectedDeadline.calculated_deadline).slice(0, 10) : "Manual Entry"}</div>
              <div><strong>Effective Deadline:</strong> {String(selectedDeadline.effective_deadline).slice(0, 10)}</div>
              <div><strong>Calculation Method:</strong> {selectedDeadline.calculation_method || "N/A"}</div>
            </div>

            {selectedDeadline.is_manual_override && (
              <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.8rem", color: "#92400e" }}>
                <strong>Manual Override Audit:</strong>
                <div>Overridden Date: {String(selectedDeadline.overridden_deadline).slice(0, 10)}</div>
                <div>Reason: {selectedDeadline.override_reason}</div>
                <div>Overridden By: {selectedDeadline.overridden_by_name || "Advocate"}</div>
              </div>
            )}

            {selectedDeadline.calculation_snapshot && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.3rem" }}>
                  Immutable Calculation Snapshot:
                </label>
                <pre
                  style={{
                    background: "#f8fafc",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    overflowX: "auto",
                    color: "#334155",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {typeof selectedDeadline.calculation_snapshot === "string"
                    ? selectedDeadline.calculation_snapshot
                    : JSON.stringify(selectedDeadline.calculation_snapshot, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="btn btn-secondary"
                style={{ padding: "0.45rem 1rem", fontSize: "0.85rem" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeadlineList;
