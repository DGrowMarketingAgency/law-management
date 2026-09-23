import apiClient from './api';

export const hearingService = {
  getHearings: async (caseId, params = {}) => {
    const res = await apiClient.get(`/cases/${caseId}/hearings`, { params });
    return res.data;
  },

  getHearingById: async (caseId, hearingId) => {
    const res = await apiClient.get(`/cases/${caseId}/hearings/${hearingId}`);
    return res.data;
  },

  createHearing: async (caseId, data) => {
    const res = await apiClient.post(`/cases/${caseId}/hearings`, data);
    return res.data;
  },

  updateHearing: async (caseId, hearingId, data) => {
    const res = await apiClient.patch(`/cases/${caseId}/hearings/${hearingId}`, data);
    return res.data;
  },

  adjournHearing: async (caseId, hearingId, data) => {
    const res = await apiClient.post(`/cases/${caseId}/hearings/${hearingId}/adjourn`, data);
    return res.data;
  },

  deleteHearing: async (caseId, hearingId) => {
    const res = await apiClient.delete(`/cases/${caseId}/hearings/${hearingId}`);
    return res.data;
  },
};

export default hearingService;
