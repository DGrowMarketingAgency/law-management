import React from "react";

export default function PaymentMethodSelector({
  selectedMethod,
  onSelectMethod,
  enabledGateways = { razorpay: true, payu: true },
  firmInstructions = null,
}) {
  const onlineOptions = [
    {
      id: "RAZORPAY",
      name: "Razorpay Gateway",
      desc: "UPI, Cards, NetBanking, QR & Wallets",
      enabled: enabledGateways.razorpay,
      badge: "Instant Clearance",
      badgeBg: "#eff6ff",
      badgeColor: "#1d4ed8",
      badgeBorder: "#bfdbfe",
    },
    {
      id: "PAYU",
      name: "PayU India",
      desc: "Cards, NetBanking, UPI, EMI options",
      enabled: enabledGateways.payu,
      badge: "Instant Clearance",
      badgeBg: "#ecfdf5",
      badgeColor: "#047857",
      badgeBorder: "#a7f3d0",
    },
  ].filter((o) => o.enabled);

  const manualOptions = [
    {
      id: "BANK_TRANSFER",
      name: "Direct Bank Transfer (NEFT / RTGS / IMPS)",
      desc: "Direct transfer to Chambers Client Trust Account",
      badge: "Staff Verification",
      badgeBg: "#fffbeb",
      badgeColor: "#b45309",
      badgeBorder: "#fde68a",
    },
    {
      id: "UPI_MANUAL",
      name: "Direct UPI Transfer",
      desc: "Transfer using chambers official VPA / QR code",
      badge: "Staff Verification",
      badgeBg: "#f5f3ff",
      badgeColor: "#6d28d9",
      badgeBorder: "#ddd6fe",
    },
    {
      id: "CHEQUE",
      name: "Cheque / Demand Draft",
      desc: "Physical cheque submission requiring bank clearance",
      badge: "Clearance Required",
      badgeBg: "#f1f5f9",
      badgeColor: "#475569",
      badgeBorder: "#cbd5e1",
    },
    {
      id: "CASH",
      name: "Cash in Chambers",
      desc: "In-person cash payment at Chambers Reception Desk",
      badge: "In-Person",
      badgeBg: "#f1f5f9",
      badgeColor: "#475569",
      badgeBorder: "#cbd5e1",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Online Payment Gateways */}
      {onlineOptions.length > 0 && (
        <div>
          <div style={{
            fontSize: "0.75rem",
            fontWeight: "800",
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "12px"
          }}>
            ⚡ Secure Online Payment Gateways
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "12px"
          }}>
            {onlineOptions.map((opt) => {
              const isSelected = selectedMethod === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => onSelectMethod(opt.id)}
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                    backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: isSelected ? "0 2px 6px rgba(37,99,235,0.12)" : "0 1px 3px rgba(0,0,0,0.03)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: "700", color: "#0f172a", fontSize: "0.95rem" }}>
                        {opt.name}
                      </span>
                      <span style={{
                        fontSize: "0.7rem",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontWeight: "700",
                        backgroundColor: opt.badgeBg,
                        color: opt.badgeColor,
                        border: `1px solid ${opt.badgeBorder}`
                      }}>
                        {opt.badge}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                      {opt.desc}
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={isSelected}
                    onChange={() => onSelectMethod(opt.id)}
                    style={{ marginTop: "3px", width: "16px", height: "16px", cursor: "pointer", accentColor: "#2563eb" }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Manual & Offline Channels */}
      <div>
        <div style={{
          fontSize: "0.75rem",
          fontWeight: "800",
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "12px"
        }}>
          🏦 Manual & Offline Banking Options
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "12px"
        }}>
          {manualOptions.map((opt) => {
            const isSelected = selectedMethod === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => onSelectMethod(opt.id)}
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                  backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? "0 2px 6px rgba(37,99,235,0.12)" : "0 1px 3px rgba(0,0,0,0.03)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "12px"
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "700", color: "#0f172a", fontSize: "0.92rem" }}>
                      {opt.name}
                    </span>
                    <span style={{
                      fontSize: "0.7rem",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontWeight: "700",
                      backgroundColor: opt.badgeBg,
                      color: opt.badgeColor,
                      border: `1px solid ${opt.badgeBorder}`
                    }}>
                      {opt.badge}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                    {opt.desc}
                  </p>
                </div>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={isSelected}
                  onChange={() => onSelectMethod(opt.id)}
                  style={{ marginTop: "3px", width: "16px", height: "16px", cursor: "pointer", accentColor: "#2563eb" }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Firm Bank Details Box (Shown when manual transfer is selected) */}
      {["BANK_TRANSFER", "UPI_MANUAL"].includes(selectedMethod) && (
        <div style={{
          padding: "18px",
          backgroundColor: "#f8fafc",
          borderRadius: "12px",
          border: "1px solid #cbd5e1"
        }}>
          <div style={{ fontWeight: "800", color: "#0f172a", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <span>🏛️</span> Chambers Official Bank & Remittance Instructions
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
            fontSize: "0.85rem",
            color: "#334155"
          }}>
            <div style={{ backgroundColor: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem", fontWeight: "700" }}>BANK NAME</span>
              <strong>{firmInstructions?.bankName || "HDFC Bank Ltd"}</strong>
            </div>
            <div style={{ backgroundColor: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem", fontWeight: "700" }}>ACCOUNT BENEFICIARY</span>
              <strong>{firmInstructions?.accountName || "Advocate Chambers Client Trust Account"}</strong>
            </div>
            <div style={{ backgroundColor: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem", fontWeight: "700" }}>ACCOUNT NUMBER</span>
              <strong style={{ fontFamily: "monospace", color: "#0f172a", fontSize: "0.95rem" }}>
                {firmInstructions?.accountNumber || "50200012345678"}
              </strong>
            </div>
            <div style={{ backgroundColor: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem", fontWeight: "700" }}>IFSC CODE</span>
              <strong style={{ fontFamily: "monospace", color: "#0f172a", fontSize: "0.95rem" }}>
                {firmInstructions?.ifscCode || "HDFC0000060"}
              </strong>
            </div>
            {firmInstructions?.upiId && (
              <div style={{ backgroundColor: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", gridColumn: "1 / -1" }}>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem", fontWeight: "700" }}>UPI VPA / QR ID</span>
                <strong style={{ fontFamily: "monospace", color: "#7e22ce" }}>{firmInstructions.upiId}</strong>
              </div>
            )}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: "0.8rem", color: "#b45309", backgroundColor: "#fffbeb", padding: "8px 12px", borderRadius: "6px", border: "1px solid #fde68a" }}>
            ⚠️ <strong>Important:</strong> After transferring funds, please input the Bank UTR / Reference number below to generate your official chambers payment receipt.
          </p>
        </div>
      )}
    </div>
  );
}
