import apiClient from './api';

export const clientBillingService = {
  getDashboard: async () => {
    const res = await apiClient.get('/client-portal/billing/dashboard');
    return res.data;
  },

  getInvoices: async (params = {}) => {
    const res = await apiClient.get('/client-portal/billing/invoices', { params });
    return res.data;
  },

  getInvoiceDetail: async (id) => {
    const res = await apiClient.get(`/client-portal/billing/invoices/${id}`);
    return res.data;
  },

  downloadInvoicePdf: async (id, invoiceNumber) => {
    const res = await apiClient.get(`/client-portal/billing/invoices/${id}/pdf`, {
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

  getPayments: async (params = {}) => {
    const res = await apiClient.get('/client-portal/billing/payments', { params });
    return res.data;
  },

  downloadReceiptPdf: async (id, paymentNumber) => {
    const res = await apiClient.get(`/client-portal/billing/payments/${id}/receipt`, {
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

export default clientBillingService;
