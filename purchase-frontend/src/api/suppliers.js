import api from "./axios";

export const listSuppliers = async (options = {}) => {
  const response = await api.get("/api/suppliers", options);
  return Array.isArray(response.data) ? response.data : [];
};

export const createSupplier = async (payload, options = {}) => {
  const response = await api.post("/api/suppliers", payload, options);
  return response.data;
};

export const updateSupplier = async (id, payload, options = {}) => {
  const response = await api.patch(`/api/suppliers/${id}`, payload, options);
  return response.data;
};

export const deleteSupplier = async (id, options = {}) => {
  await api.delete(`/api/suppliers/${id}`, options);
};

export const getSuppliersDashboard = async (options = {}) => {
  const response = await api.get('/api/suppliers/dashboard', options);
  return response.data || {};
};

export default {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSuppliersDashboard,
};