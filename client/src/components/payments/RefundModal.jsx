import React, { useState } from "react";
import paymentGatewayService from "../../services/paymentGatewayService";

export default function RefundModal({ payment, isOpen, onClose, onSuccess }) {
  const [amount, setAmount] = useState(payment?.amount || "");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !payment) return null;

  const handleRefund = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErrorMsg("");

      if (!reason.trim()) {
        throw new Error("Please provide a reason for the refund / reversal.");
      }

      const numAmount = Number(amount);
      if (numAmount <= 0 || numAmount > Number(payment.amount)) {
        throw new Error(`Refund amount must be between ₹1 and ₹${payment.amount}.`);
      }

      const res = await paymentGatewayService.refundPayment(payment.id, reason.trim(), numAmount);
      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || "Failed to process refund.");
    } finally {
      setLoading(false);
    }
  };

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
          maxWidth: "460px",
          width: "100%",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
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
          }}
        >
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: "800", color: "#0f172a", margin: 0 }}>
              Issue Payment Refund
            </h3>
            <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0.2rem 0 0 0" }}>
              Receipt #{payment.receipt_number || payment.payment_number} • Total: ₹{Number(payment.amount || 0).toLocaleString("en-IN")}
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

        <form onSubmit={handleRefund} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {errorMsg && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                fontSize: "0.8rem",
                backgroundColor: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
              }}
            >
              {errorMsg}
            </div>
          )}

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
              Refund Amount (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={payment.amount}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "0.95rem",
                fontFamily: "monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.25rem" }}>
              Original collected amount: ₹{Number(payment.amount).toLocaleString("en-IN")}
            </p>
          </div>

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
              Reason for Refund / Adjustment *
            </label>
            <textarea
              rows="3"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Overpayment adjustment, matter settled, client billing dispute resolution..."
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "0.85rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            ></textarea>
          </div>

          <div
            style={{
              paddingTop: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "0.75rem",
              borderTop: "1px solid #f1f5f9",
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
              type="submit"
              disabled={loading}
              style={{
                padding: "0.65rem 1.25rem",
                color: "#ffffff",
                backgroundColor: "#dc2626",
                fontSize: "0.82rem",
                fontWeight: "700",
                borderRadius: "8px",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
              }}
            >
              {loading ? "Processing..." : "Confirm & Execute Refund"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
