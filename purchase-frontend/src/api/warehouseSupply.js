import api from './axios';

export const printWarehouseSupplyRequest = async (id) => {
  const trimmedId = String(id || '').trim();
  if (!trimmedId) throw new Error('A request id is required');

  const res = await api.get(`/warehouse-supply/${trimmedId}/print`);
  return res.data;
};

const warehouseSupplyApi = { printWarehouseSupplyRequest };

export default warehouseSupplyApi;