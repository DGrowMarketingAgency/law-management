import apiClient from "./api";

const securityService = {
  // Security Posture Overview
  getSecurityOverview: async () => {
    const res = await apiClient.get("/security/overview");
    return res.data?.data;
  },

  // Security Audit Logs
  getSecurityAuditLogs: async (params = {}) => {
    const res = await apiClient.get("/security/audit-logs", { params });
    return res.data?.data;
  },

  // Two-Factor Authentication Management
  request2FAEnable: async () => {
    const res = await apiClient.post("/auth/2fa/enable");
    return res.data?.data;
  },

  confirm2FAEnable: async (otp) => {
    const res = await apiClient.post("/auth/2fa/confirm", { otp });
    return res.data;
  },

  disable2FA: async (password) => {
    const res = await apiClient.post("/auth/2fa/disable", { password });
    return res.data;
  },

  resendLogin2FA: async (challengeId) => {
    const res = await apiClient.post("/auth/2fa/resend", { challengeId });
    return res.data?.data;
  },

  // Email Verification
  sendVerificationEmail: async () => {
    const res = await apiClient.post("/auth/verify-email/send");
    return res.data;
  },

  verifyEmail: async (token) => {
    const res = await apiClient.post("/auth/verify-email", { token });
    return res.data;
  },

  // Active Sessions
  getActiveSessions: async () => {
    const res = await apiClient.get("/auth/sessions");
    return res.data?.data?.sessions || [];
  },

  revokeSession: async (sessionId) => {
    const res = await apiClient.post("/auth/sessions/revoke", { sessionId });
    return res.data;
  },

  revokeAllSessions: async () => {
    const res = await apiClient.post("/auth/sessions/revoke-all");
    return res.data;
  },

  // Password Operations
  changePassword: async (currentPassword, newPassword) => {
    const res = await apiClient.post("/auth/change-password", { currentPassword, newPassword });
    return res.data;
  },

  forgotPassword: async (email) => {
    const res = await apiClient.post("/auth/forgot-password", { email });
    return res.data;
  },

  resetPassword: async ({ token, email, otp, newPassword }) => {
    const res = await apiClient.post("/auth/reset-password", { token, email, otp, newPassword });
    return res.data;
  },
};

export default securityService;
