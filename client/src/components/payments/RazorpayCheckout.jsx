import React, { useState } from "react";
import paymentGatewayService from "../../services/paymentGatewayService";

export default function RazorpayCheckout({
  invoice,
  amount,
  onSuccess,
  onCancel,
  onError,
}) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        return resolve(true);
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePay = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      // 1. Create order on backend
      const order = await paymentGatewayService.createRazorpayOrder(invoice.id, amount);

      // 2. Load script if not loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error("Could not load Razorpay checkout gateway. Please check your connection.");
      }

      // 3. Configure checkout options
      const options = {
        key: order.keyId,
        amount: Math.round(order.amount * 100),
        currency: order.currency || "INR",
        name: "Advocate's Chambers Legal Practice",
        description: `Fee Payment for Invoice #${invoice.invoice_number}`,
        order_id: order.orderId,
        prefill: {
          name: invoice.billing_name || "",
          email: invoice.billing_email || "",
          contact: invoice.billing_phone || "",
        },
        theme: {
          color: "#0f172a",
        },
        handler: async (response) => {
          try {
            // 4. Send response to backend for authoritative HMAC verification
            const verifyResult = await paymentGatewayService.verifyRazorpayPayment({
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              invoice_id: invoice.id,
            });

            if (onSuccess) {
              onSuccess(verifyResult);
            }
          } catch (verifyErr) {
            const msg = verifyErr.response?.data?.message || verifyErr.message || "Payment verification failed on server.";
            setErrorMsg(msg);
            if (onError) onError(msg);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            if (onCancel) onCancel();
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        const failureReason = response.error?.description || "Payment failed at gateway.";
        setErrorMsg(failureReason);
        setLoading(false);
        if (onError) onError(failureReason);
      });
      rzp.open();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Could not initiate payment.";
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
        🔒 256-bit Encrypted Cryptographic Checkout • Cards, UPI, NetBanking, QR
      </div>

      <button
        type="button"
        onClick={handlePay}
        disabled={loading || numAmount <= 0}
        style={{
          width: "100%",
          padding: "14px 24px",
          backgroundColor: loading || numAmount <= 0 ? "#94a3b8" : "#0f172a",
          color: "#ffffff",
          fontWeight: "800",
          borderRadius: "12px",
          fontSize: "1rem",
          border: "none",
          cursor: loading || numAmount <= 0 ? "not-allowed" : "pointer",
          boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          transition: "background-color 0.2s"
        }}
      >
        {loading ? (
          <span>Connecting to Razorpay Gateway...</span>
        ) : (
          <span>🔒 Pay ₹{numAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} with Razorpay</span>
        )}
      </button>
    </div>
  );
}
