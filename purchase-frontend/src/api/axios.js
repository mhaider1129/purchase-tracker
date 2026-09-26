import axios from "axios";

const DEFAULT_API_BASE =
  process.env.NODE_ENV === "development"
    ? `${window.location.protocol}//${window.location.hostname}:5000/api`
    : "/api";

export const API_BASE = (
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  DEFAULT_API_BASE
).replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

const notificationEventName = "purchase-tracker:api-action";
const mutatingMethods = new Set(["post", "put", "patch", "delete"]);
const notificationMutedPaths = [
  /^\/?notifications(?:\/|$)/i,
  /^\/?auth\/me$/i,
];

const getRequestMethod = (config = {}) =>
  String(config.method || "get").toLowerCase();

const getRequestPath = (config = {}) => String(config.url || "");

const definitiveAuthenticationErrorCodes = new Set([
  "INVALID_TOKEN",
  "INVALID_TOKEN_SUBJECT",
  "USER_NOT_FOUND",
  "USER_INACTIVE",
]);

// A generic 401 can be an endpoint-level authorization decision. Only explicit
// token/session failures, or the authoritative session check, end the session.
export const isDefinitiveAuthenticationFailure = (error) => {
  if (error?.response?.status !== 401) return false;

  const code = String(error.response.data?.code || "").toUpperCase();
  if (definitiveAuthenticationErrorCodes.has(code)) return true;

  const path = getRequestPath(error.config).replace(/^\/?api\//i, "");
  return /^\/?auth\/me(?:\?|$)/i.test(path);
};

const shouldAnnounceApiAction = (config = {}) => {
  const method = getRequestMethod(config);
  const path = getRequestPath(config);

  return (
    mutatingMethods.has(method) &&
    !config.__skipActionNotification &&
    !notificationMutedPaths.some((pattern) => pattern.test(path.replace(/^\/+api\//i, "")))
  );
};

const getResponseMessage = (response) => {
  const data = response?.data;

  if (typeof data === "string" && data.trim()) return data.trim();

  if (data && typeof data === "object") {
    return data.message || data.error || data.data?.message || data.data?.status || null;
  }

  return null;
};

const dispatchApiActionNotification = ({ config, response, error, type }) => {
  if (typeof window === "undefined" || !shouldAnnounceApiAction(config)) return;

  const method = getRequestMethod(config).toUpperCase();
  const fallbackMessage =
    type === "error"
      ? `${method} action failed. Please try again.`
      : `${method} action completed successfully.`;
  const detailMessage =
    type === "error"
      ? error?.response?.data?.message || error?.response?.data?.error || error?.message
      : getResponseMessage(response);

  window.dispatchEvent(
    new CustomEvent(notificationEventName, {
      detail: {
        type,
        title: type === "error" ? "Action failed" : "Action completed",
        message: detailMessage || fallbackMessage,
      },
    }),
  );
};

export const API_ACTION_NOTIFICATION_EVENT = notificationEventName;

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) config.headers.Authorization = `Bearer ${token}`;

    if (config.data instanceof FormData) {
      // The browser must supply the multipart boundary.
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
      config.headers.set?.("Content-Type", undefined);
    } else if (!config.headers["Content-Type"] && !config.headers["content-type"]) {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    dispatchApiActionNotification({ config: response.config, response, type: "success" });
    return response;
  },
  (error) => {
    const config = error.config || {};
    const status = error.response?.status;

    if (isDefinitiveAuthenticationFailure(error)) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    if (status === 413) {
      error.response.data = {
        message:
          "Request is too large. Please reduce attachment sizes or ask an administrator to increase the upload limit.",
      };
    }

    dispatchApiActionNotification({ config, error, type: "error" });
    return Promise.reject(error);
  },
);

export default api;