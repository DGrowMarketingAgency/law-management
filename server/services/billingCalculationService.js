/**
 * Billing & Financial Calculation Service
 * Centralized, authoritative calculation engine for legal invoicing,
 * tax computation, RCM flags, discount processing, and aging analysis.
 *
 * NOTE: All monetary arithmetic uses fixed-precision decimal rounding (2 decimal places)
 * to avoid JavaScript floating point errors.
 */

/**
 * Round a monetary value to exactly 2 decimal places using standard accounting rounding
 * (half away from zero / symmetric round)
 * @param {number} val
 * @returns {number}
 */
const roundDec2 = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 0.0;
  const n = Number(val);
  const sign = n < 0 ? -1 : 1;
  return sign * (Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100);
};

/**
 * Calculate line item values
 * Supports both:
 *   calculateLineItem(quantity, unitPrice, taxRate) [3 arguments]
 *   calculateLineItem(quantity, unitPrice, discount, taxRate) [4 arguments]
 *
 * @param {number} quantity
 * @param {number} unitPrice
 * @param {number} [discountOrTaxRate=0]
 * @param {number|null} [maybeTaxRate=null]
 * @returns {object}
 */
const calculateLineItem = (quantity = 1, unitPrice = 0, discountOrTaxRate = 0, maybeTaxRate = null) => {
  const qty = Math.max(0, roundDec2(quantity) || 1);
  const price = Math.max(0, roundDec2(unitPrice));
  const subtotal = roundDec2(qty * price);

  let disc = 0;
  let rate = 0;

  if (maybeTaxRate === null) {
    // 3 args passed: quantity, unitPrice, taxRate
    rate = Math.max(0, Math.min(100, roundDec2(discountOrTaxRate)));
  } else {
    // 4 args passed: quantity, unitPrice, discount, taxRate
    disc = Math.min(subtotal, Math.max(0, roundDec2(discountOrTaxRate)));
    rate = Math.max(0, Math.min(100, roundDec2(maybeTaxRate)));
  }

  const taxable = roundDec2(subtotal - disc);
  const tax = roundDec2(taxable * (rate / 100));
  const total = roundDec2(taxable + tax);

  return {
    quantity: qty,
    unitPrice: price,
    unit_price: price,
    subtotal,
    discount: disc,
    taxableAmount: taxable,
    taxable_amount: taxable,
    taxRate: rate,
    tax_rate: rate,
    taxAmount: tax,
    tax_amount: tax,
    total,
    lineTotal: total,
    line_total: total,
  };
};

/**
 * Calculate invoice subtotal from line items
 * @param {Array<{ quantity?: number, unit_price?: number, unitPrice?: number, rate?: number, amount?: number }>} items
 * @returns {number}
 */
const calculateInvoiceSubtotal = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return 0.0;
  return roundDec2(
    items.reduce((sum, item) => {
      const price = item.unit_price ?? item.unitPrice ?? item.rate ?? item.amount ?? 0;
      const qty = item.quantity ?? 1;
      return sum + Number(qty) * Number(price);
    }, 0)
  );
};

/**
 * Calculate discount amount based on discount type and value
 * @param {number} subtotal
 * @param {'PERCENTAGE'|'FIXED'} discountType
 * @param {number} discountValue
 * @returns {number}
 */
const calculateDiscount = (subtotal = 0, discountType = "FIXED", discountValue = 0) => {
  const sub = Math.max(0, roundDec2(subtotal));
  const val = Math.max(0, roundDec2(discountValue));

  if (val <= 0 || sub <= 0) return 0.0;

  if (discountType === "PERCENTAGE") {
    const pct = Math.min(100, val);
    return roundDec2(sub * (pct / 100));
  }

  // FIXED
  return roundDec2(Math.min(sub, val));
};

/**
 * Calculate taxable amount (Subtotal - Discount)
 * @param {number} subtotal
 * @param {number} discountAmount
 * @returns {number}
 */
const calculateTaxableAmount = (subtotal = 0, discountAmount = 0) => {
  const sub = Math.max(0, roundDec2(subtotal));
  const disc = Math.max(0, roundDec2(discountAmount));
  return roundDec2(Math.max(0, sub - disc));
};

/**
 * Calculate taxes based on GST mode and place of supply
 * Supports both:
 *   calculateTaxes(taxable, 'CGST_SGST'|'IGST', isRcm)
 *   calculateTaxes(taxable, 'STANDARD'|'RCM'|'EXEMPT', taxRate, isInterState)
 *
 * @param {number} taxableAmount
 * @param {string} [taxModeOrGstMode='STANDARD']
 * @param {number|boolean} [arg3=18.0]
 * @param {boolean} [arg4=false]
 * @returns {object}
 */
const calculateTaxes = (
  taxableAmount = 0,
  taxModeOrGstMode = "STANDARD",
  arg3 = 18.0,
  arg4 = false
) => {
  const taxable = Math.max(0, roundDec2(taxableAmount));

  let isRcm = false;
  let isInterState = false;
  let taxRate = 18.0;

  if (typeof arg3 === "boolean") {
    // Convention A: arg3 is boolean isRcm
    isRcm = arg3;
    isInterState = taxModeOrGstMode === "IGST";
    taxRate = 18.0;
  } else {
    // Convention B: arg3 is taxRate (number), arg4 is isInterState (boolean)
    taxRate = typeof arg3 === "number" ? arg3 : 18.0;
    isInterState = Boolean(arg4);
    isRcm = taxModeOrGstMode === "RCM";
  }

  if (taxModeOrGstMode === "RCM") {
    isRcm = true;
  }

  const rate = Math.max(0, Math.min(100, roundDec2(taxRate)));

  if (taxable === 0 || taxModeOrGstMode === "EXEMPT" || taxModeOrGstMode === "NOT_APPLICABLE") {
    return {
      taxRate: 0.0,
      tax_rate: 0.0,
      cgstRate: 0.0,
      cgst_rate: 0.0,
      sgstRate: 0.0,
      sgst_rate: 0.0,
      igstRate: 0.0,
      igst_rate: 0.0,
      cgstAmount: 0.0,
      cgst_amount: 0.0,
      sgstAmount: 0.0,
      sgst_amount: 0.0,
      igstAmount: 0.0,
      igst_amount: 0.0,
      taxAmount: 0.0,
      tax_amount: 0.0,
      rcmApplicable: false,
      rcm_applicable: false,
    };
  }

  if (isRcm) {
    const nominalTax = roundDec2(taxable * (rate / 100));
    return {
      taxRate: rate,
      tax_rate: rate,
      cgstRate: isInterState ? 0.0 : roundDec2(rate / 2),
      cgst_rate: isInterState ? 0.0 : roundDec2(rate / 2),
      sgstRate: isInterState ? 0.0 : roundDec2(rate / 2),
      sgst_rate: isInterState ? 0.0 : roundDec2(rate / 2),
      igstRate: isInterState ? rate : 0.0,
      igst_rate: isInterState ? rate : 0.0,
      cgstAmount: 0.0,
      cgst_amount: 0.0,
      sgstAmount: 0.0,
      sgst_amount: 0.0,
      igstAmount: 0.0,
      igst_amount: 0.0,
      taxAmount: 0.0,
      tax_amount: 0.0,
      nominalTaxAmount: nominalTax,
      nominal_tax_amount: nominalTax,
      rcmApplicable: true,
      rcm_applicable: true,
    };
  }

  const totalTax = roundDec2(taxable * (rate / 100));
  if (isInterState) {
    return {
      taxRate: rate,
      tax_rate: rate,
      cgstRate: 0.0,
      cgst_rate: 0.0,
      sgstRate: 0.0,
      sgst_rate: 0.0,
      igstRate: rate,
      igst_rate: rate,
      cgstAmount: 0.0,
      cgst_amount: 0.0,
      sgstAmount: 0.0,
      sgst_amount: 0.0,
      igstAmount: totalTax,
      igst_amount: totalTax,
      taxAmount: totalTax,
      tax_amount: totalTax,
      rcmApplicable: false,
      rcm_applicable: false,
    };
  } else {
    const halfRate = roundDec2(rate / 2);
    const halfTax = roundDec2(totalTax / 2);
    const sgst = roundDec2(totalTax - halfTax);
    return {
      taxRate: rate,
      tax_rate: rate,
      cgstRate: halfRate,
      cgst_rate: halfRate,
      sgstRate: halfRate,
      sgst_rate: halfRate,
      igstRate: 0.0,
      igst_rate: 0.0,
      cgstAmount: halfTax,
      cgst_amount: halfTax,
      sgstAmount: sgst,
      sgst_amount: sgst,
      igstAmount: 0.0,
      igst_amount: 0.0,
      taxAmount: totalTax,
      tax_amount: totalTax,
      rcmApplicable: false,
      rcm_applicable: false,
    };
  }
};

/**
 * Calculate grand total of an invoice
 * @param {number} taxableAmount
 * @param {number} taxAmount
 * @returns {number}
 */
const calculateInvoiceTotal = (taxableAmount = 0, taxAmount = 0) => {
  const taxable = Math.max(0, roundDec2(taxableAmount));
  const tax = Math.max(0, roundDec2(taxAmount));
  return roundDec2(taxable + tax);
};

/**
 * Calculate remaining amount due
 * @param {number} totalAmount
 * @param {number} amountPaid
 * @returns {number}
 */
const calculateAmountDue = (totalAmount = 0, amountPaid = 0) => {
  const total = Math.max(0, roundDec2(totalAmount));
  const paid = Math.max(0, roundDec2(amountPaid));
  return roundDec2(Math.max(0, total - paid));
};

/**
 * Determine dynamic invoice status based on due date and payment balance / amount due
 * @param {string} currentStatus
 * @param {number} totalAmount
 * @param {number} amountDueOrPaid
 * @param {string} dueDate
 * @returns {string}
 */
const resolveInvoiceStatus = (currentStatus, totalAmount, amountDueOrPaid, dueDate) => {
  if (["CANCELLED", "VOID"].includes(currentStatus)) {
    return currentStatus;
  }
  if (currentStatus === "DRAFT") {
    return "DRAFT";
  }

  const total = roundDec2(totalAmount);
  const amountDue = roundDec2(amountDueOrPaid);

  if (amountDue <= 0 && total > 0) {
    return "PAID";
  }

  // Check if overdue
  if (dueDate && amountDue > 0) {
    const today = new Date().toISOString().split("T")[0];
    if (today > dueDate) {
      return "OVERDUE";
    }
  }

  if (amountDue > 0 && amountDue < total) {
    return "PARTIALLY_PAID";
  }

  return "ISSUED";
};

/**
 * Categorize invoices into mutually exclusive aging buckets based on due_date
 * Buckets: CURRENT (not overdue), 1-30 days, 31-60 days, 60+ days
 * @param {Array<{ due_date: string, amount_due?: number, amountDue?: number, status?: string }>} invoices
 * @param {string} [asOfDate]
 * @returns {object}
 */
const calculateAgingBuckets = (invoices = [], asOfDate = null) => {
  const referenceDate = asOfDate ? new Date(asOfDate) : new Date();
  referenceDate.setHours(0, 0, 0, 0);

  const current = { count: 0, total: 0.0, invoices: [] };
  const days1To30 = { count: 0, total: 0.0, invoices: [] };
  const days31To60 = { count: 0, total: 0.0, invoices: [] };
  const days60Plus = { count: 0, total: 0.0, invoices: [] };
  let grandTotal = 0.0;

  if (Array.isArray(invoices)) {
    for (const inv of invoices) {
      if (["PAID", "CANCELLED", "VOID", "DRAFT"].includes(inv.status)) {
        continue;
      }

      const dueAmount = roundDec2(inv.amount_due ?? inv.amountDue ?? 0);
      if (dueAmount <= 0) continue;

      grandTotal = roundDec2(grandTotal + dueAmount);

      const dueDate = new Date(inv.due_date);
      dueDate.setHours(0, 0, 0, 0);

      const diffMs = referenceDate.getTime() - dueDate.getTime();
      const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        current.count += 1;
        current.total = roundDec2(current.total + dueAmount);
        current.invoices.push(inv);
      } else if (daysOverdue <= 30) {
        days1To30.count += 1;
        days1To30.total = roundDec2(days1To30.total + dueAmount);
        days1To30.invoices.push(inv);
      } else if (daysOverdue <= 60) {
        days31To60.count += 1;
        days31To60.total = roundDec2(days31To60.total + dueAmount);
        days31To60.invoices.push(inv);
      } else {
        days60Plus.count += 1;
        days60Plus.total = roundDec2(days60Plus.total + dueAmount);
        days60Plus.invoices.push(inv);
      }
    }
  }

  return {
    current,
    days1_30: days1To30,
    days1To30,
    days31_60: days31To60,
    days31To60,
    days60Plus,
    totalOutstanding: grandTotal,
    grandTotal,
  };
};

module.exports = {
  roundDec2,
  calculateLineItem,
  calculateInvoiceSubtotal,
  calculateDiscount,
  calculateTaxableAmount,
  calculateTaxes,
  calculateInvoiceTotal,
  calculateAmountDue,
  resolveInvoiceStatus,
  calculateAgingBuckets,
};
