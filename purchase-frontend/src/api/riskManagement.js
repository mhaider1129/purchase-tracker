import api from "./axios";

export const listRisks = async (options = {}) => {
  const response = await api.get("/risk-management", options);
  return Array.isArray(response.data?.risks) ? response.data.risks : [];
};

export const createRisk = async (payload, options = {}) => {
  const response = await api.post("/risk-management", payload, options);
  return response.data?.risk;
};

export const updateRisk = async (riskId, payload, options = {}) => {
  const response = await api.patch(`/risk-management/${riskId}`, payload, options);
  return response.data?.risk;
};

const riskManagementApi = {
  listRisks,
  createRisk,
  updateRisk,
};

export default riskManagementApi;