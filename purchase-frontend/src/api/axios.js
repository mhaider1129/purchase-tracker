// src/api/axios.js
import axios from "axios";

// Prefer explicit env configuration in production; allow legacy variable name.
const configuredBase =
  process.env.REACT_APP_API_BASE ?? process.env.REACT_APP_API_BASE_URL ?? "";

const normalizeBase = (value) => value.replace(/\/+$/, "");

const resolveDefaultBase = () => {
  if (typeof window === "undefined") return "";

  const { protocol, hostname, origin } = window.location;
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const isLocalNetworkHost =
    localHosts.has(hostname) || hostname.endsWith(".local") || /^(\d+\.){3}\d+$/.test(hostname);

  if (isLocalNetworkHost) {
    return `${protocol}//${hostname}:5000`;
  }

  // In hosted environments, assume API is reverse-proxied on the same origin.
  return origin;
};

const API_BASE = normalizeBase(configuredBase || resolveDefaultBase());

const dedupeApiPrefix = (base, path = "") => {
  if (!base || !path || typeof path !== "string") return path;

  const normalizedBase = base.replace(/\/+$/, "").toLowerCase();
  const normalizedPath = path.trimStart().toLowerCase();

  if (normalizedBase.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return path.replace(/^\/?api\//i, "/");
  }

  return path;
};


const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    config.url = dedupeApiPrefix(API_BASE, config.url);

    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error("🔴 Request Error:", error);
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("🔒 Unauthorized — Token may be expired");
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    if (axios.isCancel(error) || error.code === "ERR_CANCELED") {
      console.debug("⚠️ Request canceled:", error.message);
      return Promise.reject(error);
    }

    if (error.response) {
      const suppressNotFoundLog =
        error.response.status === 404 && error.config?.suppressNotFoundLog;

      if (!suppressNotFoundLog) {
        console.error(`❌ ${error.response.status}: ${error.response.data.message}`);
      }
    } else {
      console.error("❌ Network or Server error:", error.message);
    }

    return Promise.reject(error);
  },
);

export default api;