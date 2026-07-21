import { formatOptionalItemText } from './itemUtils';

describe('formatOptionalItemText', () => {
  it.each([null, undefined, '', '   ', 0, '0', ' 0 '])(
    'uses the fallback for missing or legacy zero value %p',
    (value) => {
      expect(formatOptionalItemText(value)).toBe('—');
    },
  );

  it('preserves and trims meaningful text', () => {
    expect(formatOptionalItemText('  Acme  ')).toBe('Acme');
    expect(formatOptionalItemText('Model 01')).toBe('Model 01');
  });

  it('supports an empty fallback for conditional rendering', () => {
    expect(formatOptionalItemText('0', '')).toBe('');
  });
});