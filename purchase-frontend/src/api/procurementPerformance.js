import api from './axios';

export const getPerformanceDashboard = params => api.get('/procurement-performance/dashboard', { params });
export const getProcurementCase = id => api.get(`/procurement-performance/cases/${id}`);
export const createManualActivity = (id, payload) => api.post(`/procurement-performance/cases/${id}/activities`, payload);