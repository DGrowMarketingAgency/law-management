import apiClient from './api';

export const paymentService = {
  getPayments: async (params = {}) => {
    const res = await apiClient.get('/payments', { params });
    return res.data;
  },

  getPaymentById: async (id) => {
    const res = await apiClient.get(`/payments/${id}`);
    return res.data;
  },

  recordPayment: async (data) => {
    const res = await apiClient.post('/payments', data);
    return res.data;
  },

  refundPayment: async (id, data) => {
    const res = await apiClient.post(`/payments/${id}/refund`, data);
    return res.data;
  },

  downloadReceiptPdf: async (id, paymentNumber) => {
    const res = await apiClient.get(`/payments/${id}/receipt`, {
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Receipt-${paymentNumber || id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
};

export default paymentService;
