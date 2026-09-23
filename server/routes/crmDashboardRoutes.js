const express = require('express');
const crmDashboardController = require('../controllers/crmDashboardController');
const authenticateToken = require('../middleware/authenticateToken');
const { requirePermission } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('CONTACT_VIEW'), crmDashboardController.getDashboard);
router.get('/metrics', requirePermission('CONTACT_VIEW'), crmDashboardController.getDashboard);

module.exports = router;
