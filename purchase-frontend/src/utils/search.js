const normalizeSearchText = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const getSearchTokens = (query) =>
  normalizeSearchText(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export const matchesSearchTokens = (query, values) => {
  const tokens = getSearchTokens(query);
  if (!tokens.length) {
    return true;
  }

  const haystack = (Array.isArray(values) ? values : [values])
    .filter((value) => value !== null && value !== undefined)
    .map(normalizeSearchText)
    .join(' ');

  return tokens.every((token) => haystack.includes(token));
};