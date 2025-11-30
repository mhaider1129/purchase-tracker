import api from "./axios";

export const printRequest = async (id) => {
  const res = await api.get(`/api/requests/${id}/print`);
  return res.data;
};

export const getRequestDetails = async (id, options = {}) => {
  const trimmedId = String(id || "").trim();
  if (!trimmedId) throw new Error("A request id is required");

  const res = await api.get(`/api/requests/${trimmedId}`, options);
  return res.data;
};

export const updateRequest = async (id, payload, options = {}) => {
  const trimmedId = String(id || "").trim();
  if (!trimmedId) throw new Error("A request id is required");

  const res = await api.put(`/api/requests/${trimmedId}/edit`, payload, options);
  return res.data;
};

export default {
  printRequest,
  getRequestDetails,
  updateRequest,
};