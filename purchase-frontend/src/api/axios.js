import axios from "axios";

const ENV_API_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "/api";

const FALLBACK_API_BASES = ["/api", "/api/api", "", "/backend/api"];

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
    candidates.add(`${normalizedBase}/api`);
  }

  if (normalizedBase.endsWith("/backend/api")) {
    candidates.add(normalizedBase.slice(0, -12));
  }

  return Array.from(candidates);
};

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      // Let the browser/axios generate the multipart boundary. Leaving a default
      // JSON content type here can cause file submissions to be parsed as JSON
      // and rejected by the API/proxy as an oversized request body.
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
      config.headers.set?.("Content-Type", undefined);
    } else if (!config.headers["Content-Type"] && !config.headers["content-type"]) {
      config.headers["Content-Type"] = "application/json";
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

    const shouldTryApiFallback =
      [502, 503, 504].includes(status) ||
      (status === 404 && !/^\/?attachments\//.test(config.url || ""));

    if (shouldTryApiFallback && typeof config.url === "string") {
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

    if (status === 413 && error.response && typeof error.response.data !== "object") {
      error.response.data = {
        message:
          "Request is too large. Please reduce attachment sizes or ask an administrator to increase the upload limit.",
      };
    }

    return Promise.reject(error);
  }
);

export default api;