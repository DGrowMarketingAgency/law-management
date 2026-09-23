import React, { useState, useEffect } from "react";
import emailAdminService from "../../services/emailAdminService";
import { Link } from "react-router-dom";

export default function EmailSettingsPage() {
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [logsData, setLogsData] = useState({ logs: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connResult, setConnResult] = useState(null);

  // Test Email state
  const [testRecipient, setTestRecipient] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Log filter
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchSmtpStatus();
    fetchLogs();
  }, [statusFilter, page]);

  const fetchSmtpStatus = async () => {
    try {
      const data = await emailAdminService.getSmtpStatus();
      setSmtpStatus(data);
    } catch (err) {
      console.warn("Failed to fetch SMTP status:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const data = await emailAdminService.getDeliveryLogs({
        page,
        limit: 15,
        status: statusFilter || undefined,
      });
      setLogsData(data);
    } catch (err) {
      console.warn("Failed to fetch email logs:", err.message);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnResult(null);
    try {
      const data = await emailAdminService.getSmtpStatus();
      setSmtpStatus(data);
      setConnResult({
        ok: data.connection?.ok,
        message: data.connection?.ok
          ? "SMTP Transport connected & verified successfully!"
          : data.connection?.message || "Connection test failed.",
      });
    } catch (err) {
      setConnResult({
        ok: false,
        message: err.response?.data?.message || "Failed to establish SMTP handshake.",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    if (!testRecipient) return;
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await emailAdminService.sendTestEmail(testRecipient);
      setTestResult({
        ok: true,
        message: res.message || `Test email dispatched to ${testRecipient}.`,
      });
      fetchLogs();
    } catch (err) {
      setTestResult({
        ok: false,
        message: err.response?.data?.message || "Failed to dispatch test email.",
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
        Loading email service diagnostics and configuration...
      </div>
    );
  }

  const isConfigured = smtpStatus?.configured;
  const isEnabled = smtpStatus?.enabled;

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: "900", color: "#0f172a", margin: 0 }}>
            Central SMTP Email Infrastructure
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.35rem" }}>
            Unified email transmission engine, SMTP connectivity diagnostics, and delivery audit logs.
          </p>
        </div>

        <Link to="/settings/email-templates" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
          Manage Email Templates &rarr;
        </Link>
      </div>

      {/* Grid: Server Config & Diagnostic Test */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {/* Card 1: SMTP Server Configuration */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                SMTP Server Connection
              </h3>
              <span style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "12px",
                backgroundColor: isEnabled && isConfigured ? "#dcfce7" : "#fef3c7",
                color: isEnabled && isConfigured ? "#166534" : "#92400e"
              }}>
                {isEnabled && isConfigured ? "ONLINE" : isConfigured ? "DISABLED" : "NOT CONFIGURED"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.85rem" }}>
              <div>
                <span style={{ color: "#64748b", display: "block" }}>Host:</span>
                <strong style={{ color: "#0f172a" }}>{smtpStatus?.host}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block" }}>Port:</span>
                <strong style={{ color: "#0f172a" }}>{smtpStatus?.port} ({smtpStatus?.secure ? "SSL" : "STARTTLS"})</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block" }}>From Email:</span>
                <strong style={{ color: "#0f172a" }}>{smtpStatus?.from}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block" }}>Sender Name:</span>
                <strong style={{ color: "#0f172a" }}>{smtpStatus?.fromName}</strong>
              </div>
            </div>

            {connResult && (
              <div style={{
                marginTop: "1rem",
                padding: "0.6rem 0.8rem",
                borderRadius: "6px",
                fontSize: "0.8rem",
                backgroundColor: connResult.ok ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${connResult.ok ? "#bbf7d0" : "#fecaca"}`,
                color: connResult.ok ? "#166534" : "#991b1b"
              }}>
                {connResult.message}
              </div>
            )}
          </div>

          <div style={{ marginTop: "1.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={testingConnection}
              style={{ fontSize: "0.85rem" }}
            >
              {testingConnection ? "Verifying Transport..." : "Verify Connection Handshake"}
            </button>
          </div>
        </div>

        {/* Card 2: Send Diagnostic Email */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#0f172a" }}>
              Send Test Email
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5, margin: "0 0 1rem 0" }}>
              Dispatch an authentic test email via your configured SMTP transport to test end-to-end delivery.
            </p>

            <form onSubmit={handleSendTestEmail}>
              <div className="form-group" style={{ marginBottom: "0.75rem" }}>
                <label className="form-label" style={{ fontSize: "0.8rem" }}>Recipient Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="advocate@example.com"
                  required
                />
              </div>

              {testResult && (
                <div style={{
                  padding: "0.6rem 0.8rem",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  marginBottom: "0.75rem",
                  backgroundColor: testResult.ok ? "#f0fdf4" : "#fef2f2",
                  border: `1px solid ${testResult.ok ? "#bbf7d0" : "#fecaca"}`,
                  color: testResult.ok ? "#166534" : "#991b1b"
                }}>
                  {testResult.message}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", padding: "0.65rem", fontSize: "0.85rem" }}
                disabled={sendingTest || !testRecipient}
              >
                {sendingTest ? "Transmitting Test..." : "Dispatch Diagnostic Email"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Email Delivery Audit Logs */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
              Email Delivery Logs
            </h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "2px 0 0 0" }}>
              Comprehensive delivery audit records across Auth, Invoicing, Payments, Documents, and Workforce.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="form-input"
              style={{ padding: "0.4rem 0.6rem", fontSize: "0.85rem", width: "auto" }}
            >
              <option value="">All Statuses</option>
              <option value="SENT">SENT</option>
              <option value="FAILED">FAILED</option>
              <option value="SENDING">SENDING</option>
              <option value="QUEUED">QUEUED</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                <th style={{ padding: "0.5rem" }}>Recipient</th>
                <th style={{ padding: "0.5rem" }}>Subject</th>
                <th style={{ padding: "0.5rem" }}>Category</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Attempts</th>
                <th style={{ padding: "0.5rem" }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logsData.logs?.length > 0 ? (
                logsData.logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.6rem 0.5rem", fontWeight: 500, color: "#0f172a" }}>
                      {log.recipient}
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem", color: "#334155", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.subject}
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <span style={{
                        fontSize: "0.7rem",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "#f1f5f9",
                        color: "#475569",
                        fontWeight: 600
                      }}>
                        {log.category || "SYSTEM"}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <span style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor:
                          log.status === "SENT"
                            ? "#dcfce7"
                            : log.status === "FAILED"
                            ? "#fee2e2"
                            : "#fef3c7",
                        color:
                          log.status === "SENT"
                            ? "#166534"
                            : log.status === "FAILED"
                            ? "#991b1b"
                            : "#92400e",
                      }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem", color: "#64748b" }}>
                      {log.attempt_count}
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem", color: "#64748b" }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                    No email delivery logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {logsData.pagination?.totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
              Previous
            </button>
            <span style={{ fontSize: "0.8rem", alignSelf: "center", color: "#64748b" }}>
              Page {page} of {logsData.pagination.totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
              disabled={page >= logsData.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
