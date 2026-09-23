import apiClient from "./api";

const deadlineRuleService = {
  getRules: async (params = {}) => {
    const response = await apiClient.get("/deadline-rules", { params });
    return response.data;
  },

  getRuleById: async (id) => {
    const response = await apiClient.get(`/deadline-rules/${id}`);
    return response.data;
  },

  createRule: async (data) => {
    const response = await apiClient.post("/deadline-rules", data);
    return response.data;
  },

  updateRule: async (id, data) => {
    const response = await apiClient.put(`/deadline-rules/${id}`, data);
    return response.data;
  },

  toggleRuleActive: async (id, isActive) => {
    const response = await apiClient.patch(`/deadline-rules/${id}/toggle-active`, {
      is_active: isActive,
    });
    return response.data;
  },
};

export default deadlineRuleService;
