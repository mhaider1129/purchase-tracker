import api from "./axios";

const normalizeBasePath = () => {
  const baseURL = api?.defaults?.baseURL || "";

  if (!baseURL) {
    return "";
  }

  try {
    const pathname = /^https?:\/\//i.test(baseURL)
      ? new URL(baseURL).pathname
      : baseURL;
    return pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
};

const buildCandidateEndpoints = () => {
  const basePath = normalizeBasePath();

  if (/(^|\/)api(\/|$)/i.test(basePath)) {
    return ["/users/me", "/api/users/me", "/auth/me", "/api/auth/me"];
  }

  return ["/api/users/me", "/users/me", "/auth/me", "/api/auth/me"];
};

const CURRENT_USER_ENDPOINTS = buildCandidateEndpoints();

const isNotFoundError = (error) => error?.response?.status === 404;

export const fetchCurrentUser = async (config = {}) => {
  let lastError;

  for (const endpoint of CURRENT_USER_ENDPOINTS) {
    try {
      return await api.get(endpoint, config);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError;
};