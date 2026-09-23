const db = require("../config/database");

/**
 * Escape a CSV field according to RFC 4180
 * @param {*} value
 * @returns {string}
 */
const escapeCsv = (value) => {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
};

/**
 * Generate CSV export of billing and accounting records
 * @param {object} filters
 * @returns {Promise<string>}
 */
const generateBillingCsvExport = async (filters = {}) => {
  const { start_date, end_date, client_id, case_id, status } = filters;

  const whereClauses = ["1 = 1"];
  const params = [];

  if (client_id) {
    whereClauses.push("inv.client_id = ?");
    params.push(client_id);
  }

  if (case_id) {
    whereClauses.push("inv.case_id = ?");
    params.push(case_id);
  }

  if (status) {
    whereClauses.push("inv.status = ?");
    params.push(status);
  }

  if (start_date) {
    whereClauses.push("inv.invoice_date >= ?");
    params.push(start_date);
  }

  if (end_date) {
    whereClauses.push("inv.invoice_date <= ?");
    params.push(end_date);
  }

  const whereSql = whereClauses.join(" AND ");

  const [rows] = await db.execute(
    `SELECT 
      inv.invoice_number,
      inv.invoice_date,
      inv.due_date,
      cl.client_code,
      inv.billing_name,
      inv.client_gstin,
      cs.case_number,
      inv.subtotal,
      inv.discount_amount,
      inv.taxable_amount,
      inv.gst_mode,
      inv.tax_rate,
      inv.cgst_amount,
      inv.sgst_amount,
      inv.igst_amount,
      inv.tax_amount,
      inv.rcm_applicable,
      inv.total_amount,
      inv.amount_paid,
      inv.amount_due,
      inv.status AS invoice_status,
      inv.place_of_supply,
      p.payment_number AS receipt_number,
      p.payment_date,
      p.amount AS payment_amount,
      p.payment_mode AS payment_method,
      p.reference_number AS payment_reference,
      p.status AS payment_status
     FROM invoices inv
     JOIN clients cl ON inv.client_id = cl.id
     LEFT JOIN cases cs ON inv.case_id = cs.id
     LEFT JOIN payments p ON inv.id = p.invoice_id
     WHERE ${whereSql}
     ORDER BY inv.invoice_date DESC, inv.id DESC, p.id ASC`,
    params
  );

  const headers = [
    "Invoice Number",
    "Invoice Date",
    "Due Date",
    "Client Code",
    "Client / Billing Name",
    "Client GSTIN",
    "Case Matter Number",
    "Place of Supply",
    "Subtotal (INR)",
    "Discount (INR)",
    "Taxable Amount (INR)",
    "GST Mode",
    "GST Rate (%)",
    "CGST (INR)",
    "SGST (INR)",
    "IGST (INR)",
    "Total Tax (INR)",
    "RCM Applicable",
    "Grand Total (INR)",
    "Amount Paid (INR)",
    "Amount Due (INR)",
    "Invoice Status",
    "Receipt Number",
    "Payment Date",
    "Payment Amount (INR)",
    "Payment Method",
    "Payment Reference",
    "Payment Status",
  ];

  const csvRows = [headers.map(escapeCsv).join(",")];

  for (const r of rows) {
    const rowData = [
      r.invoice_number,
      r.invoice_date,
      r.due_date,
      r.client_code,
      r.billing_name,
      r.client_gstin || "N/A",
      r.case_number || "N/A",
      r.place_of_supply || "Tamil Nadu",
      r.subtotal,
      r.discount_amount,
      r.taxable_amount,
      r.gst_mode,
      r.tax_rate,
      r.cgst_amount,
      r.sgst_amount,
      r.igst_amount,
      r.tax_amount,
      r.rcm_applicable ? "YES" : "NO",
      r.total_amount,
      r.amount_paid,
      r.amount_due,
      r.invoice_status,
      r.receipt_number || "",
      r.payment_date || "",
      r.payment_amount || "",
      r.payment_method || "",
      r.payment_reference || "",
      r.payment_status || "",
    ];
    csvRows.push(rowData.map(escapeCsv).join(","));
  }

  // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel opens it directly with correct characters
  return "\uFEFF" + csvRows.join("\r\n");
};

module.exports = {
  generateBillingCsvExport,
  generateInvoicesCsv: generateBillingCsvExport,
  generatePaymentsCsv: generateBillingCsvExport,
};
