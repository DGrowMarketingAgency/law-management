import api from "./api";

export const reminderService = {
  sendEmailReminder: async (invoiceId, reminderType = "BEFORE_DUE", customNote = "") => {
    const res = await api.post(`/invoices/${invoiceId}/reminders/email`, {
      reminder_type: reminderType,
      custom_note: customNote,
    });
    return res.data?.data || res.data;
  },

  sendWhatsAppReminder: async (invoiceId, reminderType = "BEFORE_DUE", customNote = "") => {
    const res = await api.post(`/invoices/${invoiceId}/reminders/whatsapp`, {
      reminder_type: reminderType,
      custom_note: customNote,
    });
    return res.data?.data || res.data;
  },

  sendReminder: async (invoiceId, channel = "EMAIL", reminderType = "BEFORE_DUE", customNote = "") => {
    const res = await api.post(`/invoices/${invoiceId}/reminders/send`, {
      channel,
      reminder_type: reminderType,
      custom_note: customNote,
    });
    return res.data?.data || res.data;
  },

  getInvoiceReminders: async (invoiceId) => {
    const res = await api.get(`/invoices/${invoiceId}/reminders`);
    return res.data?.data || res.data;
  },
};

export default reminderService;
