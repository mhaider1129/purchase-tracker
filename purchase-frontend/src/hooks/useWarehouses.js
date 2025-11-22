import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api/axios";

const normalizeWarehouses = (departments) => {
  if (!Array.isArray(departments)) return [];
  return departments.filter((dept) => {
    const type = (dept.type || "").toLowerCase();
    return type === "warehouse";
  });
};

const useWarehouses = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/departments");
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
