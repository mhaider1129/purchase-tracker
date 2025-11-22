export const normalizePermissionCode = (code) =>
  typeof code === "string" ? code.trim().toLowerCase() : "";

export const hasPermission = (user, permissionCode) => {
  if (!user || !permissionCode) {
    return false;
  }
  const normalized = normalizePermissionCode(permissionCode);
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return permissions.some(
    (code) => normalizePermissionCode(code) === normalized,
  );
};

export const hasAnyPermission = (user, permissionCodes = []) =>
  Array.isArray(permissionCodes) &&
  permissionCodes.some((code) => hasPermission(user, code));

export const hasAllPermissions = (user, permissionCodes = []) =>
  Array.isArray(permissionCodes) &&
  permissionCodes.every((code) => hasPermission(user, code));
