const clientBillingService = require('../services/clientBillingService');
const invoiceService = require('../services/invoiceService');
const invoicePdfService = require('../services/invoicePdfService');
const paymentService = require('../services/paymentService');

/**
 * Get Client Portal Billing Dashboard (Invoices, Outstanding balance, summary)
 */
const getClientBillingDashboard = async (req, res, next) => {
    try {
        const dashboard = await clientBillingService.getClientBillingDashboard(req.user);
        res.json({
            success: true,
            data: dashboard
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get list of invoices for the authenticated client
 */
const getClientInvoices = async (req, res, next) => {
    try {
        const invoices = await clientBillingService.getClientInvoices(req.user, req.query);
        res.json({
            success: true,
            data: invoices
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get specific invoice detail for the authenticated client
 */
const getClientInvoiceDetail = async (req, res, next) => {
    try {
        const invoice = await clientBillingService.getClientInvoiceDetail(req.user, req.params.id);
        res.json({
            success: true,
            data: invoice
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Download Invoice PDF for the authenticated client
 */
const downloadClientInvoicePdf = async (req, res, next) => {
    try {
        const invoice = await clientBillingService.getClientInvoiceDetail(req.user, req.params.id);
        const pdfBuffer = await invoicePdfService.generateInvoicePdf(invoice);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
    } catch (err) {
        next(err);
    }
};

/**
 * Get list of payments/receipts for the authenticated client
 */
const getClientPayments = async (req, res, next) => {
    try {
        const payments = await clientBillingService.getClientPayments(req.user, req.query);
        res.json({
            success: true,
            data: payments
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Download Receipt PDF for the authenticated client
 */
const downloadClientReceiptPdf = async (req, res, next) => {
    try {
        const clientId = await clientBillingService.getClientIdForUser(req.user);
        const payment = await paymentService.getPaymentById(req.params.id);

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Receipt not found' });
        }

        // Verify the payment belongs to this client's invoice
        const invoice = await invoiceService.getInvoiceById(payment.invoice_id);
        if (!invoice || invoice.client_id !== clientId) {
            return res.status(403).json({ success: false, message: 'Access denied to this receipt' });
        }

        const pdfBuffer = await invoicePdfService.generateReceiptPdf(payment, invoice);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Receipt-${payment.payment_number}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getClientBillingDashboard,
    getClientInvoices,
    getClientInvoiceDetail,
    downloadClientInvoicePdf,
    getClientPayments,
    downloadClientReceiptPdf
};
