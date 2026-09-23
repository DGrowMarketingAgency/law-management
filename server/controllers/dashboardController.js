const DashboardService = require("../services/dashboard/dashboardService");
const { successResponse } = require("../utils/apiResponse");

/**
 * Dashboard Controller
 */
class DashboardController {
  /**
   * GET /api/v1/dashboard/summary
   */
  static async getSummary(req, res, next) {
    try {
      const { period = "this_month", from, to } = req.query;
      const data = await DashboardService.getDashboardSummary({
        user: req.user,
        period,
        from,
        to,
      });

      return successResponse(res, "Dashboard summary loaded successfully", data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/dashboard/hearings
   */
  static async getUpcomingHearings(req, res, next) {
    try {
      const { limit = 5 } = req.query;
      const data = await DashboardService.getUpcomingHearings({
        user: req.user,
        limit,
      });

      return successResponse(res, "Upcoming hearings retrieved", data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/dashboard/tasks
   */
  static async getUpcomingTasks(req, res, next) {
    try {
      const { limit = 5 } = req.query;
      const data = await DashboardService.getUpcomingTasks({
        user: req.user,
        limit,
      });

      return successResponse(res, "Upcoming tasks retrieved", data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/dashboard/invoices
   */
  static async getRecentInvoices(req, res, next) {
    try {
      const { limit = 5 } = req.query;
      const data = await DashboardService.getRecentInvoices({
        user: req.user,
        limit,
      });

      return successResponse(res, "Recent invoices retrieved", data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/dashboard/payments
   */
  static async getRecentPayments(req, res, next) {
    try {
      const { limit = 5 } = req.query;
      const data = await DashboardService.getRecentPayments({
        user: req.user,
        limit,
      });

      return successResponse(res, "Recent payments retrieved", data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/dashboard/activity
   */
  static async getRecentActivity(req, res, next) {
    try {
      const { limit = 10 } = req.query;
      const data = await DashboardService.getRecentActivity({
        user: req.user,
        limit,
      });

      return successResponse(res, "Recent activity feed retrieved", data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/dashboard/client-view
   */
  static async getClientDashboard(req, res, next) {
    try {
      const data = await DashboardService.getClientDashboardView({
        user: req.user,
      });

      return successResponse(res, "Client portal dashboard loaded", data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/dashboard/health
   */
  static async getHealth(req, res, next) {
    try {
      const data = await DashboardService.getSystemHealth();
      return successResponse(res, "System connectivity status retrieved", data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = DashboardController;
