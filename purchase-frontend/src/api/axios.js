import axios from "axios";

const API_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "/api";

const FALLBACK_API_BASES = ["/api", "/backend/api"];

const api = axios.create({
  baseURL: API_BASE,
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

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;

    const method = (config.method || "get").toLowerCase();

    if (status === 404 && typeof config.url === "string") {
      const attemptedBases = config.__attemptedApiBases || [];
      const currentBase = config.baseURL || API_BASE;

      const nextBase = FALLBACK_API_BASES.find(
        (base) => base !== currentBase && !attemptedBases.includes(base)
      );

      if (nextBase) {
        config.__attemptedApiBases = [...attemptedBases, nextBase];
        config.baseURL = nextBase;
        return api.request(config);
      }
    }

    if (status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;