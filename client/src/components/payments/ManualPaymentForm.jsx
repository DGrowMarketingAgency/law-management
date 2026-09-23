import React, { useState } from "react";
import paymentGatewayService from "../../services/paymentGatewayService";

export default function ManualPaymentForm({
  invoice,
  selectedMethod = "BANK_TRANSFER",
  defaultAmount,
  onSuccess,
  onCancel,
}) {
  const [formData, setFormData] = useState({
    amount: defaultAmount || invoice?.amount_due || "",
    payment_method: selectedMethod,
    reference_number: "",
    transaction_id: "",
    payment_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErrorMsg("");

      if (!formData.amount || Number(formData.amount) <= 0) {
        throw new Error("Please enter a valid payment amount.");
      }

      if (Number(formData.amount) > Number(invoice?.amount_due)) {
        throw new Error(`Amount cannot exceed the outstanding balance of ₹${invoice?.amount_due}.`);
      }

      if (["BANK_TRANSFER", "UPI_MANUAL", "CHEQUE"].includes(formData.payment_method) && !formData.reference_number.trim()) {
        throw new Error("Please enter the transaction reference / UTR / Cheque number.");
      }

      const res = await paymentGatewayService.recordManualPayment({
        invoice_id: invoice.id,
        amount: Number(formData.amount),
        payment_method: formData.payment_method,
        reference_number: formData.reference_number.trim(),
        transaction_id: formData.transaction_id.trim() || undefined,
        payment_date: formData.payment_date,
        notes: formData.notes.trim() || undefined,
      });

      if (onSuccess) onSuccess(res);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || "Failed to record manual payment.");
    } finally {
      setLoading(false);
    }
  };

  const getRefLabel = () => {
    if (formData.payment_method === "BANK_TRANSFER") return "Bank UTR / Reference Number *";
    if (formData.payment_method === "UPI_MANUAL") return "UPI Transaction ID / Ref Number *";
    if (formData.payment_method === "CHEQUE") return "Cheque Number & Issuing Bank *";
    return "Payment Reference / Receipt Memo";
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {errorMsg && (
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#fef2f2",
            color: "#b91c1c",
            fontSize: "0.82rem",
            borderRadius: "8px",
            border: "1px solid #fecaca",
          }}
        >
          {errorMsg}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: "700",
              color: "#334155",
              marginBottom: "0.35rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Amount Paid (₹) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={invoice?.amount_due}
            required
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            style={{
              width: "100%",
              padding: "0.65rem 0.85rem",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              fontSize: "0.95rem",
              fontFamily: "monospace",
              outline: "none",
              backgroundColor: "#ffffff",
              boxSizing: "border-box",
            }}
            placeholder="0.00"
          />
          <p style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.25rem" }}>
            Outstanding: ₹{Number(invoice?.amount_due || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: "700",
              color: "#334155",
              marginBottom: "0.35rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Payment Date *
          </label>
          <input
            type="date"
            required
            value={formData.payment_date}
            onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
            style={{
              width: "100%",
              padding: "0.65rem 0.85rem",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              fontSize: "0.9rem",
              outline: "none",
              backgroundColor: "#ffffff",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div>
        <label
          style={{
            display: "block",
            fontSize: "0.75rem",
            fontWeight: "700",
            color: "#334155",
            marginBottom: "0.35rem",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {getRefLabel()}
        </label>
        <input
          type="text"
          required={["BANK_TRANSFER", "UPI_MANUAL", "CHEQUE"].includes(formData.payment_method)}
          value={formData.reference_number}
          onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
          style={{
            width: "100%",
            padding: "0.65rem 0.85rem",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            fontSize: "0.9rem",
            outline: "none",
            backgroundColor: "#ffffff",
            boxSizing: "border-box",
          }}
          placeholder={
            formData.payment_method === "BANK_TRANSFER"
              ? "e.g. UTR123456789012"
              : formData.payment_method === "UPI_MANUAL"
              ? "e.g. UPI Ref 9876543210"
              : "e.g. Chq #000123 HDFC Bank"
          }
        />
      </div>

      <div>
        <label
          style={{
            display: "block",
            fontSize: "0.75rem",
            fontWeight: "700",
            color: "#334155",
            marginBottom: "0.35rem",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Notes / Remarks
        </label>
        <textarea
          rows="2"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          style={{
            width: "100%",
            padding: "0.65rem 0.85rem",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            fontSize: "0.85rem",
            outline: "none",
            backgroundColor: "#ffffff",
            boxSizing: "border-box",
          }}
          placeholder="Optional comments or transfer remarks..."
        ></textarea>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "0.75rem",
          paddingTop: "0.5rem",
        }}
      >
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: "0.6rem 1rem",
              color: "#475569",
              backgroundColor: "transparent",
              border: "1px solid #e2e8f0",
              fontSize: "0.85rem",
              fontWeight: "600",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "0.75rem 1.4rem",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            fontSize: "0.85rem",
            fontWeight: "700",
            borderRadius: "8px",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          {loading ? "Submitting..." : "Submit Payment for Verification"}
        </button>
      </div>
    </form>
  );
}
