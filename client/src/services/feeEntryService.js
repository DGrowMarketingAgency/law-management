import apiClient from './api';

export const feeEntryService = {
  getFeeEntries: async (params = {}) => {
    const res = await apiClient.get('/fee-entries', { params });
    return res.data;
  },

  getUnbilledFeeEntries: async (params = {}) => {
    const res = await apiClient.get('/fee-entries/unbilled', { params });
    return res.data;
  },

  getFeeEntryById: async (id) => {
    const res = await apiClient.get(`/fee-entries/${id}`);
    return res.data;
  },

  createFeeEntry: async (data) => {
    const res = await apiClient.post('/fee-entries', data);
    return res.data;
  },

  updateFeeEntry: async (id, data) => {
    const res = await apiClient.put(`/fee-entries/${id}`, data);
    return res.data;
  },

  deleteFeeEntry: async (id) => {
    const res = await apiClient.delete(`/fee-entries/${id}`);
    return res.data;
  }
};

export default feeEntryService;
