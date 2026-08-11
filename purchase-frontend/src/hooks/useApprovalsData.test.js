import { normalizeOptionalEstimatedCost } from './useApprovalsData';

describe('normalizeOptionalEstimatedCost', () => {
  it('accepts blank costs and normalizes positive formatted costs', () => {
    expect(normalizeOptionalEstimatedCost('')).toBeNull();
    expect(normalizeOptionalEstimatedCost('1,250.50')).toBe(1250.5);
  });

  it.each(['invalid', '0', '-1', 'Infinity'])('rejects invalid cost %s', (cost) => {
    expect(normalizeOptionalEstimatedCost(cost)).toBeUndefined();
  });
});