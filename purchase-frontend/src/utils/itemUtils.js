// src/utils/itemUtils.js
export const extractItems = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
};

export const getItemSortName = (item) =>
  String(item?.item_name || item?.name || item?.title || '').trim().toLocaleLowerCase();

export const sortItemsAlphabetically = (items = []) =>
  [...items].sort((a, b) => {
    const byName = getItemSortName(a).localeCompare(getItemSortName(b), undefined, {
      numeric: true,
      sensitivity: 'base',
    });

    if (byName !== 0) return byName;

    return Number(a?.id || 0) - Number(b?.id || 0);
  });

export const getDisplayItems = (items = [], shouldSortAlphabetically = false) =>
  shouldSortAlphabetically ? sortItemsAlphabetically(items) : items;