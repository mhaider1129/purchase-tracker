import axios from "./axios";
const data = (request) => request.then((response) => response.data);
export const getPublicPriorityQueue = (params) =>
  data(axios.get("/procurement-priority/public", { params }));
export const getDepartmentPriorityQueue = () =>
  data(axios.get("/procurement-priority/requests/department"));
export const reorderDepartmentPriority = (ordered_request_ids, snapshots) =>
  data(axios.put('/procurement-priority/requests/department/order', { ordered_request_ids, snapshots }));
export const getPriorityProfile = (id) =>
  data(axios.get(`/procurement-priority/cases/${id}`));
export const getPriorityHistory = (id) =>
  data(axios.get(`/procurement-priority/cases/${id}/history`));
export const updatePriorityAssessment = (id, input) =>
  data(axios.put(`/procurement-priority/cases/${id}/assessment`, input));
export const previewPriorityAssessment = (id, input) =>
  data(axios.post(`/procurement-priority/cases/${id}/preview`, input));
export const createPriorityGroup = (input) =>
  data(axios.post("/procurement-priority/groups", input));
export const getPriorityManagementQueue = (params) =>
  data(axios.get("/procurement-priority/requests/manage", { params }));
export const reorderInstitutionalPriorities = (ordered_request_ids, snapshots, reason) =>
  data(axios.put('/procurement-priority/requests/institutional-order', { ordered_request_ids, snapshots, reason }));
export const getPriorityGroups = () =>
  data(axios.get("/procurement-priority/groups"));
export const updatePriorityGroup = (id, input) =>
  data(axios.put(`/procurement-priority/groups/${id}`, input));
export const archivePriorityGroup = (id) =>
  data(axios.put(`/procurement-priority/groups/${id}/archive`));
