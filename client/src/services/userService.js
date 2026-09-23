import apiClient from './api';

const userService = {
  getUsers: async (params) => {
    const response = await apiClient.get('/users', { params });
    return response.data;
  },

  getUserById: async (id) => {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  },

  createUser: async (data) => {
    const response = await apiClient.post('/users', data);
    return response.data;
  },

  updateUser: async (id, data) => {
    const response = await apiClient.put(`/users/${id}`, data);
    return response.data;
  },

  updateUserRoles: async (id, roleIds) => {
    const response = await apiClient.put(`/users/${id}/roles`, { roleIds });
    return response.data;
  },
};

export default userService;
