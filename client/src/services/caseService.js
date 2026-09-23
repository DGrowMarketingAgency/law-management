import apiClient from './api';

export const caseService = {
  getCases: async (params = {}) => {
    const res = await apiClient.get('/cases', { params });
    return res.data;
  },

  getCaseById: async (id) => {
    const res = await apiClient.get(`/cases/${id}`);
    return res.data;
  },

  createCase: async (data) => {
    const res = await apiClient.post('/cases', data);
    return res.data;
  },

  updateCase: async (id, data) => {
    const res = await apiClient.patch(`/cases/${id}`, data);
    return res.data;
  },

  deleteCase: async (id) => {
    const res = await apiClient.delete(`/cases/${id}`);
    return res.data;
  },

  getDashboard: async () => {
    const res = await apiClient.get('/cases/dashboard');
    return res.data;
  },

  // Parties
  getParties: async (caseId) => {
    const res = await apiClient.get(`/cases/${caseId}/parties`);
    return res.data;
  },

  addParty: async (caseId, data) => {
    const res = await apiClient.post(`/cases/${caseId}/parties`, data);
    return res.data;
  },

  updateParty: async (caseId, partyId, data) => {
    const res = await apiClient.patch(`/cases/${caseId}/parties/${partyId}`, data);
    return res.data;
  },

  removeParty: async (caseId, partyId) => {
    const res = await apiClient.delete(`/cases/${caseId}/parties/${partyId}`);
    return res.data;
  },

  // Counsel
  getCounsel: async (caseId) => {
    const res = await apiClient.get(`/cases/${caseId}/counsel`);
    return res.data;
  },

  addCounsel: async (caseId, data) => {
    const res = await apiClient.post(`/cases/${caseId}/counsel`, data);
    return res.data;
  },

  updateCounsel: async (caseId, counselId, data) => {
    const res = await apiClient.patch(`/cases/${caseId}/counsel/${counselId}`, data);
    return res.data;
  },

  removeCounsel: async (caseId, counselId) => {
    const res = await apiClient.delete(`/cases/${caseId}/counsel/${counselId}`);
    return res.data;
  },

  // Assignments
  getAssignments: async (caseId) => {
    const res = await apiClient.get(`/cases/${caseId}/assignments`);
    return res.data;
  },

  assignUser: async (caseId, data) => {
    const res = await apiClient.post(`/cases/${caseId}/assignments`, data);
    return res.data;
  },

  unassignUser: async (caseId, assignmentId) => {
    const res = await apiClient.delete(`/cases/${caseId}/assignments/${assignmentId}`);
    return res.data;
  },

  // Notes
  getNotes: async (caseId) => {
    const res = await apiClient.get(`/cases/${caseId}/notes`);
    return res.data;
  },

  createNote: async (caseId, data) => {
    const res = await apiClient.post(`/cases/${caseId}/notes`, data);
    return res.data;
  },

  updateNote: async (caseId, noteId, data) => {
    const res = await apiClient.patch(`/cases/${caseId}/notes/${noteId}`, data);
    return res.data;
  },

  deleteNote: async (caseId, noteId) => {
    const res = await apiClient.delete(`/cases/${caseId}/notes/${noteId}`);
    return res.data;
  },
};

export default caseService;
