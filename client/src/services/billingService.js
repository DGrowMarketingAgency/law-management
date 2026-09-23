import apiClient from './api';

export const billingService = {
  getDashboard: async () => {
    const res = await apiClient.get('/billing/dashboard');
    return res.data;
  },

  getAging: async () => {
    const res = await apiClient.get('/billing/aging');
    return res.data;
  },

  exportCsv: async (type = 'invoices') => {
    const res = await apiClient.get(`/billing/export?type=${type}`, {
      responseType: 'blob'
    });
    return res.data;
  }
};

export default billingService;
