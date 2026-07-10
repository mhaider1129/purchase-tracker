import api from "./axios";

const base = "/procurement-evaluations";

export const procurementEvaluationsApi = {
  list: () => api.get(base).then((res) => res.data),
  create: (payload) => api.post(base, payload).then((res) => res.data),
  get: (id) => api.get(`${base}/${id}`).then((res) => res.data),
  update: (id, payload) => api.patch(`${base}/${id}`, payload).then((res) => res.data),
  remove: (id) => api.delete(`${base}/${id}`).then((res) => res.data),
  listOffers: (id) => api.get(`${base}/${id}/offers`).then((res) => res.data),
  listScenarios: (id) => api.get(`${base}/${id}/scenarios`).then((res) => res.data),
  createScenario: (id, payload) => api.post(`${base}/${id}/scenarios`, payload).then((res) => res.data),
  createOffer: (id, payload) => api.post(`${base}/${id}/offers`, payload).then((res) => res.data),
  updateOffer: (id, offerId, payload) => api.patch(`${base}/${id}/offers/${offerId}`, payload).then((res) => res.data),
  listTests: (id) => api.get(`${base}/${id}/tests`).then((res) => res.data),
  createTest: (id, payload) => api.post(`${base}/${id}/tests`, payload).then((res) => res.data),
  listCosts: (id) => api.get(`${base}/${id}/offer-test-costs`).then((res) => res.data),
  coverage: (id) => api.get(`${base}/${id}/coverage`).then((res) => res.data),
  itemComparison: (id) => api.get(`${base}/${id}/item-comparison`).then((res) => res.data),
  previewImport: (id, payload) => api.post(`${base}/${id}/import/preview`, payload).then((res) => res.data),
  confirmImport: (id, offerId, payload) => api.post(`${base}/${id}/offers/${offerId}/import`, payload).then((res) => res.data),
  importTemplateUrl: `${base}/import/template.csv`,
  bulkSaveCosts: (id, items) => api.put(`${base}/${id}/offer-test-costs/bulk`, { items }).then((res) => res.data),
  clearCost: (id, offerId, testId) => api.delete(`${base}/${id}/offer-test-costs/${offerId}/${testId}`).then((res) => res.data),
  listCriteria: (id) => api.get(`${base}/${id}/criteria`).then((res) => res.data),
  createCriteria: (id, payload) => api.post(`${base}/${id}/criteria`, payload).then((res) => res.data),
  updateCriteria: (id, criteriaId, payload) => api.patch(`${base}/${id}/criteria/${criteriaId}`, payload).then((res) => res.data),
  listScores: (id) => api.get(`${base}/${id}/scores`).then((res) => res.data),
  bulkSaveScores: (id, items) => api.put(`${base}/${id}/scores/bulk`, { items }).then((res) => res.data),
  calculate: (id) => api.post(`${base}/${id}/calculate`).then((res) => res.data),
  results: (id) => api.get(`${base}/${id}/results`).then((res) => res.data),
  sensitivity: (id) => api.get(`${base}/${id}/sensitivity`).then((res) => res.data),
  optimization: (id) => api.get(`${base}/${id}/optimization`).then((res) => res.data),
  breakEven: (id, payload) => api.post(`${base}/${id}/break-even`, payload).then((res) => res.data),
  recommendation: (id) => api.get(`${base}/${id}/recommendation`).then((res) => res.data),
  complianceMatrix: (id) => api.get(`${base}/${id}/compliance-matrix`).then((res) => res.data),
  disqualificationReview: (id) => api.get(`${base}/${id}/disqualification-review`).then((res) => res.data),
  riskAdjustedTco: (id) => api.get(`${base}/${id}/risk-adjusted-tco`).then((res) => res.data),
  reportSummary: (id) => api.get(`${base}/${id}/report-summary`).then((res) => res.data),
  finalize: (id, payload) => api.patch(`${base}/${id}/finalize`, payload).then((res) => res.data),
};

export default procurementEvaluationsApi;