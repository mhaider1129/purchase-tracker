import api from "./axios";

export const listRisks = async (options = {}) => {
  const response = await api.get("/api/risk-management", options);
  return Array.isArray(response.data?.risks) ? response.data.risks : [];
};

export const createRisk = async (payload, options = {}) => {
  const response = await api.post("/api/risk-management", payload, options);
  return response.data?.risk;
};

export const updateRisk = async (riskId, payload, options = {}) => {
  const response = await api.patch(`/api/risk-management/${riskId}`, payload, options);
  return response.data?.risk;
};

export default {
  listRisks,
  createRisk,
  updateRisk,
};