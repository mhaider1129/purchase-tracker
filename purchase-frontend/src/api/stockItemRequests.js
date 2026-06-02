// src/api/stockItemRequests.js
import api from "./axios";

export const fetchStockItemRequests = async () => {
  const res = await api.get("/stock-item-requests");
  return res.data;
};

export const updateStockItemRequestStatus = async (id, status) => {
  const res = await api.patch(`/stock-item-requests/${id}/status`, {
    status,
  });
  return res.data;
};

const stockItemRequestsApi = {
  fetchStockItemRequests,
  updateStockItemRequestStatus,
};

export default stockItemRequestsApi;