import api from "./axios";
const base = "/surgical-consignments",
  data = (p) => p.then((r) => r.data);
export const schema = () => data(api.get(`${base}/schema`));
export const options = () => data(api.get(`${base}/options`));
export const list = (search) => data(api.get(base, { params: { search } }));
export const get = (id) => data(api.get(`${base}/${id}`));
export const create = (input) => data(api.post(base, input));
export const action = (id, operation, input) =>
  data(api.post(`${base}/${id}/${operation}`, input));
export const purchaseOrders = (id) =>
  data(api.get(`${base}/${id}/purchase-orders`));
export const upload = (id, file, purpose) => {
  const body = new FormData();
  body.append("purpose", purpose);
  body.append("file", file);
  return data(api.post(`${base}/${id}/files`, body));
};
export const download = (id, fileId) =>
  data(
    api.get(`${base}/${id}/files/${fileId}/download`, { responseType: "blob" }),
  );
export const routing = (department_id, section_id) =>
  data(
    api.get(`${base}/routing`, {
      params: { department_id, section_id: section_id || undefined },
    }),
  );
export const settings = () => data(api.get(`${base}/settings`));
export const saveSettings = (input) => data(api.put(`${base}/settings`, input));
