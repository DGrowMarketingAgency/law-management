import apiClient from "./api";

const emailAdminService = {
  // SMTP Status & Test
  getSmtpStatus: async () => {
    const res = await apiClient.get("/email/status");
    return res.data?.data;
  },

  sendTestEmail: async (to) => {
    const res = await apiClient.post("/email/test", { to });
    return res.data;
  },

  // Templates
  listTemplates: async (category = null) => {
    const params = category ? { category } : {};
    const res = await apiClient.get("/email/templates", { params });
    return res.data?.data?.templates || [];
  },

  getTemplateByKey: async (key) => {
    const res = await apiClient.get(`/email/templates/${key}`);
    return res.data?.data?.template;
  },

  updateTemplate: async (id, data) => {
    const res = await apiClient.put(`/email/templates/${id}`, data);
    return res.data?.data?.template;
  },

  // Delivery Logs
  getDeliveryLogs: async (params = {}) => {
    const res = await apiClient.get("/email/logs", { params });
    return res.data?.data;
  },
};

export default emailAdminService;
