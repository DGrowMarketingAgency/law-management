import apiClient from './api';

export const crmService = {
  getDashboardStats: async () => {
    const res = await apiClient.get('/crm');
    return res.data;
  },

  checkConflict: async (searchData) => {
    const res = await apiClient.post('/conflicts/check', searchData);
    return res.data;
  }
};

export default crmService;
