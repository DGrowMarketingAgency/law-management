import React, { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import securityService from "../services/securityService";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tokenParam = searchParams.get("token") || "";

  const [token, setToken] = useState(tokenParam);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, [tokenParam]);

  // Password rules validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[@$!%*?&]/.test(newPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isPasswordValid) {
      setError("Please ensure your new password satisfies all security criteria.");
      return;
    }

    if (!isMatch) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);

    try {
      const payload = token ? { token, newPassword } : { email, otp, newPassword };
      await securityService.resetPassword(payload);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password. Link or code may be expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "460px", margin: "3rem auto", padding: "0 1rem" }}>
      <div className="card" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)", borderRadius: "12px" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: "48px",
            height: "48px",
            margin: "0 auto 12px",
            borderRadius: "10px",
            background: "#f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px"
          }}>
            🔒
          </div>
          <h1 className="card-title" style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Set New Password</h1>
          <p className="card-subtitle" style={{ fontSize: "0.875rem", margin: 0 }}>
            Create a robust legal-grade credential for your chambers account.
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            fontSize: "0.875rem",
            marginBottom: "1.25rem"
          }}>
            {error}
          </div>
        )}

        {success ? (
          <div>
            <div style={{
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
              padding: "1.25rem",
              borderRadius: "8px",
              textAlign: "center",
              marginBottom: "1.5rem"
            }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>✓</div>
              <strong style={{ fontSize: "1rem" }}>Password Reset Successful!</strong>
              <p style={{ fontSize: "0.875rem", marginTop: "6px", color: "#15803d" }}>
                Your password has been updated and all previous sessions have been safely terminated.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.75rem" }}
              onClick={() => navigate("/login")}
            >
              Sign In With New Password
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {!token && (
              <>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Chambers Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="advocate@chambers.in"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">6-Digit Verification Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    required
                  />
                </div>
              </>
            )}

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="new-password"
              />
            </div>

            {/* Password Criteria Checklist */}
            <div style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              padding: "0.75rem",
              fontSize: "0.78rem",
              marginBottom: "1rem"
            }}>
              <div style={{ fontWeight: 600, marginBottom: "4px", color: "#475569" }}>Password Requirements:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                <span style={{ color: hasMinLength ? "#16a34a" : "#94a3b8" }}>
                  {hasMinLength ? "✓" : "○"} 8+ characters
                </span>
                <span style={{ color: hasUppercase ? "#16a34a" : "#94a3b8" }}>
                  {hasUppercase ? "✓" : "○"} Uppercase letter
                </span>
                <span style={{ color: hasLowercase ? "#16a34a" : "#94a3b8" }}>
                  {hasLowercase ? "✓" : "○"} Lowercase letter
                </span>
                <span style={{ color: hasNumber ? "#16a34a" : "#94a3b8" }}>
                  {hasNumber ? "✓" : "○"} Number
                </span>
                <span style={{ color: hasSpecial ? "#16a34a" : "#94a3b8" }}>
                  {hasSpecial ? "✓" : "○"} Symbol (@$!%*?&)
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "1.25rem" }}>
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="new-password"
              />
              {confirmPassword.length > 0 && (
                <div style={{ fontSize: "0.78rem", marginTop: "4px", color: isMatch ? "#16a34a" : "#dc2626" }}>
                  {isMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem" }}
              disabled={loading || !isPasswordValid || !isMatch}
            >
              {loading ? "Updating Password..." : "Update Password"}
            </button>

            <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
              <Link to="/login" style={{ fontSize: "0.85rem", color: "#64748b", textDecoration: "none" }}>
                &larr; Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
