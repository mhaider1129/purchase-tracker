import api from "./axios";
export const getGuidedOptions = async () =>
  (await api.get("/requests/guided/options")).data;
export const searchGuidedItems = async ({ q }) =>
  (await api.get("/requests/guided/catalog", { params: { q } })).data;
export const previewGuidedRequest = async (payload) =>
  (await api.post("/requests/guided/preview", payload)).data;
export const submitGuidedRequest = async (payload, files) => {
  const body = new FormData();
  body.append("payload", JSON.stringify(payload));
  files.forEach((file) => body.append("attachments", file));
  return (await api.post("/requests/guided", body)).data;
};
