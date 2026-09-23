import React, { useState, useEffect } from "react";
import securityService from "../../services/securityService";
import { useAuth } from "../../context/AuthContext";

export default function SecuritySettingsPage() {
  const { user } = useAuth();

  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // 2FA Enable Modal state
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [setupOtp, setSetupOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // 2FA Disable Modal state
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      setLoading(true);
      const data = await securityService.getSecurityOverview();
      setOverview(data);
      setSessions(data.sessions || []);
    } catch (err) {
      setMsg({ type: "error", text: "Failed to load security overview." });
    } finally {
      setLoading(false);
    }
  };

  // Start 2FA Enablement
  const handleStartEnable2FA = async () => {
    setActionLoading(true);
    setMsg(null);
    try {
      const res = await securityService.request2FAEnable();
      setMaskedEmail(res.maskedEmail || user?.email);
      setShowEnableModal(true);
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.message || "Failed to start 2FA setup." });
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm 2FA Enablement
  const handleConfirm2FA = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setMsg(null);
    try {
      const res = await securityService.confirm2FAEnable(setupOtp);
      setShowEnableModal(false);
      setSetupOtp("");
      setMsg({ type: "success", text: res.message || "Two-factor authentication enabled successfully!" });
      await loadSecurityData();
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.message || "Invalid verification code." });
    } finally {
      setActionLoading(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setMsg(null);
    try {
      const res = await securityService.disable2FA(disablePassword);
      setShowDisableModal(false);
      setDisablePassword("");
      setMsg({ type: "success", text: res.message || "Two-factor authentication disabled." });
      await loadSecurityData();
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.message || "Incorrect password." });
    } finally {
      setActionLoading(false);
    }
  };

  // Send Email Verification
  const handleSendVerificationEmail = async () => {
    setActionLoading(true);
    setMsg(null);
    try {
      const res = await securityService.sendVerificationEmail();
      setMsg({ type: "success", text: res.message || "Verification email sent!" });
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.message || "Failed to dispatch verification email." });
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke Specific Session
  const handleRevokeSession = async (sessionId) => {
    if (!window.confirm("Are you sure you want to terminate this login session?")) return;
    try {
      await securityService.revokeSession(sessionId);
      setMsg({ type: "success", text: "Session terminated." });
      await loadSecurityData();
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.message || "Failed to revoke session." });
    }
  };

  // Revoke All Other Sessions
  const handleRevokeAllOtherSessions = async () => {
    if (!window.confirm("Terminate all active sessions on other computers and mobile devices?")) return;
    try {
      await securityService.revokeAllSessions();
      setMsg({ type: "success", text: "All other sessions have been logged out." });
      await loadSecurityData();
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.message || "Failed to terminate other sessions." });
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    setPwdLoading(true);
    setMsg(null);
    try {
      const res = await securityService.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMsg({ type: "success", text: res.message || "Password updated successfully!" });
      await loadSecurityData();
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.message || "Failed to change password." });
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
        Loading security settings and credentials overview...
      </div>
    );
  }

  const profile = overview?.profile || {};
  const is2FA = Boolean(profile.twoFactorEnabled);
  const isEmailVerified = Boolean(profile.emailVerified);

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: "900", color: "#0f172a", margin: 0 }}>
          Account Security & Authentication Settings
        </h1>
        <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.35rem" }}>
          Manage two-step verification, password credentials, active chamber sessions, and security notifications.
        </p>
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

      {/* Security Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {/* Card 1: Two-Step Verification (2FA) */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                Two-Step Verification (2FA)
              </h3>
              <span style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "12px",
                backgroundColor: is2FA ? "#dcfce7" : "#f1f5f9",
                color: is2FA ? "#166534" : "#475569"
              }}>
                {is2FA ? "ACTIVE (EMAIL OTP)" : "DISABLED"}
              </span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5, margin: 0 }}>
              Protects chambers access by requiring a 6-digit one-time passcode sent directly to your registered email address upon each sign-in attempt.
            </p>
          </div>

          <div style={{ marginTop: "1.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
            {is2FA ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ color: "#dc2626", borderColor: "#fecaca" }}
                onClick={() => setShowDisableModal(true)}
                disabled={actionLoading}
              >
                Disable 2FA
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartEnable2FA}
                disabled={actionLoading}
              >
                {actionLoading ? "Dispatching Code..." : "Enable 2FA Protection"}
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Email Address Verification */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                Email Verification
              </h3>
              <span style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "12px",
                backgroundColor: isEmailVerified ? "#dcfce7" : "#fffbeb",
                color: isEmailVerified ? "#166534" : "#b45309"
              }}>
                {isEmailVerified ? "VERIFIED" : "UNVERIFIED"}
              </span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5, margin: 0 }}>
              Registered Email: <strong>{profile.email}</strong>
              <br />
              {isEmailVerified ? (
                <span style={{ color: "#16a34a" }}>Verified on {new Date(profile.emailVerifiedAt).toLocaleDateString()}</span>
              ) : (
                "Please verify your email address to ensure critical security alerts reach you."
              )}
            </p>
          </div>

          <div style={{ marginTop: "1.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
            {!isEmailVerified && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSendVerificationEmail}
                disabled={actionLoading}
              >
                {actionLoading ? "Sending Link..." : "Send Verification Email"}
              </button>
            )}
            {isEmailVerified && (
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                ✓ Official chambers communications verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="card">
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", color: "#0f172a" }}>
          Change Password
        </h3>
        <form onSubmit={handleChangePassword} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", alignItems: "flex-end" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Current Password</label>
            <input
              type="password"
              className="form-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">New Password</label>
            <input
              type="password"
              className="form-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Confirm New Password</label>
            <input
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>

          <div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.65rem" }}
              disabled={pwdLoading}
            >
              {pwdLoading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>

      {/* Active Login Sessions */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
              Active Sessions ({sessions.length})
            </h3>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "2px 0 0 0" }}>
              Authorized browser sessions currently holding valid chamber credentials.
            </p>
          </div>
          {sessions.length > 1 && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", color: "#dc2626", borderColor: "#fecaca" }}
              onClick={handleRevokeAllOtherSessions}
            >
              Log Out All Other Devices
            </button>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                <th style={{ padding: "0.5rem" }}>Device & Browser</th>
                <th style={{ padding: "0.5rem" }}>IP Address</th>
                <th style={{ padding: "0.5rem" }}>Last Active</th>
                <th style={{ padding: "0.5rem", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.6rem 0.5rem", fontWeight: 500 }}>
                    {s.deviceInfo}
                    {s.isCurrent && (
                      <span style={{
                        marginLeft: "8px",
                        fontSize: "0.7rem",
                        backgroundColor: "#e0f2fe",
                        color: "#0369a1",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontWeight: 600
                      }}>
                        Current Device
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "0.6rem 0.5rem", color: "#475569" }}>{s.ipAddress}</td>
                  <td style={{ padding: "0.6rem 0.5rem", color: "#64748b" }}>
                    {new Date(s.lastUsedAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "0.6rem 0.5rem", textAlign: "right" }}>
                    {!s.isCurrent ? (
                      <button
                        type="button"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc2626",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          textDecoration: "underline"
                        }}
                        onClick={() => handleRevokeSession(s.id)}
                      >
                        Terminate
                      </button>
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Security Activity Audit Log */}
      <div className="card">
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#0f172a" }}>
          Recent Security Activity
        </h3>
        <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 1rem 0" }}>
          Chambers cryptographic audit trail for logins, password updates, and 2FA activities.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {overview?.recentActivity?.length > 0 ? (
            overview.recentActivity.map((act, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.6rem 0.75rem",
                  background: "#f8fafc",
                  borderRadius: "6px",
                  fontSize: "0.8rem"
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>{act.event}</span>
                  <span style={{ color: "#64748b", marginLeft: "8px" }}>from {act.ip || "127.0.0.1"}</span>
                </div>
                <span style={{ color: "#94a3b8" }}>{new Date(act.createdAt).toLocaleString()}</span>
              </div>
            ))
          ) : (
            <div style={{ color: "#94a3b8", fontSize: "0.85rem", fontStyle: "italic" }}>
              No recent security events recorded.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Enable 2FA */}
      {showEnableModal && (
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
          <div className="card" style={{ maxWidth: "420px", width: "100%", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>Confirm 2FA Enablement</h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5, margin: "0 0 1rem 0" }}>
              A 6-digit confirmation code was sent to <strong>{maskedEmail}</strong>. Enter it below to activate 2FA.
            </p>

            <form onSubmit={handleConfirm2FA}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <input
                  type="text"
                  className="form-input"
                  value={setupOtp}
                  onChange={(e) => setSetupOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  required
                  autoFocus
                  style={{ fontSize: "1.3rem", letterSpacing: "0.25em", textAlign: "center", fontWeight: "bold" }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEnableModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading || setupOtp.length < 6}
                >
                  {actionLoading ? "Activating..." : "Confirm & Activate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Disable 2FA */}
      {showDisableModal && (
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
          <div className="card" style={{ maxWidth: "420px", width: "100%", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#dc2626" }}>Disable 2FA Protection</h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5, margin: "0 0 1rem 0" }}>
              Disabling two-step verification reduces account protection. Please enter your chambers password to confirm this action.
            </p>

            <form onSubmit={handleDisable2FA}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <input
                  type="password"
                  className="form-input"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDisableModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}
                  disabled={actionLoading || !disablePassword}
                >
                  {actionLoading ? "Verifying..." : "Confirm Disable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
