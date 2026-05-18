import api from "./axios";

export const listSuppliers = async (options = {}) => {
  const response = await api.get("/suppliers", options);
  return Array.isArray(response.data) ? response.data : [];
};

export const createSupplier = async (payload, options = {}) => {
  const response = await api.post("/suppliers", payload, options);
  return response.data;
};

export const updateSupplier = async (id, payload, options = {}) => {
  const response = await api.patch(`/suppliers/${id}`, payload, options);
  return response.data;
};

export const deleteSupplier = async (id, options = {}) => {
  await api.delete(`/suppliers/${id}`, options);
};

export const getSuppliersDashboard = async (options = {}) => {
  const response = await api.get('/suppliers/dashboard', options);
  return response.data || {};
};

export default {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSuppliersDashboard,
};