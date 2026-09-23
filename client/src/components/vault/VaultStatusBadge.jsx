import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useVault } from "../../context/VaultContext";
import { IconLock, IconUnlock, IconShield } from "../common/Icons";

const VaultStatusBadge = () => {
  const { vaultStatus, isUnlocked, isConfigured, openUnlockModal, lockVault } =
    useVault();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLock = async () => {
    setLocking(true);
    try {
      await lockVault();
      setIsDropdownOpen(false);
    } catch (err) {
      console.error("Failed to lock vault:", err);
    } finally {
      setLocking(false);
    }
  };

  if (!isConfigured) {
    return (
      <Link
        to="/settings/vault"
        className="btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.3rem 0.75rem",
          fontSize: "0.78rem",
          fontWeight: 600,
          backgroundColor: "#f4f4f5",
          color: "#18181b",
          border: "1px solid #d4d4d8",
          borderRadius: "6px",
          textDecoration: "none",
        }}
        title="Setup Document Vault Encryption"
      >
        <IconShield size={14} color="#71717a" />
        <span>Setup Vault</span>
      </Link>
    );
  }

  if (!isUnlocked) {
    return (
      <button
        onClick={() => openUnlockModal()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.3rem 0.75rem",
          fontSize: "0.78rem",
          fontWeight: 600,
          backgroundColor: "#18181b",
          color: "#ffffff",
          border: "1px solid #000000",
          borderRadius: "6px",
          cursor: "pointer",
        }}
        title="Document Vault is Locked - Click to Unlock"
      >
        <IconLock size={13} color="#f87171" />
        <span>Vault Locked</span>
      </button>
    );
  }

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.3rem 0.75rem",
          fontSize: "0.78rem",
          fontWeight: 600,
          backgroundColor: "#f0fdf4",
          color: "#166534",
          border: "1px solid #bbf7d0",
          borderRadius: "6px",
          cursor: "pointer",
        }}
        title="Document Vault is Active"
      >
        <IconUnlock size={13} color="#16a34a" />
        <span>Vault Unlocked</span>
      </button>

      {isDropdownOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "6px",
            width: "220px",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            boxShadow:
              "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            border: "1px solid #e4e4e7",
            padding: "0.5rem",
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: "0.4rem 0.6rem",
              borderBottom: "1px solid #f4f4f5",
              marginBottom: "0.3rem",
            }}
          >
            <div
              style={{ fontSize: "0.75rem", fontWeight: 700, color: "#18181b" }}
            >
              Encrypted Vault Session
            </div>
            <div
              style={{ fontSize: "0.7rem", color: "#71717a", marginTop: "2px" }}
            >
              Auto-lock: {vaultStatus.auto_lock_minutes || 15}m inactivity
            </div>
          </div>

          <button
            onClick={handleLock}
            disabled={locking}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.45rem 0.6rem",
              fontSize: "0.8rem",
              color: "#dc2626",
              backgroundColor: "transparent",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#fef2f2")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <IconLock size={14} color="#dc2626" />
            <span>{locking ? "Locking..." : "Lock Vault Now"}</span>
          </button>

          <Link
            to="/settings/vault"
            onClick={() => setIsDropdownOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.45rem 0.6rem",
              fontSize: "0.8rem",
              color: "#27272a",
              textDecoration: "none",
              borderRadius: "4px",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#f4f4f5")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <IconShield size={14} color="#71717a" />
            <span>Vault Settings</span>
          </Link>
        </div>
      )}
    </div>
  );
};

export default VaultStatusBadge;
