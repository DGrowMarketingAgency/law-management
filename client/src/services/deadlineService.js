import apiClient from "./api";

const deadlineService = {
  // Calculation Preview
  calculateLimitation: async (data) => {
    const response = await apiClient.post("/deadlines/calculate", data);
    return response.data;
  },

  // Dashboard & Analytics
  getDeadlinesDashboard: async (params = {}) => {
    const response = await apiClient.get("/deadlines/dashboard", { params });
    return response.data;
  },

  // Alerts
  getAlerts: async (params = {}) => {
    const response = await apiClient.get("/deadlines/alerts", { params });
    return response.data;
  },

  processAlerts: async () => {
    const response = await apiClient.post("/deadlines/alerts/process");
    return response.data;
  },

  // Case Deadlines
  getCaseDeadlines: async (caseId, params = {}) => {
    const response = await apiClient.get(`/cases/${caseId}/deadlines`, { params });
    return response.data;
  },

  getDeadlineById: async (caseId, deadlineId) => {
    const response = await apiClient.get(`/cases/${caseId}/deadlines/${deadlineId}`);
    return response.data;
  },

  createCaseDeadline: async (caseId, data) => {
    const response = await apiClient.post(`/cases/${caseId}/deadlines`, data);
    return response.data;
  },

  overrideCaseDeadline: async (caseId, deadlineId, data) => {
    const response = await apiClient.post(`/cases/${caseId}/deadlines/${deadlineId}/override`, data);
    return response.data;
  },

  completeCaseDeadline: async (caseId, deadlineId, data) => {
    const response = await apiClient.post(`/cases/${caseId}/deadlines/${deadlineId}/complete`, data);
    return response.data;
  },

  waiveCaseDeadline: async (caseId, deadlineId, data) => {
    const response = await apiClient.post(`/cases/${caseId}/deadlines/${deadlineId}/waive`, data);
    return response.data;
  },
};

export default deadlineService;
