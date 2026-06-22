import api from "./axios";

export const printRequest = async (id, options = {}) => {
  const trimmedId = String(id || "").trim();
  if (!trimmedId) throw new Error("A request id is required");

  const { incrementPrintCount = true, language = "ar" } = options;
  const normalizedLanguage = language === "en" ? "en" : "ar";
  const res = await api.get(`/requests/${trimmedId}/print`, {
    params: { incrementPrintCount, language: normalizedLanguage },
  });
  return res.data;
};

export const getRequestDetails = async (id, options = {}) => {
  const trimmedId = String(id || "").trim();
  if (!trimmedId) throw new Error("A request id is required");

  const res = await api.get(`/requests/${trimmedId}`, options);
  return res.data;
};

export const updateRequest = async (id, payload, options = {}) => {
  const trimmedId = String(id || "").trim();
  if (!trimmedId) throw new Error("A request id is required");

  const res = await api.put(`/requests/${trimmedId}/edit`, payload, options);
  return res.data;
};

export const getHodApprovers = async (options = {}) => {
  const res = await api.get("/requests/hod-approvers", options);
  return res.data;
};

export const getProcurementUsers = async (options = {}) => {
  const res = await api.get("/requests/procurement-users", options);
  return res.data;
};

export const createHistoricalRequest = async (payload, options = {}) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload is required");
  }

  const res = await api.post("/requests/historical", payload, options);
  return res.data;
};

const requestsApi = {
  printRequest,
  getRequestDetails,
  updateRequest,
  getHodApprovers,
  getProcurementUsers,
  createHistoricalRequest,
};

export default requestsApi;