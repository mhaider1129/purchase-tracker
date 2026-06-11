import api from "./axios";

export const getDepartmentRequestedItems = async (params = {}) => {
  const res = await api.get("/department-requested-items", { params });
  return res.data;
};

export const getDepartmentRequestedItemsSummary = async (params = {}) => {
  const res = await api.get("/department-requested-items/summary", { params });
  return res.data;
};

export const previewDepartmentFollowUpMessage = async (payload) => {
  const res = await api.post("/department-requested-items/follow-up-message-preview", payload);
  return res.data;
};

export const saveDepartmentFollowUpNote = async (payload) => {
  const res = await api.post("/department-requested-items/follow-up-note", payload);
  return res.data;
};