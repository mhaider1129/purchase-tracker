import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../api/axios";
import { hasAllPermissions, hasAnyPermission } from "../utils/permissions";
import { useAuth } from "./useAuth";

const AccessControlContext = createContext(null);

const normalizeResource = (resource = {}) => {
  const permissions = Array.isArray(resource.permissions)
    ? resource.permissions.filter(Boolean)
    : [];

  return {
    key: resource.resource_key ?? resource.key ?? "",
    label: resource.label ?? "",
    description: resource.description ?? "",
    permissions,
    requireAll: Boolean(resource.require_all ?? resource.requireAll ?? false),
  };
};

export const AccessControlProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchResources = useCallback(async () => {
    if (!isAuthenticated) {
      setResources([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.get("/api/ui-access");
      const payload = Array.isArray(res.data?.resources)
        ? res.data.resources
        : Array.isArray(res.data)
          ? res.data
          : [];

      setResources(payload.map(normalizeResource).filter((item) => item.key));
    } catch (err) {
      console.error("❌ Failed to load interface access configuration:", err);
      setError("Failed to load interface access configuration.");
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const resourceMap = useMemo(() => {
    const map = new Map();
    for (const resource of resources) {
      map.set(resource.key, resource);
    }
    return map;
  }, [resources]);

  const resolvePermissions = useCallback(
    (resourceKey, fallbackPermissions = [], fallbackRequireAll = false) => {
      if (!resourceKey) {
        return {
          permissions: Array.isArray(fallbackPermissions)
            ? fallbackPermissions
            : [],
          requireAll: Boolean(fallbackRequireAll),
        };
      }

      const resource = resourceMap.get(resourceKey);

      if (!resource) {
        return {
          permissions: Array.isArray(fallbackPermissions)
            ? fallbackPermissions
            : [],
          requireAll: Boolean(fallbackRequireAll),
        };
      }

      const permissions =
        resource.permissions.length > 0
          ? resource.permissions
          : Array.isArray(fallbackPermissions)
            ? fallbackPermissions
            : [];

      const requireAll =
        typeof resource.requireAll === "boolean"
          ? resource.requireAll
          : Boolean(fallbackRequireAll);

      return { permissions, requireAll };
    },
    [resourceMap],
  );

  const hasAccess = useCallback(
    (
      candidateUser,
      resourceKey,
      fallbackPermissions = [],
      fallbackRequireAll = false,
    ) => {
      const activeUser = candidateUser ?? user;
      const { permissions, requireAll } = resolvePermissions(
        resourceKey,
        fallbackPermissions,
        fallbackRequireAll,
      );

      if (!permissions || permissions.length === 0) {
        return true;
      }

      return requireAll
        ? hasAllPermissions(activeUser, permissions)
        : hasAnyPermission(activeUser, permissions);
    },
    [resolvePermissions, user],
  );

  const value = useMemo(
    () => ({
      resources,
      loading,
      error,
      refresh: fetchResources,
      resolvePermissions,
      hasAccess,
    }),
    [resources, loading, error, fetchResources, resolvePermissions, hasAccess],
  );

  return (
    <AccessControlContext.Provider value={value}>
      {children}
    </AccessControlContext.Provider>
  );
};

export const useAccessControl = () => {
  const context = useContext(AccessControlContext);
  if (!context) {
    throw new Error(
      "useAccessControl must be used within an AccessControlProvider",
    );
  }
  return context;
};
