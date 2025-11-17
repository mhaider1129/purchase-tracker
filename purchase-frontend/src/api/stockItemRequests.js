
// src/api/stockItemRequests.js
import api from './axios';

export const fetchStockItemRequests = async () => {
  const res = await api.get('/api/stock-item-requests');
  return res.data;
};

export const updateStockItemRequestStatus = async (id, status) => {
  const res = await api.patch(`/api/stock-item-requests/${id}/status`, { status });
  return res.data;
};

export default {
  fetchStockItemRequests,
  updateStockItemRequestStatus,
};