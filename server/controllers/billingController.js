const pool = require('../config/database');
const billingExportService = require('../services/billingExportService');
const { calculateAgingBuckets } = require('../services/billingCalculationService');

/**
 * Get Chambers Billing Dashboard KPIs and Aging Summary
 */
const getBillingDashboard = async (req, res, next) => {
    try {
        // 1. Total Billed (ISSUED, SENT, PARTIALLY_PAID, PAID)
        const [billedRows] = await pool.execute(`
            SELECT 
                COALESCE(SUM(total_amount), 0) AS total_billed,
                COALESCE(SUM(tax_amount), 0) AS total_tax,
                COALESCE(SUM(amount_paid), 0) AS total_collected,
                COALESCE(SUM(amount_due), 0) AS total_outstanding,
                COUNT(*) AS total_invoices
            FROM invoices
            WHERE status IN ('ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')
        `);

        // 2. Retainers Held (Active balance)
        const [retainerRows] = await pool.execute(`
            SELECT 
                COALESCE(SUM(current_balance), 0) AS total_retainers_held,
                COUNT(*) AS total_retainer_accounts
            FROM retainers
            WHERE status = 'ACTIVE'
        `);

        // 3. Unbilled Fee Entries
        const [unbilledRows] = await pool.execute(`
            SELECT 
                COALESCE(SUM(amount), 0) AS total_unbilled_amount,
                COUNT(*) AS total_unbilled_entries
            FROM fee_entries
            WHERE status = 'UNBILLED' AND deleted_at IS NULL
        `);

        // 4. Invoices by Status count
        const [statusRows] = await pool.execute(`
            SELECT status, COUNT(*) as count, COALESCE(SUM(amount_due), 0) as total_due
            FROM invoices
            GROUP BY status
        `);

        // 5. Unpaid / Overdue invoices for aging calculations
        const [unpaidInvoices] = await pool.execute(`
            SELECT 
                i.id, i.invoice_number, i.due_date, i.amount_due, i.total_amount, i.status,
                cnt.display_name AS client_name,
                cases.case_number, cases.title AS case_title
            FROM invoices i
            JOIN clients cl ON i.client_id = cl.id
            JOIN contacts cnt ON cl.contact_id = cnt.id
            LEFT JOIN cases ON i.case_id = cases.id
            WHERE i.status IN ('ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
              AND i.amount_due > 0
            ORDER BY i.due_date ASC
        `);

        const aging = calculateAgingBuckets(unpaidInvoices);

        // 6. Recent Payments
        const [recentPayments] = await pool.execute(`
            SELECT 
                p.id, p.receipt_number, p.receipt_number AS payment_number,
                p.amount, p.payment_method, p.payment_method AS payment_mode,
                p.payment_date, p.reference_number,
                i.invoice_number,
                cnt.display_name AS client_name
            FROM payments p
            JOIN invoices i ON p.invoice_id = i.id
            JOIN clients cl ON i.client_id = cl.id
            JOIN contacts cnt ON cl.contact_id = cnt.id
            ORDER BY p.payment_date DESC, p.created_at DESC
            LIMIT 5
        `);

        res.json({
            success: true,
            data: {
                kpis: {
                    totalBilled: parseFloat(billedRows[0].total_billed) || 0,
                    totalTax: parseFloat(billedRows[0].total_tax) || 0,
                    totalCollected: parseFloat(billedRows[0].total_collected) || 0,
                    totalOutstanding: parseFloat(billedRows[0].total_outstanding) || 0,
                    totalInvoices: billedRows[0].total_invoices || 0,
                    totalRetainersHeld: parseFloat(retainerRows[0].total_retainers_held) || 0,
                    totalUnbilledAmount: parseFloat(unbilledRows[0].total_unbilled_amount) || 0,
                    totalUnbilledEntries: unbilledRows[0].total_unbilled_entries || 0
                },
                statusBreakdown: statusRows,
                aging,
                recentPayments
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get aging analysis report
 */
const getAgingAnalysis = async (req, res, next) => {
    try {
        const [unpaidInvoices] = await pool.execute(`
            SELECT 
                i.id, i.invoice_number, i.invoice_date AS issue_date, i.due_date, i.total_amount, i.amount_paid, i.amount_due, i.status,
                cl.id AS client_id, cnt.display_name AS client_name, cnt.contact_type AS client_type,
                cases.case_number, cases.title AS case_title
            FROM invoices i
            JOIN clients cl ON i.client_id = cl.id
            JOIN contacts cnt ON cl.contact_id = cnt.id
            LEFT JOIN cases ON i.case_id = cases.id
            WHERE i.status IN ('ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
              AND i.amount_due > 0
            ORDER BY i.due_date ASC
        `);

        const aging = calculateAgingBuckets(unpaidInvoices);

        res.json({
            success: true,
            data: aging
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Export Invoices and Billing Data as RFC-4180 CSV for Chartered Accountants / Tally
 */
const exportBillingCsv = async (req, res, next) => {
    try {
        const type = req.query.type || 'invoices'; // 'invoices' | 'payments'
        let csvData;
        let filename;

        if (type === 'payments') {
            csvData = await billingExportService.generatePaymentsCsv(req.query);
            filename = `payments-export-${new Date().toISOString().slice(0, 10)}.csv`;
        } else {
            csvData = await billingExportService.generateInvoicesCsv(req.query);
            filename = `invoices-export-${new Date().toISOString().slice(0, 10)}.csv`;
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvData);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getBillingDashboard,
    getAgingAnalysis,
    exportBillingCsv
};
