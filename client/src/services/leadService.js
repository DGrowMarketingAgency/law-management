import apiClient from './api';

export const leadService = {
  getLeads: async (params = {}) => {
    const res = await apiClient.get('/leads', { params });
    return res.data;
  },

  getLeadById: async (id) => {
    const res = await apiClient.get(`/leads/${id}`);
    return res.data;
  },

  createLead: async (data) => {
    const res = await apiClient.post('/leads', data);
    return res.data;
  },

  updateLead: async (id, data) => {
    const res = await apiClient.patch(`/leads/${id}`, data);
    return res.data;
  },

  convertLead: async (id, data = {}) => {
    const res = await apiClient.post(`/leads/${id}/convert`, data);
    return res.data;
  },

  addActivity: async (id, activityData) => {
    const res = await apiClient.post(`/leads/${id}/activities`, activityData);
    return res.data;
  }
};

export default leadService;
