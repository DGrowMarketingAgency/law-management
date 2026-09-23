import React, { useState } from "react";
import { useVault } from "../../context/VaultContext";
import {
  IconShield,
  IconLock,
  IconUnlock,
  IconKey,
  IconClock,
  IconAlertTriangle,
  IconCheck,
} from "../../components/common/Icons";

const VaultSettingsPage = () => {
  const {
    vaultStatus,
    isConfigured,
    isUnlocked,
    setupVault,
    changePassword,
    lockVault,
    revokeAllSessions,
    openUnlockModal,
  } = useVault();

  // Setup state
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [setupSuccess, setSetupSuccess] = useState("");

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirm, setNewConfirm] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState("");
  const [changeSuccess, setChangeSuccess] = useState("");

  // Revoke state
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState("");

  const handleSetup = async (e) => {
    e.preventDefault();
    setSetupError("");
    setSetupSuccess("");

    if (setupPassword.length < 8) {
      setSetupError("Vault password must be at least 8 characters long.");
      return;
    }
    if (setupPassword !== setupConfirm) {
      setSetupError("Passwords do not match.");
      return;
    }

    setSetupLoading(true);
    try {
      await setupVault(setupPassword);
      setSetupSuccess(
        "Document vault configured successfully! You may now unlock your vault.",
      );
      setSetupPassword("");
      setSetupConfirm("");
    } catch (err) {
      setSetupError(
        err.response?.data?.message ||
          err.message ||
          "Failed to configure vault.",
      );
    } finally {
      setSetupLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangeError("");
    setChangeSuccess("");

    if (!currentPassword) {
      setChangeError("Please enter your current vault password.");
      return;
    }
    if (newPassword.length < 8) {
      setChangeError("New vault password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== newConfirm) {
      setChangeError("New passwords do not match.");
      return;
    }

    setChangeLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setChangeSuccess(
        "Vault password changed successfully. All sessions revoked. Please unlock with your new password.",
      );
      setCurrentPassword("");
      setNewPassword("");
      setNewConfirm("");
    } catch (err) {
      setChangeError(
        err.response?.data?.message ||
          err.message ||
          "Failed to change vault password.",
      );
    } finally {
      setChangeLoading(false);
    }
  };

  const handleRevokeAll = async () => {
    if (
      !window.confirm(
        "Are you sure you want to revoke all active Document Vault sessions across all devices?",
      )
    ) {
      return;
    }

    setRevokeLoading(true);
    try {
      await revokeAllSessions();
      setRevokeSuccess(
        "All active Document Vault sessions have been revoked successfully.",
      );
    } catch (err) {
      console.error("Failed to revoke sessions:", err);
    } finally {
      setRevokeLoading(false);
    }
  };

  return (
    <div
      className="page-container"
      style={{ maxWidth: "900px", margin: "0 auto", padding: "1.5rem" }}
    >
      {/* Page Header */}
      <div
        style={{
          marginBottom: "2rem",
          borderBottom: "1px solid #e4e4e7",
          paddingBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              backgroundColor: "#000000",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconShield size={24} />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#09090b",
              }}
            >
              Document Vault & AppLock Security
            </h1>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#71717a" }}>
              Per-file AES-256-GCM envelope encryption with password protection
            </p>
          </div>
        </div>
      </div>

      {/* 1. VAULT STATUS OVERVIEW */}
      <div
        className="card"
        style={{
          padding: "1.5rem",
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #e4e4e7",
          marginBottom: "1.5rem",
        }}
      >
        <h2
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            marginBottom: "1rem",
            color: "#18181b",
          }}
        >
          Security & Session Status
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Vault Configuration
            </div>
            <div
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                marginTop: "0.25rem",
                color: isConfigured ? "#16a34a" : "#ca8a04",
              }}
            >
              {isConfigured ? "✓ Configured" : "Not Configured"}
            </div>
          </div>

          <div
            style={{
              padding: "1rem",
              backgroundColor: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Current Lock State
            </div>
            <div
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                marginTop: "0.25rem",
                color: isUnlocked ? "#16a34a" : "#dc2626",
              }}
            >
              {isUnlocked ? "🔓 Unlocked (Active)" : "🔒 Locked"}
            </div>
          </div>

          <div
            style={{
              padding: "1rem",
              backgroundColor: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Auto-Lock Timer
            </div>
            <div
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                marginTop: "0.25rem",
                color: "#18181b",
              }}
            >
              {vaultStatus.auto_lock_minutes || 15} min inactivity
            </div>
          </div>

          <div
            style={{
              padding: "1rem",
              backgroundColor: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Last Unlocked
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                marginTop: "0.25rem",
                color: "#334155",
              }}
            >
              {vaultStatus.last_unlocked_at
                ? new Date(vaultStatus.last_unlocked_at).toLocaleString()
                : "Never"}
            </div>
          </div>
        </div>

        {isConfigured && (
          <div
            style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}
          >
            {isUnlocked ? (
              <button
                onClick={lockVault}
                className="btn btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.85rem",
                }}
              >
                <IconLock size={15} />
                <span>Lock Vault Now</span>
              </button>
            ) : (
              <button
                onClick={() => openUnlockModal()}
                className="btn btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.85rem",
                }}
              >
                <IconUnlock size={15} />
                <span>Unlock Vault</span>
              </button>
            )}

            <button
              onClick={handleRevokeAll}
              disabled={revokeLoading}
              className="btn btn-secondary"
              style={{ fontSize: "0.85rem", color: "#dc2626" }}
            >
              <span>
                {revokeLoading
                  ? "Revoking..."
                  : "Lock All Sessions (All Devices)"}
              </span>
            </button>
          </div>
        )}

        {revokeSuccess && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "6px",
              color: "#166534",
              fontSize: "0.85rem",
            }}
          >
            {revokeSuccess}
          </div>
        )}
      </div>

      {/* 2. SETUP VAULT (IF NOT CONFIGURED) */}
      {!isConfigured && (
        <div
          className="card"
          style={{
            padding: "1.5rem",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e4e4e7",
            marginBottom: "1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
              color: "#18181b",
            }}
          >
            Setup Document Vault Password
          </h2>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#71717a",
              marginBottom: "1.25rem",
            }}
          >
            Your Document Vault password derives the Key Encryption Key (KEK)
            using memory-hard scrypt. It is separate from your account login
            password.
          </p>

          {setupError && (
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#fff1f2",
                border: "1px solid #ffe4e6",
                borderRadius: "6px",
                color: "#be123c",
                fontSize: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              {setupError}
            </div>
          )}

          {setupSuccess && (
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "6px",
                color: "#166534",
                fontSize: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              {setupSuccess}
            </div>
          )}

          <form onSubmit={handleSetup} style={{ maxWidth: "400px" }}>
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "0.3rem",
                }}
              >
                Vault Password (Min. 8 chars)
              </label>
              <input
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                placeholder="Choose a strong vault password"
                required
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #d4d4d8",
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.25rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "0.3rem",
                }}
              >
                Confirm Vault Password
              </label>
              <input
                type="password"
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
                placeholder="Re-enter vault password"
                required
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #d4d4d8",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={setupLoading}
              className="btn btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.55rem 1.25rem",
              }}
            >
              <IconKey size={16} />
              <span>
                {setupLoading ? "Initializing..." : "Create Vault Key"}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* 3. CHANGE VAULT PASSWORD (IF CONFIGURED) */}
      {isConfigured && (
        <div
          className="card"
          style={{
            padding: "1.5rem",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e4e4e7",
            marginBottom: "1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
              color: "#18181b",
            }}
          >
            Change Vault Password
          </h2>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#71717a",
              marginBottom: "1.25rem",
            }}
          >
            Changing your vault password re-wraps your master Vault Key with a
            new KEK. Existing document files do not need to be re-encrypted.
          </p>

          {changeError && (
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#fff1f2",
                border: "1px solid #ffe4e6",
                borderRadius: "6px",
                color: "#be123c",
                fontSize: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              {changeError}
            </div>
          )}

          {changeSuccess && (
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "6px",
                color: "#166534",
                fontSize: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              {changeSuccess}
            </div>
          )}

          <form onSubmit={handleChangePassword} style={{ maxWidth: "400px" }}>
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "0.3rem",
                }}
              >
                Current Vault Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current vault password"
                required
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #d4d4d8",
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "0.3rem",
                }}
              >
                New Vault Password (Min. 8 chars)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new vault password"
                required
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #d4d4d8",
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.25rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "0.3rem",
                }}
              >
                Confirm New Vault Password
              </label>
              <input
                type="password"
                value={newConfirm}
                onChange={(e) => setNewConfirm(e.target.value)}
                placeholder="Re-enter new vault password"
                required
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #d4d4d8",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={changeLoading}
              className="btn btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.55rem 1.25rem",
              }}
            >
              <IconKey size={16} />
              <span>
                {changeLoading
                  ? "Updating Key Wrapping..."
                  : "Update Vault Password"}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* 4. RECOVERY NOTICE */}
      <div
        style={{
          padding: "1.25rem",
          backgroundColor: "#fefce8",
          border: "1px solid #fef08a",
          borderRadius: "8px",
          color: "#854d0e",
          fontSize: "0.85rem",
          lineHeight: "1.5",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontWeight: 700,
            marginBottom: "0.25rem",
          }}
        >
          <IconAlertTriangle size={16} color="#854d0e" />
          <span>Vault Recovery Policy</span>
        </div>
        <p style={{ margin: 0 }}>
          For security and confidentiality, vault passwords are never stored in
          plaintext or sent via email. If you forget your Document Vault
          password, recovery requires an authorized administrator / security
          recovery procedure.
        </p>
      </div>
    </div>
  );
};

export default VaultSettingsPage;
