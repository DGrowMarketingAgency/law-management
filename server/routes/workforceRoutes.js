const express = require("express");
const WorkforceController = require("../controllers/workforceController");
const authenticateToken = require("../middleware/authenticateToken");
const { requirePermission } = require("../middleware/rbacMiddleware");

const router = express.Router();

// Require JWT authentication for all workforce endpoints
router.use(authenticateToken);

// ==========================================
// 1. Dashboard & Directory
// ==========================================
router.get("/dashboard", requirePermission("WORKFORCE_VIEW"), WorkforceController.getDashboardStats);
router.get("/directory", requirePermission("WORKFORCE_VIEW"), WorkforceController.getDirectory);
router.post("/profiles", requirePermission("WORKFORCE_CREATE"), WorkforceController.createProfile);
router.get("/profiles/:id", requirePermission("WORKFORCE_VIEW"), WorkforceController.getProfile);
router.put("/profiles/:id", requirePermission("WORKFORCE_UPDATE"), WorkforceController.updateProfile);
router.patch("/profiles/:id", requirePermission("WORKFORCE_UPDATE"), WorkforceController.updateProfile);
router.patch("/profiles/:id/status", requirePermission("WORKFORCE_UPDATE"), WorkforceController.updateStatus);

// Profile Lifecycle & Administrative Actions
router.post("/profiles/:id/activate", requirePermission(["WORKFORCE_UPDATE", "ONBOARDING_MANAGE"]), WorkforceController.activateProfile);
router.post("/profiles/:id/deactivate", requirePermission(["WORKFORCE_UPDATE", "USER_DISABLE"]), WorkforceController.deactivateProfile);
router.post("/profiles/:id/restore", requirePermission("WORKFORCE_UPDATE"), WorkforceController.restoreProfile);
router.get("/profiles/:id/deletion-safety", requirePermission(["WORKFORCE_VIEW", "WORKFORCE_DELETE"]), WorkforceController.checkDeletionSafety);
router.post("/profiles/:id/archive", requirePermission("WORKFORCE_DELETE"), WorkforceController.deleteOrArchiveProfile);
router.delete("/profiles/:id", requirePermission("WORKFORCE_DELETE"), WorkforceController.deleteOrArchiveProfile);
router.post("/profiles/:id/reset-password", requirePermission(["WORKFORCE_UPDATE", "USER_UPDATE"]), WorkforceController.resetPasswordForEmployee);
router.post("/profiles/:id/resend-invitation", requirePermission(["WORKFORCE_CREATE", "WORKFORCE_UPDATE", "USER_CREATE"]), WorkforceController.resendInvitation);

// Profile Tab Data
router.get("/profiles/:id/assigned-cases", requirePermission("WORKFORCE_VIEW"), WorkforceController.getAssignedCases);
router.get("/profiles/:id/attendance", requirePermission(["WORKFORCE_VIEW", "ATTENDANCE_VIEW"]), WorkforceController.getMemberAttendance);
router.get("/profiles/:id/leave", requirePermission(["WORKFORCE_VIEW", "LEAVE_VIEW"]), WorkforceController.getMemberLeaves);
router.get("/profiles/:id/tasks", requirePermission(["WORKFORCE_VIEW", "WORKFORCE_TASK_VIEW"]), WorkforceController.getMemberTasks);
router.get("/profiles/:id/documents", requirePermission("WORKFORCE_VIEW"), WorkforceController.getMemberDocuments);
router.get("/profiles/:id/activity", requirePermission("WORKFORCE_VIEW"), WorkforceController.getMemberAuditHistory);

// ==========================================
// 2. Candidate Pipeline & Recruitment
// ==========================================
router.get("/candidates", requirePermission("CANDIDATE_VIEW"), WorkforceController.getCandidates);
router.post("/candidates", requirePermission("CANDIDATE_MANAGE"), WorkforceController.createCandidate);
router.get("/candidates/:id", requirePermission("CANDIDATE_VIEW"), WorkforceController.getCandidate);
router.patch("/candidates/:id/stage", requirePermission("CANDIDATE_MANAGE"), WorkforceController.updateCandidateStage);
router.post("/candidates/:id/interviews", requirePermission("INTERVIEW_MANAGE"), WorkforceController.scheduleInterview);
router.patch("/interviews/:id/feedback", requirePermission("INTERVIEW_MANAGE"), WorkforceController.recordInterviewFeedback);
router.post("/candidates/:id/offers", requirePermission("OFFER_MANAGE"), WorkforceController.createOffer);
router.post("/offers/:id/accept", requirePermission("OFFER_MANAGE"), WorkforceController.acceptOffer);

// ==========================================
// 3. Onboarding Checklists & Activation
// ==========================================
router.get("/profiles/:workforceId/onboarding", requirePermission("WORKFORCE_VIEW"), WorkforceController.getOnboardingChecklist);
router.post("/profiles/:workforceId/onboarding-items", requirePermission("ONBOARDING_MANAGE"), WorkforceController.addOnboardingChecklistItem);
router.patch("/onboarding-items/:id", requirePermission("ONBOARDING_MANAGE"), WorkforceController.updateOnboardingChecklistItem);
router.post("/profiles/:workforceId/complete-onboarding", requirePermission("ONBOARDING_MANAGE"), WorkforceController.completeOnboarding);

// ==========================================
// 4. Attendance
// ==========================================
router.post("/profiles/:workforceId/attendance/check-in", requirePermission("ATTENDANCE_MANAGE"), WorkforceController.checkIn);
router.post("/profiles/:workforceId/attendance/check-out", requirePermission("ATTENDANCE_MANAGE"), WorkforceController.checkOut);
router.get("/attendance/logs", requirePermission("ATTENDANCE_VIEW"), WorkforceController.getAttendanceLogs);
router.patch("/attendance/:id/regularize", requirePermission("ATTENDANCE_MANAGE"), WorkforceController.regularizeAttendance);
router.get("/profiles/:workforceId/attendance/monthly-summary", requirePermission("ATTENDANCE_VIEW"), WorkforceController.getMonthlySummary);

// ==========================================
// 5. Leave Management
// ==========================================
router.get("/leaves/types", requirePermission("LEAVE_VIEW"), WorkforceController.getLeaveTypes);
router.get("/profiles/:workforceId/leaves/balances", requirePermission("LEAVE_VIEW"), WorkforceController.getBalances);
router.post("/profiles/:workforceId/leaves/apply", requirePermission("LEAVE_APPLY"), WorkforceController.applyLeave);
router.get("/leaves/requests", requirePermission("LEAVE_VIEW"), WorkforceController.getLeaveRequests);
router.patch("/leaves/requests/:id/process", requirePermission("LEAVE_APPROVE"), WorkforceController.processLeaveRequest);

// ==========================================
// 6. Workforce Tasks
// ==========================================
router.get("/tasks", requirePermission("WORKFORCE_TASK_VIEW"), WorkforceController.getTasks);
router.post("/tasks", requirePermission("WORKFORCE_TASK_MANAGE"), WorkforceController.createTask);
router.get("/tasks/:id", requirePermission("WORKFORCE_TASK_VIEW"), WorkforceController.getTask);
router.patch("/tasks/:id", requirePermission("WORKFORCE_TASK_VIEW"), WorkforceController.updateTask);

// ==========================================
// 7. Internal Payroll, Stipends & Reimbursements
// ==========================================
router.post("/profiles/:workforceId/salary-structure", requirePermission("SALARY_MANAGE"), WorkforceController.setSalaryStructure);
router.post("/profiles/:workforceId/intern-stipend", requirePermission("STIPEND_MANAGE"), WorkforceController.setInternStipend);
router.post("/profiles/:workforceId/bank-account", requirePermission(["WORKFORCE_CREATE", "WORKFORCE_UPDATE"]), WorkforceController.saveBankAccount);
router.get("/payroll/disbursements", requirePermission(["SALARY_VIEW", "STIPEND_VIEW"]), WorkforceController.getDisbursements);
router.post("/payroll/disbursements", requirePermission(["SALARY_MANAGE", "STIPEND_MANAGE"]), WorkforceController.createDisbursement);
router.patch("/payroll/disbursements/:id/paid", requirePermission(["SALARY_MANAGE", "STIPEND_MANAGE"]), WorkforceController.markDisbursementPaid);
router.post("/profiles/:workforceId/reimbursements", requirePermission("REIMBURSEMENT_MANAGE"), WorkforceController.submitReimbursement);
router.get("/payroll/reimbursements", requirePermission("REIMBURSEMENT_VIEW"), WorkforceController.getReimbursements);
router.patch("/payroll/reimbursements/:id/process", requirePermission("REIMBURSEMENT_MANAGE"), WorkforceController.processReimbursement);

// ==========================================
// 8. Performance, Goals & Warnings
// ==========================================
router.get("/profiles/:workforceId/goals", requirePermission("PERFORMANCE_VIEW"), WorkforceController.getGoals);
router.post("/profiles/:workforceId/goals", requirePermission("PERFORMANCE_MANAGE"), WorkforceController.createGoal);
router.patch("/goals/:id", requirePermission("PERFORMANCE_MANAGE"), WorkforceController.updateGoal);
router.get("/profiles/:workforceId/reviews", requirePermission("PERFORMANCE_VIEW"), WorkforceController.getReviews);
router.post("/profiles/:workforceId/reviews", requirePermission("PERFORMANCE_MANAGE"), WorkforceController.createReview);
router.get("/profiles/:workforceId/warnings", requirePermission("PERFORMANCE_VIEW"), WorkforceController.getWarnings);
router.post("/profiles/:workforceId/warnings", requirePermission("WARNING_MANAGE"), WorkforceController.issueWarning);
router.patch("/warnings/:id", requirePermission("PERFORMANCE_VIEW"), WorkforceController.updateWarning);

// ==========================================
// 9. Assets
// ==========================================
router.get("/assets", requirePermission("ASSET_VIEW"), WorkforceController.getAssets);
router.post("/assets/assign", requirePermission("ASSET_MANAGE"), WorkforceController.assignAsset);
router.patch("/assets/:id/return", requirePermission("ASSET_MANAGE"), WorkforceController.returnAsset);

// ==========================================
// 10. Exit & Offboarding
// ==========================================
router.post("/profiles/:workforceId/exit-request", requirePermission("WORKFORCE_VIEW"), WorkforceController.submitExitRequest);
router.get("/profiles/:workforceId/offboarding", requirePermission("EXIT_VIEW"), WorkforceController.getOffboardingDetails);
router.patch("/profiles/:workforceId/exit-request/process", requirePermission("EXIT_MANAGE"), WorkforceController.processExitRequest);
router.post("/profiles/:workforceId/handovers", requirePermission("EXIT_MANAGE"), WorkforceController.createHandoverItem);
router.patch("/offboarding-items/:id", requirePermission("EXIT_MANAGE"), WorkforceController.updateOffboardingChecklistItem);
router.post("/profiles/:workforceId/revoke-and-exit", requirePermission("ACCESS_REVOKE"), WorkforceController.executeFullRevocation);
router.post("/profiles/:workforceId/issue-certificate", requirePermission("EXIT_MANAGE"), WorkforceController.issueInternshipCertificate);

module.exports = router;
