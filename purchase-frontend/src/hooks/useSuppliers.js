import { useCallback, useEffect, useMemo, useState } from 'react';
import { listSuppliers } from '../api/suppliers';

export const useSuppliers = ({ autoLoad = true } = {}) => {
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [suppliersError, setSuppliersError] = useState('');

  const reloadSuppliers = useCallback(async () => {
    setLoadingSuppliers(true);
    try {
      const rows = await listSuppliers();
      setSuppliers(rows || []);
      setSuppliersError('');
      return rows || [];
    } catch (err) {
      setSuppliersError(err?.response?.data?.message || 'Failed to load suppliers');
      throw err;
    } finally {
      setLoadingSuppliers(false);
    }
  }, []);

  useEffect(() => {
    if (!autoLoad) {
      return;
    }

    reloadSuppliers().catch(() => {});
  }, [autoLoad, reloadSuppliers]);

  const supplierOptions = useMemo(
    () => suppliers.map((supplier) => ({ id: String(supplier.id), name: supplier.name || '-' })),
    [suppliers]
  );

  return {
    suppliers,
    supplierOptions,
    loadingSuppliers,
    suppliersError,
    reloadSuppliers,
  };
};