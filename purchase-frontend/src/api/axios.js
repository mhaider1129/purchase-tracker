import axios from "axios";

const API_BASE =
  process.env.REACT_APP_API_BASE || "/api";

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

    if (status === 404 && !config.__didRetryWithApiPrefix && typeof config.url === "string") {
      config.__didRetryWithApiPrefix = true;

      const normalizedUrl = config.url.startsWith("/") ? config.url : `/${config.url}`;
      config.url = `/api${normalizedUrl}`;

      return api.request(config);
    }

    if (status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;