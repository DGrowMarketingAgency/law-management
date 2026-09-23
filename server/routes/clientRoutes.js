const express = require('express');
const clientController = require('../controllers/clientController');
const authenticateToken = require('../middleware/authenticateToken');
const { requirePermission } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('CONTACT_VIEW'), clientController.getClients);
router.post('/', requirePermission('CONTACT_CREATE'), clientController.createClient);
router.get('/:id', requirePermission('CONTACT_VIEW'), clientController.getClientById);
router.patch('/:id/status', requirePermission('CONTACT_UPDATE'), clientController.updateClientStatus);
router.post('/:id/consents', requirePermission('CONTACT_UPDATE'), clientController.recordConsent);
router.patch('/:id/consents/:consentId/withdraw', requirePermission('CONTACT_UPDATE'), clientController.withdrawConsent);

module.exports = router;
