import apiClient from "./api";

/**
 * Production Dashboard API Service
 * Authoritative client for live dashboard aggregations, widgets, and live health.
 */
const dashboardService = {
  /**
   * Get main aggregated dashboard summary
   * @param {Object} params - { period, from, to }
   */
  async getSummary(params = {}) {
    const res = await apiClient.get("/dashboard/summary", { params });
    return res.data;
  },

  /**
   * Get upcoming scheduled hearings
   * @param {number} limit
   */
  async getUpcomingHearings(limit = 5) {
    const res = await apiClient.get("/dashboard/hearings", { params: { limit } });
    return res.data;
  },

  /**
   * Get priority pending/in-progress tasks
   * @param {number} limit
   */
  async getUpcomingTasks(limit = 5) {
    const res = await apiClient.get("/dashboard/tasks", { params: { limit } });
    return res.data;
  },

  /**
   * Get recent invoices (Authorized roles only)
   * @param {number} limit
   */
  async getRecentInvoices(limit = 5) {
    const res = await apiClient.get("/dashboard/invoices", { params: { limit } });
    return res.data;
  },

  /**
   * Get recent payments (Authorized roles only)
   * @param {number} limit
   */
  async getRecentPayments(limit = 5) {
    const res = await apiClient.get("/dashboard/payments", { params: { limit } });
    return res.data;
  },

  /**
   * Get real recent activity feed
   * @param {number} limit
   */
  async getRecentActivity(limit = 10) {
    const res = await apiClient.get("/dashboard/activity", { params: { limit } });
    return res.data;
  },

  /**
   * Get dedicated client dashboard view (CLIENT role only)
   */
  async getClientDashboard() {
    const res = await apiClient.get("/dashboard/client-view");
    return res.data;
  },

  /**
   * Get live system connectivity & gateway configuration status
   */
  async getSystemHealth() {
    const res = await apiClient.get("/dashboard/health");
    return res.data;
  },
};

export default dashboardService;
