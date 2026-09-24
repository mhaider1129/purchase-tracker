
export const filterUsersBySearch = (users = [], query = '') => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return users;
  }

  return users.filter((user) =>
    [user?.name, user?.email].some((value) =>
      String(value || '').toLowerCase().includes(normalizedQuery),
    ),
  );
};