const express = require('express');
const billingController = require('../controllers/billingController');
const authenticateToken = require('../middleware/authenticateToken');
const { requirePermission } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/dashboard', requirePermission('INVOICE_VIEW'), billingController.getBillingDashboard);
router.get('/aging', requirePermission('INVOICE_VIEW'), billingController.getAgingAnalysis);
router.get('/export', requirePermission('INVOICE_VIEW'), billingController.exportBillingCsv);

module.exports = router;
