const express = require('express');
const clientBillingController = require('../controllers/clientBillingController');
const authenticateToken = require('../middleware/authenticateToken');
const { requirePermission } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authenticateToken);

// Client portal billing endpoints - requires CLIENT_BILLING_VIEW (granted to CLIENT, and also accessible to OWNER/SENIOR_ASSOCIATE)
router.get('/dashboard', requirePermission('CLIENT_BILLING_VIEW'), clientBillingController.getClientBillingDashboard);
router.get('/invoices', requirePermission('CLIENT_BILLING_VIEW'), clientBillingController.getClientInvoices);
router.get('/invoices/:id', requirePermission('CLIENT_BILLING_VIEW'), clientBillingController.getClientInvoiceDetail);
router.get('/invoices/:id/pdf', requirePermission('CLIENT_BILLING_VIEW'), clientBillingController.downloadClientInvoicePdf);
router.get('/payments', requirePermission('CLIENT_BILLING_VIEW'), clientBillingController.getClientPayments);
router.get('/payments/:id/receipt', requirePermission('CLIENT_BILLING_VIEW'), clientBillingController.downloadClientReceiptPdf);

module.exports = router;
