import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api/axios";

const normalizeWarehouses = (rawList) => {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((warehouse) => ({
    ...warehouse,
    type: warehouse.type || "warehouse",
  }));
};

const useWarehouses = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/warehouses");
      setWarehouses(normalizeWarehouses(res.data));
    } catch (err) {
      console.error("Failed to load warehouses", err);
      setError(err?.response?.data?.message || "Failed to load warehouses");
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const warehouseMap = useMemo(() => {
    const map = new Map();
    warehouses.forEach((wh) => {
      map.set(wh.id, wh);
    });
    return map;
  }, [warehouses]);

  return { warehouses, warehouseMap, loading, error, refresh: fetchWarehouses };
};

export default useWarehouses;