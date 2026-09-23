import apiClient from './api';

export const invoiceService = {
  getInvoices: async (params = {}) => {
    const res = await apiClient.get('/invoices', { params });
    return res.data;
  },

  getInvoiceById: async (id) => {
    const res = await apiClient.get(`/invoices/${id}`);
    return res.data;
  },

  createInvoice: async (data) => {
    const res = await apiClient.post('/invoices', data);
    return res.data;
  },

  updateDraftInvoice: async (id, data) => {
    const res = await apiClient.put(`/invoices/${id}`, data);
    return res.data;
  },

  issueInvoice: async (id) => {
    const res = await apiClient.post(`/invoices/${id}/issue`);
    return res.data;
  },

  sendInvoice: async (id) => {
    const res = await apiClient.post(`/invoices/${id}/send`);
    return res.data;
  },

  cancelInvoice: async (id, reason) => {
    const res = await apiClient.post(`/invoices/${id}/cancel`, { reason });
    return res.data;
  },

  voidInvoice: async (id, reason) => {
    const res = await apiClient.post(`/invoices/${id}/void`, { reason });
    return res.data;
  },

  downloadPdf: async (id, invoiceNumber) => {
    const res = await apiClient.get(`/invoices/${id}/pdf`, {
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Invoice-${invoiceNumber || id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  previewReminder: async (id) => {
    const res = await apiClient.get(`/invoices/${id}/reminder-preview`);
    return res.data;
  },

  sendReminder: async (id, data = {}) => {
    const res = await apiClient.post(`/invoices/${id}/remind`, data);
    return res.data;
  }
};

export default invoiceService;
