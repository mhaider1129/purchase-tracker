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

export const getSupplierProfile = async (id, options = {}) => {
  const response = await api.get(`/suppliers/${id}/profile`, options);
  return response.data || {};
};

export const updateSupplierClassification = async (id, payload, options = {}) => {
  const response = await api.patch(`/suppliers/${id}/classification`, payload, options);
  return response.data;
};

export const listSupplierPrincipals = async (id, options = {}) => {
  const response = await api.get(`/suppliers/${id}/principals`, options);
  return Array.isArray(response.data) ? response.data : [];
};

export const createSupplierPrincipal = async (id, payload, options = {}) => {
  const response = await api.post(`/suppliers/${id}/principals`, payload, options);
  return response.data;
};

export const updateSupplierPrincipal = async (id, principalId, payload, options = {}) => {
  const response = await api.patch(`/suppliers/${id}/principals/${principalId}`, payload, options);
  return response.data;
};

export const verifySupplierPrincipal = async (id, principalId, payload = {}, options = {}) => {
  const response = await api.patch(`/suppliers/${id}/principals/${principalId}/verify`, payload, options);
  return response.data;
};

export const suspendSupplierPrincipal = async (id, principalId, payload, options = {}) => {
  const response = await api.patch(`/suppliers/${id}/principals/${principalId}/suspend`, payload, options);
  return response.data;
};

export const deactivateSupplierPrincipal = async (id, principalId, options = {}) => {
  const response = await api.delete(`/suppliers/${id}/principals/${principalId}`, options);
  return response.data;
};

const suppliersApi = {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSuppliersDashboard,
  getSupplierProfile,
  updateSupplierClassification,
  listSupplierPrincipals,
  createSupplierPrincipal,
  updateSupplierPrincipal,
  verifySupplierPrincipal,
  suspendSupplierPrincipal,
  deactivateSupplierPrincipal,
};

export default suppliersApi;