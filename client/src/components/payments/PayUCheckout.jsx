import React, { useState } from "react";
import paymentGatewayService from "../../services/paymentGatewayService";

export default function PayUCheckout({
  invoice,
  amount,
  onError,
}) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handlePay = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const currentOrigin = window.location.origin;
      const returnUrl = `${currentOrigin}/billing/payment-result`;
      const failureUrl = `${currentOrigin}/billing/payment-result`;

      const order = await paymentGatewayService.createPayUOrder(
        invoice.id,
        amount,
        returnUrl,
        failureUrl
      );

      // Create a hidden form and post directly to PayU
      const form = document.createElement("form");
      form.method = "POST";
      form.action = order.actionUrl || "https://test.payu.in/_payment";

      Object.entries(order.params || {}).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Could not initiate PayU checkout.";
      setErrorMsg(msg);
      setLoading(false);
      if (onError) onError(msg);
    }
  };

  const numAmount = parseFloat(amount) || 0;

  return (
    <div style={{ textAlign: "center" }}>
      {errorMsg && (
        <div style={{
          marginBottom: "16px",
          padding: "12px 16px",
          backgroundColor: "#fef2f2",
          color: "#b91c1c",
          fontSize: "0.85rem",
          borderRadius: "8px",
          border: "1px solid #fecaca",
          textAlign: "left"
        }}>
          {errorMsg}
        </div>
      )}

      <div style={{ marginBottom: "16px", fontSize: "0.85rem", color: "#64748b" }}>
        🔒 256-bit Encrypted Cryptographic Checkout • Redirecting to PayU Secure Gateway
      </div>

      <button
        type="button"
        onClick={handlePay}
        disabled={loading || numAmount <= 0}
        style={{
          width: "100%",
          padding: "14px 24px",
          backgroundColor: loading || numAmount <= 0 ? "#94a3b8" : "#059669",
          color: "#ffffff",
          fontWeight: "800",
          borderRadius: "12px",
          fontSize: "1rem",
          border: "none",
          cursor: loading || numAmount <= 0 ? "not-allowed" : "pointer",
          boxShadow: "0 4px 12px rgba(5, 150, 105, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          transition: "background-color 0.2s"
        }}
      >
        {loading ? (
          <span>Connecting to PayU India...</span>
        ) : (
          <span>🔒 Proceed to Pay ₹{numAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} with PayU</span>
        )}
      </button>
    </div>
  );
}
