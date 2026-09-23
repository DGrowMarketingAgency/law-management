import apiClient from './api';

/**
 * Workforce API Client Service
 * Connects frontend views with Prompt 10 Workforce REST endpoints.
 */
export const workforceService = {
  // 1. Dashboard & Directory
  getDashboardStats: async () => {
    const res = await apiClient.get('/workforce/dashboard');
    return res.data;
  },

  getDirectory: async (params = {}) => {
    const res = await apiClient.get('/workforce/directory', { params });
    return res.data;
  },

  getProfile: async (id) => {
    const res = await apiClient.get(`/workforce/profiles/${id}`);
    return res.data;
  },

  createProfile: async (data) => {
    const res = await apiClient.post('/workforce/profiles', data);
    return res.data;
  },

  updateProfile: async (id, data) => {
    const res = await apiClient.put(`/workforce/profiles/${id}`, data);
    return res.data;
  },

  updateStatus: async (id, status, reason = '') => {
    const res = await apiClient.patch(`/workforce/profiles/${id}/status`, { status, reason });
    return res.data;
  },

  // Lifecycle & Account Actions
  activateProfile: async (id, data = {}) => {
    const res = await apiClient.post(`/workforce/profiles/${id}/activate`, data);
    return res.data;
  },

  deactivateProfile: async (id, reason = '') => {
    const res = await apiClient.post(`/workforce/profiles/${id}/deactivate`, { reason });
    return res.data;
  },

  restoreProfile: async (id, reason = '') => {
    const res = await apiClient.post(`/workforce/profiles/${id}/restore`, { reason });
    return res.data;
  },

  getDeletionSafety: async (id) => {
    const res = await apiClient.get(`/workforce/profiles/${id}/deletion-safety`);
    return res.data;
  },

  archiveProfile: async (id, confirmation_code = '') => {
    const res = await apiClient.post(`/workforce/profiles/${id}/archive`, {
      action: 'ARCHIVE',
      confirmation_code,
    });
    return res.data;
  },

  permanentDeleteProfile: async (id, confirmation_code) => {
    const res = await apiClient.delete(`/workforce/profiles/${id}`, {
      data: { action: 'PERMANENT_DELETE', confirmation_code },
    });
    return res.data;
  },

  resetPassword: async (id) => {
    const res = await apiClient.post(`/workforce/profiles/${id}/reset-password`);
    return res.data;
  },

  resendInvitation: async (id) => {
    const res = await apiClient.post(`/workforce/profiles/${id}/resend-invitation`);
    return res.data;
  },

  // Member Tab Data
  getAssignedCases: async (id) => {
    const res = await apiClient.get(`/workforce/profiles/${id}/assigned-cases`);
    return res.data;
  },

  getAttendanceHistory: async (id, params = {}) => {
    const res = await apiClient.get(`/workforce/profiles/${id}/attendance`, { params });
    return res.data;
  },

  getLeavesHistory: async (id, params = {}) => {
    const res = await apiClient.get(`/workforce/profiles/${id}/leave`, { params });
    return res.data;
  },

  getTasksList: async (id, params = {}) => {
    const res = await apiClient.get(`/workforce/profiles/${id}/tasks`, { params });
    return res.data;
  },

  getDocuments: async (id) => {
    const res = await apiClient.get(`/workforce/profiles/${id}/documents`);
    return res.data;
  },

  getActivityAudit: async (id, params = {}) => {
    const res = await apiClient.get(`/workforce/profiles/${id}/activity`, { params });
    return res.data;
  },

  // 2. Candidate Pipeline & ATS
  getCandidates: async (params = {}) => {
    const res = await apiClient.get('/workforce/candidates', { params });
    return res.data;
  },

  getCandidate: async (id) => {
    const res = await apiClient.get(`/workforce/candidates/${id}`);
    return res.data;
  },

  createCandidate: async (data) => {
    const res = await apiClient.post('/workforce/candidates', data);
    return res.data;
  },

  updateCandidateStage: async (id, stage, remarks = '') => {
    const res = await apiClient.patch(`/workforce/candidates/${id}/stage`, { stage, remarks });
    return res.data;
  },

  scheduleInterview: async (candidateId, data) => {
    const res = await apiClient.post(`/workforce/candidates/${candidateId}/interviews`, data);
    return res.data;
  },

  recordInterviewFeedback: async (interviewId, data) => {
    const res = await apiClient.patch(`/workforce/interviews/${interviewId}/feedback`, data);
    return res.data;
  },

  createOffer: async (candidateId, data) => {
    const res = await apiClient.post(`/workforce/candidates/${candidateId}/offers`, data);
    return res.data;
  },

  acceptOffer: async (offerId) => {
    const res = await apiClient.post(`/workforce/offers/${offerId}/accept`);
    return res.data;
  },

  // 3. Onboarding
  getOnboardingChecklist: async (workforceId) => {
    const res = await apiClient.get(`/workforce/profiles/${workforceId}/onboarding`);
    return res.data;
  },

  updateOnboardingChecklistItem: async (id, data) => {
    const res = await apiClient.patch(`/workforce/onboarding-items/${id}`, data);
    return res.data;
  },

  addOnboardingChecklistItem: async (workforceId, data) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/onboarding-items`, data);
    return res.data;
  },

  completeOnboarding: async (workforceId, data = {}) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/complete-onboarding`, data);
    return res.data;
  },

  // 4. Attendance
  checkIn: async (workforceId, data = {}) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/attendance/check-in`, data);
    return res.data;
  },

  checkOut: async (workforceId, data = {}) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/attendance/check-out`, data);
    return res.data;
  },

  getAttendanceLogs: async (params = {}) => {
    const res = await apiClient.get('/workforce/attendance/logs', { params });
    return res.data;
  },

  regularizeAttendance: async (id, data) => {
    const res = await apiClient.patch(`/workforce/attendance/${id}/regularize`, data);
    return res.data;
  },

  getMonthlySummary: async (workforceId, year, month) => {
    const res = await apiClient.get(`/workforce/profiles/${workforceId}/attendance/monthly-summary`, {
      params: { year, month },
    });
    return res.data;
  },

  // 5. Leaves
  getLeaveTypes: async (workforceType = null) => {
    const res = await apiClient.get('/workforce/leaves/types', {
      params: { workforce_type: workforceType },
    });
    return res.data;
  },

  getLeaveBalances: async (workforceId, year = null) => {
    const res = await apiClient.get(`/workforce/profiles/${workforceId}/leaves/balances`, {
      params: { year },
    });
    return res.data;
  },

  applyLeave: async (workforceId, data) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/leaves/apply`, data);
    return res.data;
  },

  getLeaveRequests: async (params = {}) => {
    const res = await apiClient.get('/workforce/leaves/requests', { params });
    return res.data;
  },

  processLeaveRequest: async (id, action, rejection_reason = '') => {
    const res = await apiClient.patch(`/workforce/leaves/requests/${id}/process`, {
      action,
      rejection_reason,
    });
    return res.data;
  },

  // 6. Workforce Tasks
  getTasks: async (params = {}) => {
    const res = await apiClient.get('/workforce/tasks', { params });
    return res.data;
  },

  getTask: async (id) => {
    const res = await apiClient.get(`/workforce/tasks/${id}`);
    return res.data;
  },

  createTask: async (data) => {
    const res = await apiClient.post('/workforce/tasks', data);
    return res.data;
  },

  updateTask: async (id, data) => {
    const res = await apiClient.patch(`/workforce/tasks/${id}`, data);
    return res.data;
  },

  // 7. Payroll, Stipends & Bank Accounts
  setSalaryStructure: async (workforceId, data) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/salary-structure`, data);
    return res.data;
  },

  setInternStipend: async (workforceId, data) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/intern-stipend`, data);
    return res.data;
  },

  saveBankAccount: async (workforceId, data) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/bank-account`, data);
    return res.data;
  },

  getDisbursements: async (params = {}) => {
    const res = await apiClient.get('/workforce/payroll/disbursements', { params });
    return res.data;
  },

  createDisbursement: async (data) => {
    const res = await apiClient.post('/workforce/payroll/disbursements', data);
    return res.data;
  },

  markDisbursementPaid: async (id, data = {}) => {
    const res = await apiClient.patch(`/workforce/payroll/disbursements/${id}/paid`, data);
    return res.data;
  },

  submitReimbursement: async (workforceId, data) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/reimbursements`, data);
    return res.data;
  },

  getReimbursements: async (params = {}) => {
    const res = await apiClient.get('/workforce/payroll/reimbursements', { params });
    return res.data;
  },

  processReimbursement: async (id, action, rejection_reason = '') => {
    const res = await apiClient.patch(`/workforce/payroll/reimbursements/${id}/process`, {
      action,
      rejection_reason,
    });
    return res.data;
  },

  // 8. Performance & Warnings
  getGoals: async (workforceId) => {
    const res = await apiClient.get(`/workforce/profiles/${workforceId}/goals`);
    return res.data;
  },

  createGoal: async (workforceId, data) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/goals`, data);
    return res.data;
  },

  updateGoal: async (id, data) => {
    const res = await apiClient.patch(`/workforce/goals/${id}`, data);
    return res.data;
  },

  getReviews: async (workforceId) => {
    const res = await apiClient.get(`/workforce/profiles/${workforceId}/reviews`);
    return res.data;
  },

  createReview: async (workforceId, data) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/reviews`, data);
    return res.data;
  },

  getWarnings: async (workforceId) => {
    const res = await apiClient.get(`/workforce/profiles/${workforceId}/warnings`);
    return res.data;
  },

  issueWarning: async (workforceId, data) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/warnings`, data);
    return res.data;
  },

  updateWarning: async (id, data) => {
    const res = await apiClient.patch(`/workforce/warnings/${id}`, data);
    return res.data;
  },

  // 9. Assets
  getAssets: async (params = {}) => {
    const res = await apiClient.get('/workforce/assets', { params });
    return res.data;
  },

  assignAsset: async (data) => {
    const res = await apiClient.post('/workforce/assets/assign', data);
    return res.data;
  },

  returnAsset: async (id, data = {}) => {
    const res = await apiClient.patch(`/workforce/assets/${id}/return`, data);
    return res.data;
  },

  // 10. Offboarding & Certificates
  submitExitRequest: async (workforceId, data) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/exit-request`, data);
    return res.data;
  },

  getOffboardingDetails: async (workforceId) => {
    const res = await apiClient.get(`/workforce/profiles/${workforceId}/offboarding`);
    return res.data;
  },

  processExitRequest: async (workforceId, action, data = {}) => {
    const res = await apiClient.patch(`/workforce/profiles/${workforceId}/exit-request/process`, {
      action,
      ...data,
    });
    return res.data;
  },

  createHandoverItem: async (workforceId, data) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/handovers`, data);
    return res.data;
  },

  updateOffboardingChecklistItem: async (id, data) => {
    const res = await apiClient.patch(`/workforce/offboarding-items/${id}`, data);
    return res.data;
  },

  executeFullRevocation: async (workforceId) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/revoke-and-exit`);
    return res.data;
  },

  issueInternshipCertificate: async (workforceId) => {
    const res = await apiClient.post(`/workforce/profiles/${workforceId}/issue-certificate`);
    return res.data;
  },
};

export default workforceService;
