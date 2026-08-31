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
    // i18next plural families legitimately have different suffixes by locale:
    // English uses one/other while Arabic also uses zero/two/few/many.
    const pluralSuffix = /_(zero|one|two|few|many|other)$/;
    const canonicalizePluralKeys = (locale) => [...new Set(
      flattenLocaleKeys(locale).map((key) => key.replace(pluralSuffix, '')),
    )].sort();
    const englishKeys = canonicalizePluralKeys(en);
    const arabicKeys = canonicalizePluralKeys(ar);

    expect(arabicKeys).toEqual(englishKeys);
  });

  it('provides the plural forms required by each locale', () => {
    expect(en.requestTypeSelector.finder).toEqual(expect.objectContaining({
      results_one: expect.any(String),
      results_other: expect.any(String),
    }));
    expect(ar.requestTypeSelector.finder).toEqual(expect.objectContaining({
      results_zero: expect.any(String),
      results_one: expect.any(String),
      results_two: expect.any(String),
      results_few: expect.any(String),
      results_many: expect.any(String),
      results_other: expect.any(String),
    }));
  });
});