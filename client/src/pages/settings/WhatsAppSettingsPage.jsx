import React, { useState, useEffect } from "react";
import whatsappService from "../../services/whatsappService";
import { IconPhone } from "../../components/common/Icons";

export default function WhatsAppSettingsPage() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  // AiSensy Test Message State
  const [testDestination, setTestDestination] = useState("+918870686660");
  const [testCampaignName, setTestCampaignName] = useState("");
  const [testParams, setTestParams] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setAlertMsg(null);
    try {
      const [statusRes, settingsRes] = await Promise.all([
        whatsappService.getStatus(),
        whatsappService.getSettings(),
      ]);

      if (statusRes?.success && statusRes?.data) {
        setHealthStatus(statusRes.data);
        if (statusRes.data.campaignName) {
          setTestCampaignName(statusRes.data.campaignName);
        }
      }

      if (settingsRes?.success && settingsRes?.data) {
        setRules(settingsRes.data.settings || []);
      }
    } catch (err) {
      setAlertMsg({
        type: "error",
        text: err.response?.data?.message || "Failed to load WhatsApp settings.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (reminderType) => {
    setRules((prev) =>
      prev.map((r) =>
        r.reminderType === reminderType ? { ...r, enabled: !r.enabled } : r
      )
    );
  };

  const handleTimeChange = (reminderType, newTime) => {
    setRules((prev) =>
      prev.map((r) =>
        r.reminderType === reminderType ? { ...r, sendTime: newTime } : r
      )
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAlertMsg(null);

    try {
      const payload = rules.map((r) => ({
        reminderType: r.reminderType,
        enabled: r.enabled,
        sendTime: r.sendTime,
      }));

      const res = await whatsappService.updateSettings(payload);
      if (res.success) {
        setAlertMsg({
          type: "success",
          text: "WhatsApp reminder rules updated successfully.",
        });
        setRules(res.data.settings || rules);
      }
    } catch (err) {
      setAlertMsg({
        type: "error",
        text: err.response?.data?.message || "Failed to save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    // Parse template parameters (comma-separated if provided)
    const parsedParams = testParams
      ? testParams
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
      : [];

    try {
      const res = await whatsappService.testAiSensyConnection({
        destination: testDestination.trim(),
        campaignName: testCampaignName ? testCampaignName.trim() : null,
        templateParams: parsedParams,
        userName: "Chambers Admin",
      });

      if (res.success) {
        setTestResult({
          type: "success",
          message: res.message || "AiSensy API request accepted",
          data: res.data,
        });
      } else {
        setTestResult({
          type: "error",
          message: res.message || "AiSensy API request failed",
          error: res.error,
        });
      }
    } catch (err) {
      const respData = err.response?.data;
      setTestResult({
        type: "error",
        message: respData?.message || err.message || "AiSensy API request failed",
        error: respData?.error || { code: "AISENSY_API_ERROR", details: err.message },
      });
    } finally {
      setTesting(false);
    }
  };

  const getRuleLabel = (type) => {
    switch (type) {
      case "HEARING_7_DAYS":
        return "7 Days Before Hearing";
      case "HEARING_3_DAYS":
        return "3 Days Before Hearing";
      case "HEARING_1_DAY":
        return "1 Day Before Hearing";
      case "HEARING_DAY":
        return "Day of Hearing";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading WhatsApp integration diagnostics...
      </div>
    );
  }

  const isApiConfigured = Boolean(healthStatus?.apiConfigured);
  const isCampaignConfigured = Boolean(healthStatus?.campaignConfigured || testCampaignName);

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <IconPhone size={22} color="#059669" />
          WhatsApp Integration — AiSensy
        </h1>
        <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: "0.9rem" }}>
          Verify API key connectivity, test live WhatsApp delivery, and configure automated hearing reminder timings.
        </p>
      </div>

      {alertMsg && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            borderRadius: "6px",
            fontSize: "0.9rem",
            backgroundColor: alertMsg.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: alertMsg.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${alertMsg.type === "success" ? "#a7f3d0" : "#fecaca"}`,
          }}
        >
          {alertMsg.text}
        </div>
      )}

      {/* 1. AiSensy Provider Configuration Card */}
      <div
        className="card"
        style={{
          padding: "1.25rem",
          marginBottom: "1.5rem",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          backgroundColor: "var(--color-bg-subtle)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)" }}>
              WhatsApp Provider
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: "0.2rem", color: "#0f172a" }}>
              AiSensy WhatsApp Business API
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
              Endpoint: <code>https://backend.aisensy.com/campaign/t1/api/v2</code>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            {/* Mode Badge (TEST / PRODUCTION) */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.4rem 0.8rem",
              borderRadius: "20px",
              fontSize: "0.85rem",
              fontWeight: 700,
              backgroundColor: healthStatus?.testMode ? "#eff6ff" : "#f0fdf4",
              color: healthStatus?.testMode ? "#1d4ed8" : "#15803d",
              border: `1px solid ${healthStatus?.testMode ? "#bfdbfe" : "#bbf7d0"}`,
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: healthStatus?.testMode ? "#3b82f6" : "#22c55e"
              }}></span>
              Mode: {healthStatus?.testMode ? "TEST" : "PRODUCTION"}
            </div>

            {/* API Key Status */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.4rem 0.8rem",
              borderRadius: "20px",
              fontSize: "0.85rem",
              fontWeight: 600,
              backgroundColor: isApiConfigured ? "#ecfdf5" : "#fef2f2",
              color: isApiConfigured ? "#047857" : "#991b1b",
              border: `1px solid ${isApiConfigured ? "#a7f3d0" : "#fecaca"}`,
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: isApiConfigured ? "#10b981" : "#ef4444"
              }}></span>
              API: {isApiConfigured ? "Configured" : "Not Configured"}
            </div>

            {/* Campaign Status */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.4rem 0.8rem",
              borderRadius: "20px",
              fontSize: "0.85rem",
              fontWeight: 600,
              backgroundColor: isCampaignConfigured ? "#ecfdf5" : "#fffbeb",
              color: isCampaignConfigured ? "#047857" : "#b45309",
              border: `1px solid ${isCampaignConfigured ? "#a7f3d0" : "#fde68a"}`,
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: isCampaignConfigured ? "#10b981" : "#f59e0b"
              }}></span>
              Campaign: {isCampaignConfigured ? (healthStatus?.campaignName || "Configured") : "Not Configured"}
            </div>

            {/* Test Destination */}
            {healthStatus?.testDestinationMasked && (
              <div style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "20px",
                fontSize: "0.85rem",
                fontWeight: 600,
                backgroundColor: "#f8fafc",
                color: "#475569",
                border: "1px solid #cbd5e1",
              }}>
                Test Number: {healthStatus.testDestinationMasked}
              </div>
            )}
          </div>
        </div>

        <div style={{
          marginTop: "1rem",
          padding: "0.75rem",
          backgroundColor: "#fff",
          borderRadius: "6px",
          fontSize: "0.82rem",
          color: "var(--color-text-muted)",
          border: "1px solid var(--color-border)",
          lineHeight: "1.5"
        }}>
          <strong>Production Safety Note:</strong> When <code>AISENSY_TEST_MODE=true</code>, automatic hearing reminders to clients are strictly disabled. Manual test messages are permitted exclusively to your designated test phone number. Your API key is kept strictly on the backend and is never exposed to the client.
        </div>
      </div>

      {/* 2. Live AiSensy API Connection Test Console */}
      <div
        className="card"
        style={{
          padding: "1.25rem",
          marginBottom: "1.5rem",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          backgroundColor: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
              Manual Real API Test
            </h2>
            <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem", borderRadius: "12px", backgroundColor: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>
              Real AiSensy Provider
            </span>
          </div>

          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            Permitted Destination: <strong>{healthStatus?.testDestinationMasked || "+91******6660"}</strong>
          </div>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "1.25rem" }}>
          Dispatches a real WhatsApp message to your authorized test phone number via the live AiSensy Campaign API. No production client records are contacted.
        </p>

        <form onSubmit={handleSendTestMessage}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                Test WhatsApp Number <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="+918870686660"
                value={testDestination}
                onChange={(e) => setTestDestination(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                Must equal configured safe test number in test mode.
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                AiSensy Campaign Name <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. hearing_reminder_template"
                value={testCampaignName}
                onChange={(e) => setTestCampaignName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                Pre-approved API campaign name configured in your AiSensy account.
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={testing || !isApiConfigured}
              className="btn btn-primary"
              style={{
                padding: "0.55rem 1.5rem",
                fontSize: "0.9rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontWeight: 600,
              }}
            >
              <IconPhone size={16} />
              <span>{testing ? "Testing..." : "Send Test WhatsApp"}</span>
            </button>

            {!isApiConfigured && (
              <span style={{ fontSize: "0.85rem", color: "#dc2626" }}>
                Cannot test: AISENSY_API_KEY is not configured in .env.
              </span>
            )}
          </div>
        </form>

        {/* Live Result Display */}
        {testResult && (
          <div
            style={{
              marginTop: "1.25rem",
              padding: "1rem",
              borderRadius: "6px",
              border: `1px solid ${testResult.type === "success" ? "#a7f3d0" : "#fecaca"}`,
              backgroundColor: testResult.type === "success" ? "#ecfdf5" : "#fef2f2",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span style={{
                fontSize: "0.8rem",
                padding: "0.2rem 0.6rem",
                borderRadius: "4px",
                fontWeight: 700,
                backgroundColor: testResult.type === "success" ? "#10b981" : "#ef4444",
                color: "#fff",
              }}>
                {testResult.type === "success" ? "SUCCESS" : "FAILED"}
              </span>
              <strong style={{
                color: testResult.type === "success" ? "#065f46" : "#991b1b",
                fontSize: "0.95rem"
              }}>
                {testResult.type === "success" ? "AiSensy API request accepted" : (testResult.error?.code || "AISENSY_PROVIDER_ERROR")}
              </strong>
            </div>

            <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: testResult.type === "success" ? "#047857" : "#7f1d1d" }}>
              {testResult.message}
            </p>

            {testResult.data && (
              <div style={{ fontSize: "0.8rem", color: "#065f46", backgroundColor: "#ffffff", padding: "0.6rem", borderRadius: "4px", border: "1px solid #d1fae5" }}>
                <div><strong>Provider:</strong> {testResult.data.provider}</div>
                <div><strong>Status:</strong> {testResult.data.status}</div>
                {testResult.data.providerMessageId && (
                  <div><strong>Provider Message ID:</strong> {testResult.data.providerMessageId}</div>
                )}
              </div>
            )}

            {testResult.error && (
              <div style={{ fontSize: "0.8rem", color: "#991b1b", backgroundColor: "#ffffff", padding: "0.6rem", borderRadius: "4px", border: "1px solid #fee2e2" }}>
                <div><strong>Error Category:</strong> {testResult.error.code}</div>
                {testResult.error.details && (
                  <div><strong>Details:</strong> {testResult.error.details}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section 37: Clear Separation for Automated Local Test */}
        <div style={{
          marginTop: "1.25rem",
          padding: "0.9rem",
          backgroundColor: "#f8fafc",
          borderRadius: "6px",
          border: "1px dashed #cbd5e1",
          fontSize: "0.82rem",
          color: "#475569"
        }}>
          <strong style={{ color: "#1e293b" }}>Automated Local Tests (CI / Development):</strong>
          <p style={{ margin: "0.25rem 0 0" }}>
            Automated tests (<code>npm test</code>) run with mocked provider responses against an isolated test environment and <strong>never send real WhatsApp messages</strong>. Real provider tests run only on explicit opt-in via <code>npm run test:aisensy</code> with <code>RUN_REAL_AISENSY_TESTS=true</code>.
          </p>
        </div>
      </div>

      {/* 3. Automated Reminder Timing Rules (Kept for Phase 2) */}
      <div
        className="card"
        style={{
          padding: "1.25rem",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          backgroundColor: "#fff",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
          Automated Hearing Reminder Timing Rules
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "1.25rem" }}>
          These rules govern future automated WhatsApp hearing reminder scheduling (Asia/Kolkata).
        </p>

        <form onSubmit={handleSave}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "0.75rem 0.5rem" }}>Reminder Interval</th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>Status</th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>Send Time</th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>Language</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.reminderType} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "0.85rem 0.5rem", fontWeight: 500 }}>
                      {getRuleLabel(rule.reminderType)}
                      <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                        {rule.reminderType} ({rule.offsetDays} day{rule.offsetDays === 1 ? "" : "s"} before)
                      </div>
                    </td>

                    <td style={{ padding: "0.85rem 0.5rem" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", gap: "0.5rem" }}>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => handleToggle(rule.reminderType)}
                          style={{ width: "18px", height: "18px", cursor: "pointer" }}
                        />
                        <span style={{ fontWeight: 500, color: rule.enabled ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                          {rule.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </label>
                    </td>

                    <td style={{ padding: "0.85rem 0.5rem" }}>
                      <input
                        type="time"
                        value={rule.sendTime ? rule.sendTime.slice(0, 5) : "10:00"}
                        onChange={(e) => handleTimeChange(rule.reminderType, `${e.target.value}:00`)}
                        disabled={!rule.enabled}
                        style={{
                          padding: "0.3rem 0.5rem",
                          border: "1px solid var(--color-border)",
                          borderRadius: "4px",
                          fontSize: "0.85rem",
                          backgroundColor: rule.enabled ? "#fff" : "var(--color-bg-subtle)",
                        }}
                      />
                    </td>

                    <td style={{ padding: "0.85rem 0.5rem", color: "var(--color-text-muted)" }}>
                      English (en)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ padding: "0.5rem 1.5rem", fontSize: "0.9rem" }}
            >
              {saving ? "Saving Changes..." : "Save Reminder Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
