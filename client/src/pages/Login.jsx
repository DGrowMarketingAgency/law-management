import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiClient from "../services/api";

const Login = () => {
  const { login, verify2FA, resend2FA, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState(null);
  const [tempToken, setTempToken] = useState(null);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [step, setStep] = useState("credentials"); // 'credentials' | 'otp'
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [setupRequired, setSetupRequired] = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Check if system requires initial Owner setup
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await apiClient.get("/auth/setup/status");
        if (res.data?.data?.setupRequired) {
          setSetupRequired(true);
        }
      } catch {
        // Ignore background status check failure
      }
    };
    checkSetup();
  }, []);

  // Cooldown timer
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.requires2FA) {
        setChallengeId(result.challengeId);
        setTempToken(result.tempToken);
        setMaskedEmail(result.maskedEmail || email);
        setCooldown(60);
        setStep("otp");
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      await verify2FA({ challengeId, tempToken, otp });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || !challengeId) return;
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      await resend2FA(challengeId);
      setSuccessMsg("A new verification code has been dispatched to your email.");
      setCooldown(60);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend code.");
      if (err.response?.data?.remainingSeconds) {
        setCooldown(err.response.data.remainingSeconds);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "440px", margin: "2.5rem auto", padding: "0 1rem" }}>
      <div className="card" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)", borderRadius: "12px" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <img
            src="/law logo.png"
            alt="DG Legal Practice Management"
            style={{
              width: "60px",
              height: "60px",
              margin: "0 auto 12px",
              borderRadius: "12px",
              objectFit: "contain",
              display: "block",
              backgroundColor: "#000000",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)"
            }}
          />
          <h1 className="card-title" style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Chambers Sign In</h1>
          <p className="card-subtitle" style={{ fontSize: "0.875rem", margin: 0 }}>
            Legal Practice Management & Security Core
          </p>
        </div>

        {setupRequired && (
          <div style={{
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            padding: "0.85rem 1rem",
            borderRadius: "8px",
            fontSize: "0.85rem",
            marginBottom: "1.25rem",
            textAlign: "center"
          }}>
            <strong>Chambers Setup Required</strong><br />
            No Owner account has been initialized yet.<br />
            <Link to="/setup" style={{ color: "#1d4ed8", fontWeight: "bold", textDecoration: "underline", marginTop: "4px", display: "inline-block" }}>
              Click here to perform first-time setup &rarr;
            </Link>
          </div>
        )}

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

        {successMsg && (
          <div style={{
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            fontSize: "0.875rem",
            marginBottom: "1.25rem"
          }}>
            {successMsg}
          </div>
        )}

        {step === "credentials" ? (
          <form onSubmit={handleCredentialsSubmit}>
            <div className="form-group" style={{ marginBottom: "1rem" }}>
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
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label className="form-label" htmlFor="password" style={{ margin: 0 }}>
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  style={{ fontSize: "0.8rem", color: "var(--color-accent, #2563eb)", textDecoration: "none" }}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "1.25rem", padding: "0.75rem", fontSize: "0.95rem" }}
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Sign In to Chambers"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <div style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              color: "#0369a1",
              borderRadius: "8px",
              padding: "0.85rem",
              fontSize: "0.85rem",
              marginBottom: "1.25rem"
            }}>
              <strong>Two-Step Verification:</strong><br />
              We sent a 6-digit security code to <strong>{maskedEmail}</strong>.
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" htmlFor="otp">
                Enter 6-Digit Code
              </label>
              <input
                id="otp"
                type="text"
                className="form-input"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="• • • • • •"
                maxLength={6}
                required
                autoFocus
                disabled={loading}
                style={{
                  fontSize: "1.3rem",
                  letterSpacing: "0.3em",
                  textAlign: "center",
                  fontWeight: "bold",
                  padding: "0.6rem"
                }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem" }}
              disabled={loading || otp.length < 6}
            >
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem", alignItems: "center" }}>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "0.85rem",
                  color: cooldown > 0 ? "#94a3b8" : "var(--color-accent, #2563eb)",
                  cursor: cooldown > 0 ? "not-allowed" : "pointer",
                  textDecoration: cooldown > 0 ? "none" : "underline"
                }}
                disabled={cooldown > 0 || loading}
                onClick={handleResendOtp}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>

              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "0.85rem",
                  color: "#64748b",
                  cursor: "pointer",
                  textDecoration: "underline"
                }}
                onClick={() => {
                  setStep("credentials");
                  setOtp("");
                  setError("");
                }}
                disabled={loading}
              >
                Back to credentials
              </button>
            </div>
          </form>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.8rem", color: "#71717a" }}>
        Powered by{" "}
        <a
          href="https://dgrowmarketing.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#09090b", fontWeight: 600, textDecoration: "none" }}
          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
        >
          Dgrow Marketing Agency
        </a>
      </div>
    </div>
  );
};

export default Login;
