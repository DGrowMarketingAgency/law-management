/**
 * Prompt 8: Billing Calculation Engine Unit Test Suite
 * Tests financial mathematics, 2-decimal rounding, tax formulas, RCM rules, and aging logic.
 */

const assert = require('assert');
const {
    roundDec2,
    calculateLineItem,
    calculateInvoiceSubtotal,
    calculateDiscount,
    calculateTaxableAmount,
    calculateTaxes,
    calculateInvoiceTotal,
    calculateAmountDue,
    resolveInvoiceStatus,
    calculateAgingBuckets
} = require('../services/billingCalculationService');

async function runTests() {
    console.log('==================================================================');
    console.log('Starting Prompt 8 Billing Calculation Unit Tests');
    console.log('==================================================================');

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`  ✓ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ✗ FAIL: ${name}`);
            console.error(`    -> ${err.message}`);
            failed++;
        }
    }

    // -------------------------------------------------------------
    // 1. Decimal Rounding & Monetary Precision Tests
    // -------------------------------------------------------------
    console.log('\n[1. Monetary Precision & Rounding Tests]');

    test('roundDec2 correctly fixes floating-point representation quirks', () => {
        // Floating point addition: 0.1 + 0.2 = 0.30000000000000004
        assert.strictEqual(roundDec2(0.1 + 0.2), 0.3);
        assert.strictEqual(roundDec2(1234.567), 1234.57);
        assert.strictEqual(roundDec2(1234.564), 1234.56);
        assert.strictEqual(roundDec2(0), 0);
        assert.strictEqual(roundDec2(-10.555), -10.56);
    });

    test('calculateLineItem computes quantity * unit_price and tax correctly', () => {
        // 2.5 hours @ ₹3,500/hr = 8,750
        const item1 = calculateLineItem(2.5, 3500, 18);
        assert.strictEqual(item1.subtotal, 8750.00);
        assert.strictEqual(item1.tax_amount, 1575.00);
        assert.strictEqual(item1.total, 10325.00);

        // 1 Appearance @ ₹25,000, 0% tax (RCM)
        const item2 = calculateLineItem(1, 25000, 0);
        assert.strictEqual(item2.subtotal, 25000.00);
        assert.strictEqual(item2.tax_amount, 0.00);
        assert.strictEqual(item2.total, 25000.00);
    });

    test('calculateInvoiceSubtotal sums up line items cleanly', () => {
        const items = [
            { quantity: 2, unit_price: 1000 },
            { quantity: 3.5, unit_price: 2000 },
            { quantity: 1, unit_price: 550.75 }
        ];
        // 2000 + 7000 + 550.75 = 9550.75
        const subtotal = calculateInvoiceSubtotal(items);
        assert.strictEqual(subtotal, 9550.75);
    });

    // -------------------------------------------------------------
    // 2. Discounts & Taxable Base Tests
    // -------------------------------------------------------------
    console.log('\n[2. Discounts & Taxable Amount Tests]');

    test('calculateDiscount computes FIXED discount and caps at subtotal', () => {
        // Normal fixed discount
        assert.strictEqual(calculateDiscount(10000, 'FIXED', 1500), 1500.00);
        // Discount exceeding subtotal must be capped to subtotal (cannot be negative)
        assert.strictEqual(calculateDiscount(1000, 'FIXED', 2500), 1000.00);
    });

    test('calculateDiscount computes PERCENTAGE discount accurately', () => {
        // 10% on ₹15,000 = ₹1,500
        assert.strictEqual(calculateDiscount(15000, 'PERCENTAGE', 10), 1500.00);
        // 15.5% on ₹8,500 = ₹1,317.50
        assert.strictEqual(calculateDiscount(8500, 'PERCENTAGE', 15.5), 1317.50);
        // 0% discount
        assert.strictEqual(calculateDiscount(5000, 'PERCENTAGE', 0), 0.00);
    });

    test('calculateTaxableAmount calculates subtotal - discount without negative overflow', () => {
        assert.strictEqual(calculateTaxableAmount(10000, 1500), 8500.00);
        assert.strictEqual(calculateTaxableAmount(5000, 5000), 0.00);
        assert.strictEqual(calculateTaxableAmount(5000, 6000), 0.00);
    });

    // -------------------------------------------------------------
    // 3. Indian GST Rules & Reverse Charge Mechanism (RCM) Tests
    // -------------------------------------------------------------
    console.log('\n[3. GST (CGST/SGST/IGST) & Reverse Charge Mechanism (RCM) Tests]');

    test('calculateTaxes computes 9% CGST + 9% SGST for intra-state supply', () => {
        const taxable = 10000;
        const taxes = calculateTaxes(taxable, 'CGST_SGST', false);
        assert.strictEqual(taxes.cgst_rate, 9.00);
        assert.strictEqual(taxes.cgst_amount, 900.00);
        assert.strictEqual(taxes.sgst_rate, 9.00);
        assert.strictEqual(taxes.sgst_amount, 900.00);
        assert.strictEqual(taxes.igst_rate, 0.00);
        assert.strictEqual(taxes.igst_amount, 0.00);
        assert.strictEqual(taxes.tax_amount, 1800.00);
    });

    test('calculateTaxes computes 18% IGST for inter-state supply', () => {
        const taxable = 10000;
        const taxes = calculateTaxes(taxable, 'IGST', false);
        assert.strictEqual(taxes.cgst_rate, 0.00);
        assert.strictEqual(taxes.cgst_amount, 0.00);
        assert.strictEqual(taxes.sgst_rate, 0.00);
        assert.strictEqual(taxes.sgst_amount, 0.00);
        assert.strictEqual(taxes.igst_rate, 18.00);
        assert.strictEqual(taxes.igst_amount, 1800.00);
        assert.strictEqual(taxes.tax_amount, 1800.00);
    });

    test('calculateTaxes sets tax on invoice to ZERO when RCM is applicable', () => {
        // Under Sec 9(3) CGST Act, advocate fee note to business entity has 0 tax billed
        const taxable = 50000;
        const taxes = calculateTaxes(taxable, 'CGST_SGST', true);
        assert.strictEqual(taxes.tax_amount, 0.00, 'Tax on invoice must be zero under RCM');
        assert.strictEqual(taxes.cgst_amount, 0.00);
        assert.strictEqual(taxes.sgst_amount, 0.00);
        assert.strictEqual(taxes.igst_amount, 0.00);
    });

    // -------------------------------------------------------------
    // 4. Invoice Total & Amount Due Tests
    // -------------------------------------------------------------
    console.log('\n[4. Grand Total & Outstanding Balance Tests]');

    test('calculateInvoiceTotal adds taxable amount and tax amount correctly', () => {
        assert.strictEqual(calculateInvoiceTotal(8500, 1530), 10030.00);
        // RCM scenario
        assert.strictEqual(calculateInvoiceTotal(50000, 0), 50000.00);
    });

    test('calculateAmountDue calculates total_amount - amount_paid', () => {
        assert.strictEqual(calculateAmountDue(10030, 0), 10030.00);
        assert.strictEqual(calculateAmountDue(10030, 5000), 5030.00);
        assert.strictEqual(calculateAmountDue(10030, 10030), 0.00);
        // Edge case: paid exceeding total (should not be negative)
        assert.strictEqual(calculateAmountDue(10030, 10050), 0.00);
    });

    // -------------------------------------------------------------
    // 5. Status Resolution Tests
    // -------------------------------------------------------------
    console.log('\n[5. Invoice Status Resolution Tests]');

    test('resolveInvoiceStatus correctly handles DRAFT, ISSUED, PARTIAL, PAID, and OVERDUE', () => {
        const today = new Date().toISOString().slice(0, 10);
        const pastDate = '2020-01-01';
        const futureDate = '2099-12-31';

        // 1. DRAFT remains DRAFT
        assert.strictEqual(resolveInvoiceStatus('DRAFT', 10000, 0, futureDate), 'DRAFT');

        // 2. ISSUED with full balance due in future
        assert.strictEqual(resolveInvoiceStatus('ISSUED', 10000, 10000, futureDate), 'ISSUED');

        // 3. ISSUED with partial payment in future
        assert.strictEqual(resolveInvoiceStatus('ISSUED', 10000, 4000, futureDate), 'PARTIALLY_PAID');

        // 4. Overdue with positive due date elapsed
        assert.strictEqual(resolveInvoiceStatus('ISSUED', 10000, 4000, pastDate), 'OVERDUE');

        // 5. Fully paid (amount_due = 0)
        assert.strictEqual(resolveInvoiceStatus('ISSUED', 10000, 0, pastDate), 'PAID');
        assert.strictEqual(resolveInvoiceStatus('PARTIALLY_PAID', 10000, 0, pastDate), 'PAID');

        // 6. CANCELLED and VOID remain unchanged
        assert.strictEqual(resolveInvoiceStatus('CANCELLED', 10000, 5000, pastDate), 'CANCELLED');
        assert.strictEqual(resolveInvoiceStatus('VOID', 10000, 5000, pastDate), 'VOID');
    });

    // -------------------------------------------------------------
    // 6. Aging Analysis Buckets Tests
    // -------------------------------------------------------------
    console.log('\n[6. Accounts Receivable Aging Buckets Tests]');

    test('calculateAgingBuckets segregates invoices by elapsed days', () => {
        const now = new Date();

        const makeDate = (offsetDays) => {
            const d = new Date(now);
            d.setDate(d.getDate() + offsetDays);
            return d.toISOString().slice(0, 10);
        };

        const sampleInvoices = [
            { id: 1, invoice_number: 'INV-1', amount_due: 10000, due_date: makeDate(5) },   // Future (Current)
            { id: 2, invoice_number: 'INV-2', amount_due: 15000, due_date: makeDate(-10) }, // 10 days ago (1-30)
            { id: 3, invoice_number: 'INV-3', amount_due: 20000, due_date: makeDate(-45) }, // 45 days ago (31-60)
            { id: 4, invoice_number: 'INV-4', amount_due: 30000, due_date: makeDate(-75) }  // 75 days ago (60+)
        ];

        const aging = calculateAgingBuckets(sampleInvoices);

        assert.strictEqual(aging.current.total, 10000);
        assert.strictEqual(aging.current.count, 1);

        assert.strictEqual(aging.days1To30.total, 15000);
        assert.strictEqual(aging.days1To30.count, 1);

        assert.strictEqual(aging.days31To60.total, 20000);
        assert.strictEqual(aging.days31To60.count, 1);

        assert.strictEqual(aging.days60Plus.total, 30000);
        assert.strictEqual(aging.days60Plus.count, 1);

        assert.strictEqual(aging.grandTotal, 75000);
    });

    console.log('\n==================================================================');
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log('==================================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

// Run tests if executed directly
if (require.main === module) {
    runTests().catch(err => {
        console.error('Test execution error:', err);
        process.exit(1);
    });
}

module.exports = { runTests };
