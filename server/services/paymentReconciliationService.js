const db = require("../config/database");
const { roundDec2 } = require("./billingCalculationService");

/**
 * Payment Reconciliation Service
 * Reconciles local chambers payment records against gateway transaction reports.
 */

/**
 * Perform reconciliation analysis across transactions
 * @param {object} filters
 * @returns {Promise<object>}
 */
const reconcilePayments = async ({ provider = null, startDate = null, endDate = null } = {}) => {
  const whereClauses = ["1=1"];
  const params = [];

  if (provider) {
    whereClauses.push("pgt.provider = ?");
    params.push(provider.toUpperCase());
  }

  if (startDate) {
    whereClauses.push("pgt.created_at >= ?");
    params.push(startDate);
  }

  if (endDate) {
    whereClauses.push("pgt.created_at <= ?");
    params.push(endDate);
  }

  const [transactions] = await db.query(
    `SELECT 
       pgt.*,
       p.amount AS local_payment_amount,
       p.status AS local_payment_status,
       p.receipt_number,
       inv.invoice_number,
       cnt.display_name AS client_name
     FROM payment_gateway_transactions pgt
     LEFT JOIN payments p ON pgt.payment_id = p.id
     JOIN invoices inv ON pgt.invoice_id = inv.id
     JOIN clients cl ON pgt.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY pgt.created_at DESC`,
    params
  );

  const matched = [];
  const mismatched = [];
  const pending = [];
  const failed = [];

  for (const tx of transactions) {
    const gatewayAmount = roundDec2(tx.amount);
    const localAmount = tx.local_payment_amount !== null ? roundDec2(tx.local_payment_amount) : 0;
    const diff = roundDec2(Math.abs(gatewayAmount - localAmount));

    const item = {
      id: tx.id,
      provider: tx.provider,
      orderId: tx.provider_order_id,
      paymentId: tx.provider_payment_id,
      invoiceNumber: tx.invoice_number,
      clientName: tx.client_name,
      gatewayStatus: tx.status,
      localStatus: tx.local_payment_status || "UNRECORDED",
      gatewayAmount,
      localAmount,
      difference: diff,
      receiptNumber: tx.receipt_number || null,
      createdAt: tx.created_at,
    };

    if (tx.status === "SUCCESS") {
      if (tx.local_payment_status === "SUCCESS" && diff === 0) {
        item.reconciliationStatus = "MATCHED";
        matched.push(item);
      } else {
        item.reconciliationStatus = "MISMATCHED";
        item.mismatchReason = diff !== 0 ? `Amount disparity of ₹${diff}` : `Status mismatch (Gateway: ${tx.status}, Local: ${tx.local_payment_status})`;
        mismatched.push(item);
      }
    } else if (tx.status === "FAILED") {
      item.reconciliationStatus = "FAILED";
      failed.push(item);
    } else {
      item.reconciliationStatus = "PENDING";
      pending.push(item);
    }
  }

  const allItems = [...matched, ...mismatched, ...pending, ...failed];

  return {
    summary: {
      totalTransactions: transactions.length,
      total_examined: transactions.length,
      matchedCount: matched.length,
      matched_count: matched.length,
      mismatchedCount: mismatched.length,
      mismatched_count: mismatched.length,
      pendingCount: pending.length,
      pending_count: pending.length,
      failedCount: failed.length,
      failed_count: failed.length,
    },
    items: allItems,
    matched,
    mismatched,
    pending,
    failed,
  };
};

module.exports = {
  reconcilePayments,
};
