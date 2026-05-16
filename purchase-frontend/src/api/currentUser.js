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

const resolveCurrentUserEndpoint = () => {
  const configuredEndpoint = process.env.REACT_APP_CURRENT_USER_ENDPOINT?.trim();
  if (configuredEndpoint) {
    return configuredEndpoint.startsWith("/")
      ? configuredEndpoint
      : `/${configuredEndpoint}`;
  }

  const basePath = normalizeBasePath();

  // If the API base already includes `/api`, avoid double-prefixing.
  if (/(^|\/)api(\/|$)/i.test(basePath)) {
    return "/users/me";
  }

  return "/api/users/me";
};

const CURRENT_USER_ENDPOINT = resolveCurrentUserEndpoint();

export const fetchCurrentUser = async (config = {}) =>
  api.get(CURRENT_USER_ENDPOINT, config);