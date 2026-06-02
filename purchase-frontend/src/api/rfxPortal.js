import api from "./axios";

export const listRfxEvents = async (options = {}) => {
  const response = await api.get("/rfx-portal", options);
  return Array.isArray(response.data) ? response.data : [];
};

export const createRfxEvent = async (payload, options = {}) => {
  const response = await api.post("/rfx-portal", payload, options);
  return response.data;
};

export const updateRfxStatus = async (id, status, options = {}) => {
  const response = await api.patch(`/rfx-portal/${id}/status`, { status }, options);
  return response.data;
};

export const listRfxResponses = async (id, options = {}) => {
  const response = await api.get(`/rfx-portal/${id}/responses`, options);
  return Array.isArray(response.data) ? response.data : [];
};

export const submitRfxResponse = async (id, payload, options = {}) => {
  const response = await api.post(`/rfx-portal/${id}/responses`, payload, options);
  return response.data;
};

export const analyzeRfxQuotations = async (id, quotations, options = {}) => {
  const response = await api.post(`/rfx-portal/${id}/analyze`, { quotations }, options);
  return response.data;
};

export const awardRfxResponse = async (id, payload, options = {}) => {
  const response = await api.post(`/rfx-portal/${id}/award`, payload, options);
  return response.data;
};

const rfxPortalApi = {
  listRfxEvents,
  createRfxEvent,
  updateRfxStatus,
  listRfxResponses,
  submitRfxResponse,
  analyzeRfxQuotations,
  awardRfxResponse,
};

export default rfxPortalApi;