const express = require('express');
const conflictController = require('../controllers/conflictController');
const authenticateToken = require('../middleware/authenticateToken');
const { requirePermission } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.post('/check', requirePermission('CONFLICT_CHECK'), conflictController.checkConflict);

module.exports = router;
