import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import paymentService from "../../services/paymentService";
import paymentGatewayService from "../../services/paymentGatewayService";
import RefundModal from "../../components/payments/RefundModal";
import { IconReceipt, IconDownload, IconCheck, IconClose } from "../../components/common/Icons";

export const PaymentsPage = () => {
  const [activeTab, setActiveTab] = useState("receipts"); // "receipts" | "reconciliation"

  // Receipts state
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modeFilter, setModeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  // Reconciliation state
  const [reconReport, setReconReport] = useState(null);
  const [reconLoading, setReconLoading] = useState(false);

  // Modals & Action states
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState(null);
  const [rejectingPayment, setRejectingPayment] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "receipts") {
      fetchPayments();
    } else {
      fetchReconciliation();
    }
  }, [activeTab, modeFilter, statusFilter]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = {};
      if (modeFilter) params.payment_mode = modeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await paymentService.getPayments(params);
      setPayments(res.data?.items || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const fetchReconciliation = async () => {
    try {
      setReconLoading(true);
      const data = await paymentGatewayService.getReconciliation();
      setReconReport(data);
    } catch (err) {
      alert("Failed to load reconciliation report: " + (err.response?.data?.message || err.message));
    } finally {
      setReconLoading(false);
    }
  };

  const handleDownloadReceipt = async (p) => {
    try {
      setDownloadingId(p.id);
      await paymentService.downloadReceiptPdf(p.id, p.payment_number || p.receipt_number);
    } catch (err) {
      alert("Failed to download receipt: " + (err.message || "Error"));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleVerify = async (p) => {
    if (!window.confirm(`Verify and clear payment ${p.payment_number || p.receipt_number} of ₹${Number(p.amount).toLocaleString("en-IN")}?`)) {
      return;
    }
    try {
      setActionLoading(true);
      await paymentGatewayService.verifyManualPayment(p.id);
      alert("Payment verified and cleared successfully!");
      fetchPayments();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Verification failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }
    try {
      setActionLoading(true);
      await paymentGatewayService.rejectManualPayment(rejectingPayment.id, rejectionReason.trim());
      alert("Payment record marked as rejected.");
      setRejectingPayment(null);
      setRejectionReason("");
      fetchPayments();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Rejection failed");
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = payments.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.payment_number?.toLowerCase().includes(q) ||
      p.receipt_number?.toLowerCase().includes(q) ||
      p.invoice_number?.toLowerCase().includes(q) ||
      p.client_name?.toLowerCase().includes(q) ||
      p.reference_number?.toLowerCase().includes(q)
    );
  });

  const totalCollected = filtered
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const pendingVerificationCount = filtered.filter((p) =>
    ["PENDING_VERIFICATION", "PENDING_CLEARANCE", "PENDING"].includes(p.status)
  ).length;

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: "800", color: "#0f172a" }}>
            Payment Receipts & Gateways
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.95rem" }}>
            Chambers receipts, online gateway transactions, manual UTR verification, and reconciliation.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link
            to="/settings/payment-gateways"
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              backgroundColor: "#f8fafc",
              border: "1px solid #cbd5e1",
              color: "#334155",
              fontWeight: "600",
              fontSize: "0.85rem",
              textDecoration: "none",
            }}
          >
            Gateway Settings
          </Link>
          <Link
            to="/invoices"
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              fontWeight: "600",
              fontSize: "0.85rem",
              textDecoration: "none",
            }}
          >
            View Invoices
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("receipts")}
          style={{
            padding: "10px 18px",
            fontSize: "0.9rem",
            fontWeight: "700",
            cursor: "pointer",
            border: "none",
            backgroundColor: "transparent",
            color: activeTab === "receipts" ? "#2563eb" : "#64748b",
            borderBottom: activeTab === "receipts" ? "2px solid #2563eb" : "2px solid transparent",
          }}
        >
          Payment Receipts Ledger
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reconciliation")}
          style={{
            padding: "10px 18px",
            fontSize: "0.9rem",
            fontWeight: "700",
            cursor: "pointer",
            border: "none",
            backgroundColor: "transparent",
            color: activeTab === "reconciliation" ? "#2563eb" : "#64748b",
            borderBottom: activeTab === "reconciliation" ? "2px solid #2563eb" : "2px solid transparent",
          }}
        >
          Gateway & Bank Reconciliation
        </button>
      </div>

      {activeTab === "receipts" ? (
        <>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "20px" }}>
            <div
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#64748b" }}>TOTAL CLEARED RECEIPTS</div>
                <div style={{ fontSize: "1.75rem", fontWeight: "800", color: "#059669", marginTop: "4px" }}>
                  ₹{totalCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px" }}>
                  From verified transactions
                </div>
              </div>
              <div style={{ padding: "12px", borderRadius: "12px", backgroundColor: "#ecfdf5", color: "#059669" }}>
                <IconReceipt size={28} />
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#64748b" }}>PENDING VERIFICATION</div>
                <div style={{ fontSize: "1.75rem", fontWeight: "800", color: pendingVerificationCount > 0 ? "#d97706" : "#059669", marginTop: "4px" }}>
                  {pendingVerificationCount}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px" }}>
                  Awaiting staff confirmation or cheque clearance
                </div>
              </div>
              <div style={{ padding: "12px", borderRadius: "12px", backgroundColor: "#fef3c7", color: "#d97706" }}>
                <IconCheck size={28} />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "20px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div style={{ flex: "1 1 280px", maxWidth: "400px" }}>
              <input
                type="text"
                placeholder="Search receipt #, invoice #, client, or UTR..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  color: "#0f172a",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  color: "#0f172a",
                  backgroundColor: "#ffffff",
                }}
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">Cleared & Verified</option>
                <option value="PENDING_VERIFICATION">Pending Verification</option>
                <option value="PENDING_CLEARANCE">Pending Cheque Clearance</option>
                <option value="REJECTED">Rejected</option>
                <option value="REFUNDED">Refunded</option>
              </select>

              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  color: "#0f172a",
                  backgroundColor: "#ffffff",
                }}
              >
                <option value="">All Payment Modes</option>
                <option value="RAZORPAY">Razorpay Gateway</option>
                <option value="PAYU">PayU Gateway</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="UPI_MANUAL">UPI Manual Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="DEMAND_DRAFT">Demand Draft</option>
                <option value="CASH">Cash</option>
                <option value="RETAINER_ADJUSTMENT">Retainer Adjustment</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              overflow: "hidden",
            }}
          >
            {loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                Loading payment receipts...
              </div>
            ) : error ? (
              <div style={{ padding: "24px", color: "#b91c1c" }}>{error}</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
                <p style={{ margin: "0 0 8px", fontSize: "1.05rem", fontWeight: "600", color: "#334155" }}>
                  No payments recorded
                </p>
                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                  Payments recorded against invoices will generate official receipts here.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                      <th style={{ padding: "12px 16px", fontWeight: "700" }}>Receipt #</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700" }}>Date</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700" }}>Client</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700" }}>Invoice #</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700" }}>Channel & Mode</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700" }}>Status</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700", textAlign: "right" }}>Amount (₹)</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const isPending = ["PENDING_VERIFICATION", "PENDING_CLEARANCE", "PENDING"].includes(p.status);
                      const isCleared = p.status === "SUCCESS";

                      return (
                        <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "14px 16px" }}>
                            <Link
                              to={`/billing/payments/${p.id}`}
                              style={{ fontWeight: "700", color: "#2563eb", textDecoration: "none" }}
                            >
                              {p.payment_number || p.receipt_number}
                            </Link>
                          </td>

                          <td style={{ padding: "14px 16px", color: "#334155", fontSize: "0.82rem" }}>
                            {p.payment_date}
                          </td>

                          <td style={{ padding: "14px 16px", fontWeight: "600", color: "#0f172a" }}>
                            {p.client_name}
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <Link
                              to={`/invoices/${p.invoice_id}`}
                              style={{ color: "#475569", textDecoration: "none", fontWeight: "600" }}
                            >
                              {p.invoice_number}
                            </Link>
                          </td>

                          <td style={{ padding: "14px 16px", fontSize: "0.82rem" }}>
                            <span
                              style={{
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor: p.provider ? "#eff6ff" : "#f1f5f9",
                                color: p.provider ? "#1d4ed8" : "#334155",
                                fontWeight: "600",
                                marginRight: "6px",
                              }}
                            >
                              {p.provider ? `${p.provider}` : (p.payment_mode || p.payment_method)}
                            </span>
                            {p.reference_number && (
                              <span style={{ color: "#64748b", fontSize: "0.75rem", display: "block", marginTop: "2px" }}>
                                Ref: {p.reference_number}
                              </span>
                            )}
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            {p.status === "SUCCESS" && (
                              <span style={{ padding: "3px 8px", backgroundColor: "#ecfdf5", color: "#059669", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "700" }}>
                                Cleared
                              </span>
                            )}
                            {p.status === "PENDING_VERIFICATION" && (
                              <span style={{ padding: "3px 8px", backgroundColor: "#fef3c7", color: "#d97706", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "700" }}>
                                Verify Pending
                              </span>
                            )}
                            {p.status === "PENDING_CLEARANCE" && (
                              <span style={{ padding: "3px 8px", backgroundColor: "#e0e7ff", color: "#4338ca", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "700" }}>
                                Cheque Clearance
                              </span>
                            )}
                            {p.status === "REJECTED" && (
                              <span style={{ padding: "3px 8px", backgroundColor: "#fee2e2", color: "#dc2626", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "700" }}>
                                Rejected
                              </span>
                            )}
                            {p.status === "REFUNDED" && (
                              <span style={{ padding: "3px 8px", backgroundColor: "#f3e8ff", color: "#7e22ce", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "700" }}>
                                Refunded
                              </span>
                            )}
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: "800", color: "#059669" }}>
                            ₹{parseFloat(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                              <Link
                                to={`/billing/payments/${p.id}`}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  backgroundColor: "#f8fafc",
                                  border: "1px solid #cbd5e1",
                                  color: "#334155",
                                  fontSize: "0.75rem",
                                  fontWeight: "600",
                                  textDecoration: "none",
                                }}
                              >
                                View
                              </Link>

                              <button
                                type="button"
                                onClick={() => handleDownloadReceipt(p)}
                                disabled={downloadingId === p.id}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  backgroundColor: "#f8fafc",
                                  color: "#0f172a",
                                  fontSize: "0.75rem",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                }}
                                title="Download Official PDF Receipt"
                              >
                                {downloadingId === p.id ? "..." : "PDF"}
                              </button>

                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleVerify(p)}
                                    disabled={actionLoading}
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      backgroundColor: "#059669",
                                      color: "#ffffff",
                                      border: "none",
                                      fontSize: "0.75rem",
                                      fontWeight: "700",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Verify
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRejectingPayment(p);
                                      setRejectionReason("");
                                    }}
                                    disabled={actionLoading}
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      backgroundColor: "#fee2e2",
                                      color: "#dc2626",
                                      border: "1px solid #fca5a5",
                                      fontSize: "0.75rem",
                                      fontWeight: "700",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {isCleared && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPaymentForRefund(p)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    backgroundColor: "#f1f5f9",
                                    color: "#475569",
                                    border: "1px solid #cbd5e1",
                                    fontSize: "0.75rem",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                  }}
                                >
                                  Refund
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Gateway & Bank Reconciliation Tab */
        <div style={{ spaceY: "20px" }}>
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "800", color: "#0f172a" }}>
                Payment Gateway & Settlement Reconciliation
              </h2>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                Audit local ledger transactions against gateway settlement records to detect missing webhooks or amount mismatches.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchReconciliation}
              disabled={reconLoading}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontWeight: "700",
                fontSize: "0.85rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              {reconLoading ? "Running Audit..." : "Run Reconcile Audit"}
            </button>
          </div>

          {reconReport && (
            <>
              {/* Recon Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
                <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b" }}>TOTAL EXAMINED</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>
                    {reconReport.summary?.total_examined || 0}
                  </div>
                </div>
                <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#059669" }}>MATCHED TRANSACTIONS</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#059669", marginTop: "4px" }}>
                    {reconReport.summary?.matched_count || 0}
                  </div>
                </div>
                <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#d97706" }}>PENDING CLEARANCE</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#d97706", marginTop: "4px" }}>
                    {reconReport.summary?.pending_count || 0}
                  </div>
                </div>
                <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#dc2626" }}>DISCREPANCIES</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#dc2626", marginTop: "4px" }}>
                    {reconReport.summary?.mismatched_count || 0}
                  </div>
                </div>
              </div>

              {/* Recon Table */}
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                      <th style={{ padding: "10px 14px" }}>Receipt #</th>
                      <th style={{ padding: "10px 14px" }}>Order / Ref</th>
                      <th style={{ padding: "10px 14px" }}>Provider</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Ledger Amount</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Gateway Amount</th>
                      <th style={{ padding: "10px 14px" }}>Audit Status</th>
                      <th style={{ padding: "10px 14px" }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reconReport.items || []).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 14px", fontWeight: "700" }}>{item.receipt_number || `TX-${item.id}`}</td>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: "0.8rem" }}>{item.order_id || item.reference_number || "—"}</td>
                        <td style={{ padding: "10px 14px" }}>{item.provider || "MANUAL"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: "700" }}>₹{Number(item.ledger_amount || item.amount).toLocaleString("en-IN")}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: "700" }}>₹{Number(item.gateway_amount || item.amount).toLocaleString("en-IN")}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: "700",
                              backgroundColor: item.reconciliation_status === "MATCHED" ? "#ecfdf5" : "#fee2e2",
                              color: item.reconciliation_status === "MATCHED" ? "#059669" : "#dc2626",
                            }}
                          >
                            {item.reconciliation_status || "MATCHED"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#64748b", fontSize: "0.8rem" }}>
                          {item.reconciliation_notes || "Clean cryptographic match"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingPayment && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)", padding: "16px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", width: "100%", maxWidth: "440px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
            <div style={{ padding: "16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "700", color: "#dc2626" }}>Reject Payment Record</h3>
              <button onClick={() => setRejectingPayment(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleReject} style={{ padding: "16px" }}>
              <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#475569" }}>
                Reject receipt {rejectingPayment.payment_number || rejectingPayment.receipt_number} for ₹{Number(rejectingPayment.amount).toLocaleString("en-IN")}.
              </p>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                Reason for Rejection *
              </label>
              <textarea
                required
                rows="3"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Bank statement does not reflect UTR, cheque dishonoured..."
                style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.85rem", boxSizing: "border-box" }}
              ></textarea>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setRejectingPayment(null)}
                  disabled={actionLoading}
                  style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", cursor: "pointer", fontSize: "0.85rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{ padding: "6px 14px", borderRadius: "6px", border: "none", backgroundColor: "#dc2626", color: "#ffffff", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem" }}
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
        payment={selectedPaymentForRefund}
        isOpen={!!selectedPaymentForRefund}
        onClose={() => setSelectedPaymentForRefund(null)}
        onSuccess={() => {
          alert("Refund processed successfully!");
          fetchPayments();
        }}
      />
    </div>
  );
};

export default PaymentsPage;
