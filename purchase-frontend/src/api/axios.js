import axios from "axios";

const ENV_API_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "/api";

const FALLBACK_API_BASES = ["/api", "/backend/api", ""];

const trimTrailingSlashes = (value = "") => value.replace(/\/+$/, "");

const isLikelyPrivateHost = (host = "") => {
  const normalizedHost = host.toLowerCase();

  return (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "0.0.0.0" ||
    normalizedHost.startsWith("10.") ||
    normalizedHost.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalizedHost)
  );
};

const resolveInitialApiBase = () => {
  const normalizedBase = trimTrailingSlashes(ENV_API_BASE);

  if (typeof window === "undefined") {
    return normalizedBase;
  }

  if (!normalizedBase) {
    return "/api";
  }

  try {
    const parsed = new URL(normalizedBase, window.location.origin);
    const isAbsoluteEnvValue = /^https?:\/\//i.test(normalizedBase);

    if (isAbsoluteEnvValue && isLikelyPrivateHost(parsed.hostname) && parsed.origin !== window.location.origin) {
      return "/api";
    }

    return isAbsoluteEnvValue ? `${parsed.origin}${parsed.pathname}` : normalizedBase;
  } catch (_error) {
    return "/api";
  }
};

const API_BASE = resolveInitialApiBase();

const resolveApiFallbackBases = (base) => {
  const normalizedBase = trimTrailingSlashes(base || API_BASE || "");
  const candidates = new Set([normalizedBase, ...FALLBACK_API_BASES]);

  if (normalizedBase.endsWith("/api")) {
    candidates.add(normalizedBase.slice(0, -4));
  }

  if (normalizedBase.endsWith("/backend/api")) {
    candidates.add(normalizedBase.slice(0, -12));
  }

  return Array.from(candidates);
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

    if (status === 404 && typeof config.url === "string") {
      const attemptedBases = config.__attemptedApiBases || [];
      const currentBase = trimTrailingSlashes(config.baseURL || API_BASE);
      const fallbackBases = resolveApiFallbackBases(currentBase);

      const nextBase = fallbackBases.find(
        (base) => trimTrailingSlashes(base) !== currentBase && !attemptedBases.includes(base)
      );

      if (nextBase !== undefined) {
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