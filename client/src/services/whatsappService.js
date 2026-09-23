import apiClient from "./api";

/**
 * WhatsApp Business Platform and Hearing Reminder Client API
 */
export const whatsappService = {
  // WhatsApp Health & Status
  getStatus: async () => {
    const res = await apiClient.get("/whatsapp/status");
    return res.data;
  },

  // WhatsApp Reminder Rules & Settings
  getSettings: async () => {
    const res = await apiClient.get("/whatsapp/settings");
    return res.data;
  },

  updateSettings: async (settings) => {
    const res = await apiClient.patch("/whatsapp/settings", { settings });
    return res.data;
  },

  // Case Hearing Reminders
  getHearingReminders: async (hearingId) => {
    const res = await apiClient.get(`/hearings/${hearingId}/reminders`);
    return res.data;
  },

  sendManualReminder: async (hearingId) => {
    const res = await apiClient.post(`/hearings/${hearingId}/reminders/send`);
    return res.data;
  },

  regenerateReminders: async (hearingId) => {
    const res = await apiClient.post(`/hearings/${hearingId}/reminders/regenerate`);
    return res.data;
  },

  cancelReminder: async (hearingId, reminderId) => {
    const res = await apiClient.patch(`/hearings/${hearingId}/reminders/${reminderId}/cancel`);
    return res.data;
  },

  // AiSensy Connection Test
  testAiSensyConnection: async (data) => {
    const res = await apiClient.post("/whatsapp/aisensy/test", data);
    return res.data;
  },
};

export default whatsappService;
