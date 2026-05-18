// src/api/axios.js
import axios from "axios";

const configuredBase =
  process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_BASE_URL;

const API_BASE =
  configuredBase ||
  (window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  /^(\d+\.){3}\d+$/.test(window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:5000/api`
    : `${window.location.origin}/api`);

const api = axios.create({
  baseURL: API_BASE.replace(/\/+$/, ""),
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    console.error("🔴 Request Error:", error);
    return Promise.reject(error);
  }
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
        console.error(
          `❌ ${error.response.status}: ${
            error.response.data?.message || error.message
          }`
        );
      }
    } else {
      console.error("❌ Network or Server error:", error.message);
    }

    return Promise.reject(error);
  }
);

export default api;