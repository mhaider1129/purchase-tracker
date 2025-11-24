import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";

const useWarehouseStockItems = (warehouseId) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchItems = useCallback(async () => {
    if (!warehouseId) {
      setItems([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/api/warehouse-inventory/${warehouseId}/items`);
      setItems(res.data || []);
    } catch (err) {
      console.error("Failed to load warehouse items", err);
      setError(err?.response?.data?.message || "Failed to load warehouse items");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { items, loading, error, refresh: fetchItems };
};

export default useWarehouseStockItems;