import React from "react";
import { useVault } from "../../context/VaultContext";
import { IconLock, IconUnlock, IconShield } from "../common/Icons";

const VaultLockScreen = ({ onUnlockSuccess = null }) => {
  const { openUnlockModal, isConfigured } = useVault();

  return (
    <div
      style={{
        padding: "3rem 2rem",
        textAlign: "center",
        backgroundColor: "#fafafa",
        border: "1px dashed #d4d4d8",
        borderRadius: "12px",
        margin: "1.5rem 0",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          backgroundColor: "#18181b",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.25rem",
        }}
      >
        <IconLock size={26} />
      </div>

      <h3
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "#09090b",
          marginBottom: "0.5rem",
        }}
      >
        🔒 Document Vault Locked
      </h3>

      <p
        style={{
          fontSize: "0.9rem",
          color: "#52525b",
          maxWidth: "480px",
          margin: "0 auto 1.5rem",
          lineHeight: "1.5",
        }}
      >
        Unlock the document vault to open, preview, download, or modify
        protected legal documents.
      </p>

      <button
        onClick={() => openUnlockModal(onUnlockSuccess)}
        className="btn btn-primary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.6rem 1.5rem",
          fontSize: "0.9rem",
          fontWeight: 600,
        }}
      >
        <IconUnlock size={16} />
        <span>{isConfigured ? "Unlock Vault" : "Set Up Vault"}</span>
      </button>

      <div
        style={{
          marginTop: "1.5rem",
          fontSize: "0.75rem",
          color: "#a1a1aa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem",
        }}
      >
        <IconShield size={13} />
        <span>AES-256-GCM Envelope Encryption Active</span>
      </div>
    </div>
  );
};

export default VaultLockScreen;
