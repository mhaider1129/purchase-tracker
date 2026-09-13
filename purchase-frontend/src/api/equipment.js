import api from './axios';

export const listEquipment = params => api.get('/equipment', { params }).then(response => response.data);
export const listAvailableAssets = params => api.get('/equipment/available-assets', { params }).then(response => response.data.data);
export const getEquipment = id => api.get(`/equipment/${id}`).then(response => response.data.data);
export const createEquipment = body => api.post('/equipment', body).then(response => response.data.data);
export const updateEquipment = (id, body) => api.patch(`/equipment/${id}`, body).then(response => response.data.data);
export const listEquipmentContracts = id => api.get(`/equipment/${id}/contracts`).then(response => response.data.data);
export const addEquipmentContract = (id, body) => api.post(`/equipment/${id}/contracts`, body).then(response => response.data.data);
export const removeEquipmentContract = (id, coverageId) => api.delete(`/equipment/${id}/contracts/${coverageId}`).then(response => response.data.data);