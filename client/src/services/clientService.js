import apiClient from './api';

export const clientService = {
  getClients: async (params = {}) => {
    const res = await apiClient.get('/clients', { params });
    return res.data;
  },

  getClientById: async (id) => {
    const res = await apiClient.get(`/clients/${id}`);
    return res.data;
  },

  createClient: async (data) => {
    const res = await apiClient.post('/clients', data);
    return res.data;
  },

  updateStatus: async (id, status) => {
    const res = await apiClient.patch(`/clients/${id}/status`, { status });
    return res.data;
  },

  recordConsent: async (id, consentData) => {
    const res = await apiClient.post(`/clients/${id}/consents`, consentData);
    return res.data;
  },

  withdrawConsent: async (id, consentId) => {
    const res = await apiClient.patch(`/clients/${id}/consents/${consentId}/withdraw`);
    return res.data;
  }
};

export default clientService;
