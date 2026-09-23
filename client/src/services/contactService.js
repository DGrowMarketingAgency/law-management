import apiClient from './api';

export const contactService = {
  getContacts: async (params = {}) => {
    const res = await apiClient.get('/contacts', { params });
    return res.data;
  },

  getContactById: async (id) => {
    const res = await apiClient.get(`/contacts/${id}`);
    return res.data;
  },

  createContact: async (data) => {
    const res = await apiClient.post('/contacts', data);
    return res.data;
  },

  updateContact: async (id, data) => {
    const res = await apiClient.patch(`/contacts/${id}`, data);
    return res.data;
  },

  deleteContact: async (id) => {
    const res = await apiClient.delete(`/contacts/${id}`);
    return res.data;
  },

  getTimeline: async (id) => {
    const res = await apiClient.get(`/contacts/${id}/timeline`);
    return res.data;
  },

  addAddress: async (id, addressData) => {
    const res = await apiClient.post(`/contacts/${id}/addresses`, addressData);
    return res.data;
  },

  deleteAddress: async (id, addressId) => {
    const res = await apiClient.delete(`/contacts/${id}/addresses/${addressId}`);
    return res.data;
  },

  addTag: async (id, tagId) => {
    const res = await apiClient.post(`/contacts/${id}/tags`, { tag_id: tagId });
    return res.data;
  },

  removeTag: async (id, tagId) => {
    const res = await apiClient.delete(`/contacts/${id}/tags/${tagId}`);
    return res.data;
  }
};

export default contactService;
