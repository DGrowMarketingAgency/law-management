const express = require('express');
const followUpController = require('../controllers/followUpController');
const authenticateToken = require('../middleware/authenticateToken');
const { requirePermission } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('FOLLOWUP_VIEW'), followUpController.getFollowUps);
router.get('/summary', requirePermission('FOLLOWUP_VIEW'), followUpController.getSummary);
router.post('/', requirePermission('FOLLOWUP_CREATE'), followUpController.createFollowUp);
router.patch('/:id/complete', requirePermission('FOLLOWUP_UPDATE'), followUpController.completeFollowUp);
router.patch('/:id', requirePermission('FOLLOWUP_UPDATE'), followUpController.updateFollowUp);
router.delete('/:id', requirePermission('FOLLOWUP_DELETE'), followUpController.deleteFollowUp);

module.exports = router;
