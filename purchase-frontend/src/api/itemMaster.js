import api from './axios';

export const listItemMaster = async (params = {}) => {
  const { data } = await api.get('/api/item-master', { params });
  return data;
};

export const getItemMasterById = async (id) => {
  const { data } = await api.get(`/api/item-master/${id}`);
  return data;
};

export const createItemMaster = async (payload) => {
  const { data } = await api.post('/api/item-master', payload);
  return data;
};

export const updateItemMaster = async (id, payload) => {
  const { data } = await api.put(`/api/item-master/${id}`, payload);
  return data;
};

export const submitItemMaster = async (id) => {
  const { data } = await api.post(`/api/item-master/${id}/submit`);
  return data;
};

export const approveItemMaster = async (id) => {
  const { data } = await api.post(`/api/item-master/${id}/approve`);
  return data;
};

export const rejectItemMaster = async (id, reason) => {
  const { data } = await api.post(`/api/item-master/${id}/reject`, { reason });
  return data;
};

export const attachItemMasterDocument = async (id, payload) => {
  const { data } = await api.post(`/api/item-master/${id}/documents`, payload);
  return data;
};