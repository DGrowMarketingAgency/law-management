import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import deadlineService from "../../services/deadlineService";
import DeadlineStatusBadge from "../../components/deadlines/DeadlineStatusBadge";
import { useAuth } from "../../context/AuthContext";
import {
  IconBell,
  IconScale,
  IconZap,
  IconHourglass,
  IconCalendar,
  IconAlertTriangle,
  IconSearch,
  IconCheck,
} from "../../components/common/Icons";

const DeadlineDashboardPage = () => {
  const { hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingAlerts, setProcessingAlerts] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState("");

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await deadlineService.getDeadlinesDashboard();
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load deadline dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const handleProcessAlerts = async () => {
    try {
      setProcessingAlerts(true);
      setAlertSuccess("");
      const res = await deadlineService.processAlerts();
      setAlertSuccess(
        `Alerts processed: ${res.data?.processed || 0} checked, ${res.data?.sent || 0} sent.`
      );
      fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to process alerts.");
    } finally {
      setProcessingAlerts(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-secondary)" }}>
        Loading Chambers Limitation Deadlines Dashboard...
      </div>
    );
  }

  const m = data?.metrics || {};

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
            Limitation Deadlines & Alerts
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
            Statutory limitation management, trigger calculation engine, and 30/15/7/1-day alerts.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          {hasPermission("DEADLINE_RULE_MANAGE") && (
            <Link
              to="/deadline-rules"
              className="btn btn-secondary"
              style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
            >
              Configure Limitation Rules
            </Link>
          )}

          <button
            onClick={handleProcessAlerts}
            disabled={processingAlerts}
            className="btn btn-secondary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
            title="Scan and deliver due internal alerts"
          >
            {processingAlerts ? (
              "Processing..."
            ) : (
              <>
                <IconBell size={15} /> Run Alert Dispatcher
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mandatory Legal Disclaimer Banner */}
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
        <IconScale size={20} color="#000000" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: "0.82rem", color: "#18181b", lineHeight: 1.4 }}>
          <strong>LEGAL SAFETY NOTICE:</strong> System-generated limitation date. Verify
          against the applicable law, facts, exclusions, extensions, court orders, and
          professional legal judgment.
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#000000",
            color: "#ffffff",
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {alertSuccess && (
        <div
          style={{
            background: "#f4f4f5",
            border: "1px solid #000000",
            color: "#000000",
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
          }}
        >
          {alertSuccess}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {/* Due Today */}
        <div
          style={{
            background: m.dueToday > 0 ? "#000000" : "#ffffff",
            color: m.dueToday > 0 ? "#ffffff" : "#000000",
            border: "1px solid #000000",
            borderRadius: "8px",
            padding: "1rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: m.dueToday > 0 ? "#ffffff" : "#000000", display: "flex", alignItems: "center", gap: "5px" }}>
            <IconZap size={14} color={m.dueToday > 0 ? "#ffffff" : "#000000"} /> Due Today
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: m.dueToday > 0 ? "#ffffff" : "#000000", margin: "0.2rem 0" }}>
            {m.dueToday}
          </div>
          <div style={{ fontSize: "0.75rem", color: m.dueToday > 0 ? "#a1a1aa" : "#71717a" }}>Requires immediate filing</div>
        </div>

        {/* Due in 7 Days */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e4e4e7",
            borderRadius: "8px",
            padding: "1rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#000000", display: "flex", alignItems: "center", gap: "5px" }}>
            <IconHourglass size={14} color="#000000" /> Due in ≤ 7 Days
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#000000", margin: "0.2rem 0" }}>
            {m.due7Days}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#71717a" }}>Critical priority window</div>
        </div>

        {/* Due in 15 Days */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e4e4e7",
            borderRadius: "8px",
            padding: "1rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#000000", display: "flex", alignItems: "center", gap: "5px" }}>
            <IconCalendar size={14} color="#000000" /> Due in ≤ 15 Days
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#000000", margin: "0.2rem 0" }}>
            {m.due15Days}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#71717a" }}>Drafting & review stage</div>
        </div>

        {/* Due in 30 Days */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e4e4e7",
            borderRadius: "8px",
            padding: "1rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#000000", display: "flex", alignItems: "center", gap: "5px" }}>
            <IconCalendar size={14} color="#000000" /> Due in ≤ 30 Days
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#000000", margin: "0.2rem 0" }}>
            {m.due30Days}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#71717a" }}>Advance alert window</div>
        </div>

        {/* Overdue */}
        <div
          style={{
            background: m.overdue > 0 ? "#18181b" : "#ffffff",
            color: m.overdue > 0 ? "#ffffff" : "#000000",
            border: "1px solid #000000",
            borderRadius: "8px",
            padding: "1rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: m.overdue > 0 ? "#ffffff" : "#000000", display: "flex", alignItems: "center", gap: "5px" }}>
            <IconAlertTriangle size={14} color={m.overdue > 0 ? "#ffffff" : "#000000"} /> Overdue
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: m.overdue > 0 ? "#ffffff" : "#000000", margin: "0.2rem 0" }}>
            {m.overdue}
          </div>
          <div style={{ fontSize: "0.75rem", color: m.overdue > 0 ? "#a1a1aa" : "#71717a" }}>Requires condonation / review</div>
        </div>

        {/* Manual Review Required */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e4e4e7",
            borderRadius: "8px",
            padding: "1rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#000000", display: "flex", alignItems: "center", gap: "5px" }}>
            <IconSearch size={14} color="#000000" /> Manual Review
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#000000", margin: "0.2rem 0" }}>
            {m.manualReviewRequired}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#71717a" }}>Fallback or unverified rules</div>
        </div>

        {/* Total Active / Completed */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e4e4e7",
            borderRadius: "8px",
            padding: "1rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#000000", display: "flex", alignItems: "center", gap: "5px" }}>
            <IconCheck size={14} color="#000000" /> Completed
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#000000", margin: "0.2rem 0" }}>
            {m.completed}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#71717a" }}>{m.waived || 0} Waived</div>
        </div>
      </div>

      {/* Main Content Grid: Urgent Deadlines + Court Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", gap: "1.5rem" }}>
        {/* Urgent Deadlines Roster */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            padding: "1.25rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem", color: "#0f172a" }}>
            Priority Limitation Deadlines (Upcoming & Overdue)
          </h2>

          {data?.urgentDeadlines?.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              No active upcoming deadlines found in chambers roster.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem 0.75rem", color: "#475569" }}>Status</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "#475569" }}>Case Matter</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "#475569" }}>Deadline Title</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "#475569" }}>Effective Date</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "#475569", textAlign: "right" }}>Dossier</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.urgentDeadlines?.map((dl) => (
                    <tr key={dl.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <DeadlineStatusBadge status={dl.status} />
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{dl.case_number}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{dl.case_title}</div>
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <div style={{ color: "#334155" }}>{dl.title}</div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                          {dl.act_name ? `${dl.act_name} ${dl.article_reference || ""}` : "Manual Entry"}
                        </div>
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontFamily: "monospace",
                            color: dl.status === "OVERDUE" ? "#b91c1c" : "#0f172a",
                          }}
                        >
                          {String(dl.effective_deadline).slice(0, 10)}
                        </span>
                        {dl.is_manual_override && (
                          <div style={{ fontSize: "0.7rem", color: "#b45309", display: "flex", alignItems: "center", gap: "3px" }}>
                            <IconZap size={11} /> Overridden
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                        <Link
                          to={`/cases/${dl.case_id}`}
                          className="btn btn-secondary"
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                        >
                          View Case &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Court Breakdown Panel */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            padding: "1.25rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            height: "fit-content",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem", color: "#0f172a" }}>
            Deadlines by Court
          </h3>

          {data?.courtBreakdown?.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>No court data available.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {data?.courtBreakdown?.map((c) => (
                <div
                  key={c.court_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.6rem 0.75rem",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "#334155" }}>
                    {c.court_name}
                  </span>
                  <span
                    style={{
                      background: "var(--color-primary, #0f766e)",
                      color: "#ffffff",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "0.2rem 0.5rem",
                      borderRadius: "9999px",
                    }}
                  >
                    {c.deadline_count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeadlineDashboardPage;
