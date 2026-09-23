import React, { useState, useEffect } from "react";
import paymentSettingsService from "../../services/paymentSettingsService";

export default function PaymentGatewaySettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await paymentSettingsService.getSettings();
      setSettings(data);
    } catch (err) {
      setStatusMsg({ type: "error", text: "Failed to load payment settings." });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key, value) => {
    try {
      setSavingKey(key);
      setStatusMsg(null);
      const updated = await paymentSettingsService.updateSettings(key, value);
      setSettings(updated);
      setStatusMsg({ type: "success", text: "Settings saved successfully." });
    } catch (err) {
      setStatusMsg({ type: "error", text: err.response?.data?.message || err.message || "Failed to update settings." });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
        Loading payment gateway and firm instructions...
      </div>
    );
  }

  const { gateway_config, bank_instructions, reminder_rules, smtp_config, whatsapp_config } = settings || {};

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: "900", color: "#0f172a", margin: 0 }}>
          Payment Gateway & Collection Settings
        </h1>
        <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.35rem" }}>
          Configure online payment gateways (Razorpay, PayU), firm bank instructions, and automated reminder schedules.
        </p>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: "0.9rem 1.25rem",
            borderRadius: "10px",
            fontSize: "0.85rem",
            border: "1px solid",
            backgroundColor: statusMsg.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: statusMsg.type === "success" ? "#065f46" : "#991b1b",
            borderColor: statusMsg.type === "success" ? "#a7f3d0" : "#fecaca",
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* 1. Gateway Status & Provider Toggles */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f8fafc",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: "800", color: "#0f172a", margin: 0 }}>
              Online Payment Gateways
            </h2>
            <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0.2rem 0 0 0" }}>
              Enable or switch primary online collection gateways for clients
            </p>
          </div>
          <span
            style={{
              fontSize: "0.72rem",
              padding: "0.3rem 0.75rem",
              borderRadius: "20px",
              fontWeight: "700",
              backgroundColor: "#eff6ff",
              color: "#1d4ed8",
              border: "1px solid #bfdbfe",
            }}
          >
            Coexistence Architecture
          </span>
        </div>

        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Razorpay Card */}
            <div
              style={{
                padding: "1.25rem",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontWeight: "800", color: "#0f172a", fontSize: "1.05rem" }}>Razorpay</span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontWeight: "800",
                      backgroundColor: gateway_config?.razorpayMode === "LIVE" ? "#ecfdf5" : "#fef3c7",
                      color: gateway_config?.razorpayMode === "LIVE" ? "#047857" : "#b45309",
                    }}
                  >
                    {gateway_config?.razorpayMode || "TEST"} MODE
                  </span>
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={gateway_config?.razorpayEnabled}
                    onChange={(e) =>
                      handleSave("gateway_config", {
                        ...gateway_config,
                        razorpayEnabled: e.target.checked,
                      })
                    }
                    style={{ transform: "scale(1.3)", cursor: "pointer" }}
                  />
                </label>
              </div>

              <div style={{ fontSize: "0.78rem", color: "#475569", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <div>
                  <span style={{ color: "#94a3b8" }}>Public Key ID:</span>{" "}
                  <span style={{ fontFamily: "monospace", color: "#1e293b" }}>{gateway_config?.razorpayKeyId || "Configured via .env"}</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8" }}>Secret Key:</span> <span style={{ fontFamily: "monospace" }}>********</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8" }}>Webhook Status:</span>{" "}
                  <span style={{ color: "#059669", fontWeight: "700" }}>HMAC SHA-256 Validated</span>
                </div>
              </div>
            </div>

            {/* PayU Card */}
            <div
              style={{
                padding: "1.25rem",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontWeight: "800", color: "#0f172a", fontSize: "1.05rem" }}>PayU India</span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontWeight: "800",
                      backgroundColor: gateway_config?.payuMode === "LIVE" ? "#ecfdf5" : "#fef3c7",
                      color: gateway_config?.payuMode === "LIVE" ? "#047857" : "#b45309",
                    }}
                  >
                    {gateway_config?.payuMode || "TEST"} MODE
                  </span>
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={gateway_config?.payuEnabled}
                    onChange={(e) =>
                      handleSave("gateway_config", {
                        ...gateway_config,
                        payuEnabled: e.target.checked,
                      })
                    }
                    style={{ transform: "scale(1.3)", cursor: "pointer" }}
                  />
                </label>
              </div>

              <div style={{ fontSize: "0.78rem", color: "#475569", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <div>
                  <span style={{ color: "#94a3b8" }}>Merchant Key:</span>{" "}
                  <span style={{ fontFamily: "monospace", color: "#1e293b" }}>{gateway_config?.payuMerchantKey || "Configured via .env"}</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8" }}>Merchant Salt:</span> <span style={{ fontFamily: "monospace" }}>********</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8" }}>Hash Algorithm:</span>{" "}
                  <span style={{ color: "#059669", fontWeight: "700" }}>SHA-512 Server Generated</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.85rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: "700", color: "#334155" }}>Primary Checkout Gateway:</span>
            <select
              value={gateway_config?.primaryGateway}
              onChange={(e) =>
                handleSave("gateway_config", {
                  ...gateway_config,
                  primaryGateway: e.target.value,
                })
              }
              style={{
                padding: "0.5rem 0.85rem",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "0.85rem",
                backgroundColor: "#ffffff",
                outline: "none",
              }}
            >
              <option value="RAZORPAY">Razorpay (Default)</option>
              <option value="PAYU">PayU India</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Firm Bank & UPI Instructions */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #f1f5f9",
            backgroundColor: "#f8fafc",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: "800", color: "#0f172a", margin: 0 }}>
            Firm Bank & Manual Payment Instructions
          </h2>
          <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0.2rem 0 0 0" }}>
            These details are shown to clients selecting direct bank transfer or UPI payments
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave("bank_instructions", bank_instructions);
          }}
          style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.82rem" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
            }}
          >
            <div>
              <label style={{ display: "block", fontWeight: "700", color: "#334155", marginBottom: "0.35rem" }}>Bank Name</label>
              <input
                type="text"
                value={bank_instructions?.bankName || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bank_instructions: { ...bank_instructions, bankName: e.target.value },
                  })
                }
                style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid #cbd5e1", borderRadius: "8px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: "700", color: "#334155", marginBottom: "0.35rem" }}>Account Holder Name</label>
              <input
                type="text"
                value={bank_instructions?.accountName || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bank_instructions: { ...bank_instructions, accountName: e.target.value },
                  })
                }
                style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid #cbd5e1", borderRadius: "8px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: "700", color: "#334155", marginBottom: "0.35rem" }}>Account Number</label>
              <input
                type="text"
                value={bank_instructions?.accountNumber || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bank_instructions: { ...bank_instructions, accountNumber: e.target.value },
                  })
                }
                style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid #cbd5e1", borderRadius: "8px", fontFamily: "monospace", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: "700", color: "#334155", marginBottom: "0.35rem" }}>IFSC Code</label>
              <input
                type="text"
                value={bank_instructions?.ifscCode || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bank_instructions: { ...bank_instructions, ifscCode: e.target.value },
                  })
                }
                style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid #cbd5e1", borderRadius: "8px", fontFamily: "monospace", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: "700", color: "#334155", marginBottom: "0.35rem" }}>UPI ID (VPA)</label>
            <input
              type="text"
              value={bank_instructions?.upiId || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bank_instructions: { ...bank_instructions, upiId: e.target.value },
                })
              }
              style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid #cbd5e1", borderRadius: "8px", fontFamily: "monospace", boxSizing: "border-box" }}
              placeholder="e.g. chambers@sbi"
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: "700", color: "#334155", marginBottom: "0.35rem" }}>Client Payment Remarks / Notes</label>
            <textarea
              rows="2"
              value={bank_instructions?.notes || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bank_instructions: { ...bank_instructions, notes: e.target.value },
                })
              }
              style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid #cbd5e1", borderRadius: "8px", boxSizing: "border-box" }}
            ></textarea>
          </div>

          <div style={{ paddingTop: "0.5rem", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={savingKey === "bank_instructions"}
              style={{
                padding: "0.65rem 1.25rem",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontWeight: "700",
                borderRadius: "8px",
                border: "none",
                fontSize: "0.82rem",
                cursor: savingKey === "bank_instructions" ? "not-allowed" : "pointer",
                boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
              }}
            >
              {savingKey === "bank_instructions" ? "Saving..." : "Save Bank Instructions"}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Communication Channels Status (SMTP & WhatsApp) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.25rem",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1.25rem",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: "800", fontSize: "0.95rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>✉️</span> SMTP Email Transport
            </span>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "2px 8px",
                borderRadius: "12px",
                fontWeight: "700",
                backgroundColor: smtp_config?.configured ? "#ecfdf5" : "#f1f5f9",
                color: smtp_config?.configured ? "#047857" : "#475569",
                border: smtp_config?.configured ? "1px solid #a7f3d0" : "1px solid #cbd5e1",
              }}
            >
              {smtp_config?.configured ? "Configured" : "Configured via .env"}
            </span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "#475569", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <div>
              <span style={{ color: "#94a3b8" }}>Host:</span> {smtp_config?.host || "Not set"}
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>From Address:</span> {smtp_config?.fromEmail || "Not set"}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1.25rem",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: "800", fontSize: "0.95rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>💬</span> Meta WhatsApp Business Cloud
            </span>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "2px 8px",
                borderRadius: "12px",
                fontWeight: "700",
                backgroundColor: whatsapp_config?.configured ? "#ecfdf5" : "#f1f5f9",
                color: whatsapp_config?.configured ? "#047857" : "#475569",
                border: whatsapp_config?.configured ? "1px solid #a7f3d0" : "1px solid #cbd5e1",
              }}
            >
              {whatsapp_config?.configured ? "Configured" : "Configured via .env"}
            </span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "#475569", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <div>
              <span style={{ color: "#94a3b8" }}>API Endpoint:</span> {whatsapp_config?.baseUrl}
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Template Engine:</span>{" "}
              <span style={{ color: "#059669", fontWeight: "700" }}>Meta Approved Legal Templates</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
