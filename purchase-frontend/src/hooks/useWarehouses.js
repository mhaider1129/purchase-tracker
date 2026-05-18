import { useMemo, useCallback } from 'react';
import api from '../api/axios';
import { useDataQuery } from './useDataQuery';

const normalizeWarehouses = (rawList) => {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((warehouse) => ({
    ...warehouse,
    type: warehouse.type || 'warehouse',
  }));
};

const useWarehouses = () => {
  const fetchWarehouses = useCallback(async () => {
    const res = await api.get('/warehouses');
    return normalizeWarehouses(res.data);
  }, []);

  const { data, error, isLoading, isFetching, refetch } = useDataQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const warehouses = useMemo(() => data || [], [data]);

  const warehouseMap = useMemo(() => {
    const map = new Map();
    warehouses.forEach((wh) => {
      map.set(wh.id, wh);
    });
    return map;
  }, [warehouses]);

  return {
    warehouses,
    warehouseMap,
    loading: isLoading || isFetching,
    error: error?.response?.data?.message || (error ? 'Failed to load warehouses' : ''),
    refresh: refetch,
  };
};

export default useWarehouses;