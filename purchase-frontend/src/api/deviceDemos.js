import api from "./axios";
const base = "/device-demos";
const data = (p) => p.then((r) => r.data);
export const demoSchema = () => data(api.get(`${base}/schema`));
export const listDemos = (search) =>
  data(api.get(base, { params: { search } }));
export const eligibleDemoItems = (search) =>
  data(api.get(`${base}/eligible-items`, { params: { search } }));
export const demoReviewers = () => data(api.get(`${base}/reviewers`));
export const getDemoWorkspace = (id) => data(api.get(`${base}/${id}`));
export const demoOptions = (id) => data(api.get(`${base}/${id}/options`));
export const openDemoWorkspace = (input) => data(api.post(base, input));
export const demoAction = (id, action, input) =>
  data(api.post(`${base}/${id}/${action}`, input));
export const demoEvidence = (id) => data(api.get(`/attachments/${id}`));
export const uploadDemoEvidence = (id, file) => {
  const body = new FormData();
  body.append("file", file);
  return data(api.post(`/attachments/${id}`, body));
};
