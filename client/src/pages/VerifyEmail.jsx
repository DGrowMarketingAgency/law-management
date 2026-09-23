import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import securityService from "../services/securityService";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // 'idle' | 'success' | 'error'
  const [message, setMessage] = useState("");

  const handleVerify = async (tok) => {
    if (!tok) {
      setStatus("error");
      setMessage("Verification token is missing in URL.");
      return;
    }

    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const res = await securityService.verifyEmail(tok);
      setStatus("success");
      setMessage(res.message || "Your chambers email has been successfully verified!");
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "Verification failed. The link may have expired or was already used.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      handleVerify(token);
    }
  }, [token]);

  return (
    <div style={{ maxWidth: "460px", margin: "3rem auto", padding: "0 1rem" }}>
      <div className="card" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)", borderRadius: "12px", textAlign: "center" }}>
        <div style={{
          width: "52px",
          height: "52px",
          margin: "0 auto 16px",
          borderRadius: "12px",
          background: status === "success" ? "#f0fdf4" : status === "error" ? "#fef2f2" : "#f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px"
        }}>
          {status === "success" ? "✓" : status === "error" ? "✕" : "✉"}
        </div>

        <h1 className="card-title" style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>
          Email Address Verification
        </h1>

        {loading && (
          <div style={{ padding: "2rem 0" }}>
            <div className="spinner" style={{ margin: "0 auto 12px" }}></div>
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Verifying your security credentials...</p>
          </div>
        )}

        {!loading && status === "success" && (
          <div style={{ marginTop: "1rem" }}>
            <div style={{
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
              padding: "1rem",
              borderRadius: "8px",
              fontSize: "0.9rem",
              marginBottom: "1.5rem"
            }}>
              {message}
            </div>
            <Link to="/dashboard" className="btn btn-primary" style={{ display: "inline-block", width: "100%", padding: "0.75rem" }}>
              Proceed to Dashboard
            </Link>
          </div>
        )}

        {!loading && status === "error" && (
          <div style={{ marginTop: "1rem" }}>
            <div style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: "1rem",
              borderRadius: "8px",
              fontSize: "0.9rem",
              marginBottom: "1.5rem"
            }}>
              {message}
            </div>
            <Link to="/login" className="btn btn-secondary" style={{ display: "inline-block", width: "100%", padding: "0.75rem" }}>
              Return to Sign In
            </Link>
          </div>
        )}

        {!token && status === "idle" && !loading && (
          <div style={{ marginTop: "1rem" }}>
            <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              No verification token was provided in your request. Please click the verification link sent to your chambers inbox.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ display: "inline-block", width: "100%", padding: "0.75rem" }}>
              Go to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
