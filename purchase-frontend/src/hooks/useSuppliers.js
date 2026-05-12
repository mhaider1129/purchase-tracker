import { useCallback, useMemo } from 'react';
import { listSuppliers } from '../api/suppliers';
import { useDataQuery } from './useDataQuery';

export const useSuppliers = ({ autoLoad = true } = {}) => {
  const fetchSuppliers = useCallback(async () => {
    const rows = await listSuppliers();
    return rows || [];
  }, []);

  const { data, error, isLoading, isFetching, refetch } = useDataQuery({
    queryKey: ['suppliers'],
    queryFn: fetchSuppliers,
    enabled: autoLoad,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const suppliers = useMemo(() => data || [], [data]);

  const supplierOptions = useMemo(
    () => suppliers.map((supplier) => ({ id: String(supplier.id), name: supplier.name || '-' })),
    [suppliers],
  );

  return {
    suppliers,
    supplierOptions,
    loadingSuppliers: isLoading || isFetching,
    suppliersError: error?.response?.data?.message || (error ? 'Failed to load suppliers' : ''),
    reloadSuppliers: refetch,
  };
};