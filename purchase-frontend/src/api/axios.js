// src/api/axios.js
import axios from "axios";

// ✅ Use REACT_APP_API_BASE (or legacy REACT_APP_API_BASE_URL) or fall back to current host
const envBase =
  process.env.REACT_APP_API_BASE ?? process.env.REACT_APP_API_BASE_URL ?? "";

// 🧼 Ensure there is no trailing slash so Axios handles paths predictably
const normalizedEnvBase = envBase.replace(/\/+$/, "");

const resolveBrowserBase = () => {
  if (typeof window === "undefined") {
    return { primary: "", fallback: "" };
  }

  const { protocol, hostname, origin } = window.location;
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const isIPAddress =
    /^(\d+\.){3}\d+$/.test(hostname) || hostname.includes(":");

  if (localHosts.has(hostname) || hostname.endsWith(".local")) {
    const localBackend = `${protocol}//${hostname}:5000`;
    return { primary: localBackend, fallback: localBackend };
  }

  if (isIPAddress) {
    const directHost = `${protocol}//${hostname}`;
    return { primary: directHost, fallback: directHost };
  }

  if (hostname.startsWith("api.")) {
    const apiHost = `${protocol}//${hostname}`;
    return { primary: apiHost, fallback: apiHost };
  }

  const bareHostname = hostname.replace(/^www\./, "");
  const apiHostname = `api.${bareHostname}`;
  const apiURL = `${protocol}//${apiHostname}`;

  return { primary: apiURL, fallback: origin };
};

const { primary: browserPrimary } = resolveBrowserBase();

const API_BASE = normalizedEnvBase || browserPrimary;

// ✅ Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000, // ⏱️ optional: 15s timeout to catch network issues
  headers: {
    "Content-Type": "application/json",
  },
});

const isRouteNotFound = (error) =>
  error?.response?.status === 404 &&
  /route not found/i.test(error?.response?.data?.message || "");

const buildApiPrefixFallbackUrl = (url = "") => {
  if (typeof url !== "string" || !url.startsWith("/")) {
    return null;
  }

  if (url === "/api") {
    return "/";
  }

  if (url.startsWith("/api/")) {
    return url.replace(/^\/api/, "") || "/";
  }

  return `/api${url}`;
};

// ✅ Attach token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => {
    console.error("🔴 Request Error:", error);
    return Promise.reject(error);
  },
);

// ⚠️ Global error interceptor (optional enhancement)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle token expiration or unauthorized access
    if (error.response?.status === 401) {
      console.warn("🔒 Unauthorized — Token may be expired");
      localStorage.removeItem("token");
      window.location.href = "/login"; // redirect to login
    }

    // Ignore abort errors triggered by Axios cancelation
    if (axios.isCancel(error) || error.code === "ERR_CANCELED") {
      console.debug("⚠️ Request canceled:", error.message);
      return Promise.reject(error);
    }

    if (isRouteNotFound(error) && !error.config?._apiPrefixFallbackTried) {
      const fallbackUrl = buildApiPrefixFallbackUrl(error.config?.url);

      if (fallbackUrl) {
        return api.request({
          ...error.config,
          url: fallbackUrl,
          _apiPrefixFallbackTried: true,
        });
      }
    }

    // General logging
    if (error.response) {
      const responseData = error.response.data;
      const serverMessage =
        (typeof responseData === "string" && responseData.trim()) ||
        responseData?.message ||
        responseData?.error ||
        responseData?.detail ||
        error.message ||
        "Request failed";

      console.error(`❌ ${error.response.status}: ${serverMessage}`);
    } else {
      console.error("❌ Network or Server error:", error.message);
    }

    return Promise.reject(error);
  },
);

export default api;