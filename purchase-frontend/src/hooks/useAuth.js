// src/hooks/useAuth.js
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { fetchCurrentUser } from "../api/currentUser";
import { invalidateQueries } from "./useDataQuery";

const AuthContext = createContext(null);

const normalizeDataScopes = (dataScopes) => {
  if (!dataScopes || typeof dataScopes !== "object" || Array.isArray(dataScopes)) {
    return {};
  }

  return Object.entries(dataScopes).reduce((acc, [code, values]) => {
    const normalizedCode = typeof code === "string" ? code.trim().toLowerCase() : "";
    if (!normalizedCode) return acc;
    acc[normalizedCode] = Array.isArray(values)
      ? values
          .map((value) => (value === null || typeof value === "undefined" ? "" : String(value).trim()))
          .filter(Boolean)
      : [];
    return acc;
  }, {});
};


const useProvideAuth = () => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeProfileRequestRef = useRef(0);
  const navigate = useNavigate();

  const isTokenExpired = useCallback((candidate) => {
    if (!candidate) return true;
    try {
      const decoded = jwtDecode(candidate);
      const now = Date.now() / 1000;
      return decoded.exp && decoded.exp < now - 5;
    } catch (err) {
      console.warn("⚠️ Invalid token:", err);
      return true;
    }
  }, []);

  const logout = useCallback(() => {
    activeProfileRequestRef.current += 1;
    localStorage.removeItem("token");
    invalidateQueries((key) => key.includes("current-user"));
    setToken(null);
    setUser(null);
    setIsLoading(false);
    navigate("/login");
  }, [navigate]);

  const fetchUserProfile = useCallback(
    async (activeToken) => {
      if (!activeToken) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const requestId = activeProfileRequestRef.current + 1;
      activeProfileRequestRef.current = requestId;
      setUser(null);
      setIsLoading(true);
      try {
        const res = await fetchCurrentUser({
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        const profile = res.data || {};
        profile.permissions = Array.isArray(profile.permissions)
          ? profile.permissions
          : [];
        profile.data_scopes = normalizeDataScopes(profile.data_scopes);
        if (activeProfileRequestRef.current === requestId && localStorage.getItem("token") === activeToken) {
          setUser(profile);
        }
      } catch (err) {
        if (activeProfileRequestRef.current === requestId && localStorage.getItem("token") === activeToken) {
          console.error("❌ Failed to fetch user profile:", err);
          logout();
        }
      } finally {
        if (activeProfileRequestRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [logout],
  );

  const login = useCallback((newToken) => {
    activeProfileRequestRef.current += 1;
    invalidateQueries((key) => key.includes("current-user"));
    localStorage.setItem("token", newToken);
    setUser(null);
    setIsLoading(true);
    setToken(newToken);
  }, []);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    if (isTokenExpired(token)) {
      logout();
    } else {
      fetchUserProfile(token);
    }
  }, [token, isTokenExpired, fetchUserProfile, logout]);

  useEffect(() => {
    const handleStorageChange = () => {
      const newToken = localStorage.getItem("token");
      if (!newToken || isTokenExpired(newToken)) {
        logout();
      } else {
        invalidateQueries((key) => key.includes("current-user"));
        setUser(null);
        setIsLoading(true);
        setToken(newToken);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [logout, isTokenExpired]);

  const value = useMemo(
    () => ({
      token,
      user,
      login,
      logout,
      isAuthenticated: Boolean(token && user),
      isLoading,
    }),
    [token, user, login, logout, isLoading],
  );

  return value;
};

export const AuthProvider = ({ children }) => {
  const auth = useProvideAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
