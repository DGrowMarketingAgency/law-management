const express = require('express');
const leadController = require('../controllers/leadController');
const authenticateToken = require('../middleware/authenticateToken');
const { requirePermission } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('LEAD_VIEW'), leadController.getLeads);
router.post('/', requirePermission('LEAD_CREATE'), leadController.createLead);
router.get('/:id', requirePermission('LEAD_VIEW'), leadController.getLeadById);
router.patch('/:id', requirePermission('LEAD_UPDATE'), leadController.updateLead);
router.post('/:id/convert', requirePermission('LEAD_CONVERT'), leadController.convertLead);
router.post('/:id/activities', requirePermission('LEAD_UPDATE'), leadController.addActivity);

module.exports = router;
