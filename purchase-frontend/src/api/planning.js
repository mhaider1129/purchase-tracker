import api from "./axios";

export const fetchDemandForecast = (payload) =>
  api.post("/planning/forecast", payload);

export const calculateSafetyStock = (payload) =>
  api.post("/planning/safety-stock", payload);

export const runMrp = (payload) => api.post("/planning/mrp", payload);
export const fetchPlanningDefaults = (warehouseId) =>
  api.get("/planning/defaults", { params: warehouseId ? { warehouse_id: warehouseId } : {} });
export const savePlanningDefaults = (payload) =>
  api.post("/planning/defaults", payload);

export const saveReplenishmentPolicy = (payload) =>
  api.post("/planning/replenishment/policies", payload);

export const runReplenishmentPlanner = (payload) =>
  api.post("/planning/replenishment/run", payload);

export default {
  fetchDemandForecast,
  calculateSafetyStock,
  runMrp,
  fetchPlanningDefaults,
  savePlanningDefaults,
  saveReplenishmentPolicy,
  runReplenishmentPlanner,
};