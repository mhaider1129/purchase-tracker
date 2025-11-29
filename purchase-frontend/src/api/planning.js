import api from "./axios";

export const fetchDemandForecast = (payload) =>
  api.post("/api/planning/forecast", payload);

export const calculateSafetyStock = (payload) =>
  api.post("/api/planning/safety-stock", payload);

export const runMrp = (payload) => api.post("/api/planning/mrp", payload);

export default {
  fetchDemandForecast,
  calculateSafetyStock,
  runMrp,
};