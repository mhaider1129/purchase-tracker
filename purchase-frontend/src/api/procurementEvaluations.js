import api from "./axios";

const base = "/procurement-evaluations";

export const procurementEvaluationsApi = {
  list: () => api.get(base).then((res) => res.data),
  create: (payload) => api.post(base, payload).then((res) => res.data),
  get: (id) => api.get(`${base}/${id}`).then((res) => res.data),
  update: (id, payload) => api.patch(`${base}/${id}`, payload).then((res) => res.data),
  remove: (id) => api.delete(`${base}/${id}`).then((res) => res.data),
  listOffers: (id) => api.get(`${base}/${id}/offers`).then((res) => res.data),
  createOffer: (id, payload) => api.post(`${base}/${id}/offers`, payload).then((res) => res.data),
  updateOffer: (id, offerId, payload) => api.patch(`${base}/${id}/offers/${offerId}`, payload).then((res) => res.data),
  listTests: (id) => api.get(`${base}/${id}/tests`).then((res) => res.data),
  createTest: (id, payload) => api.post(`${base}/${id}/tests`, payload).then((res) => res.data),
  listCosts: (id) => api.get(`${base}/${id}/offer-test-costs`).then((res) => res.data),
  bulkSaveCosts: (id, items) => api.put(`${base}/${id}/offer-test-costs/bulk`, { items }).then((res) => res.data),
  listCriteria: (id) => api.get(`${base}/${id}/criteria`).then((res) => res.data),
  createCriteria: (id, payload) => api.post(`${base}/${id}/criteria`, payload).then((res) => res.data),
  updateCriteria: (id, criteriaId, payload) => api.patch(`${base}/${id}/criteria/${criteriaId}`, payload).then((res) => res.data),
  listScores: (id) => api.get(`${base}/${id}/scores`).then((res) => res.data),
  bulkSaveScores: (id, items) => api.put(`${base}/${id}/scores/bulk`, { items }).then((res) => res.data),
  calculate: (id) => api.post(`${base}/${id}/calculate`).then((res) => res.data),
  results: (id) => api.get(`${base}/${id}/results`).then((res) => res.data),
  sensitivity: (id) => api.get(`${base}/${id}/sensitivity`).then((res) => res.data),
  recommendation: (id) => api.get(`${base}/${id}/recommendation`).then((res) => res.data),
  finalize: (id, payload) => api.patch(`${base}/${id}/finalize`, payload).then((res) => res.data),
};

export default procurementEvaluationsApi;