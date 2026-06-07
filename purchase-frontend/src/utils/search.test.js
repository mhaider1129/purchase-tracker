import { getSearchTokens, matchesSearchTokens } from './search';

describe('search token helpers', () => {
  it('splits a query into normalized words', () => {
    expect(getSearchTokens('  PDS   USP 2  ')).toEqual(['pds', 'usp', '2']);
  });

  it('matches search words in any order across item fields', () => {
    const itemName =
      'Polydioxanone (PDS / PDO) Monofilament Absorbable Suture, Precision Reverse Cutting Needle, 3/8 Circle, 13 mm, USP 2, 75 cm, Undyed';

    expect(matchesSearchTokens('PDS USP 2', [itemName])).toBe(true);
    expect(matchesSearchTokens('USP PDS reverse', [itemName])).toBe(true);
  });

  it('requires every searched word to be present', () => {
    expect(matchesSearchTokens('PDS nylon', ['Polydioxanone (PDS / PDO) Suture USP 2'])).toBe(false);
  });

  it('matches words across multiple searchable values', () => {
    expect(matchesSearchTokens('suture ethicon', ['Absorbable suture', 'Ethicon'])).toBe(true);
  });
});