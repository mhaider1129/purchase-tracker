import api from "./axios";

const CURRENT_USER_ENDPOINT = "/users/me";

export const fetchCurrentUser = async (config = {}) =>
  api.get(CURRENT_USER_ENDPOINT, config);