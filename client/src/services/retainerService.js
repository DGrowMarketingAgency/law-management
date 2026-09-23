import apiClient from './api';

export const retainerService = {
  getRetainers: async (params = {}) => {
    const res = await apiClient.get('/retainers', { params });
    return res.data;
  },

  getRetainerById: async (id) => {
    const res = await apiClient.get(`/retainers/${id}`);
    return res.data;
  },

  createRetainer: async (data) => {
    const res = await apiClient.post('/retainers', data);
    return res.data;
  },

  depositFunds: async (id, data) => {
    const res = await apiClient.post(`/retainers/${id}/deposit`, data);
    return res.data;
  },

  refundFunds: async (id, data) => {
    const res = await apiClient.post(`/retainers/${id}/refund`, data);
    return res.data;
  }
};

export default retainerService;
