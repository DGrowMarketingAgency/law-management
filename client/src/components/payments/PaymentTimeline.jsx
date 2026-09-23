import React from "react";

export default function PaymentTimeline({ payment }) {
  if (!payment) return null;

  const isSuccess = payment.status === "SUCCESS";
  const isPending = ["PENDING", "PENDING_VERIFICATION", "PENDING_CLEARANCE", "INITIATED"].includes(payment.status);
  const isFailed = ["FAILED", "REJECTED", "CANCELLED"].includes(payment.status);
  const isRefunded = payment.status === "REFUNDED";

  const steps = [
    {
      title: "1. Payment Initiated",
      desc: payment.payment_date || new Date(payment.created_at).toISOString().slice(0, 10),
      active: true,
      completed: true,
      icon: "✓",
    },
    {
      title: payment.payment_type === "ONLINE_GATEWAY" ? `2. ${payment.provider || "Gateway"} Processing` : "2. Transfer Reference Recorded",
      desc: payment.reference_number || payment.provider_payment_id || "UTR / Reference pending",
      active: true,
      completed: isSuccess || isRefunded,
      failed: isFailed,
      icon: isFailed ? "✗" : isSuccess || isRefunded ? "✓" : "⏳",
    },
    {
      title: payment.payment_type === "ONLINE_GATEWAY" ? "3. Gateway Cryptographic Verification" : "3. Chambers Staff Verification",
      desc: payment.verified_at ? `Verified: ${new Date(payment.verified_at).toLocaleDateString()}` : isFailed ? (payment.rejection_reason || "Verification rejected") : "Awaiting verification",
      active: isSuccess || isFailed || isRefunded,
      completed: isSuccess || isRefunded,
      failed: isFailed,
      icon: isFailed ? "✗" : isSuccess || isRefunded ? "✓" : "⏳",
    },
    {
      title: isRefunded ? "4. Payment Refunded / Reversed" : "4. Receipt Generated & Ledger Allocated",
      desc: isRefunded ? `Reason: ${payment.refund_reason || "Refund processed"}` : payment.receipt_number ? `Receipt #${payment.receipt_number}` : "Pending receipt",
      active: isSuccess || isRefunded,
      completed: isSuccess || isRefunded,
      icon: isRefunded ? "↩" : "✓",
    },
  ];

  const getCircleStyle = (step) => {
    const base = {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "700",
      fontSize: "0.8rem",
      flexShrink: 0,
      margin: "0 auto",
    };

    if (step.failed) {
      return { ...base, backgroundColor: "#fee2e2", color: "#b91c1c", border: "2px solid #f87171" };
    }
    if (step.completed) {
      return { ...base, backgroundColor: "#ecfdf5", color: "#047857", border: "2px solid #10b981" };
    }
    if (step.active) {
      return { ...base, backgroundColor: "#fef3c7", color: "#b45309", border: "2px solid #fbbf24" };
    }
    return { ...base, backgroundColor: "#f1f5f9", color: "#94a3b8", border: "2px solid #cbd5e1" };
  };

  return (
    <div style={{ padding: "1rem 0" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {steps.map((step, idx) => (
          <div key={idx} style={{ textAlign: "center" }}>
            <div style={getCircleStyle(step)}>{step.icon}</div>
            <div style={{ marginTop: "0.5rem" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: "700", color: "#1e293b" }}>{step.title}</div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#64748b",
                  marginTop: "0.2rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "normal",
                  maxWidth: "180px",
                  margin: "0.2rem auto 0 auto",
                }}
              >
                {step.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
