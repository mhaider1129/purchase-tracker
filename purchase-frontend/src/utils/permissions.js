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


export const getScopeValues = (user, scopeCode) => {
  if (!user || !scopeCode) return [];

  const normalizedScopeCode = normalizePermissionCode(scopeCode);
  const scopes = user?.data_scopes && typeof user.data_scopes === 'object' ? user.data_scopes : {};
  const values = scopes[normalizedScopeCode];

  return Array.isArray(values) ? values : [];
};

export const hasScopeValue = (user, scopeCode, scopeValue) => {
  if (!scopeCode || typeof scopeValue === 'undefined' || scopeValue === null) return false;
  const normalizedValue = String(scopeValue).trim();
  if (!normalizedValue) return false;

  return getScopeValues(user, scopeCode).some((value) => String(value).trim() === normalizedValue);
};
