import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import paymentGatewayService from "../../services/paymentGatewayService";
import paymentService from "../../services/paymentService";
import PaymentTimeline from "../../components/payments/PaymentTimeline";
import RefundModal from "../../components/payments/RefundModal";
import { IconReceipt, IconDownload, IconCheck, IconClose } from "../../components/common/Icons";

export const PaymentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals & Action states
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchPayment();
  }, [id]);

  const fetchPayment = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await paymentGatewayService.getPaymentById(id);
      setPayment(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load payment details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!payment) return;
    try {
      setDownloadingPdf(true);
      await paymentService.downloadReceiptPdf(payment.id, payment.receipt_number || payment.payment_number);
    } catch (err) {
      alert("Failed to download receipt: " + (err.message || "Error"));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!window.confirm("Verify and clear this payment? This will update invoice allocation and issue an official receipt.")) {
      return;
    }
    try {
      setActionLoading(true);
      await paymentGatewayService.verifyManualPayment(payment.id);
      alert("Payment verified and cleared successfully!");
      fetchPayment();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to verify payment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPayment = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejecting the payment.");
      return;
    }
    try {
      setActionLoading(true);
      await paymentGatewayService.rejectManualPayment(payment.id, rejectionReason.trim());
      alert("Payment has been marked as rejected.");
      setShowRejectModal(false);
      fetchPayment();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to reject payment");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
        Loading payment transaction details...
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div style={{ maxWidth: "1000px", margin: "2rem auto", padding: "0 1rem" }}>
        <div
          style={{
            padding: "1rem 1.25rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            borderRadius: "12px",
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}
        >
          {error || "Payment record not found."}
        </div>
        <Link
          to="/billing/payments"
          style={{ fontSize: "0.85rem", fontWeight: "700", color: "#2563eb", textDecoration: "none" }}
        >
          &larr; Back to Payment Receipts
        </Link>
      </div>
    );
  }

  const isPendingVerification = ["PENDING", "PENDING_VERIFICATION", "PENDING_CLEARANCE", "INITIATED"].includes(payment.status);
  const isSuccess = payment.status === "SUCCESS";

  const renderBadge = (status) => {
    const map = {
      SUCCESS: { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0", label: "Cleared & Verified" },
      PENDING_VERIFICATION: { bg: "#fef3c7", color: "#b45309", border: "#fde68a", label: "Pending Chambers Verification" },
      PENDING_CLEARANCE: { bg: "#e0e7ff", color: "#4338ca", border: "#c7d2fe", label: "Pending Cheque Clearance" },
      REJECTED: { bg: "#fee2e2", color: "#b91c1c", border: "#fecaca", label: "Verification Rejected" },
      REFUNDED: { bg: "#f3e8ff", color: "#7e22ce", border: "#e9d5ff", label: "Fully Refunded" },
      PARTIALLY_REFUNDED: { bg: "#faf5ff", color: "#6b21a8", border: "#f3e8ff", label: "Partially Refunded" },
    };
    const s = map[status] || { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", label: status };
    return (
      <span
        style={{
          padding: "4px 12px",
          backgroundColor: s.bg,
          color: s.color,
          border: `1px solid ${s.border}`,
          borderRadius: "20px",
          fontSize: "0.72rem",
          fontWeight: "800",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          display: "inline-block",
        }}
      >
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Top Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <Link
          to="/billing/payments"
          style={{ fontSize: "0.82rem", fontWeight: "700", color: "#64748b", textDecoration: "none" }}
        >
          &larr; Back to Payment Receipts
        </Link>
        {payment.invoice_id && (
          <Link
            to={`/invoices/${payment.invoice_id}`}
            style={{
              fontSize: "0.78rem",
              fontWeight: "700",
              color: "#2563eb",
              backgroundColor: "#eff6ff",
              padding: "0.4rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid #bfdbfe",
              textDecoration: "none",
            }}
          >
            View Invoice #{payment.invoice_number}
          </Link>
        )}
      </div>

      {/* Main Header Banner */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          padding: "1.5rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.6rem", fontWeight: "900", color: "#0f172a", margin: 0 }}>
              Receipt #{payment.receipt_number || payment.payment_number}
            </h1>
            {renderBadge(payment.status)}
          </div>
          <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0.4rem 0 0 0" }}>
            Recorded on {payment.payment_date || new Date(payment.created_at).toLocaleDateString("en-IN")} • Client:{" "}
            <strong style={{ color: "#1e293b" }}>{payment.client_name}</strong> ({payment.client_code || "Client"})
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleDownloadReceipt}
            disabled={downloadingPdf}
            style={{
              padding: "0.6rem 1.1rem",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              borderRadius: "10px",
              fontSize: "0.78rem",
              fontWeight: "700",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            <IconDownload size={14} />
            {downloadingPdf ? "Generating..." : "Download Official PDF"}
          </button>

          {isPendingVerification && (
            <>
              <button
                type="button"
                onClick={handleVerifyPayment}
                disabled={actionLoading}
                style={{
                  padding: "0.6rem 1.1rem",
                  backgroundColor: "#059669",
                  color: "#ffffff",
                  borderRadius: "10px",
                  fontSize: "0.78rem",
                  fontWeight: "700",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <IconCheck size={14} />
                Verify & Clear
              </button>
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                style={{
                  padding: "0.6rem 1rem",
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  borderRadius: "10px",
                  fontSize: "0.78rem",
                  fontWeight: "700",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <IconClose size={14} />
                Reject
              </button>
            </>
          )}

          {isSuccess && (
            <button
              type="button"
              onClick={() => setShowRefundModal(true)}
              style={{
                padding: "0.6rem 1.1rem",
                backgroundColor: "#f1f5f9",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                fontSize: "0.78rem",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Issue Refund
            </button>
          )}
        </div>
      </div>

      {/* Audit Timeline */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          padding: "1.5rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
      >
        <h2 style={{ fontSize: "0.75rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", margin: "0 0 0.75rem 0" }}>
          Audit Lifecycle Timeline
        </h2>
        <PaymentTimeline payment={payment} />
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1rem",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            padding: "1.25rem",
          }}
        >
          <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Amount Paid
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#059669", marginTop: "0.25rem" }}>
            ₹{Number(payment.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            Channel: <strong style={{ color: "#334155" }}>{payment.payment_type || "OFFLINE"}</strong>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            padding: "1.25rem",
          }}
        >
          <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Payment Method
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: "800", color: "#1e293b", marginTop: "0.35rem" }}>
            {payment.payment_mode || payment.payment_method || "N/A"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            Provider: <strong style={{ color: "#334155" }}>{payment.provider || "Direct / Bank"}</strong>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            padding: "1.25rem",
          }}
        >
          <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Reference / UTR
          </div>
          <div
            style={{
              fontSize: "0.95rem",
              fontFamily: "monospace",
              fontWeight: "700",
              color: "#1e293b",
              marginTop: "0.5rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {payment.reference_number || payment.provider_payment_id || "None / Cash"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            Bank: {payment.bank_name ? `${payment.bank_name} (${payment.branch_name || "Main"})` : "Direct Account"}
          </div>
        </div>
      </div>

      {/* Gateway Details or Offline Verification Card */}
      {payment.gatewayTransaction ? (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            padding: "1.5rem",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div
            style={{
              borderBottom: "1px solid #f1f5f9",
              paddingBottom: "0.75rem",
              marginBottom: "1rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ fontSize: "0.95rem", fontWeight: "800", color: "#0f172a", margin: 0 }}>
              Cryptographic Gateway Transaction Log
            </h2>
            <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#64748b" }}>
              Provider: {payment.gatewayTransaction.provider}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1.25rem",
              fontSize: "0.8rem",
            }}
          >
            <div>
              <span style={{ color: "#64748b", display: "block", marginBottom: "0.2rem" }}>Gateway Order ID</span>
              <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#1e293b" }}>
                {payment.gatewayTransaction.order_id || "N/A"}
              </span>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block", marginBottom: "0.2rem" }}>Gateway Payment ID</span>
              <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#1e293b" }}>
                {payment.gatewayTransaction.gateway_payment_id || "N/A"}
              </span>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block", marginBottom: "0.2rem" }}>HMAC Signature Verification</span>
              <span
                style={{
                  display: "inline-block",
                  fontWeight: "700",
                  color: "#065f46",
                  backgroundColor: "#ecfdf5",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "6px",
                  border: "1px solid #a7f3d0",
                }}
              >
                ✓ Cryptographically Verified
              </span>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block", marginBottom: "0.2rem" }}>Gateway Timestamp</span>
              <span style={{ fontFamily: "monospace", color: "#334155" }}>
                {new Date(payment.gatewayTransaction.created_at).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            padding: "1.5rem",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          <h2 style={{ fontSize: "0.95rem", fontWeight: "800", color: "#0f172a", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
            Manual / Offline Verification Audit
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1.25rem",
              fontSize: "0.8rem",
            }}
          >
            <div>
              <span style={{ color: "#64748b", display: "block", marginBottom: "0.2rem" }}>Verified By</span>
              <span style={{ fontWeight: "700", color: "#1e293b" }}>
                {payment.verifier_first_name ? `${payment.verifier_first_name} ${payment.verifier_last_name || ""}` : (payment.verified_by ? `Staff ID #${payment.verified_by}` : "Pending Verification")}
              </span>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block", marginBottom: "0.2rem" }}>Verification Timestamp</span>
              <span style={{ color: "#334155" }}>
                {payment.verified_at ? new Date(payment.verified_at).toLocaleString("en-IN") : "—"}
              </span>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block", marginBottom: "0.2rem" }}>Cheque / Instrument Date</span>
              <span style={{ color: "#334155" }}>
                {payment.cheque_date || "N/A"}
              </span>
            </div>
          </div>
          {payment.rejection_reason && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                backgroundColor: "#fef2f2",
                color: "#991b1b",
                fontSize: "0.8rem",
                borderRadius: "8px",
                border: "1px solid #fecaca",
              }}
            >
              <strong>Rejection Reason:</strong> {payment.rejection_reason}
            </div>
          )}
        </div>
      )}

      {/* Refunds History Table */}
      {payment.refunds && payment.refunds.length > 0 && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            padding: "1.5rem",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          <h2 style={{ fontSize: "0.95rem", fontWeight: "800", color: "#0f172a", marginBottom: "1rem" }}>
            Refunds & Adjustments History
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", textAlign: "left", fontSize: "0.8rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                  <th style={{ padding: "0.75rem" }}>Refund ID</th>
                  <th style={{ padding: "0.75rem" }}>Amount (₹)</th>
                  <th style={{ padding: "0.75rem" }}>Reason</th>
                  <th style={{ padding: "0.75rem" }}>Gateway Refund Ref</th>
                  <th style={{ padding: "0.75rem" }}>Date</th>
                  <th style={{ padding: "0.75rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {payment.refunds.map((ref) => (
                  <tr key={ref.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.75rem", fontFamily: "monospace", fontWeight: "700" }}>#{ref.id}</td>
                    <td style={{ padding: "0.75rem", fontWeight: "800", color: "#7e22ce" }}>
                      ₹{Number(ref.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "0.75rem", color: "#334155" }}>{ref.reason}</td>
                    <td style={{ padding: "0.75rem", fontFamily: "monospace", color: "#64748b" }}>
                      {ref.gateway_refund_id || "Manual Adjustment"}
                    </td>
                    <td style={{ padding: "0.75rem", color: "#475569" }}>{new Date(ref.created_at).toLocaleDateString("en-IN")}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <span
                        style={{
                          padding: "2px 6px",
                          backgroundColor: "#f3e8ff",
                          color: "#7e22ce",
                          borderRadius: "4px",
                          fontWeight: "700",
                          fontSize: "0.7rem",
                        }}
                      >
                        {ref.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(3px)",
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              maxWidth: "460px",
              width: "100%",
              overflow: "hidden",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid #fee2e2",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#fef2f2",
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: "800", color: "#991b1b", margin: 0 }}>
                Reject Payment Record
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRejectPayment} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.82rem" }}>
              <p style={{ color: "#475569", margin: 0 }}>
                Rejecting this payment will revert any pending invoice allocations and mark the receipt as unverified.
              </p>
              <div>
                <label style={{ display: "block", fontWeight: "700", color: "#334155", marginBottom: "0.35rem" }}>
                  Reason for Rejection *
                </label>
                <textarea
                  rows="3"
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. UTR not reflected in bank statement, cheque bounced, insufficient funds..."
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                ></textarea>
              </div>
              <div style={{ paddingTop: "0.5rem", display: "flex", justifyContent: "flex-end", gap: "0.75rem", borderTop: "1px solid #f1f5f9" }}>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  disabled={actionLoading}
                  style={{
                    padding: "0.6rem 1rem",
                    color: "#64748b",
                    backgroundColor: "transparent",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: "0.65rem 1.25rem",
                    backgroundColor: "#dc2626",
                    color: "#ffffff",
                    borderRadius: "8px",
                    border: "none",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  {actionLoading ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      <RefundModal
        payment={payment}
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        onSuccess={() => {
          alert("Refund processed successfully!");
          fetchPayment();
        }}
      />
    </div>
  );
};

export default PaymentDetailPage;
