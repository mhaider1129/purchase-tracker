import { getApprovalActionErrorMessage, normalizeOptionalEstimatedCost } from './useApprovalsData';

describe('normalizeOptionalEstimatedCost', () => {
  it('accepts blank costs and normalizes positive formatted costs', () => {
    expect(normalizeOptionalEstimatedCost('')).toBeNull();
    expect(normalizeOptionalEstimatedCost('1,250.50')).toBe(1250.5);
  });

  it.each(['invalid', '0', '-1', 'Infinity'])('rejects invalid cost %s', (cost) => {
    expect(normalizeOptionalEstimatedCost(cost)).toBeUndefined();
  });
});

describe('getApprovalActionErrorMessage', () => {
  it('uses the API conflict message when one is available', () => {
    const error = { response: { status: 409, data: { message: 'The request was already approved.' } } };

    expect(getApprovalActionErrorMessage(error)).toBe('The request was already approved.');
  });

  it('explains a conflict even when the API did not return a message', () => {
    const error = { response: { status: 409, data: {} } };

    expect(getApprovalActionErrorMessage(error)).toContain('changed while you were working on it');
  });

  it('keeps a useful fallback for other failures', () => {
    expect(getApprovalActionErrorMessage(new Error('Network Error'))).toBe(
      'Failed to process your decision. Please try again.',
    );
  });
});