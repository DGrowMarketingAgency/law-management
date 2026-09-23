import apiClient from './api';

export const appointmentService = {
  getAppointments: async (params = {}) => {
    const res = await apiClient.get('/appointments', { params });
    return res.data;
  },

  getAppointmentById: async (id) => {
    const res = await apiClient.get(`/appointments/${id}`);
    return res.data;
  },

  createAppointment: async (data) => {
    const res = await apiClient.post('/appointments', data);
    return res.data;
  },

  updateAppointment: async (id, data) => {
    const res = await apiClient.patch(`/appointments/${id}`, data);
    return res.data;
  },

  deleteAppointment: async (id) => {
    const res = await apiClient.delete(`/appointments/${id}`);
    return res.data;
  }
};

export default appointmentService;
