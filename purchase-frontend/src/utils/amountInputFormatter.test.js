import { formatAmountInputValue, normalizeAmountInputValue } from './amountInputFormatter';

describe('amount input formatting', () => {
  it('adds thousands separators without changing the stored numeric value', () => {
    expect(normalizeAmountInputValue('12,345.67')).toBe('12345.67');
    expect(formatAmountInputValue('12345.67')).toBe('12,345.67');
  });

  it('keeps partial decimal entry readable while typing', () => {
    expect(normalizeAmountInputValue('1000.')).toBe('1000.');
    expect(formatAmountInputValue('1000.')).toBe('1,000.');
  });

  it('removes non-amount punctuation before saving', () => {
    expect(normalizeAmountInputValue('$1,250,000')).toBe('1250000');
    expect(formatAmountInputValue('$1,250,000')).toBe('1,250,000');
  });
});