import React from "react";
import { IconScale, IconLock } from "../common/Icons";


export const DOCUMENT_CATEGORIES = [
  { value: "PLEADING", label: "Pleading", color: "#000000", bg: "#f4f4f5" },
  { value: "PETITION", label: "Petition", color: "#000000", bg: "#f4f4f5" },
  { value: "WRITTEN_STATEMENT", label: "Written Statement", color: "#000000", bg: "#f4f4f5" },
  { value: "AFFIDAVIT", label: "Affidavit", color: "#000000", bg: "#f4f4f5" },
  { value: "EVIDENCE", label: "Evidence", color: "#000000", bg: "#f4f4f5" },
  { value: "ORDER", label: "Court Order", color: "#000000", bg: "#f4f4f5" },
  { value: "JUDGMENT", label: "Judgment", color: "#000000", bg: "#f4f4f5" },
  { value: "NOTICE", label: "Notice", color: "#000000", bg: "#f4f4f5" },
  { value: "APPLICATION", label: "Application", color: "#000000", bg: "#f4f4f5" },
  { value: "LEGAL_NOTICE", label: "Legal Notice", color: "#000000", bg: "#f4f4f5" },
  { value: "AGREEMENT", label: "Agreement", color: "#000000", bg: "#f4f4f5" },
  { value: "CORRESPONDENCE", label: "Correspondence", color: "#000000", bg: "#f4f4f5" },
  { value: "CASE_DOCUMENT", label: "Case Document", color: "#000000", bg: "#f4f4f5" },
  { value: "CLIENT_DOCUMENT", label: "Client Document", color: "#000000", bg: "#f4f4f5" },
  { value: "OTHER", label: "Other", color: "#000000", bg: "#f4f4f5" },
];

export const CONFIDENTIALITY_LEVELS = [
  { value: "NORMAL", label: "Normal", color: "#000000", bg: "#ffffff", border: "#e4e4e7" },
  { value: "CONFIDENTIAL", label: "Confidential", color: "#000000", bg: "#f4f4f5", border: "#71717a" },
  { value: "HIGHLY_CONFIDENTIAL", label: "Highly Confidential", color: "#ffffff", bg: "#000000", border: "#000000" },
  { value: "ADVOCATE_ONLY", label: "Advocate Only", color: "#ffffff", bg: "#18181b", border: "#18181b" },
];

export const DocumentCategoryBadge = ({ category }) => {
  const cat = DOCUMENT_CATEGORIES.find((c) => c.value === category) || {
    label: category,
    color: "#000000",
    bg: "#f4f4f5",
  };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.2rem 0.6rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: cat.color,
        backgroundColor: cat.bg,
        border: "1px solid #e4e4e7",
      }}
    >
      {cat.label}
    </span>
  );
};

export const ConfidentialityBadge = ({ level }) => {
  const conf = CONFIDENTIALITY_LEVELS.find((l) => l.value === level) || {
    label: level,
    color: "#000000",
    bg: "#f4f4f5",
    border: "#e4e4e7",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.2rem 0.55rem",
        borderRadius: "4px",
        fontSize: "0.7rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        color: conf.color,
        backgroundColor: conf.bg,
        border: `1px solid ${conf.border || "#e4e4e7"}`,
      }}
    >
      {level === "ADVOCATE_ONLY" && <IconScale size={12} color={conf.color} />}
      {level === "HIGHLY_CONFIDENTIAL" && <IconLock size={12} color={conf.color} />}
      {conf.label}
    </span>
  );
};

export const DOCUMENT_WORKFLOW_STATUSES = [
  { value: "DRAFT", label: "Draft", color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" },
  { value: "IN_REVIEW", label: "In Review", color: "#d97706", bg: "#fef3c7", border: "#fde68a" },
  { value: "CHANGES_REQUESTED", label: "Changes Requested", color: "#dc2626", bg: "#fee2e2", border: "#fecaca" },
  { value: "APPROVED", label: "Approved", color: "#059669", bg: "#d1fae5", border: "#a7f3d0" },
  { value: "AWAITING_SIGNATURE", label: "Awaiting Signature", color: "#2563eb", bg: "#dbeafe", border: "#bfdbfe" },
  { value: "SIGNED", label: "Signed & Certified", color: "#047857", bg: "#ecfdf5", border: "#10b981" },
  { value: "ARCHIVED", label: "Archived", color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
  { value: "REJECTED", label: "Rejected", color: "#991b1b", bg: "#fee2e2", border: "#f87171" },
];

export const DocumentWorkflowStatusBadge = ({ status }) => {
  const item = DOCUMENT_WORKFLOW_STATUSES.find((s) => s.value === status) || {
    label: status || "DRAFT",
    color: "#475569",
    bg: "#f1f5f9",
    border: "#cbd5e1",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.2rem 0.55rem",
        borderRadius: "9999px",
        fontSize: "0.72rem",
        fontWeight: 600,
        color: item.color,
        backgroundColor: item.bg,
        border: `1px solid ${item.border}`,
        whiteSpace: "nowrap"
      }}
    >
      {item.label}
    </span>
  );
};

export const EXTERNAL_PROVIDERS = [
  { value: "GOOGLE_DRIVE", label: "Google Drive", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", icon: "📁" },
  { value: "ONEDRIVE", label: "OneDrive", color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd", icon: "☁️" },
  { value: "DROPBOX", label: "Dropbox", color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe", icon: "📦" },
  { value: "OTHER", label: "Cloud Link", color: "#475569", bg: "#f8fafc", border: "#cbd5e1", icon: "🔗" },
];

export const DocumentStorageBadge = ({ storageType, provider }) => {
  const isExternal = storageType === "EXTERNAL";

  if (!isExternal) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          padding: "0.2rem 0.55rem",
          borderRadius: "9999px",
          fontSize: "0.72rem",
          fontWeight: 600,
          color: "#0f766e",
          backgroundColor: "#f0fdfa",
          border: "1px solid #99f6e4",
          whiteSpace: "nowrap",
        }}
      >
        <span>📄</span>
        <span>Internal File</span>
      </span>
    );
  }

  const p = EXTERNAL_PROVIDERS.find((item) => item.value === provider) || {
    label: provider || "External Link",
    color: "#4338ca",
    bg: "#eef2ff",
    border: "#c7d2fe",
    icon: "🔗",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.2rem 0.55rem",
        borderRadius: "9999px",
        fontSize: "0.72rem",
        fontWeight: 600,
        color: p.color,
        backgroundColor: p.bg,
        border: `1px solid ${p.border}`,
        whiteSpace: "nowrap",
      }}
    >
      <span>{p.icon}</span>
      <span>{p.label}</span>
    </span>
  );
};

export default {
  DocumentCategoryBadge,
  ConfidentialityBadge,
  DocumentWorkflowStatusBadge,
  DocumentStorageBadge,
  DOCUMENT_CATEGORIES,
  CONFIDENTIALITY_LEVELS,
  DOCUMENT_WORKFLOW_STATUSES,
  EXTERNAL_PROVIDERS,
};
