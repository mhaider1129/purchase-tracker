import api from "./axios";

export const loginSupplierPortal = async (payload, options = {}) => {
  const response = await api.post("/supplier-portal/auth/login/", payload, options);
  return response.data;
};

export const acknowledgePurchaseOrder = async (purchaseOrderId, payload = {}, options = {}) => {
  const response = await api.post(`/supplier-portal/purchase-orders/${purchaseOrderId}/acknowledge`, payload, options);
  return response.data;
};

export const submitSupplierDocument = async (payload, options = {}) => {
  const response = await api.post("/supplier-portal/documents", payload, options);
  return response.data;
};

export default {
  loginSupplierPortal,
  acknowledgePurchaseOrder,
  submitSupplierDocument,
};