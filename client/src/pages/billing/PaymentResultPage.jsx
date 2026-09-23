import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import paymentGatewayService from "../../services/paymentGatewayService";
import invoiceService from "../../services/invoiceService";

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const paymentId = searchParams.get("payment_id");
  const invoiceId = searchParams.get("invoice_id");
  const statusParam = searchParams.get("status") || "pending";

  const [payment, setPayment] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuthoritativeStatus();
  }, [paymentId, invoiceId]);

  const loadAuthoritativeStatus = async () => {
    try {
      setLoading(true);
      if (paymentId) {
        const pay = await paymentGatewayService.getPaymentById(paymentId);
        setPayment(pay);
      }
      if (invoiceId) {
        const invRes = await invoiceService.getInvoiceById(invoiceId);
        setInvoice(invRes?.data || invRes);
      }
    } catch (err) {
      console.warn("Status inquiry error:", err);
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = payment?.status === "SUCCESS" || statusParam.toLowerCase() === "success";
  const isPending =
    payment?.status === "PENDING_VERIFICATION" ||
    payment?.status === "PENDING_CLEARANCE" ||
    payment?.status === "PENDING";
  const isFailed = payment?.status === "FAILED" || payment?.status === "REJECTED";

  return (
    <div
      style={{
        maxWidth: "580px",
        margin: "2rem auto",
        padding: "1.5rem 1rem",
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
          padding: "2rem 1.5rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {isSuccess && (
          <>
            <div
              style={{
                width: "64px",
                height: "64px",
                backgroundColor: "#ecfdf5",
                color: "#059669",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                fontWeight: "900",
                margin: "0 auto",
              }}
            >
              ✓
            </div>
            <div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: "900", color: "#0f172a", margin: 0 }}>
                Payment Successfully Received
              </h1>
              <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.35rem" }}>
                Your payment has been cryptographically verified and allocated to chambers records.
              </p>
            </div>

            {payment && (
              <div
                style={{
                  padding: "1rem 1.25rem",
                  backgroundColor: "#f8fafc",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.82rem",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Official Receipt:</span>
                  <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#0f172a" }}>
                    {payment.receipt_number || payment.payment_number}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Amount Paid:</span>
                  <span style={{ fontFamily: "monospace", fontWeight: "800", color: "#047857" }}>
                    ₹{Number(payment.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Payment Channel:</span>
                  <span style={{ fontWeight: "600", color: "#334155" }}>
                    {payment.provider || payment.payment_mode || payment.payment_method}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Payment Date:</span>
                  <span style={{ color: "#334155" }}>{payment.payment_date}</span>
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                justifyContent: "center",
                paddingTop: "0.5rem",
              }}
            >
              {payment?.id && (
                <button
                  type="button"
                  onClick={() => window.open(`/api/v1/payments/${payment.id}/receipt`, "_blank")}
                  style={{
                    padding: "0.75rem 1.4rem",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    fontWeight: "700",
                    borderRadius: "10px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                  }}
                >
                  📄 Download Payment Receipt PDF
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate("/billing/invoices")}
                style={{
                  padding: "0.75rem 1.25rem",
                  backgroundColor: "#f1f5f9",
                  color: "#334155",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  cursor: "pointer",
                }}
              >
                Return to Invoices
              </button>
            </div>
          </>
        )}

        {isPending && (
          <>
            <div
              style={{
                width: "64px",
                height: "64px",
                backgroundColor: "#fef3c7",
                color: "#b45309",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                fontWeight: "900",
                margin: "0 auto",
              }}
            >
              ⏳
            </div>
            <div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: "900", color: "#0f172a", margin: 0 }}>
                Payment Recorded & Pending Clearance
              </h1>
              <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.35rem" }}>
                Your transfer reference has been registered. Official receipt will be released upon chambers verification.
              </p>
            </div>

            <div style={{ paddingTop: "0.5rem" }}>
              <button
                type="button"
                onClick={() => navigate("/billing/invoices")}
                style={{
                  padding: "0.75rem 1.4rem",
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Return to Invoices
              </button>
            </div>
          </>
        )}

        {isFailed && (
          <>
            <div
              style={{
                width: "64px",
                height: "64px",
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                fontWeight: "900",
                margin: "0 auto",
              }}
            >
              ✗
            </div>
            <div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: "900", color: "#0f172a", margin: 0 }}>
                Payment Unsuccessful
              </h1>
              <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.35rem" }}>
                The transaction could not be verified or was declined by your bank. Your invoice balance remains unchanged.
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap", paddingTop: "0.5rem" }}>
              {invoiceId && (
                <Link
                  to={`/billing/pay/${invoiceId}`}
                  style={{
                    padding: "0.75rem 1.4rem",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    fontWeight: "700",
                    borderRadius: "10px",
                    textDecoration: "none",
                  }}
                >
                  Retry Payment
                </Link>
              )}
              <button
                type="button"
                onClick={() => navigate("/billing/invoices")}
                style={{
                  padding: "0.75rem 1.25rem",
                  backgroundColor: "#f1f5f9",
                  color: "#334155",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
