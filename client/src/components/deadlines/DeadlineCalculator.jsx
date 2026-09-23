import React, { useState, useEffect } from "react";
import deadlineRuleService from "../../services/deadlineRuleService";
import deadlineService from "../../services/deadlineService";
import { IconScale } from "../common/Icons";

const DeadlineCalculator = ({ caseId = null, onClose = null, onSuccess = null }) => {
  const [mode, setMode] = useState("RULE"); // 'RULE' or 'MANUAL'
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(true);

  // Form State
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [triggerDate, setTriggerDate] = useState("");
  const [triggerType, setTriggerType] = useState("CAUSE_OF_ACTION");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("HIGH");

  // Manual Fallback State
  const [manualTitle, setManualTitle] = useState("");
  const [manualDeadline, setManualDeadline] = useState("");
  const [manualReason, setManualReason] = useState("");

  // Calculation Result State
  const [calcResult, setCalcResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoadingRules(true);
      const res = await deadlineRuleService.getRules({ is_active: true, limit: 100 });
      setRules(res.data?.rules || []);
      if (res.data?.rules?.length > 0) {
        setSelectedRuleId(res.data.rules[0].id);
        if (res.data.rules[0].trigger_type) {
          setTriggerType(res.data.rules[0].trigger_type);
        }
      }
    } catch (err) {
      console.error("Failed to load rules:", err);
    } finally {
      setLoadingRules(false);
    }
  };

  const handleRuleChange = (ruleId) => {
    setSelectedRuleId(ruleId);
    setCalcResult(null);
    const rule = rules.find((r) => String(r.id) === String(ruleId));
    if (rule?.trigger_type) {
      setTriggerType(rule.trigger_type);
    }
  };

  const handleCalculate = async (e) => {
    if (e) e.preventDefault();
    if (!selectedRuleId) {
      setError("Please select a limitation rule.");
      return;
    }
    if (!triggerDate) {
      setError("Please specify the trigger event date.");
      return;
    }

    setCalculating(true);
    setError("");

    try {
      const res = await deadlineService.calculateLimitation({
        deadline_rule_id: selectedRuleId,
        trigger_date: triggerDate,
        trigger_type: triggerType,
        notes,
      });
      setCalcResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to calculate limitation deadline.");
    } finally {
      setCalculating(false);
    }
  };

  const handleSaveToCase = async () => {
    if (!caseId) return;

    setSaving(true);
    setError("");

    try {
      if (mode === "RULE") {
        if (!calcResult) {
          await handleCalculate();
        }
        await deadlineService.createCaseDeadline(caseId, {
          deadline_rule_id: selectedRuleId,
          trigger_date: triggerDate,
          trigger_type: triggerType,
          priority,
          notes,
          is_manual: false,
        });
      } else {
        // Manual Fallback
        if (!manualDeadline) {
          setError("Please provide a manual deadline date.");
          setSaving(false);
          return;
        }
        if (!manualReason.trim()) {
          setError("A justification reason is mandatory for manual deadline entries.");
          setSaving(false);
          return;
        }
        await deadlineService.createCaseDeadline(caseId, {
          title: manualTitle.trim() || "Manual Limitation Deadline",
          is_manual: true,
          manual_deadline: manualDeadline,
          manual_reason: manualReason.trim(),
          trigger_date: triggerDate || manualDeadline,
          trigger_type: triggerType,
          priority,
          notes,
        });
      }

      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save deadline to case.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "8px",
        boxShadow: caseId ? "none" : "0 10px 15px -3px rgba(0,0,0,0.1)",
        overflow: "hidden",
      }}
    >
      {/* Mode Switcher */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setMode("RULE");
            setError("");
          }}
          style={{
            flex: 1,
            padding: "0.75rem 1rem",
            background: mode === "RULE" ? "#ffffff" : "transparent",
            border: "none",
            borderBottom: mode === "RULE" ? "2px solid var(--color-primary, #0f766e)" : "none",
            fontWeight: 600,
            fontSize: "0.85rem",
            color: mode === "RULE" ? "var(--color-primary, #0f766e)" : "#64748b",
            cursor: "pointer",
          }}
        >
          Statutory Rule Calculator
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("MANUAL");
            setError("");
          }}
          style={{
            flex: 1,
            padding: "0.75rem 1rem",
            background: mode === "MANUAL" ? "#ffffff" : "transparent",
            border: "none",
            borderBottom: mode === "MANUAL" ? "2px solid var(--color-primary, #0f766e)" : "none",
            fontWeight: 600,
            fontSize: "0.85rem",
            color: mode === "MANUAL" ? "var(--color-primary, #0f766e)" : "#64748b",
            cursor: "pointer",
          }}
        >
          Manual Deadline Fallback
        </button>
      </div>

      <div style={{ padding: "1.25rem" }}>
        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "0.6rem 0.8rem",
              borderRadius: "6px",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Mandatory Legal Disclaimer Banner */}
        <div
          style={{
            background: "#f4f4f5",
            border: "1px solid #e4e4e7",
            borderRadius: "6px",
            padding: "0.75rem",
            marginBottom: "1.25rem",
            display: "flex",
            gap: "0.6rem",
            alignItems: "flex-start",
          }}
        >
          <IconScale size={18} color="#000000" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div style={{ fontSize: "0.78rem", color: "#18181b", lineHeight: 1.4 }}>
            <strong>INTERNAL ASSISTIVE DEADLINE TOOL:</strong> System-generated limitation
            date. Verify against the applicable law, facts, exclusions, extensions, court
            orders, and professional legal judgment.
          </div>
        </div>

        {mode === "RULE" ? (
          <div>
            {loadingRules ? (
              <div style={{ padding: "1rem", textAlign: "center", color: "#64748b" }}>
                Loading statutory limitation rules...
              </div>
            ) : rules.length === 0 ? (
              <div
                style={{
                  padding: "1rem",
                  background: "#f8fafc",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  color: "#475569",
                  marginBottom: "1rem",
                }}
              >
                No verified statutory rules configured yet. Switch to{" "}
                <strong>Manual Deadline Fallback</strong> above, or add rules in the{" "}
                <strong>Limitation Rules</strong> page.
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: "1rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: "0.3rem",
                    }}
                  >
                    Applicable Limitation Rule *
                  </label>
                  <select
                    value={selectedRuleId}
                    onChange={(e) => handleRuleChange(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                    }}
                  >
                    {rules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.act_name} — {r.article_reference || r.section_reference || "Sec"} ({r.proceeding_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "0.3rem",
                      }}
                    >
                      Trigger Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={triggerDate}
                      onChange={(e) => {
                        setTriggerDate(e.target.value);
                        setCalcResult(null);
                      }}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "0.3rem",
                      }}
                    >
                      Trigger Event Type *
                    </label>
                    <select
                      value={triggerType}
                      onChange={(e) => setTriggerType(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                      }}
                    >
                      <option value="CAUSE_OF_ACTION">Cause of Action Date</option>
                      <option value="DATE_OF_ORDER">Date of Order</option>
                      <option value="DATE_OF_JUDGMENT">Date of Judgment</option>
                      <option value="DATE_OF_KNOWLEDGE">Date of Knowledge</option>
                      <option value="DATE_OF_DEFAULT">Date of Default</option>
                      <option value="DATE_OF_RECEIPT_OF_AWARD">Date of Receipt of Award</option>
                      <option value="DATE_FIXED_FOR_PERFORMANCE">Date Fixed for Performance</option>
                      <option value="OTHER">Other Trigger Event</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 2fr",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "0.3rem",
                      }}
                    >
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                      }}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "0.3rem",
                      }}
                    >
                      Notes / Facts
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., notice received by client on..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
                  <button
                    type="button"
                    disabled={calculating || !triggerDate}
                    onClick={handleCalculate}
                    className="btn btn-secondary"
                    style={{ padding: "0.45rem 1rem", fontSize: "0.85rem" }}
                  >
                    {calculating ? "Calculating..." : "Preview Calculation"}
                  </button>
                </div>

                {/* Calculation Output Box */}
                {calcResult && (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "6px",
                      padding: "1rem",
                      marginBottom: "1.25rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#166534" }}>
                        Calculated Limitation Deadline:
                      </span>
                      <span
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: 700,
                          color: "#15803d",
                          fontFamily: "monospace",
                        }}
                      >
                        {calcResult.calculated_deadline}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.8rem", color: "#1e3a5f", marginBottom: "0.5rem" }}>
                      <strong>Method:</strong> {calcResult.calculation_explanation}
                    </div>

                    {calcResult.rule?.exclusion_notes && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#4b5563",
                          background: "#ffffff",
                          padding: "0.5rem",
                          borderRadius: "4px",
                          marginTop: "0.5rem",
                        }}
                      >
                        <strong>Statutory Exclusions / Notes:</strong> {calcResult.rule.exclusion_notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Manual Mode */
          <div>
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "0.3rem",
                }}
              >
                Deadline Title *
              </label>
              <input
                type="text"
                placeholder="e.g., Summary Suit Leave to Defend Deadline"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "0.3rem",
                  }}
                >
                  Manual Deadline Date *
                </label>
                <input
                  type="date"
                  required
                  value={manualDeadline}
                  onChange={(e) => setManualDeadline(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "0.3rem",
                  }}
                >
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "0.3rem",
                }}
              >
                Justification / Reason *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Document professional reasons for this manual deadline entry..."
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  resize: "vertical",
                }}
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            marginTop: "1.25rem",
            borderTop: "1px solid #e2e8f0",
            paddingTop: "1rem",
          }}
        >
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: "0.45rem 1rem", fontSize: "0.85rem" }}
            >
              Cancel
            </button>
          )}

          {caseId && (
            <button
              type="button"
              disabled={saving || (mode === "RULE" && !triggerDate)}
              onClick={handleSaveToCase}
              className="btn btn-primary"
              style={{ padding: "0.45rem 1.25rem", fontSize: "0.85rem" }}
            >
              {saving ? "Saving to Case..." : "Save Deadline to Case"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeadlineCalculator;
