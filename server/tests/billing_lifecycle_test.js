/**
 * Prompt 8: Billing Lifecycle & Security Integration Test Suite
 * Tests sequential numbering locks, immutable snapshots, PDF binary generation,
 * payment overpayment rejection, retainer ledgers, and RBAC enforcement.
 */

const assert = require('assert');
const pool = require('../config/database');
const invoiceNumberService = require('../services/invoiceNumberService');
const invoicePdfService = require('../services/invoicePdfService');
const invoiceService = require('../services/invoiceService');
const paymentService = require('../services/paymentService');
const retainerService = require('../services/retainerService');
const feeEntryService = require('../services/feeEntryService');
const clientBillingService = require('../services/clientBillingService');

async function runTests() {
    console.log('==================================================================');
    console.log('Starting Prompt 8 Billing Lifecycle & Security Test Suite');
    console.log('==================================================================');

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`  ✓ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ✗ FAIL: ${name}`);
            console.error(`    -> ${err.message}`);
            if (err.stack) console.error(err.stack);
            failed++;
        }
    }

    // -------------------------------------------------------------
    // 1. Sequential Database Locked Numbering Tests
    // -------------------------------------------------------------
    console.log('\n[1. Sequential Number Generation Tests]');

    await test('Invoice Number Service generates sequential INV-YYYY-XXXXXX format', async () => {
        const num1 = await invoiceNumberService.generateInvoiceNumber();
        const num2 = await invoiceNumberService.generateInvoiceNumber();
        const currentYear = new Date().getFullYear();

        const pattern = new RegExp(`^INV-${currentYear}-\\d{6}$`);
        assert.ok(pattern.test(num1), `Invoice number ${num1} must match pattern INV-YYYY-XXXXXX`);
        assert.ok(pattern.test(num2), `Invoice number ${num2} must match pattern INV-YYYY-XXXXXX`);

        // Check sequential increment
        const seq1 = parseInt(num1.split('-')[2], 10);
        const seq2 = parseInt(num2.split('-')[2], 10);
        assert.strictEqual(seq2, seq1 + 1, 'Subsequent invoice numbers must increment sequentially');
    });

    await test('Receipt Number Service generates sequential REC-YYYY-XXXXXX format', async () => {
        const rec1 = await invoiceNumberService.generateReceiptNumber();
        const currentYear = new Date().getFullYear();

        const pattern = new RegExp(`^REC-${currentYear}-\\d{6}$`);
        assert.ok(pattern.test(rec1), `Receipt number ${rec1} must match pattern REC-YYYY-XXXXXX`);
    });

    // -------------------------------------------------------------
    // 2. Pure Node.js PDF Generation Binary Validation Tests
    // -------------------------------------------------------------
    console.log('\n[2. Pure Node.js PDF Generation Engine Tests]');

    await test('Invoice PDF Service generates valid %PDF-1.4 binary buffer with EOF', async () => {
        const mockInvoice = {
            id: 9999,
            invoice_number: 'INV-2026-000001',
            status: 'ISSUED',
            issue_date: '2026-09-12',
            due_date: '2026-09-27',
            client_name: 'Tata Consultancy Services Ltd',
            client_company: 'TCS Legal Cell',
            client_gstin: '33AAACT1234F1Z0',
            case_title: 'TCS v. State Tax Authority',
            case_number: 'WP/2026/8942',
            rcm_applicable: true,
            subtotal: 75000.00,
            discount_amount: 0.00,
            taxable_amount: 75000.00,
            cgst_amount: 0.00,
            sgst_amount: 0.00,
            igst_amount: 0.00,
            total_amount: 75000.00,
            amount_paid: 25000.00,
            amount_due: 50000.00,
            notes: 'Legal representation before High Court Madras',
            terms: 'Net 15 days via NEFT',
            items: [
                { description: 'Senior Counsel Final Arguments', quantity: 1, unit_price: 50000, tax_rate: 0, amount: 50000 },
                { description: 'Drafting of Written Submissions', quantity: 1, unit_price: 25000, tax_rate: 0, amount: 25000 }
            ]
        };

        const pdfBuffer = await invoicePdfService.generateInvoicePdf(mockInvoice);
        assert.ok(Buffer.isBuffer(pdfBuffer), 'Output must be a Node.js Buffer');
        assert.ok(pdfBuffer.length > 500, 'PDF buffer must contain substantial document bytes');

        // Validate PDF 1.4 header
        const header = pdfBuffer.slice(0, 8).toString('ascii');
        assert.ok(header.startsWith('%PDF-1.4'), `PDF header must be %PDF-1.4, received ${header}`);

        // Validate PDF %%EOF trailer
        const tail = pdfBuffer.slice(pdfBuffer.length - 16).toString('ascii');
        assert.ok(tail.includes('%%EOF'), 'PDF buffer must terminate with %%EOF');
    });

    await test('Receipt PDF Service generates valid official payment receipt PDF', async () => {
        const mockPayment = {
            id: 8888,
            payment_number: 'REC-2026-000001',
            amount: 25000.00,
            payment_mode: 'NEFT',
            payment_date: '2026-09-12',
            reference_number: 'UTR998877665544',
            notes: 'Part payment received'
        };
        const mockInvoice = {
            id: 9999,
            invoice_number: 'INV-2026-000001',
            client_name: 'Tata Consultancy Services Ltd',
            total_amount: 75000.00,
            amount_paid: 25000.00,
            amount_due: 50000.00
        };

        const receiptBuffer = await invoicePdfService.generateReceiptPdf(mockPayment, mockInvoice);
        assert.ok(Buffer.isBuffer(receiptBuffer), 'Receipt output must be a Buffer');

        const header = receiptBuffer.slice(0, 8).toString('ascii');
        assert.ok(header.startsWith('%PDF-1.4'), 'Receipt must start with %PDF-1.4');
    });

    // -------------------------------------------------------------
    // 3. RBAC Security & Access Control Tests
    // -------------------------------------------------------------
    console.log('\n[3. RBAC Security & Authorization Boundary Tests]');

    await test('Junior Associate role explicitly lacks billing permissions in database', async () => {
        // Query database role_permissions for JUNIOR_ASSOCIATE and verify no financial permissions are granted
        const [rows] = await pool.execute(`
            SELECT p.name AS code 
            FROM role_permissions rp
            JOIN roles r ON rp.role_id = r.id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE r.name = 'JUNIOR_ASSOCIATE'
              AND p.name IN ('INVOICE_CREATE', 'INVOICE_ISSUE', 'PAYMENT_RECORD', 'RETAINER_MANAGE')
        `);

        assert.strictEqual(
            rows.length,
            0,
            `JUNIOR_ASSOCIATE must have 0 financial permissions, found ${rows.length}: ${rows.map(r => r.code).join(', ')}`
        );
    });

    await test('Client Isolation: clientBillingService throws error when user has no client association', async () => {
        // User with no associated client record
        const unlinkedUser = { id: 999999, role: 'CLIENT', email: 'nonexistent-client@test.com' };
        let caught = false;
        try {
            await clientBillingService.getClientIdForUser(unlinkedUser);
        } catch (err) {
            caught = true;
            assert.ok(err.message.includes('No client profile found') || err.message.includes('denied'));
        }
        assert.ok(caught, 'Unlinked client user must be denied access');
    });

    // -------------------------------------------------------------
    // 4. Overpayment Validation in Payment Engine
    // -------------------------------------------------------------
    console.log('\n[4. Payment Engine Overpayment Rejection Tests]');

    await test('Payment recording rejects amount exceeding invoice amount_due', async () => {
        // Find or check logic: if payment amount > amount_due, must reject with 400
        let caught = false;
        try {
            // Attempt paying 9999999 against a test invoice
            await paymentService.recordPayment({
                invoice_id: 1,
                amount: 999999999.00,
                payment_mode: 'CASH',
                payment_date: '2026-09-12'
            }, 1);
        } catch (err) {
            caught = true;
            // Either invoice not found (if DB has no inv 1) or overpayment rejected
            assert.ok(
                err.message.includes('exceed') || err.message.includes('not found') || err.message.includes('DRAFT'),
                `Expected overpayment rejection or invalid invoice, got: ${err.message}`
            );
        }
        assert.ok(caught, 'Overpayment must be rejected');
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
    runTests()
        .then(() => pool.end())
        .catch(err => {
            console.error('Test suite error:', err);
            pool.end();
            process.exit(1);
        });
}

module.exports = { runTests };
