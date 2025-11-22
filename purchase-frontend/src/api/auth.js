// src/api/auth.js
import api from "./axios";

export const changePassword = async ({ currentPassword, newPassword }) => {
  const response = await api.put("/auth/change-password", {
    currentPassword,
    newPassword,
  });
  return response.data;
};

export default {
  changePassword,
};
