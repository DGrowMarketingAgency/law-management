const express = require('express');
const invoiceController = require('../controllers/invoiceController');
const authenticateToken = require('../middleware/authenticateToken');
const { requirePermission } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requirePermission('INVOICE_VIEW'), invoiceController.getInvoices);
router.post('/', requirePermission('INVOICE_CREATE'), invoiceController.createInvoice);
router.get('/:id', requirePermission('INVOICE_VIEW'), invoiceController.getInvoiceById);
router.put('/:id', requirePermission('INVOICE_UPDATE'), invoiceController.updateDraftInvoice);
router.post('/:id/issue', requirePermission('INVOICE_ISSUE'), invoiceController.issueInvoice);
router.post('/:id/send', requirePermission('INVOICE_ISSUE'), invoiceController.sendInvoice);
router.post('/:id/cancel', requirePermission('INVOICE_CANCEL'), invoiceController.cancelInvoice);
router.post('/:id/void', requirePermission('INVOICE_CANCEL'), invoiceController.voidInvoice);
router.get('/:id/pdf', requirePermission('INVOICE_VIEW'), invoiceController.downloadInvoicePdf);
router.get('/:id/reminder-preview', requirePermission('INVOICE_VIEW'), invoiceController.previewReminder);
router.post('/:id/remind', requirePermission('INVOICE_ISSUE'), invoiceController.sendReminder);

// Prompt 9: Payment Reminders (Email & WhatsApp)
const reminderController = require('../controllers/paymentReminderController');
router.post('/:id/reminders/email', requirePermission('REMINDER_SEND'), reminderController.sendEmailReminder);
router.post('/:id/reminders/whatsapp', requirePermission('REMINDER_SEND'), reminderController.sendWhatsAppReminder);
router.post('/:id/reminders/send', requirePermission('REMINDER_SEND'), reminderController.sendReminder);
router.get('/:id/reminders', requirePermission('INVOICE_VIEW'), reminderController.getReminders);

module.exports = router;
