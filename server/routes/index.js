const express = require("express");
const { getHealth } = require("../controllers/healthController");
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const { errorResponse } = require("../utils/apiResponse");

const router = express.Router();

// =======================================================
// Technical Foundation & Health
// =======================================================
router.get("/health", getHealth);

// =======================================================
// Prompt 3: Authentication & User Management Routes
// =======================================================
router.use("/auth", authRoutes);
router.use("/users", userRoutes);

// =======================================================
// Prompt 4: CRM Foundation Routes
// =======================================================
router.use("/contacts", require("./contactRoutes"));
router.use("/clients", require("./clientRoutes"));
router.use("/leads", require("./leadRoutes"));
router.use("/follow-ups", require("./followUpRoutes"));
router.use("/appointments", require("./appointmentRoutes"));
router.use("/conflicts", require("./conflictRoutes"));
router.use("/crm", require("./crmDashboardRoutes"));

// =======================================================
// Prompt 5: Courts, Cases & Cause List Routes
// =======================================================
router.use("/courts", require("./courtRoutes"));
router.use("/cases", require("./caseRoutes"));
router.use("/cause-list", require("./causeListRoutes"));

// =======================================================
// Prompt 6: Limitation Act Deadlines & Rules Routes
// =======================================================
router.use("/deadline-rules", require("./deadlineRuleRoutes"));
router.use("/deadlines", require("./deadlineRoutes"));

// =======================================================
// Prompt 7: Document Management, Versions & Permissions
// =======================================================
const { documentRouter } = require("./documentRoutes");
router.use("/documents", documentRouter);

// =======================================================
// Prompt 7A: Encrypted Document Vault & AppLock
// =======================================================
router.use("/vault", require("./vaultRoutes"));

// =======================================================
// Prompt 8: Billing, Invoicing, Payments & Retainers
// =======================================================
router.use("/billing", require("./billingRoutes"));
router.use("/fee-entries", require("./feeEntryRoutes"));
router.use("/invoices", require("./invoiceRoutes"));
router.use("/payments", require("./paymentRoutes"));
router.use("/retainers", require("./retainerRoutes"));
router.use("/client-portal/billing", require("./clientBillingRoutes"));

// =======================================================
// Prompt 9: Payment Gateways, Webhooks & Settings
// =======================================================
router.use("/webhooks", require("./webhookRoutes"));
router.use("/payment-settings", require("./paymentSettingsRoutes"));

// =======================================================
// Prompt 10: Employee + Internship Management System
// =======================================================
router.use("/workforce", require("./workforceRoutes"));

// =======================================================
// Prompt 12: Central SMTP Email & Security Subsystem
// =======================================================
router.use("/email", require("./emailRoutes"));
router.use("/security", require("./securityRoutes"));

// =======================================================
// Prompt 13: Real-Time Production Dashboard & Analytics
// =======================================================
router.use("/dashboard", require("./dashboardRoutes"));

// =======================================================
// Case Hearing WhatsApp Reminders & WhatsApp Settings
// =======================================================
router.use("/whatsapp", require("./whatsappRoutes"));
router.use("/hearings", require("./hearingReminderRoutes"));

// NOTE: Modules below are intentionally NOT implemented yet.
// They will be introduced in subsequent phases.
// =======================================================
const placeholderHandler = (moduleName) => (req, res) => {
  return errorResponse(
    res,
    `The ${moduleName} module is not yet implemented. It will be available in a future phase.`,
    "MODULE_NOT_IMPLEMENTED",
    null,
    501,
  );
};

const futureModules = [
  { path: "/notifications", name: "Notifications" },
  { path: "/legal-research", name: "Legal Research & Reference" },
  { path: "/audit-logs", name: "Chambers Audit Logs" },
];

futureModules.forEach(({ path, name }) => {
  router.use(path, placeholderHandler(name));
});

module.exports = router;
