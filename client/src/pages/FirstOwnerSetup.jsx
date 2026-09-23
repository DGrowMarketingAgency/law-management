import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiClient from "../services/api";

const FirstOwnerSetup = () => {
  const navigate = useNavigate();

  const [statusLoading, setStatusLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      setStatusLoading(true);
      const res = await apiClient.get("/auth/setup/status");
      if (res.data?.data) {
        setSetupRequired(res.data.data.setupRequired);
      }
    } catch (err) {
      setError("Unable to connect to chambers server. Please verify the backend is running.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Password rules validation
  const pwd = form.password;
  const hasMinLength = pwd.length >= 8;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasLowercase = /[a-z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_~`\-+=/\\[\]]/.test(pwd);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const isMatch = pwd.length > 0 && pwd === form.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isPasswordValid) {
      setError("Password must meet all complexity requirements.");
      return;
    }

    if (!isMatch) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post("/auth/setup", {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || null,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      if (res.data?.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to initialize Chambers Owner account.");
    } finally {
      setSubmitting(false);
    }
  };

  if (statusLoading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#64748b" }}>Verifying Chambers System State...</p>
      </div>
    );
  }

  if (!setupRequired) {
    return (
      <div style={{ maxWidth: "480px", margin: "4rem auto", padding: "0 1rem" }}>
        <div className="card" style={{ textAlign: "center", padding: "2.5rem 2rem", boxShadow: "0 10px 25px rgba(0,0,0,0.06)", borderRadius: "12px" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🛡️</div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#0f172a" }}>
            Setup Already Completed
          </h2>
          <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
            The primary Chambers Owner account has already been initialized. For security, first-time setup has been permanently locked.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ display: "inline-block", padding: "0.75rem 1.5rem" }}>
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "520px", margin: "2.5rem auto", padding: "0 1rem" }}>
      <div className="card" style={{ boxShadow: "0 10px 25px rgba(0,0,0,0.08)", borderRadius: "12px", padding: "2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: "52px",
            height: "52px",
            margin: "0 auto 12px",
            borderRadius: "12px",
            background: "#0f172a",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px"
          }}>
            ⚖️
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.25rem 0", color: "#0f172a" }}>
            Initial Chambers Setup
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.875rem", margin: 0 }}>
            Create the primary Chambers Owner / Administrator account. This form will permanently lock after submission.
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            fontSize: "0.85rem",
            marginBottom: "1.25rem"
          }}>
            {error}
          </div>
        )}

        {success ? (
          <div style={{
            backgroundColor: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            padding: "1.5rem",
            borderRadius: "8px",
            textAlign: "center"
          }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Owner Account Initialized!</h3>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              Redirecting you to the secure login page...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  className="form-input"
                  value={form.firstName}
                  onChange={handleChange}
                  placeholder="e.g. Vikram"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  className="form-input"
                  value={form.lastName}
                  onChange={handleChange}
                  placeholder="e.g. Malhotra"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" htmlFor="email">Chambers Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                value={form.email}
                onChange={handleChange}
                placeholder="advocate@chambers.in"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" htmlFor="phone">Mobile / Phone (Optional)</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="form-input"
                value={form.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                disabled={submitting}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" htmlFor="password">Owner Master Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-input"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••••••"
                required
                disabled={submitting}
              />

              {/* Password strength checklist */}
              <div style={{
                marginTop: "0.5rem",
                padding: "0.6rem 0.75rem",
                background: "#f8fafc",
                borderRadius: "6px",
                fontSize: "0.75rem",
                color: "#64748b"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                  <span style={{ color: hasMinLength ? "#059669" : "#94a3b8" }}>
                    {hasMinLength ? "✓" : "○"} 8+ characters
                  </span>
                  <span style={{ color: hasUppercase ? "#059669" : "#94a3b8" }}>
                    {hasUppercase ? "✓" : "○"} Uppercase letter
                  </span>
                  <span style={{ color: hasLowercase ? "#059669" : "#94a3b8" }}>
                    {hasLowercase ? "✓" : "○"} Lowercase letter
                  </span>
                  <span style={{ color: hasNumber ? "#059669" : "#94a3b8" }}>
                    {hasNumber ? "✓" : "○"} Numeric digit
                  </span>
                  <span style={{ color: hasSpecial ? "#059669" : "#94a3b8" }}>
                    {hasSpecial ? "✓" : "○"} Special character
                  </span>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label className="form-label" htmlFor="confirmPassword">Confirm Master Password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className="form-input"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••••••"
                required
                disabled={submitting}
              />
              {form.confirmPassword && !isMatch && (
                <p style={{ color: "#dc2626", fontSize: "0.75rem", margin: "4px 0 0 0" }}>
                  Passwords do not match.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem", fontWeight: 600 }}
              disabled={submitting || !isPasswordValid || !isMatch}
            >
              {submitting ? "Initializing Chambers..." : "Initialize Chambers & Create Owner"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default FirstOwnerSetup;
