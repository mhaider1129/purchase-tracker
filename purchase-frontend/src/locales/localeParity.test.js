import en from './en.json';
import ar from './ar.json';

const flattenLocaleKeys = (value, prefix = '') => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenLocaleKeys(child, nextPrefix);
  });
};

describe('locale parity', () => {
  it('keeps English and Arabic locale keys synchronized', () => {
    const englishKeys = flattenLocaleKeys(en).sort();
    const arabicKeys = flattenLocaleKeys(ar).sort();

    expect(arabicKeys).toEqual(englishKeys);
  });
});