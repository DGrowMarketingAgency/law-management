const { getInvoiceById } = require("./invoiceService");
const { getPaymentById } = require("./paymentService");

/**
 * Escape string for PDF string literal (parentheses and backslashes)
 * @param {string} str
 * @returns {string}
 */
const escapePdf = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, " "); // ASCII printable
};

/**
 * Generate a clean, high-authority Legal Invoice PDF (PDF 1.4 Binary Buffer)
 * @param {object} invoice
 * @returns {Buffer}
 */
const buildInvoicePdfBuffer = (invoice) => {
  const content = [];

  // Page setup: 595.28 x 841.89 (Standard A4)
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  let y = pageHeight - margin;

  // Helper operators
  const setFont = (font, size) => `/${font} ${size} Tf`;
  const setFillColor = (r, g, b) => `${r} ${g} ${b} rg`;
  const setStrokeColor = (r, g, b) => `${r} ${g} ${b} RG`;
  const drawRect = (x, y, w, h) => `${x} ${y} ${w} ${h} re f`;
  const drawLine = (x1, y1, x2, y2) => `${x1} ${y1} m ${x2} ${y2} l S`;
  const drawText = (x, y, text, font = "F1", size = 10) =>
    `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET`;

  // 1. Header Bar & Branding
  content.push(setFillColor(0, 0, 0));
  content.push(drawRect(margin, y - 28, 30, 30));
  content.push(setFillColor(1, 1, 1));
  content.push(drawText(margin + 9, y - 18, "§", "F2", 16));

  content.push(setFillColor(0, 0, 0));
  content.push(drawText(margin + 40, y - 10, invoice.advocate_business_name || "LEGAL PRACTICE CHAMBERS", "F2", 14));
  content.push(drawText(margin + 40, y - 24, "ADVOCATE'S CHAMBERS & LEGAL COUNSEL", "F1", 8));

  // Invoice Title Right
  content.push(drawText(pageWidth - margin - 150, y - 10, "TAX INVOICE", "F2", 18));
  content.push(drawText(pageWidth - margin - 150, y - 24, `STATUS: ${invoice.status}`, "F2", 9));

  y -= 45;
  content.push(setStrokeColor(0, 0, 0));
  content.push(`1 w`);
  content.push(drawLine(margin, y, pageWidth - margin, y));

  y -= 20;

  // 2. Firm & Invoice Metadata Columns
  // Left Box: Chambers Details
  content.push(drawText(margin, y, "ISSUED BY:", "F2", 9));
  content.push(drawText(margin, y - 13, invoice.advocate_business_name || "Advocate Chambers", "F1", 9));
  content.push(drawText(margin, y - 25, invoice.advocate_address || "High Court Complex, Chennai", "F1", 8));
  content.push(drawText(margin, y - 37, `Advocate GSTIN: ${invoice.advocate_gstin || "N/A"}`, "F1", 8));

  // Center Box: Client Details
  const col2X = margin + 190;
  content.push(drawText(col2X, y, "BILLED TO (CLIENT):", "F2", 9));
  content.push(drawText(col2X, y - 13, invoice.billing_name || "Client", "F2", 9));
  content.push(drawText(col2X, y - 25, (invoice.billing_address || "").substring(0, 38), "F1", 8));
  content.push(drawText(col2X, y - 37, `Client GSTIN: ${invoice.client_gstin || "Not Provided"}`, "F1", 8));

  // Right Box: Invoice Details
  const col3X = margin + 360;
  content.push(drawText(col3X, y, `Invoice No: ${invoice.invoice_number}`, "F2", 9));
  content.push(drawText(col3X, y - 13, `Date: ${invoice.invoice_date}`, "F1", 9));
  content.push(drawText(col3X, y - 25, `Due Date: ${invoice.due_date}`, "F2", 9));
  content.push(drawText(col3X, y - 37, `Matter: ${invoice.case_number || "General Retainer"}`, "F1", 8));

  y -= 55;

  // RCM Notice Badge if applicable
  if (invoice.rcm_applicable) {
    content.push(setFillColor(0.95, 0.95, 0.95));
    content.push(drawRect(margin, y - 18, pageWidth - margin * 2, 20));
    content.push(setFillColor(0, 0, 0));
    content.push(drawText(margin + 10, y - 13, "REVERSE CHARGE MECHANISM (RCM) APPLICABLE - GST PAYABLE DIRECTLY BY RECIPIENT", "F2", 8));
    y -= 25;
  }

  y -= 10;

  // 3. Line Items Table Header
  content.push(setFillColor(0.92, 0.92, 0.92));
  content.push(drawRect(margin, y - 18, pageWidth - margin * 2, 20));
  content.push(setFillColor(0, 0, 0));
  content.push(drawText(margin + 8, y - 13, "DESCRIPTION & SERVICE", "F2", 9));
  content.push(drawText(margin + 260, y - 13, "DATE", "F2", 9));
  content.push(drawText(margin + 330, y - 13, "QTY", "F2", 9));
  content.push(drawText(margin + 380, y - 13, "RATE (INR)", "F2", 9));
  content.push(drawText(margin + 445, y - 13, "AMOUNT (INR)", "F2", 9));

  y -= 24;

  // Line items
  const items = invoice.items || [];
  for (const item of items) {
    content.push(drawText(margin + 8, y, String(item.description).substring(0, 38), "F1", 9));
    content.push(drawText(margin + 260, y, String(item.service_date || "-"), "F1", 8));
    content.push(drawText(margin + 330, y, `${item.quantity} ${item.unit || ""}`, "F1", 8));
    content.push(drawText(margin + 380, y, `Rs. ${item.unit_price}`, "F1", 8));
    content.push(drawText(margin + 445, y, `Rs. ${item.line_total}`, "F2", 9));

    y -= 18;
    content.push(setStrokeColor(0.9, 0.9, 0.9));
    content.push(drawLine(margin, y + 4, pageWidth - margin, y + 4));

    if (y < 160) break; // Keep within single-page boundary
  }

  y -= 10;

  // 4. Financial Summary Right-Aligned
  const sumX = margin + 320;
  const valX = margin + 440;

  content.push(drawText(sumX, y, "Subtotal:", "F1", 9));
  content.push(drawText(valX, y, `Rs. ${invoice.subtotal}`, "F1", 9));
  y -= 15;

  if (invoice.discount_amount > 0) {
    content.push(drawText(sumX, y, "Discount:", "F1", 9));
    content.push(drawText(valX, y, `- Rs. ${invoice.discount_amount}`, "F1", 9));
    y -= 15;
  }

  content.push(drawText(sumX, y, `Taxable Amount:`, "F1", 9));
  content.push(drawText(valX, y, `Rs. ${invoice.taxable_amount}`, "F1", 9));
  y -= 15;

  if (invoice.rcm_applicable) {
    content.push(drawText(sumX, y, `GST (RCM - 0% on bill):`, "F1", 9));
    content.push(drawText(valX, y, `Rs. 0.00`, "F1", 9));
    y -= 15;
  } else if (invoice.tax_amount > 0) {
    content.push(drawText(sumX, y, `GST (${invoice.tax_rate}%):`, "F1", 9));
    content.push(drawText(valX, y, `Rs. ${invoice.tax_amount}`, "F1", 9));
    y -= 15;
  }

  content.push(setFillColor(0, 0, 0));
  content.push(drawRect(sumX - 5, y - 18, 200, 22));
  content.push(setFillColor(1, 1, 1));
  content.push(drawText(sumX + 5, y - 13, "TOTAL DUE:", "F2", 10));
  content.push(drawText(valX, y - 13, `Rs. ${invoice.total_amount}`, "F2", 11));
  y -= 30;

  // Balance & Payments
  content.push(setFillColor(0, 0, 0));
  content.push(drawText(sumX, y, `Amount Paid:`, "F1", 9));
  content.push(drawText(valX, y, `Rs. ${invoice.amount_paid}`, "F1", 9));
  y -= 15;

  content.push(drawText(sumX, y, `Remaining Balance:`, "F2", 10));
  content.push(drawText(valX, y, `Rs. ${invoice.amount_due}`, "F2", 10));
  y -= 30;

  // 5. Payment Instructions & Footer
  content.push(drawText(margin, y, "PAYMENT INSTRUCTIONS:", "F2", 8));
  content.push(drawText(margin, y - 12, "Please remit via NEFT / RTGS / UPI to Chambers account.", "F1", 8));
  content.push(drawText(margin, y - 22, `Place of Supply: ${invoice.place_of_supply || "Tamil Nadu"} | Terms: Due upon receipt`, "F1", 8));

  // Watermark footer
  content.push(setStrokeColor(0, 0, 0));
  content.push(drawLine(margin, 40, pageWidth - margin, 40));
  content.push(drawText(margin, 28, "Generated by Legal Practice Management Platform - Private Chambers Authority", "F1", 7));
  content.push(drawText(pageWidth - margin - 120, 28, `Date: ${new Date().toLocaleDateString()}`, "F1", 7));

  // Assemble valid PDF 1.4 file
  const streamBody = content.join("\n");
  const streamLength = Buffer.byteLength(streamBody);

  const objects = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`);
  objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamBody}\nendstream\nendobj`);
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);

  let offset = 0;
  const xrefs = ["0000000000 65535 f "];
  let pdfData = `%PDF-1.4\n`;
  offset = Buffer.byteLength(pdfData);

  for (let i = 0; i < objects.length; i++) {
    xrefs.push(String(offset).padStart(10, "0") + " 00000 n ");
    pdfData += `${objects[i]}\n`;
    offset = Buffer.byteLength(pdfData);
  }

  const xrefStart = offset;
  pdfData += `xref\n0 ${objects.length + 1}\n${xrefs.join("\n")}\n`;
  pdfData += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdfData += `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdfData, "binary");
};

/**
 * Generate a clean Payment Receipt PDF (PDF 1.4 Binary Buffer)
 * @param {object} payment
 * @returns {Buffer}
 */
const buildReceiptPdfBuffer = (payment) => {
  const content = [];
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  let y = pageHeight - margin;

  const setFillColor = (r, g, b) => `${r} ${g} ${b} rg`;
  const setStrokeColor = (r, g, b) => `${r} ${g} ${b} RG`;
  const drawRect = (x, y, w, h) => `${x} ${y} ${w} ${h} re f`;
  const drawLine = (x1, y1, x2, y2) => `${x1} ${y1} m ${x2} ${y2} l S`;
  const drawText = (x, y, text, font = "F1", size = 10) =>
    `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET`;

  // Header
  content.push(setFillColor(0, 0, 0));
  content.push(drawRect(margin, y - 28, 30, 30));
  content.push(setFillColor(1, 1, 1));
  content.push(drawText(margin + 9, y - 18, "§", "F2", 16));

  content.push(setFillColor(0, 0, 0));
  content.push(drawText(margin + 40, y - 10, "ADVOCATE'S CHAMBERS", "F2", 15));
  content.push(drawText(margin + 40, y - 24, "LEGAL PRACTICE MANAGEMENT PLATFORM", "F1", 8));

  content.push(drawText(pageWidth - margin - 170, y - 10, "OFFICIAL RECEIPT", "F2", 16));
  content.push(drawText(pageWidth - margin - 170, y - 24, `Receipt No: ${payment.receipt_number}`, "F2", 9));

  y -= 45;
  content.push(setStrokeColor(0, 0, 0));
  content.push(`1 w`);
  content.push(drawLine(margin, y, pageWidth - margin, y));

  y -= 30;

  // Receipt Acknowledgement Box
  content.push(setFillColor(0.96, 0.96, 0.96));
  content.push(drawRect(margin, y - 80, pageWidth - margin * 2, 80));
  content.push(setFillColor(0, 0, 0));

  content.push(drawText(margin + 16, y - 22, `Received with thanks from:`, "F1", 9));
  content.push(drawText(margin + 16, y - 38, `${payment.client_name || "Valued Client"} (${payment.client_code || ""})`, "F2", 13));

  content.push(drawText(margin + 16, y - 56, `The sum of:`, "F1", 9));
  content.push(drawText(margin + 16, y - 72, `INR ${payment.amount} (Indian Rupees Only)`, "F2", 12));

  y -= 110;

  // Payment Details Table
  content.push(drawText(margin, y, "TRANSACTION BREAKDOWN:", "F2", 10));
  y -= 15;

  const drawRow = (label, val) => {
    content.push(drawText(margin + 10, y, label, "F1", 9));
    content.push(drawText(margin + 200, y, String(val), "F2", 9));
    y -= 18;
  };

  drawRow("Receipt Number:", payment.receipt_number);
  drawRow("Payment Date:", payment.payment_date);
  drawRow("Invoice Reference:", payment.invoice_number);
  drawRow("Payment Method:", payment.payment_method);
  drawRow("Transaction / Ref No:", payment.reference_number || payment.transaction_id || "N/A");
  drawRow("Invoice Total:", `Rs. ${payment.invoice_total || "-"}`);
  drawRow("Total Amount Paid to Date:", `Rs. ${payment.invoice_paid || "-"}`);
  drawRow("Remaining Invoice Balance:", `Rs. ${payment.invoice_due || "0.00"}`);

  y -= 30;
  content.push(drawText(margin, y, `Received By: ${payment.receiver_first_name ? `${payment.receiver_first_name} ${payment.receiver_last_name}` : "Chambers Finance Officer"}`, "F1", 9));

  // Footer
  content.push(setStrokeColor(0, 0, 0));
  content.push(drawLine(margin, 40, pageWidth - margin, 40));
  content.push(drawText(margin, 28, "Official E-Receipt &bull; Legal Practice Management Platform", "F1", 7));

  const streamBody = content.join("\n");
  const streamLength = Buffer.byteLength(streamBody);

  const objects = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`);
  objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamBody}\nendstream\nendobj`);
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);

  let offset = 0;
  const xrefs = ["0000000000 65535 f "];
  let pdfData = `%PDF-1.4\n`;
  offset = Buffer.byteLength(pdfData);

  for (let i = 0; i < objects.length; i++) {
    xrefs.push(String(offset).padStart(10, "0") + " 00000 n ");
    pdfData += `${objects[i]}\n`;
    offset = Buffer.byteLength(pdfData);
  }

  const xrefStart = offset;
  pdfData += `xref\n0 ${objects.length + 1}\n${xrefs.join("\n")}\n`;
  pdfData += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdfData += `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdfData, "binary");
};

/**
 * Generate Invoice PDF by invoice ID or invoice object
 * @param {number|object} invoiceOrId
 * @param {number} [clientRestrictionId]
 * @returns {Promise<Buffer>}
 */
const generateInvoicePdf = async (invoiceOrId, clientRestrictionId = null) => {
  const invoice = typeof invoiceOrId === "object" && invoiceOrId !== null
    ? invoiceOrId
    : await getInvoiceById(invoiceOrId, clientRestrictionId);
  const pdfBuffer = buildInvoicePdfBuffer(invoice);
  const filename = `Invoice_${invoice.invoice_number || "Draft"}.pdf`;
  pdfBuffer.filename = filename;
  pdfBuffer.pdfBuffer = pdfBuffer;
  return pdfBuffer;
};

/**
 * Generate Payment Receipt PDF by payment ID or payment object
 * @param {number|object} paymentOrId
 * @param {object|number} [invoiceOrClientId]
 * @returns {Promise<Buffer>}
 */
const generateReceiptPdf = async (paymentOrId, invoiceOrClientId = null) => {
  let payment;
  let invoice = null;

  if (typeof paymentOrId === "object" && paymentOrId !== null) {
    payment = paymentOrId;
    invoice = invoiceOrClientId;
  } else {
    payment = await getPaymentById(paymentOrId, invoiceOrClientId);
  }

  const pdfBuffer = buildReceiptPdfBuffer(payment, invoice);
  const filename = `Receipt_${payment.payment_number || payment.receipt_number || "Receipt"}.pdf`;
  pdfBuffer.filename = filename;
  pdfBuffer.pdfBuffer = pdfBuffer;
  return pdfBuffer;
};

module.exports = {
  generateInvoicePdf,
  generateReceiptPdf,
};
