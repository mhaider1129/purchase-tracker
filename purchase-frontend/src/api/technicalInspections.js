// src/api/technicalInspections.js
import api from "./axios";

const RESOURCE = "/api/technical-inspections";

export const listTechnicalInspections = async (params = {}, options = {}) => {
  const { data } = await api.get(RESOURCE, { params, ...options });
  return Array.isArray(data) ? data : [];
};

export const getTechnicalInspection = async (id, options = {}) => {
  const { data } = await api.get(`${RESOURCE}/${id}`, options);
  return data;
};

export const createTechnicalInspection = async (payload, options = {}) => {
  const { data } = await api.post(RESOURCE, payload, options);
  return data;
};

export const updateTechnicalInspection = async (id, payload, options = {}) => {
  const { data } = await api.put(`${RESOURCE}/${id}`, payload, options);
  return data;
};

export const deleteTechnicalInspection = async (id, options = {}) => {
  await api.delete(`${RESOURCE}/${id}`, options);
};

export default {
  listTechnicalInspections,
  getTechnicalInspection,
  createTechnicalInspection,
  updateTechnicalInspection,
  deleteTechnicalInspection,
};