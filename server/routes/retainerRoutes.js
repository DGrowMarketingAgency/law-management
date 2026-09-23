const express = require('express');
const retainerController = require('../controllers/retainerController');
const authenticateToken = require('../middleware/authenticateToken');
const { requirePermission } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('RETAINER_VIEW'), retainerController.listRetainers);
router.post('/', requirePermission('RETAINER_MANAGE'), retainerController.createRetainer);
router.get('/:id', requirePermission('RETAINER_VIEW'), retainerController.getRetainer);
router.post('/:id/deposit', requirePermission('RETAINER_MANAGE'), retainerController.depositFunds);
router.post('/:id/refund', requirePermission('RETAINER_MANAGE'), retainerController.refundFunds);

module.exports = router;
