import api from "./api";

export const paymentGatewayService = {
  // --- Razorpay ---
  createRazorpayOrder: async (invoiceId, amount) => {
    const res = await api.post("/payments/razorpay/order", {
      invoice_id: invoiceId,
      amount,
    });
    return res.data?.data || res.data;
  },

  verifyRazorpayPayment: async (verificationData) => {
    const res = await api.post("/payments/razorpay/verify", verificationData);
    return res.data?.data || res.data;
  },

  createRazorpayPaymentLink: async (data) => {
    const res = await api.post("/payments/razorpay/payment-links", data);
    return res.data?.data || res.data;
  },

  getRazorpayStatus: async (paymentId) => {
    const res = await api.get(`/payments/razorpay/${paymentId}/status`);
    return res.data?.data || res.data;
  },

  // --- PayU ---
  createPayUOrder: async (invoiceId, amount, returnUrl, failureUrl) => {
    const res = await api.post("/payments/payu/order", {
      invoice_id: invoiceId,
      amount,
      return_url: returnUrl,
      failure_url: failureUrl,
    });
    return res.data?.data || res.data;
  },

  verifyPayUPayment: async (verificationData) => {
    const res = await api.post("/payments/payu/verify", verificationData);
    return res.data?.data || res.data;
  },

  createPayUPaymentLink: async (data) => {
    const res = await api.post("/payments/payu/payment-links", data);
    return res.data?.data || res.data;
  },

  getPayUStatus: async (paymentId) => {
    const res = await api.get(`/payments/payu/${paymentId}/status`);
    return res.data?.data || res.data;
  },

  // --- Manual & Offline Payments ---
  recordManualPayment: async (paymentData) => {
    const res = await api.post("/payments/manual", paymentData);
    return res.data?.data || res.data;
  },

  verifyManualPayment: async (paymentId) => {
    const res = await api.post(`/payments/${paymentId}/verify`);
    return res.data?.data || res.data;
  },

  rejectManualPayment: async (paymentId, reason) => {
    const res = await api.post(`/payments/${paymentId}/reject`, { reason });
    return res.data?.data || res.data;
  },

  // --- Core / Reconciliation ---
  getPaymentById: async (paymentId) => {
    const res = await api.get(`/payments/${paymentId}`);
    return res.data?.data || res.data;
  },

  refundPayment: async (paymentId, reason, amount) => {
    const res = await api.post(`/payments/${paymentId}/refund`, { reason, amount });
    return res.data?.data || res.data;
  },

  getReconciliation: async (params = {}) => {
    const res = await api.get("/payments/reconciliation", { params });
    return res.data?.data || res.data;
  },
};

export default paymentGatewayService;
