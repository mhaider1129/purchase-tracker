import api from "./axios";

export const listSuppliers = async (options = {}) => {
  const response = await api.get("/api/suppliers", options);
  return Array.isArray(response.data) ? response.data : [];
};

export default {
  listSuppliers,
};