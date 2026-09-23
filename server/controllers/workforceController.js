const WorkforceService = require("../services/workforceService");
const CandidateService = require("../services/candidateService");
const OnboardingService = require("../services/onboardingService");
const AttendanceService = require("../services/attendanceService");
const LeaveService = require("../services/leaveService");
const WorkforceTaskService = require("../services/workforceTaskService");
const PayrollService = require("../services/payrollService");
const PerformanceService = require("../services/performanceService");
const AssetService = require("../services/assetService");
const OffboardingService = require("../services/offboardingService");

/**
 * WorkforceController
 * Handles incoming REST requests for the Chambers Employee and Internship Management System.
 */
class WorkforceController {
  // Directory & Profiles
  static async getDirectory(req, res, next) {
    try {
      const result = await WorkforceService.getDirectory(req.query, req.user);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const result = await WorkforceService.getProfileById(req.params.id, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createProfile(req, res, next) {
    try {
      const result = await WorkforceService.createProfile(req.body, req.user.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const result = await WorkforceService.updateProfile(
        req.params.id,
        req.body,
        req.user,
        req.ip,
        req.headers["user-agent"]
      );
      res.json({ success: true, data: result, message: "Workforce profile updated successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async activateProfile(req, res, next) {
    try {
      const result = await WorkforceService.activateProfile(req.params.id, req.user, req.body);
      res.json({ success: true, data: result, message: "Workforce member activated successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async deactivateProfile(req, res, next) {
    try {
      const { reason } = req.body;
      const result = await WorkforceService.deactivateProfile(req.params.id, req.user, reason);
      res.json({ success: true, data: result, message: "Workforce member deactivated successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async restoreProfile(req, res, next) {
    try {
      const { reason } = req.body;
      const result = await WorkforceService.restoreProfile(req.params.id, req.user, reason);
      res.json({ success: true, data: result, message: "Workforce member restored to active status" });
    } catch (err) {
      next(err);
    }
  }

  static async checkDeletionSafety(req, res, next) {
    try {
      const result = await WorkforceService.checkDeletionSafety(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async deleteOrArchiveProfile(req, res, next) {
    try {
      const { action, confirmation_code } = req.body;
      const result = await WorkforceService.deleteOrArchiveProfile(
        req.params.id,
        action || "ARCHIVE",
        confirmation_code,
        req.user
      );
      res.json({ success: true, data: result, message: result.message });
    } catch (err) {
      next(err);
    }
  }

  static async resetPasswordForEmployee(req, res, next) {
    try {
      const result = await WorkforceService.resetPasswordForEmployee(req.params.id, req.user);
      res.json({ success: true, data: result, message: result.message });
    } catch (err) {
      next(err);
    }
  }

  static async resendInvitation(req, res, next) {
    try {
      const result = await WorkforceService.resendInvitation(req.params.id, req.user);
      res.json({ success: true, data: result, message: result.message });
    } catch (err) {
      next(err);
    }
  }

  static async getAssignedCases(req, res, next) {
    try {
      const result = await WorkforceService.getAssignedCases(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getMemberAttendance(req, res, next) {
    try {
      const result = await WorkforceService.getMemberAttendance(req.params.id, req.query);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getMemberLeaves(req, res, next) {
    try {
      const result = await WorkforceService.getMemberLeaves(req.params.id, req.query);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getMemberTasks(req, res, next) {
    try {
      const result = await WorkforceService.getMemberTasks(req.params.id, req.query);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getMemberDocuments(req, res, next) {
    try {
      const result = await WorkforceService.getMemberDocuments(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getMemberAuditHistory(req, res, next) {
    try {
      const result = await WorkforceService.getMemberAuditHistory(req.params.id, req.query);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const { status, reason } = req.body;
      const result = await WorkforceService.updateStatus(req.params.id, status, reason, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getDashboardStats(req, res, next) {
    try {
      const stats = await WorkforceService.getDashboardStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  // Candidate Pipeline & Recruitment
  static async getCandidates(req, res, next) {
    try {
      const result = await CandidateService.getCandidates(req.query);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getCandidate(req, res, next) {
    try {
      const result = await CandidateService.getCandidateById(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createCandidate(req, res, next) {
    try {
      const result = await CandidateService.createCandidate(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateCandidateStage(req, res, next) {
    try {
      const result = await CandidateService.updateStage(req.params.id, req.body.stage, req.body.remarks);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async scheduleInterview(req, res, next) {
    try {
      const result = await CandidateService.scheduleInterview(req.params.id, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async recordInterviewFeedback(req, res, next) {
    try {
      const result = await CandidateService.recordInterviewFeedback(req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createOffer(req, res, next) {
    try {
      const result = await CandidateService.createOffer(req.params.id, req.body, req.user.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async acceptOffer(req, res, next) {
    try {
      const result = await CandidateService.acceptOffer(req.params.id, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Onboarding
  static async getOnboardingChecklist(req, res, next) {
    try {
      const result = await OnboardingService.getChecklist(req.params.workforceId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateOnboardingChecklistItem(req, res, next) {
    try {
      const result = await OnboardingService.updateChecklistItem(req.params.id, req.body, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async addOnboardingChecklistItem(req, res, next) {
    try {
      const result = await OnboardingService.addChecklistItem(req.params.workforceId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async completeOnboarding(req, res, next) {
    try {
      const result = await OnboardingService.completeOnboardingAndActivate(
        req.params.workforceId,
        req.body,
        req.user
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Attendance
  static async checkIn(req, res, next) {
    try {
      const result = await AttendanceService.checkIn(req.params.workforceId, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async checkOut(req, res, next) {
    try {
      const result = await AttendanceService.checkOut(req.params.workforceId, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getAttendanceLogs(req, res, next) {
    try {
      const result = await AttendanceService.getLogs(req.query);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async regularizeAttendance(req, res, next) {
    try {
      const result = await AttendanceService.regularizeAttendance(req.params.id, req.body, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getMonthlySummary(req, res, next) {
    try {
      const { year, month } = req.query;
      const result = await AttendanceService.getMonthlySummary(req.params.workforceId, year, month);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Leave Management
  static async getLeaveTypes(req, res, next) {
    try {
      const result = await LeaveService.getLeaveTypes(req.query.workforce_type);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getBalances(req, res, next) {
    try {
      const result = await LeaveService.getBalances(req.params.workforceId, req.query.year);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async applyLeave(req, res, next) {
    try {
      const result = await LeaveService.applyLeave(req.params.workforceId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getLeaveRequests(req, res, next) {
    try {
      const result = await LeaveService.getLeaveRequests(req.query, req.user);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async processLeaveRequest(req, res, next) {
    try {
      const { action, rejection_reason } = req.body;
      const result = await LeaveService.processLeaveRequest(req.params.id, action, { rejection_reason }, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Workforce Tasks
  static async getTasks(req, res, next) {
    try {
      const result = await WorkforceTaskService.getTasks(req.query, req.user);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getTask(req, res, next) {
    try {
      const result = await WorkforceTaskService.getTaskById(req.params.id, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createTask(req, res, next) {
    try {
      const result = await WorkforceTaskService.createTask(req.body, req.user.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateTask(req, res, next) {
    try {
      const result = await WorkforceTaskService.updateTask(req.params.id, req.body, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Payroll, Stipends & Bank Accounts
  static async setSalaryStructure(req, res, next) {
    try {
      const result = await PayrollService.setSalaryStructure(req.params.workforceId, req.body, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async setInternStipend(req, res, next) {
    try {
      const result = await PayrollService.setInternStipend(req.params.workforceId, req.body, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async saveBankAccount(req, res, next) {
    try {
      const result = await PayrollService.saveBankAccount(req.params.workforceId, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createDisbursement(req, res, next) {
    try {
      const result = await PayrollService.createDisbursement(req.body, req.user.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async markDisbursementPaid(req, res, next) {
    try {
      const result = await PayrollService.markDisbursementPaid(req.params.id, req.body, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getDisbursements(req, res, next) {
    try {
      const result = await PayrollService.getDisbursements(req.query);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async submitReimbursement(req, res, next) {
    try {
      const result = await PayrollService.submitReimbursement(req.params.workforceId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getReimbursements(req, res, next) {
    try {
      const result = await PayrollService.getReimbursements(req.query, req.user);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async processReimbursement(req, res, next) {
    try {
      const { action, rejection_reason } = req.body;
      const result = await PayrollService.processReimbursement(req.params.id, action, { rejection_reason }, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Performance & Warnings
  static async getGoals(req, res, next) {
    try {
      const result = await PerformanceService.getGoals(req.params.workforceId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createGoal(req, res, next) {
    try {
      const result = await PerformanceService.createGoal(req.params.workforceId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateGoal(req, res, next) {
    try {
      const result = await PerformanceService.updateGoal(req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getReviews(req, res, next) {
    try {
      const result = await PerformanceService.getReviews(req.params.workforceId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createReview(req, res, next) {
    try {
      const result = await PerformanceService.createReview(req.params.workforceId, req.body, req.user.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getWarnings(req, res, next) {
    try {
      const result = await PerformanceService.getWarnings(req.params.workforceId, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async issueWarning(req, res, next) {
    try {
      const result = await PerformanceService.issueWarning(req.params.workforceId, req.body, req.user.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateWarning(req, res, next) {
    try {
      const result = await PerformanceService.updateWarning(req.params.id, req.body, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Assets
  static async getAssets(req, res, next) {
    try {
      const result = await AssetService.getAssets(req.query);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async assignAsset(req, res, next) {
    try {
      const result = await AssetService.assignAsset(req.body, req.user.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async returnAsset(req, res, next) {
    try {
      const result = await AssetService.returnAsset(req.params.id, req.body, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Offboarding & Revocation
  static async submitExitRequest(req, res, next) {
    try {
      const result = await OffboardingService.submitExitRequest(req.params.workforceId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getOffboardingDetails(req, res, next) {
    try {
      const result = await OffboardingService.getOffboardingDetails(req.params.workforceId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async processExitRequest(req, res, next) {
    try {
      const { action, actual_last_working_date, rejection_reason } = req.body;
      const result = await OffboardingService.processExitRequest(
        req.params.workforceId,
        action,
        { actual_last_working_date, rejection_reason },
        req.user.id
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createHandoverItem(req, res, next) {
    try {
      const result = await OffboardingService.createHandoverItem(req.params.workforceId, req.body, req.user.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateOffboardingChecklistItem(req, res, next) {
    try {
      const result = await OffboardingService.updateOffboardingChecklistItem(req.params.id, req.body, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async executeFullRevocation(req, res, next) {
    try {
      const result = await OffboardingService.executeFullRevocationAndExit(req.params.workforceId, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async issueInternshipCertificate(req, res, next) {
    try {
      const result = await OffboardingService.issueInternshipCertificate(req.params.workforceId, req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = WorkforceController;
