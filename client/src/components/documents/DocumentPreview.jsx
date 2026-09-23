import React, { useState, useEffect } from "react";
import documentService from "../../services/documentService";
import { useVault } from "../../context/VaultContext";
import VaultLockScreen from "../vault/VaultLockScreen";
import { IconFileText, IconDownload } from "../common/Icons";

const DocumentPreview = ({ documentId, mimeType, filename }) => {
  const { isUnlocked, openUnlockModal } = useVault();
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isPdf =
    mimeType === "application/pdf" || filename?.toLowerCase().endsWith(".pdf");
  const isImage =
    mimeType?.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(filename || "");

  useEffect(() => {
    let activeUrl = null;

    if (!isUnlocked) {
      setLoading(false);
      setBlobUrl(null);
      return;
    }

    if (isPdf || isImage) {
      setLoading(true);
      setError(null);

      documentService
        .downloadDocument(documentId, true)
        .then((response) => {
          activeUrl = window.URL.createObjectURL(
            new Blob([response.data], { type: mimeType }),
          );
          setBlobUrl(activeUrl);
          setLoading(false);
        })
        .catch((err) => {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to load preview.",
          );
          setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      if (activeUrl) {
        window.URL.revokeObjectURL(activeUrl);
      }
    };
  }, [documentId, mimeType, filename, isUnlocked]);

  // If vault is locked, render VaultLockScreen
  if (!isUnlocked) {
    return <VaultLockScreen />;
  }

  if (loading) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "3rem",
          backgroundColor: "#f8fafc",
          borderRadius: "8px",
        }}
      >
        <p style={{ color: "#64748b" }}>
          Loading decrypted document preview...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "1.5rem",
          backgroundColor: "#fee2e2",
          borderRadius: "8px",
          color: "#b91c1c",
        }}
      >
        <strong>Preview Unavailable:</strong> {error}
      </div>
    );
  }

  if (isPdf && blobUrl) {
    return (
      <div
        style={{
          width: "100%",
          height: "650px",
          border: "1px solid #cbd5e1",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <iframe
          src={blobUrl}
          title={filename}
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </div>
    );
  }

  if (isImage && blobUrl) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "1rem",
          backgroundColor: "#f8fafc",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
        }}
      >
        <img
          src={blobUrl}
          alt={filename}
          style={{
            maxWidth: "100%",
            maxHeight: "600px",
            objectFit: "contain",
            borderRadius: "4px",
          }}
        />
      </div>
    );
  }

  // Office documents / text fallback
  const handleDownload = async () => {
    if (!isUnlocked) {
      openUnlockModal(() => handleDownload());
      return;
    }
    try {
      const response = await documentService.downloadDocument(
        documentId,
        false,
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  };

  return (
    <div
      style={{
        padding: "2.5rem 1.5rem",
        textAlign: "center",
        backgroundColor: "#f8fafc",
        borderRadius: "8px",
        border: "1px dashed #cbd5e1",
      }}
    >
      <div
        style={{
          marginBottom: "0.75rem",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <IconFileText size={42} color="var(--color-primary)" />
      </div>
      <h4 style={{ margin: "0 0 0.5rem 0", color: "#1e293b" }}>
        Direct Preview Not Supported
      </h4>
      <p
        style={{
          color: "#64748b",
          fontSize: "0.85rem",
          maxWidth: "450px",
          margin: "0 auto 1.5rem auto",
        }}
      >
        This document ({filename}) is an office or structured binary format. To
        inspect or review its contents, please download the file using the
        button below.
      </p>
      <button
        className="btn btn-primary"
        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        onClick={handleDownload}
      >
        <IconDownload size={15} />
        <span>Download {filename}</span>
      </button>
    </div>
  );
};

export default DocumentPreview;
