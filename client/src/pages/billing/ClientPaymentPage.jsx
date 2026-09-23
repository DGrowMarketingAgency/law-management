import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import invoiceService from "../../services/invoiceService";
import paymentSettingsService from "../../services/paymentSettingsService";
import PaymentMethodSelector from "../../components/payments/PaymentMethodSelector";
import RazorpayCheckout from "../../components/payments/RazorpayCheckout";
import PayUCheckout from "../../components/payments/PayUCheckout";
import ManualPaymentForm from "../../components/payments/ManualPaymentForm";

export default function ClientPaymentPage() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState("RAZORPAY");
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadData();
  }, [invoiceId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      // Execute in parallel
      const [invRes, sett] = await Promise.all([
        invoiceService.getInvoiceById(invoiceId),
        paymentSettingsService.getSettings().catch(() => null),
      ]);

      // Handle both { data: { ... } } and direct object
      const actualInvoice = invRes?.data || invRes;
      if (!actualInvoice || !actualInvoice.id) {
        throw new Error("Invoice record not found.");
      }

      setInvoice(actualInvoice);
      setSettings(sett);
      setCustomAmount(actualInvoice.amount_due || "0");

      // Default to first enabled method
      if (sett?.gateway_config?.primaryGateway) {
        setSelectedMethod(sett.gateway_config.primaryGateway);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || "Failed to load invoice details.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (paymentResult) => {
    navigate(`/billing/payment-result?status=success&payment_id=${paymentResult?.id || ""}&invoice_id=${invoice?.id || invoiceId}`);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", color: "#64748b" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "32px",
            height: "32px",
            border: "3px solid #2563eb",
            borderTopColor: "transparent",
            borderRadius: "50%",
            margin: "0 auto 12px",
            animation: "spin 0.8s linear infinite"
          }}></div>
          <p style={{ margin: 0, fontWeight: "600", fontSize: "0.95rem" }}>Loading secure checkout session...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !invoice) {
    return (
      <div style={{ maxWidth: "560px", margin: "40px auto", padding: "16px" }}>
        <div style={{
          backgroundColor: "#ffffff",
          border: "1px solid #fca5a5",
          borderRadius: "16px",
          padding: "32px 24px",
          textAlign: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
        }}>
          <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "12px" }}>⚠️</span>
          <h2 style={{ margin: "0 0 8px", fontSize: "1.25rem", fontWeight: "800", color: "#0f172a" }}>Payment Notice</h2>
          <p style={{ margin: "0 0 20px", fontSize: "0.9rem", color: "#64748b" }}>
            {errorMsg || "Invoice not found or no longer payable."}
          </p>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              borderRadius: "8px",
              border: "none",
              fontWeight: "600",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const enabledGateways = {
    razorpay: settings?.gateway_config?.razorpayEnabled ?? true,
    payu: settings?.gateway_config?.payuEnabled ?? true,
  };

  const dueAmount = parseFloat(invoice.amount_due) || 0;
  const isPaid = dueAmount <= 0;

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "24px 16px" }}>
      {/* Top Banner Header */}
      <div style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "24px",
        marginBottom: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px"
      }}>
        <div style={{ flex: "1 1 300px" }}>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: "800",
            color: "#2563eb",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            display: "inline-block",
            marginBottom: "4px"
          }}>
            Chambers Client Portal
          </span>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: "900", color: "#0f172a" }}>
            Secure Legal Fee Payment
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "#64748b" }}>
            Invoice #{invoice.invoice_number} • Billed to <strong style={{ color: "#1e293b" }}>{invoice.billing_name || invoice.client_name || "Client"}</strong>
          </p>
        </div>

        <div style={{
          backgroundColor: isPaid ? "#ecfdf5" : "#f8fafc",
          border: isPaid ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "16px 20px",
          textAlign: "right",
          minWidth: "160px"
        }}>
          <div style={{ fontSize: "0.75rem", fontWeight: "700", color: isPaid ? "#059669" : "#64748b", textTransform: "uppercase" }}>
            {isPaid ? "Invoice Status" : "Amount Due"}
          </div>
          <div style={{
            fontSize: "1.75rem",
            fontWeight: "900",
            color: isPaid ? "#059669" : "#0f172a",
            marginTop: "2px",
            fontFamily: "monospace"
          }}>
            {isPaid ? "PAID IN FULL" : `₹${dueAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          </div>
        </div>
      </div>

      {isPaid ? (
        <div style={{
          backgroundColor: "#ffffff",
          border: "1px solid #a7f3d0",
          borderRadius: "16px",
          padding: "32px",
          textAlign: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
        }}>
          <span style={{ fontSize: "2.5rem" }}>✅</span>
          <h2 style={{ margin: "12px 0 6px", fontSize: "1.25rem", fontWeight: "800", color: "#065f46" }}>
            This invoice is completely settled
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "#64748b" }}>
            No balance is outstanding. Official payment receipts are available in your account ledger.
          </p>
          <Link
            to={`/invoices/${invoice.id}`}
            style={{
              padding: "10px 20px",
              backgroundColor: "#059669",
              color: "#ffffff",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "700",
              fontSize: "0.85rem",
              display: "inline-block"
            }}
          >
            View Invoice Details
          </Link>
        </div>
      ) : (
        /* Payment Options Box */
        <div style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
        }}>
          <PaymentMethodSelector
            selectedMethod={selectedMethod}
            onSelectMethod={setSelectedMethod}
            enabledGateways={enabledGateways}
            firmInstructions={settings?.bank_instructions}
          />

          <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #e2e8f0" }}>
            {selectedMethod === "RAZORPAY" && (
              <RazorpayCheckout
                invoice={invoice}
                amount={customAmount}
                onSuccess={handlePaymentSuccess}
                onError={(err) => alert(err)}
              />
            )}

            {selectedMethod === "PAYU" && (
              <PayUCheckout
                invoice={invoice}
                amount={customAmount}
                onError={(err) => alert(err)}
              />
            )}

            {["BANK_TRANSFER", "UPI_MANUAL", "CHEQUE", "CASH"].includes(selectedMethod) && (
              <ManualPaymentForm
                invoice={invoice}
                selectedMethod={selectedMethod}
                defaultAmount={customAmount}
                onSuccess={handlePaymentSuccess}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
