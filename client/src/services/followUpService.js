import apiClient from './api';

export const followUpService = {
  getFollowUps: async (params = {}) => {
    const res = await apiClient.get('/follow-ups', { params });
    return res.data;
  },

  getSummary: async () => {
    const res = await apiClient.get('/follow-ups/summary');
    return res.data;
  },

  createFollowUp: async (data) => {
    const res = await apiClient.post('/follow-ups', data);
    return res.data;
  },

  updateFollowUp: async (id, data) => {
    const res = await apiClient.patch(`/follow-ups/${id}`, data);
    return res.data;
  },

  completeFollowUp: async (id, outcomeNotes = '') => {
    const res = await apiClient.patch(`/follow-ups/${id}/complete`, { outcome_notes: outcomeNotes });
    return res.data;
  },

  deleteFollowUp: async (id) => {
    const res = await apiClient.delete(`/follow-ups/${id}`);
    return res.data;
  }
};

export default followUpService;
