import api from "./api";

export const paymentSettingsService = {
  getSettings: async () => {
    const res = await api.get("/payment-settings");
    return res.data?.data || res.data;
  },

  updateSettings: async (key, value) => {
    const res = await api.patch("/payment-settings", { key, value });
    return res.data?.data || res.data;
  },
};

export default paymentSettingsService;
