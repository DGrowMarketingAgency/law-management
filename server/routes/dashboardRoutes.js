const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const DashboardController = require("../controllers/dashboardController");

const router = express.Router();

// All dashboard endpoints require valid authentication
router.use(authenticate);

// Top Dashboard Summary (RBAC-aware aggregates across cases, hearings, CRM, billing, workforce, docs)
router.get("/summary", DashboardController.getSummary);

// Widget Sub-endpoints
router.get("/hearings", authorize(["HEARING_VIEW", "CAUSELIST_VIEW"], "ANY"), DashboardController.getUpcomingHearings);
router.get("/tasks", authorize(["WORKFORCE_TASK_VIEW"], "ANY"), DashboardController.getUpcomingTasks);
router.get("/invoices", authorize(["INVOICE_VIEW"], "ANY"), DashboardController.getRecentInvoices);
router.get("/payments", authorize(["PAYMENT_VIEW"], "ANY"), DashboardController.getRecentPayments);
router.get("/activity", DashboardController.getRecentActivity);
router.get("/client-view", DashboardController.getClientDashboard);
router.get("/health", authorize(["SECURITY_VIEW", "USER_VIEW"], "ANY"), DashboardController.getHealth);

module.exports = router;
