import api from './axios';

export const listItemMaster = async (params = {}) => {
  const { data } = await api.get('/item-master', { params });
  return data;
};

export const getItemMasterById = async (id) => {
  const { data } = await api.get(`/item-master/${id}`);
  return data;
};

export const createItemMaster = async (payload) => {
  const { data } = await api.post('/item-master', payload);
  return data;
};

export const updateItemMaster = async (id, payload) => {
  const { data } = await api.put(`/item-master/${id}`, payload);
  return data;
};

export const submitItemMaster = async (id) => {
  const { data } = await api.post(`/item-master/${id}/submit`);
  return data;
};

export const approveItemMaster = async (id) => {
  const { data } = await api.post(`/item-master/${id}/approve`);
  return data;
};

export const rejectItemMaster = async (id, reason) => {
  const { data } = await api.post(`/item-master/${id}/reject`, { reason });
  return data;
};

export const attachItemMasterDocument = async (id, payload) => {
  const { data } = await api.post(`/item-master/${id}/documents`, payload);
  return data;
};

// Normalized item-master reference data (additive, for new hierarchy UI wiring)
export const listItemCategories = async () => {
  const { data } = await api.get('/item-master/reference/categories');
  return data;
};

export const listItemUom = async () => {
  const { data } = await api.get('/item-master/reference/uom');
  return data;
};

export const listItemManufacturers = async () => {
  const { data } = await api.get('/item-master/reference/manufacturers');
  return data;
};

export const listItemBrands = async (params = {}) => {
  const { data } = await api.get('/item-master/reference/brands', { params });
  return data;
};

export const listItemVariants = async (itemMasterId) => {
  const { data } = await api.get(`/item-master/${itemMasterId}/variants`);
  return data;
};

export const searchGenericItems = async (params = {}) => {
  const { data } = await api.get('/item-master/foundation/generic-items', { params });
  return data;
};

export const searchApprovedProducts = async (params = {}) => {
  const { data } = await api.get('/item-master/foundation/products', { params });
  return data;
};

export const searchSupplierCatalog = async (params = {}) => {
  const { data } = await api.get('/item-master/foundation/supplier-catalog', { params });
  return data;
};

export const createGenericItem = async payload => {
  const { data } = await api.post('/item-master/foundation/generic-items', payload);
  return data;
};

export const transitionGenericItem = async (id, status) => {
  const { data } = await api.post(`/item-master/foundation/generic-items/${id}/transition`, { status });
  return data;
};

export const submitPendingItem = async payload => {
  const { data } = await api.post('/item-master/foundation/pending-items', payload);
  return data;
};

export const getItemMasterReferences = async () => {
  const { data } = await api.get('/item-master/foundation/references');
  return data;
};

export const searchItemMasterReferences = async (type, params = {}) => {
  const { data } = await api.get(`/item-master/foundation/references/${type}`, { params });
  return data;
};

export const createItemMasterReference = async (type, payload) => {
  const { data } = await api.post(`/item-master/foundation/references/${type}`, payload);
  return data;
};

export const deactivateItemMasterReference = async (type, id) => {
  const { data } = await api.delete(`/item-master/foundation/references/${type}/${id}`);
  return data;
};

export const listPendingItems = async (params = {}) => {
  const { data } = await api.get('/item-master/foundation/pending-items', { params });
  return data;
};

export const resolvePendingItem = async (id, payload) => {
  const { data } = await api.post(`/item-master/foundation/pending-items/${id}/resolve`, payload);
  return data;
};

export const getLegacyCoverage = async () => {
  const { data } = await api.get('/item-master/foundation/legacy/coverage');
  return data;
};