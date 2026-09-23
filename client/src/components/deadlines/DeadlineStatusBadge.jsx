import React from "react";
import {
  IconZap,
  IconAlertTriangle,
  IconHourglass,
  IconCalendar,
  IconSearch,
  IconCheck,
} from "../common/Icons";

const STATUS_CONFIG = {
  DUE_TODAY: {
    label: "Due Today",
    icon: (color) => <IconZap size={12} color={color} />,
    bg: "#000000",
    color: "#ffffff",
    border: "#000000",
  },
  OVERDUE: {
    label: "Overdue",
    icon: (color) => <IconAlertTriangle size={12} color={color} />,
    bg: "#000000",
    color: "#ffffff",
    border: "#000000",
  },
  DUE_SOON: {
    label: "Due Soon (≤15d)",
    icon: (color) => <IconHourglass size={12} color={color} />,
    bg: "#f4f4f5",
    color: "#000000",
    border: "#71717a",
  },
  UPCOMING: {
    label: "Upcoming",
    icon: (color) => <IconCalendar size={12} color={color} />,
    bg: "#ffffff",
    color: "#000000",
    border: "#e4e4e7",
  },
  MANUAL_REVIEW_REQUIRED: {
    label: "Manual Review Required",
    icon: (color) => <IconSearch size={12} color={color} />,
    bg: "#f4f4f5",
    color: "#18181b",
    border: "#a1a1aa",
  },
  COMPLETED: {
    label: "Completed",
    icon: (color) => <IconCheck size={12} color={color} />,
    bg: "#ffffff",
    color: "#000000",
    border: "#000000",
  },
  WAIVED: {
    label: "Waived",
    icon: () => null,
    bg: "#f4f4f5",
    color: "#71717a",
    border: "#e4e4e7",
  },
};

const DeadlineStatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || {
    label: status || "Unknown",
    icon: () => null,
    bg: "#f1f5f9",
    color: "#475569",
    border: "#cbd5e1",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.25rem 0.6rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        whiteSpace: "nowrap",
      }}
      title={`Limitation Status: ${config.label}`}
    >
      {typeof config.icon === "function" && config.icon(config.color)}
      <span>{config.label}</span>
    </span>
  );
};

export default DeadlineStatusBadge;
