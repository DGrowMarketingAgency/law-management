const express = require('express');
const feeEntryController = require('../controllers/feeEntryController');
const authenticateToken = require('../middleware/authenticateToken');
const { requirePermission } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('FEE_ENTRY_VIEW'), feeEntryController.getFeeEntries);
router.post('/', requirePermission('FEE_ENTRY_CREATE'), feeEntryController.createFeeEntry);
router.get('/unbilled', requirePermission('FEE_ENTRY_VIEW'), feeEntryController.getUnbilledFeeEntries);
router.get('/:id', requirePermission('FEE_ENTRY_VIEW'), feeEntryController.getFeeEntryById);
router.put('/:id', requirePermission('FEE_ENTRY_UPDATE'), feeEntryController.updateFeeEntry);
router.delete('/:id', requirePermission('FEE_ENTRY_DELETE'), feeEntryController.deleteFeeEntry);

module.exports = router;
