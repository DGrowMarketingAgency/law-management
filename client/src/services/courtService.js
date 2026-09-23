import apiClient from './api';

export const courtService = {
  getCourts: async (params = {}) => {
    const res = await apiClient.get('/courts', { params });
    return res.data;
  },

  getCourtById: async (id) => {
    const res = await apiClient.get(`/courts/${id}`);
    return res.data;
  },

  createCourt: async (data) => {
    const res = await apiClient.post('/courts', data);
    return res.data;
  },

  updateCourt: async (id, data) => {
    const res = await apiClient.patch(`/courts/${id}`, data);
    return res.data;
  },

  deleteCourt: async (id) => {
    const res = await apiClient.delete(`/courts/${id}`);
    return res.data;
  },
};

export default courtService;
