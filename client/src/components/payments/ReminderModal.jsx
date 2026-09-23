import React, { useState } from "react";
import reminderService from "../../services/reminderService";

export default function ReminderModal({ invoice, isOpen, onClose, onSuccess }) {
  const [channel, setChannel] = useState("EMAIL");
  const [reminderType, setReminderType] = useState("BEFORE_DUE");
  const [customNote, setCustomNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  if (!isOpen || !invoice) return null;

  const handleSend = async () => {
    try {
      setLoading(true);
      setStatusMsg(null);

      const res = await reminderService.sendReminder(
        invoice.id,
        channel,
        reminderType,
        customNote
      );

      if (res.status === "FAILED") {
        setStatusMsg({
          type: "warning",
          text: `Reminder logged as FAILED: ${res.failureReason || "Gateway or SMTP not configured in environment."}`,
        });
      } else {
        setStatusMsg({
          type: "success",
          text: `Payment reminder successfully dispatched via ${channel}!`,
        });
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err.response?.data?.message || err.message || "Could not dispatch payment reminder.",
      });
    } finally {
      setLoading(false);
    }
  };

  const clientPhone = invoice.client_phone || invoice.billing_phone || "No phone on file";
  const clientEmail = invoice.client_email || invoice.billing_email || "No email on file";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1050,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(3px)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          maxWidth: "520px",
          width: "100%",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f8fafc",
          }}
        >
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: "800", color: "#0f172a", margin: 0 }}>
              Send Payment Reminder
            </h3>
            <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0.2rem 0 0 0" }}>
              Invoice #{invoice.invoice_number} • ₹{Number(invoice.amount_due || 0).toLocaleString("en-IN")}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.1rem",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              borderRadius: "6px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {statusMsg && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                fontSize: "0.8rem",
                border: "1px solid",
                backgroundColor:
                  statusMsg.type === "success"
                    ? "#ecfdf5"
                    : statusMsg.type === "warning"
                    ? "#fffbeb"
                    : "#fef2f2",
                color:
                  statusMsg.type === "success"
                    ? "#065f46"
                    : statusMsg.type === "warning"
                    ? "#92400e"
                    : "#991b1b",
                borderColor:
                  statusMsg.type === "success"
                    ? "#a7f3d0"
                    : statusMsg.type === "warning"
                    ? "#fde68a"
                    : "#fecaca",
              }}
            >
              {statusMsg.text}
            </div>
          )}

          {/* Channel selector */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.72rem",
                fontWeight: "700",
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.5rem",
              }}
            >
              Delivery Channel
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setChannel("EMAIL")}
                style={{
                  padding: "0.75rem 0.9rem",
                  borderRadius: "10px",
                  border: channel === "EMAIL" ? "2px solid #2563eb" : "1px solid #e2e8f0",
                  backgroundColor: channel === "EMAIL" ? "#eff6ff" : "#ffffff",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "1.3rem" }}>✉️</span>
                <div style={{ overflow: "hidden" }}>
                  <div style={{ fontWeight: "700", fontSize: "0.8rem", color: channel === "EMAIL" ? "#1e40af" : "#1e293b" }}>
                    Email (SMTP)
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "#64748b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {clientEmail}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setChannel("WHATSAPP")}
                style={{
                  padding: "0.75rem 0.9rem",
                  borderRadius: "10px",
                  border: channel === "WHATSAPP" ? "2px solid #16a34a" : "1px solid #e2e8f0",
                  backgroundColor: channel === "WHATSAPP" ? "#f0fdf4" : "#ffffff",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "1.3rem" }}>💬</span>
                <div style={{ overflow: "hidden" }}>
                  <div style={{ fontWeight: "700", fontSize: "0.8rem", color: channel === "WHATSAPP" ? "#15803d" : "#1e293b" }}>
                    WhatsApp Cloud
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "#64748b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {clientPhone}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Reminder Type */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.72rem",
                fontWeight: "700",
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.35rem",
              }}
            >
              Reminder Schedule Stage
            </label>
            <select
              value={reminderType}
              onChange={(e) => setReminderType(e.target.value)}
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "0.85rem",
                backgroundColor: "#ffffff",
                boxSizing: "border-box",
                outline: "none",
              }}
            >
              <option value="BEFORE_DUE">Upcoming Due Date (Gentle Notice)</option>
              <option value="DUE_TODAY">Payment Due Today (Action Notice)</option>
              <option value="OVERDUE">Overdue Invoice Notice (Urgent Notice)</option>
            </select>
          </div>

          {/* Preview Box */}
          <div
            style={{
              padding: "0.9rem 1rem",
              backgroundColor: "#f8fafc",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              fontSize: "0.78rem",
            }}
          >
            <div
              style={{
                fontWeight: "700",
                color: "#334155",
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.4rem",
              }}
            >
              <span>Preview Message Format:</span>
              <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: "normal" }}>Official Chambers Template</span>
            </div>
            <p style={{ color: "#475569", lineHeight: "1.5", margin: 0 }}>
              "Dear {invoice.client_name || invoice.billing_name || "Client"}, your payment of ₹
              {Number(invoice.amount_due || 0).toLocaleString("en-IN")} for Invoice #{invoice.invoice_number} is{" "}
              {reminderType === "OVERDUE" ? "overdue" : "due by " + (invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "due date")}
              . Please pay securely using the chambers portal."
            </p>
          </div>

          {/* Optional custom remarks */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.72rem",
                fontWeight: "700",
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.35rem",
              }}
            >
              Additional Note / Remarks (Optional)
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. As discussed regarding the upcoming trial hearing..."
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "0.85rem",
                backgroundColor: "#ffffff",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.75rem",
            backgroundColor: "#f8fafc",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "0.6rem 1rem",
              color: "#64748b",
              backgroundColor: "transparent",
              border: "1px solid #e2e8f0",
              fontSize: "0.82rem",
              fontWeight: "600",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={loading}
            style={{
              padding: "0.65rem 1.25rem",
              color: "#ffffff",
              backgroundColor: channel === "WHATSAPP" ? "#16a34a" : "#2563eb",
              fontSize: "0.82rem",
              fontWeight: "700",
              borderRadius: "8px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {loading ? "Dispatching..." : `Send ${channel} Reminder`}
          </button>
        </div>
      </div>
    </div>
  );
}
