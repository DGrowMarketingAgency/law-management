import apiClient from './api';

export const causeListService = {
  getCauseList: async (params = {}) => {
    const res = await apiClient.get('/cause-list', { params });
    return res.data;
  },
};

export default causeListService;
