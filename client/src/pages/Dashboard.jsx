import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import dashboardService from "../services/dashboardService";
import {
  IconScale,
  IconClock,
  IconUsers,
  IconInvoice,
  IconPayment,
  IconCheckSquare,
  IconFolder,
  IconBriefcase,
  IconShield,
  IconPhone,
  IconAlertTriangle,
  IconCalendar,
} from "../components/common/Icons";

const formatINR = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const Dashboard = () => {
  const { user, requestEnable2FA, confirmEnable2FA, disable2FA, hasPermission } = useAuth();
  const navigate = useNavigate();

  // Filters & State
  const [period, setPeriod] = useState("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [summary, setSummary] = useState(null);
  const [hearings, setHearings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [clientData, setClientData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // 2FA Management State (Preserved)
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState("init");
  const [twoFAOtp, setTwoFAOtp] = useState("");
  const [twoFAPassword, setTwoFAPassword] = useState("");
  const [twoFAMessage, setTwoFAMessage] = useState("");
  const [twoFAError, setTwoFAError] = useState("");
  const [twoFALoading, setTwoFALoading] = useState(false);

  const isClient = Boolean(user?.roles && user?.roles.includes("CLIENT"));
  const isOwner = Boolean(user?.isOwner || user?.roles?.includes("OWNER") || user?.roles?.includes("ADMIN"));
  const hasBillingPerm = Boolean(isOwner || hasPermission("INVOICE_VIEW"));
  const hasPaymentPerm = Boolean(isOwner || hasPermission("PAYMENT_VIEW"));

  // Fetch all dashboard data concurrently
  const loadDashboard = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      setError(null);

      try {
        if (isClient) {
          // Dedicated Client Portal Dashboard
          const cRes = await dashboardService.getClientDashboard();
          if (cRes.success) {
            setClientData(cRes.data);
          }
        } else {
          // Practice Staff & Advocates Dashboard
          const params = { period };
          if (period === "custom") {
            if (customFrom) params.from = customFrom;
            if (customTo) params.to = customTo;
          }

          const promises = [
            dashboardService.getSummary(params),
            dashboardService.getUpcomingHearings(5),
            dashboardService.getUpcomingTasks(5),
            dashboardService.getRecentActivity(8),
          ];

          if (hasBillingPerm) {
            promises.push(dashboardService.getRecentInvoices(5).catch(() => ({ data: [] })));
          }
          if (hasPaymentPerm) {
            promises.push(dashboardService.getRecentPayments(5).catch(() => ({ data: [] })));
          }

          const results = await Promise.all(promises);

          const sumRes = results[0];
          const hearRes = results[1];
          const taskRes = results[2];
          const actRes = results[3];

          if (sumRes?.success) setSummary(sumRes.data);
          if (hearRes?.success) setHearings(hearRes.data || []);
          if (taskRes?.success) setTasks(taskRes.data || []);
          if (actRes?.success) setActivity(actRes.data || []);

          let nextIdx = 4;
          if (hasBillingPerm) {
            const invRes = results[nextIdx++];
            if (invRes?.success) setInvoices(invRes.data || []);
          }
          if (hasPaymentPerm) {
            const payRes = results[nextIdx++];
            if (payRes?.success) setPayments(payRes.data || []);
          }
        }

        setLastUpdated(new Date());
      } catch (err) {
        console.error("[Dashboard Load Error]:", err);
        setError(err.response?.data?.message || "Unable to load dashboard data. Please verify your connection.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, customFrom, customTo, isClient, hasBillingPerm, hasPaymentPerm]
  );

  // Initial load & filter change
  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  // Safe Real-Time Auto-Refresh Polling (60s default, paused when tab hidden)
  useEffect(() => {
    const intervalMs = 60000;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadDashboard(false);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [loadDashboard]);

  // 2FA Handlers
  const handleStartEnable2FA = async () => {
    setTwoFALoading(true);
    setTwoFAError("");
    try {
      await requestEnable2FA();
      setTwoFAStep("confirm");
      setShow2FAModal(true);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to start 2FA setup");
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleConfirmEnable2FA = async (e) => {
    e.preventDefault();
    setTwoFALoading(true);
    setTwoFAError("");
    try {
      await confirmEnable2FA(twoFAOtp);
      setTwoFAMessage("Two-factor authentication successfully enabled!");
      setTimeout(() => {
        setShow2FAModal(false);
        setTwoFAMessage("");
        setTwoFAOtp("");
      }, 1500);
    } catch (err) {
      setTwoFAError(err.response?.data?.message || "Invalid OTP");
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleStartDisable2FA = () => {
    setTwoFAPassword("");
    setTwoFAError("");
    setTwoFAStep("disable");
    setShow2FAModal(true);
  };

  const handleConfirmDisable2FA = async (e) => {
    e.preventDefault();
    setTwoFALoading(true);
    setTwoFAError("");
    try {
      await disable2FA(twoFAPassword);
      setTwoFAMessage("Two-factor authentication disabled.");
      setTimeout(() => {
        setShow2FAModal(false);
        setTwoFAMessage("");
        setTwoFAPassword("");
      }, 1500);
    } catch (err) {
      setTwoFAError(err.response?.data?.message || "Incorrect password");
    } finally {
      setTwoFALoading(false);
    }
  };

  // =========================================================================
  // CLIENT PORTAL VIEW
  // =========================================================================
  if (isClient) {
    return (
      <div style={{ paddingBottom: "3rem" }}>
        {/* Welcome Banner */}
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h1 className="card-title" style={{ fontSize: "1.6rem", margin: 0 }}>
                Client Confidential Portal
              </h1>
              <p className="card-subtitle" style={{ margin: "0.25rem 0 0 0" }}>
                Welcome, <strong>{user?.firstName} {user?.lastName}</strong> ({user?.email})
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => loadDashboard(true)} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "↻ Refresh Portal"}
            </button>
          </div>
        </div>

        {/* Client KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="card" style={{ padding: "1.25rem", margin: 0 }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Active Matters</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0f172a", marginTop: "0.25rem" }}>
              {clientData?.cases?.length || 0}
            </div>
          </div>
          <div className="card" style={{ padding: "1.25rem", margin: 0 }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Upcoming Hearings</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0284c7", marginTop: "0.25rem" }}>
              {clientData?.hearings?.length || 0}
            </div>
          </div>
          <div className="card" style={{ padding: "1.25rem", margin: 0 }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Total Outstanding Due</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: (clientData?.totalDue || 0) > 0 ? "#dc2626" : "#059669", marginTop: "0.25rem" }}>
              {formatINR(clientData?.totalDue)}
            </div>
          </div>
        </div>

        {/* Client Matters & Hearings */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem" }}>
          {/* Active Cases */}
          <div className="card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>My Legal Matters</h3>
            {(clientData?.cases || []).length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "0.9rem" }}>No active matters associated with your profile.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {clientData.cases.map((c) => (
                  <div key={c.id} style={{ padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{c.case_number}</div>
                    <div style={{ fontSize: "0.85rem", color: "#475569" }}>{c.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                      Court: {c.court_name || "Tribunal"} &bull; Stage: {c.case_stage || "Pleadings"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Hearings */}
          <div className="card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>Upcoming Court Hearings</h3>
            {(clientData?.hearings || []).length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "0.9rem" }}>No upcoming court hearings scheduled.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {clientData.hearings.map((h) => (
                  <div key={h.id} style={{ padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ color: "#0284c7" }}>{formatDate(h.hearing_date)}</strong>
                      <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{h.hearing_time || "10:30 AM"}</span>
                    </div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, marginTop: "0.25rem" }}>{h.case_number}</div>
                    <div style={{ fontSize: "0.8rem", color: "#475569" }}>Purpose: {h.purpose || "Regular Hearing"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ADVOCATES & CHAMBERS STAFF DASHBOARD
  // =========================================================================
  return (
    <div style={{ paddingBottom: "3rem" }}>
      {/* 1. Header & Workspace Welcome Banner */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <h1 className="card-title" style={{ fontSize: "1.6rem", margin: 0 }}>
                Chambers Operations Center
              </h1>
              <span
                style={{
                  padding: "0.15rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  backgroundColor: "#059669",
                  color: "#ffffff",
                }}
              >
                LIVE PRODUCTION
              </span>
            </div>
            <p className="card-subtitle" style={{ margin: "0.25rem 0 0.5rem 0" }}>
              Welcome back, <strong>{user?.firstName} {user?.lastName}</strong> ({user?.email}) &bull;{" "}
              <span>Role: {user?.roles?.join(", ") || "Associate"}</span>
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            {hasPermission("USER_VIEW") && (
              <Link to="/users" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
                Associates & RBAC
              </Link>
            )}

            {user?.twoFactorEnabled ? (
              <button onClick={handleStartDisable2FA} className="btn btn-secondary" style={{ fontSize: "0.85rem" }} disabled={twoFALoading}>
                2FA: Active
              </button>
            ) : (
              <button onClick={handleStartEnable2FA} className="btn btn-secondary" style={{ fontSize: "0.85rem", color: "#d97706" }} disabled={twoFALoading}>
                + Activate 2FA
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Controls Toolbar: Period Filter, Live Timestamp, Manual Refresh */}
      <div
        className="card"
        style={{
          marginBottom: "1.5rem",
          padding: "0.85rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>Analytics Window:</label>
          <select
            className="form-control"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ width: "auto", minWidth: "160px", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="custom">Custom Date Range</option>
          </select>

          {period === "custom" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="date"
                className="form-control"
                style={{ width: "auto", padding: "0.35rem 0.5rem", fontSize: "0.8rem" }}
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span style={{ color: "#64748b" }}>to</span>
              <input
                type="date"
                className="form-control"
                style={{ width: "auto", padding: "0.35rem 0.5rem", fontSize: "0.8rem" }}
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString("en-IN") : "Connecting..."}
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => loadDashboard(true)}
            disabled={refreshing || loading}
            style={{ fontSize: "0.85rem", padding: "0.4rem 0.85rem" }}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ backgroundColor: "#fef2f2", border: "1px solid #f87171", padding: "1rem", borderRadius: "6px", marginBottom: "1.5rem", color: "#991b1b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{error}</span>
            <button className="btn btn-secondary" onClick={() => loadDashboard(true)} style={{ fontSize: "0.8rem" }}>
              Retry Now
            </button>
          </div>
        </div>
      )}

      {/* 3. Live System Health Bar (Only if authorized/present) */}
      {summary?.systemHealth && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ padding: "0.6rem 0.85rem", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: summary.systemHealth.database.status === "CONNECTED" ? "#059669" : "#dc2626" }} />
            <span style={{ fontSize: "0.8rem", color: "#334155" }}>
              Database: <strong>{summary.systemHealth.database.status}</strong> ({summary.systemHealth.database.latencyMs}ms)
            </span>
          </div>

          <div style={{ padding: "0.6rem 0.85rem", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: summary.systemHealth.email.status === "CONFIGURED" ? "#059669" : "#d97706" }} />
            <span style={{ fontSize: "0.8rem", color: "#334155" }}>
              SMTP Service: <strong>{summary.systemHealth.email.status}</strong>
            </span>
          </div>

          <div style={{ padding: "0.6rem 0.85rem", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: summary.systemHealth.gateways.razorpay === "CONFIGURED" ? "#059669" : "#94a3b8" }} />
            <span style={{ fontSize: "0.8rem", color: "#334155" }}>
              Razorpay: <strong>{summary.systemHealth.gateways.razorpay}</strong>
            </span>
          </div>

          <div style={{ padding: "0.6rem 0.85rem", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: summary.systemHealth.gateways.payu === "CONFIGURED" ? "#059669" : "#94a3b8" }} />
            <span style={{ fontSize: "0.8rem", color: "#334155" }}>
              PayU India: <strong>{summary.systemHealth.gateways.payu}</strong>
            </span>
          </div>
        </div>
      )}

      {/* 4. Core Primary KPI Metric Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* Active Cases */}
        <Link to="/cases?status=ACTIVE" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card" style={{ padding: "1.2rem", margin: 0, transition: "transform 0.1s, box-shadow 0.1s", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>Active Cases</span>
              <IconScale size={18} color="#0284c7" />
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0f172a", marginTop: "0.35rem" }}>
              {loading ? "..." : summary?.cases?.active ?? 0}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#059669", marginTop: "0.25rem" }}>
              +{summary?.cases?.openedInPeriod || 0} opened in period
            </div>
          </div>
        </Link>

        {/* Upcoming Hearings */}
        <Link to="/cause-list" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card" style={{ padding: "1.2rem", margin: 0, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>Upcoming Hearings</span>
              <IconClock size={18} color="#059669" />
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: (summary?.hearings?.today || 0) > 0 ? "#dc2626" : "#0f172a", marginTop: "0.35rem" }}>
              {loading ? "..." : summary?.hearings?.upcoming ?? 0}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.25rem" }}>
              {summary?.hearings?.today || 0} scheduled today
            </div>
          </div>
        </Link>

        {/* Total Clients */}
        <Link to="/clients" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card" style={{ padding: "1.2rem", margin: 0, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>Active Clients</span>
              <IconUsers size={18} color="#4f46e5" />
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0f172a", marginTop: "0.35rem" }}>
              {loading ? "..." : summary?.clients?.total ?? 0}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.25rem" }}>
              +{summary?.clients?.newInPeriod || 0} enrolled in period
            </div>
          </div>
        </Link>

        {/* Total Outstanding (RBAC Gated) */}
        {summary?.billing && (
          <Link to="/billing" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card" style={{ padding: "1.2rem", margin: 0, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>Total Outstanding</span>
                <IconInvoice size={18} color="#d97706" />
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: (summary.billing.totalOutstanding || 0) > 0 ? "#dc2626" : "#0f172a", marginTop: "0.35rem" }}>
                {loading ? "..." : formatINR(summary.billing.totalOutstanding)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem" }}>
                {formatINR(summary.billing.overdueAmount)} overdue
              </div>
            </div>
          </Link>
        )}

        {/* Collections This Month (RBAC Gated) */}
        {summary?.payments && (
          <Link to="/payments" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card" style={{ padding: "1.2rem", margin: 0, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>Collections (Month)</span>
                <IconPayment size={18} color="#059669" />
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#059669", marginTop: "0.35rem" }}>
                {loading ? "..." : formatINR(summary.payments.thisMonthCollected)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.25rem" }}>
                {formatINR(summary.payments.todayCollected)} received today
              </div>
            </div>
          </Link>
        )}

        {/* Pending Tasks */}
        <Link to="/workforce/tasks" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card" style={{ padding: "1.2rem", margin: 0, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>Pending Tasks</span>
              <IconCheckSquare size={18} color="#2563eb" />
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: (summary?.tasks?.overdue || 0) > 0 ? "#dc2626" : "#0f172a", marginTop: "0.35rem" }}>
              {loading ? "..." : summary?.tasks?.pending ?? 0}
            </div>
            <div style={{ fontSize: "0.75rem", color: (summary?.tasks?.overdue || 0) > 0 ? "#dc2626" : "#475569", marginTop: "0.25rem" }}>
              {summary?.tasks?.overdue || 0} overdue &bull; {summary?.tasks?.dueToday || 0} due today
            </div>
          </div>
        </Link>

        {/* Follow-ups Due */}
        <Link to="/follow-ups" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card" style={{ padding: "1.2rem", margin: 0, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>Follow-ups Due</span>
              <IconPhone size={18} color="#0891b2" />
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0f172a", marginTop: "0.35rem" }}>
              {loading ? "..." : summary?.followups?.dueToday ?? 0}
            </div>
            <div style={{ fontSize: "0.75rem", color: (summary?.followups?.overdue || 0) > 0 ? "#dc2626" : "#475569", marginTop: "0.25rem" }}>
              {summary?.followups?.overdue || 0} overdue follow-ups
            </div>
          </div>
        </Link>

        {/* Active Workforce (RBAC Gated) */}
        {summary?.workforce && (
          <Link to="/workforce" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card" style={{ padding: "1.2rem", margin: 0, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>Workforce Roster</span>
                <IconBriefcase size={18} color="#7c3aed" />
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0f172a", marginTop: "0.35rem" }}>
                {loading ? "..." : (summary.workforce.activeEmployees + summary.workforce.activeInterns)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.25rem" }}>
                {summary.workforce.activeEmployees} employees &bull; {summary.workforce.activeInterns} interns
              </div>
            </div>
          </Link>
        )}

        {/* Documents */}
        <Link to="/documents" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card" style={{ padding: "1.2rem", margin: 0, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>Repository Docs</span>
              <IconFolder size={18} color="#ea580c" />
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0f172a", marginTop: "0.35rem" }}>
              {loading ? "..." : summary?.documents?.total ?? 0}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.25rem" }}>
              {summary?.documents?.awaitingApproval || 0} pending review
            </div>
          </div>
        </Link>

        {/* WhatsApp Hearing Reminders Widget */}
        <Link to="/settings/whatsapp" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card" style={{ padding: "1.2rem", margin: 0, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>WhatsApp Reminders</span>
              <IconPhone size={18} color="#059669" />
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0f172a", marginTop: "0.35rem" }}>
              {loading ? "..." : (summary?.whatsappReminders?.scheduled ?? 0)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.25rem" }}>
              Sent: <strong>{summary?.whatsappReminders?.sent ?? 0}</strong> &bull; Delivered: <strong>{summary?.whatsappReminders?.delivered ?? 0}</strong>
              {(summary?.whatsappReminders?.failed ?? 0) > 0 && (
                <span style={{ color: "#dc2626", marginLeft: "0.3rem" }}>
                  &bull; Failed: <strong>{summary.whatsappReminders.failed}</strong>
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>

      {/* 5. Two-Column Operational Layout: Upcoming Hearings & Priority Tasks */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* Upcoming Hearings Table Widget */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", margin: 0 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <IconClock size={18} color="#059669" />
                Upcoming Court Hearings
              </h3>
              <Link to="/cause-list" className="btn btn-outline" style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem" }}>
                View All Cause List &rarr;
              </Link>
            </div>

            {hearings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#64748b", fontSize: "0.9rem" }}>
                No upcoming hearings scheduled.
              </div>
            ) : (
              <div className="table-responsive">
                <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                      <th style={{ padding: "0.5rem" }}>Date & Time</th>
                      <th style={{ padding: "0.5rem" }}>Case</th>
                      <th style={{ padding: "0.5rem" }}>Court</th>
                      <th style={{ padding: "0.5rem" }}>Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hearings.map((h) => (
                      <tr key={h.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                          <strong style={{ color: "#0284c7" }}>{formatDate(h.hearingDate)}</strong>
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{h.hearingTime || "10:30 AM"}</div>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <Link to={`/cases/${h.caseId}`} style={{ color: "#0f172a", fontWeight: 600, textDecoration: "none" }}>
                            {h.caseNumber}
                          </Link>
                          <div style={{ fontSize: "0.75rem", color: "#64748b", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {h.caseTitle}
                          </div>
                        </td>
                        <td style={{ padding: "0.5rem", color: "#334155" }}>{h.courtName || "High Court"}</td>
                        <td style={{ padding: "0.5rem", color: "#475569" }}>{h.purpose || "Hearing"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Tasks Table Widget */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", margin: 0 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <IconCheckSquare size={18} color="#2563eb" />
                Priority Action Tasks
              </h3>
              <Link to="/workforce/tasks" className="btn btn-outline" style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem" }}>
                View All Tasks &rarr;
              </Link>
            </div>

            {tasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#64748b", fontSize: "0.9rem" }}>
                No pending tasks assigned.
              </div>
            ) : (
              <div className="table-responsive">
                <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                      <th style={{ padding: "0.5rem" }}>Task</th>
                      <th style={{ padding: "0.5rem" }}>Priority</th>
                      <th style={{ padding: "0.5rem" }}>Assigned</th>
                      <th style={{ padding: "0.5rem" }}>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.5rem" }}>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{t.title}</div>
                          {t.caseNumber && (
                            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Case: {t.caseNumber}</div>
                          )}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <span
                            style={{
                              padding: "0.15rem 0.4rem",
                              borderRadius: "4px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              backgroundColor: t.priority === "URGENT" ? "#fee2e2" : t.priority === "HIGH" ? "#fef3c7" : "#e0f2fe",
                              color: t.priority === "URGENT" ? "#b91c1c" : t.priority === "HIGH" ? "#92400e" : "#0369a1",
                            }}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem", color: "#475569" }}>{t.assignedTo || "Unassigned"}</td>
                        <td style={{ padding: "0.5rem", color: "#334155" }}>{formatDate(t.dueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Financial Overview & Recent Billing (Authorized Roles Only) */}
      {summary?.billing && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
          {/* Recent Invoices Widget */}
          <div className="card" style={{ margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <IconInvoice size={18} color="#d97706" />
                Recent Fee Invoices
              </h3>
              <Link to="/invoices" className="btn btn-outline" style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem" }}>
                All Invoices &rarr;
              </Link>
            </div>

            {invoices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#64748b", fontSize: "0.9rem" }}>
                No recent invoices found.
              </div>
            ) : (
              <div className="table-responsive">
                <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                      <th style={{ padding: "0.5rem" }}>Invoice #</th>
                      <th style={{ padding: "0.5rem" }}>Client</th>
                      <th style={{ padding: "0.5rem" }}>Total</th>
                      <th style={{ padding: "0.5rem" }}>Due</th>
                      <th style={{ padding: "0.5rem" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.5rem" }}>
                          <Link to={`/invoices/${inv.id}`} style={{ color: "#0284c7", fontWeight: 600, textDecoration: "none" }}>
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                        <td style={{ padding: "0.5rem", color: "#334155" }}>{inv.clientName || "Client"}</td>
                        <td style={{ padding: "0.5rem", fontWeight: 600 }}>{formatINR(inv.totalAmount)}</td>
                        <td style={{ padding: "0.5rem", color: inv.amountDue > 0 ? "#dc2626" : "#059669", fontWeight: 600 }}>
                          {formatINR(inv.amountDue)}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: inv.status === "PAID" ? "#059669" : inv.status === "OVERDUE" ? "#dc2626" : "#d97706" }}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Payments Widget */}
          <div className="card" style={{ margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <IconPayment size={18} color="#059669" />
                Recent Payment Receipts
              </h3>
              <Link to="/payments" className="btn btn-outline" style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem" }}>
                All Payments &rarr;
              </Link>
            </div>

            {payments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#64748b", fontSize: "0.9rem" }}>
                No recent payment transactions recorded.
              </div>
            ) : (
              <div className="table-responsive">
                <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                      <th style={{ padding: "0.5rem" }}>Receipt #</th>
                      <th style={{ padding: "0.5rem" }}>Client</th>
                      <th style={{ padding: "0.5rem" }}>Method</th>
                      <th style={{ padding: "0.5rem" }}>Amount</th>
                      <th style={{ padding: "0.5rem" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.5rem", fontWeight: 600, color: "#0284c7" }}>{p.receiptNumber}</td>
                        <td style={{ padding: "0.5rem", color: "#334155" }}>{p.clientName}</td>
                        <td style={{ padding: "0.5rem", fontSize: "0.75rem", color: "#64748b" }}>{p.paymentMethod}</td>
                        <td style={{ padding: "0.5rem", fontWeight: 700, color: "#059669" }}>{formatINR(p.amount)}</td>
                        <td style={{ padding: "0.5rem", color: "#475569" }}>{formatDate(p.paymentDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Bottom Grid: CRM Pipeline & Recent Live Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem" }}>
        {/* CRM Lead Pipeline Snapshot */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <IconUsers size={18} color="#4f46e5" />
              CRM & Intake Pipeline
            </h3>
            <Link to="/crm" className="btn btn-outline" style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem" }}>
              CRM Hub &rarr;
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{ padding: "0.75rem", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>New Inquiries</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0f172a" }}>{summary?.leads?.newInquiries || 0}</div>
            </div>
            <div style={{ padding: "0.75rem", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Consultations Scheduled</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0284c7" }}>{summary?.leads?.consultationsScheduled || 0}</div>
            </div>
            <div style={{ padding: "0.75rem", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Retained / Converted</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#059669" }}>{summary?.leads?.retained || 0}</div>
            </div>
            <div style={{ padding: "0.75rem", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Not Converted</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#64748b" }}>{summary?.leads?.notConverted || 0}</div>
            </div>
          </div>
        </div>

        {/* Real Live Recent Activity Feed */}
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <IconCalendar size={18} color="#0891b2" />
            Recent Chambers Activity
          </h3>

          {activity.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#64748b", fontSize: "0.9rem" }}>
              No recent audit activity recorded.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {activity.map((act, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "0.82rem",
                  }}
                >
                  <div>
                    <strong style={{ color: "#0f172a" }}>{act.action.replace(/_/g, " ")}</strong>
                    <span style={{ color: "#64748b", marginLeft: "0.35rem" }}>
                      by <em>{act.performedBy}</em>
                    </span>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {formatDate(act.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2FA Modal (Preserved for user security) */}
      {show2FAModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div className="card" style={{ width: "420px", maxWidth: "90%", padding: "2rem" }}>
            <h2 className="card-title">
              {twoFAStep === "confirm" ? "Enable Two-Factor Authentication" : "Disable Two-Factor Authentication"}
            </h2>

            {twoFAMessage && (
              <div style={{ backgroundColor: "var(--color-success-bg)", color: "var(--color-success)", padding: "0.75rem", borderRadius: "4px", marginBottom: "1rem" }}>
                {twoFAMessage}
              </div>
            )}

            {twoFAError && (
              <div style={{ backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)", padding: "0.75rem", borderRadius: "4px", marginBottom: "1rem" }}>
                {twoFAError}
              </div>
            )}

            {twoFAStep === "confirm" ? (
              <form onSubmit={handleConfirmEnable2FA}>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
                  A verification code has been dispatched to your email. Enter it below to activate 2FA.
                </p>

                <div className="form-group">
                  <label className="form-label">6-Digit Verification Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={twoFAOtp}
                    onChange={(e) => setTwoFAOtp(e.target.value)}
                    maxLength={6}
                    placeholder="123456"
                    required
                    style={{ fontSize: "1.2rem", letterSpacing: "0.2em", textAlign: "center" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShow2FAModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={twoFALoading}>
                    {twoFALoading ? "Verifying..." : "Confirm & Enable"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmDisable2FA}>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
                  Please confirm your password to disable two-factor authentication.
                </p>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={twoFAPassword}
                    onChange={(e) => setTwoFAPassword(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShow2FAModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={twoFALoading}>
                    {twoFALoading ? "Disabling..." : "Disable 2FA"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
