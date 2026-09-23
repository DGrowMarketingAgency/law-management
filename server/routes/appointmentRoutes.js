const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const authenticateToken = require('../middleware/authenticateToken');
const { requirePermission } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('APPOINTMENT_VIEW'), appointmentController.getAppointments);
router.post('/', requirePermission('APPOINTMENT_CREATE'), appointmentController.createAppointment);
router.get('/:id', requirePermission('APPOINTMENT_VIEW'), appointmentController.getAppointmentById);
router.patch('/:id', requirePermission('APPOINTMENT_UPDATE'), appointmentController.updateAppointment);
router.delete('/:id', requirePermission('APPOINTMENT_DELETE'), appointmentController.deleteAppointment);

module.exports = router;
