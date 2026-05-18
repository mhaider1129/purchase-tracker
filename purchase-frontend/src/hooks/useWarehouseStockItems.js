import { useCallback } from 'react';
import api from '../api/axios';
import { useDataQuery } from './useDataQuery';

const useWarehouseStockItems = (warehouseId) => {
  const fetchItems = useCallback(async () => {
    if (!warehouseId) {
      return [];
    }

    const res = await api.get(`/warehouse-inventory/${warehouseId}/items`);
    return res.data || [];
  }, [warehouseId]);

  const { data, error, isLoading, isFetching, refetch } = useDataQuery({
    queryKey: ['warehouse-items', warehouseId],
    queryFn: fetchItems,
    enabled: Boolean(warehouseId),
    staleTime: 60_000,
    retry: 1,
  });

  return {
    items: data || [],
    loading: isLoading || isFetching,
    error: error?.response?.data?.message || (error ? 'Failed to load warehouse items' : ''),
    refresh: refetch,
  };
};

export default useWarehouseStockItems;