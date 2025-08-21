import api from './axios';

export const printRequest = async (id) => {
  const res = await api.get(`/api/requests/${id}/print`);
  return res.data;
};
