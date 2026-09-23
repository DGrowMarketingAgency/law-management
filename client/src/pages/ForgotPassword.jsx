import React, { useState } from "react";
import { Link } from "react-router-dom";
import securityService from "../services/securityService";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await securityService.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to process password reset request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "440px", margin: "3rem auto", padding: "0 1rem" }}>
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
            🔑
          </div>
          <h1 className="card-title" style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Password Recovery</h1>
          <p className="card-subtitle" style={{ fontSize: "0.875rem", margin: 0 }}>
            Enter your chambers email to receive secure recovery instructions.
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

        {submitted ? (
          <div>
            <div style={{
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
              padding: "1rem",
              borderRadius: "8px",
              fontSize: "0.9rem",
              lineHeight: 1.5,
              marginBottom: "1.5rem"
            }}>
              <strong>Instructions Dispatched:</strong><br />
              If <strong>{email}</strong> is registered in our chambers system, an email with a secure, single-use password reset link has been dispatched.
            </div>

            <div style={{ textAlign: "center" }}>
              <Link to="/login" className="btn btn-primary" style={{ display: "inline-block", width: "100%", padding: "0.75rem" }}>
                Return to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: "1.25rem" }}>
              <label className="form-label" htmlFor="email">
                Chambers Email Address
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="advocate@chambers.in"
                required
                autoFocus
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem" }}
              disabled={loading}
            >
              {loading ? "Sending Instructions..." : "Send Reset Instructions"}
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

export default ForgotPassword;
