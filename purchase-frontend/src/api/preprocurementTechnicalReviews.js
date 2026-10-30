import api from "./axios";
const base = "/technical-inspections/pre-procurement";
const data = (promise) => promise.then((response) => response.data);
export const reviewSchema = () => data(api.get(`${base}/schema`));
export const reviewPolicy = () => data(api.get(`${base}/policy`));
export const saveReviewPolicy = (input) =>
  data(api.put(`${base}/policy`, input));
export const eligibleReviewRequests = (search) =>
  data(api.get(`${base}/eligible-requests`, { params: { search } }));
export const reviewDirectory = () => data(api.get(`${base}/reviewers`));
export const listPreprocurementReviews = (search) =>
  data(api.get(base, { params: { search } }));
export const getPreprocurementReview = (id) => data(api.get(`${base}/${id}`));
export const sendTechnicalReview = (input) => data(api.post(base, input));
export const submitTechnicalOpinion = (id, input) =>
  data(api.post(`${base}/${id}/opinion`, input));
export const signTechnicalReview = (id, input) =>
  data(api.post(`${base}/${id}/sign-off`, input));
export const cancelTechnicalReview = (id, input) =>
  data(api.post(`${base}/${id}/cancel`, input));
export const requestEvidence = (id) => data(api.get(`/attachments/${id}`));
export const uploadReviewEvidence = (id, file) => {
  const body = new FormData();
  body.append("file", file);
  return data(api.post(`/attachments/${id}`, body));
};
export const reviseTechnicalReview=(id,input)=>data(api.post(`${base}/${id}/revise`,input));
export const startTechnicalReview=(id,input)=>data(api.post(`${base}/${id}/start`,input));
export const proposalDirectory=()=>data(api.get(`${base}/proposals`));
