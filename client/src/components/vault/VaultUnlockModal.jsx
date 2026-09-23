import React, { useState, useEffect } from "react";
import { useVault } from "../../context/VaultContext";
import {
  IconLock,
  IconUnlock,
  IconX,
  IconAlertTriangle,
} from "../common/Icons";

const VaultUnlockModal = () => {
  const { isUnlockModalOpen, closeUnlockModal, unlockVault, vaultStatus } =
    useVault();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (isUnlockModalOpen) {
      setPassword("");
      setError("");
      setShowPassword(false);

      if (
        vaultStatus?.locked_until &&
        new Date(vaultStatus.locked_until) > new Date()
      ) {
        const remaining = Math.max(
          0,
          Math.ceil(
            (new Date(vaultStatus.locked_until).getTime() - Date.now()) / 1000,
          ),
        );
        setCooldownSeconds(remaining);
      } else {
        setCooldownSeconds(0);
      }
    }
  }, [isUnlockModalOpen, vaultStatus]);

  // Lockout countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  if (!isUnlockModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError("Please enter your Document Vault password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await unlockVault(password);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Unable to unlock vault. Please check your password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isLockedOut = cooldownSeconds > 0;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: "440px",
          width: "90%",
          padding: "2rem",
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
          border: "1px solid #e4e4e7",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1.25rem",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                backgroundColor: "#000000",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconLock size={20} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "#09090b",
                }}
              >
                Unlock Document Vault
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#71717a" }}>
                Password AppLock Security
              </p>
            </div>
          </div>
          <button
            onClick={closeUnlockModal}
            className="btn-icon"
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "#71717a",
            }}
            title="Close"
          >
            <IconX size={18} />
          </button>
        </div>

        <p
          style={{
            fontSize: "0.85rem",
            color: "#3f3f46",
            lineHeight: "1.5",
            marginBottom: "1.25rem",
          }}
        >
          Enter your Document Vault password to decrypt, download, preview, or
          upload legal documents.
        </p>

        {/* Lockout alert */}
        {isLockedOut && (
          <div
            style={{
              padding: "0.85rem 1rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              color: "#991b1b",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              marginBottom: "1rem",
            }}
          >
            <IconAlertTriangle size={18} color="#dc2626" />
            <div>
              <strong>Vault Temporarily Locked</strong>
              <div style={{ fontSize: "0.8rem", marginTop: "2px" }}>
                Excessive failed attempts. Retry in{" "}
                {Math.floor(cooldownSeconds / 60)}m {cooldownSeconds % 60}s.
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && !isLockedOut && (
          <div
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "#fff1f2",
              border: "1px solid #ffe4e6",
              borderRadius: "8px",
              color: "#be123c",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="vault-password-input"
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#18181b",
                marginBottom: "0.4rem",
              }}
            >
              Document Vault Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="vault-password-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter vault password"
                disabled={loading || isLockedOut}
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.65rem 2.5rem 0.65rem 0.85rem",
                  borderRadius: "6px",
                  border: "1px solid #d4d4d8",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  color: "#71717a",
                  padding: "4px 8px",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              marginTop: "1.5rem",
            }}
          >
            <button
              type="button"
              onClick={closeUnlockModal}
              className="btn btn-secondary"
              disabled={loading}
              style={{ padding: "0.55rem 1rem", fontSize: "0.85rem" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || isLockedOut || !password}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.55rem 1.25rem",
                fontSize: "0.85rem",
              }}
            >
              <IconUnlock size={15} />
              <span>{loading ? "Decrypting..." : "Unlock Vault"}</span>
            </button>
          </div>
        </form>

        <div
          style={{
            marginTop: "1.25rem",
            paddingTop: "1rem",
            borderTop: "1px solid #f4f4f5",
            fontSize: "0.75rem",
            color: "#a1a1aa",
            textAlign: "center",
          }}
        >
          AES-256-GCM Envelope Encryption &bull; Auto-locks after inactivity
        </div>
      </div>
    </div>
  );
};

export default VaultUnlockModal;
