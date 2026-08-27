import {
  isCompletedRequestStatus,
  requestMatchesStatusFilter,
  summarizeRequestStatuses,
} from './requestStatus';

describe('request status helpers', () => {
  it.each(['completed', 'Completed', ' received ', 'RECEIVED', 'Available in Stock', ' available in stock '])(
    'treats %s as a completed request status',
    (status) => {
      expect(isCompletedRequestStatus(status)).toBe(true);
    },
  );

  it('includes received and available-in-stock requests in the completed summary', () => {
    expect(
      summarizeRequestStatuses([
        { status: 'Completed' },
        { status: 'received' },
        { status: 'Received' },
        { status: 'Available in Stock' },
        { status: 'Pending' },
      ]),
    ).toMatchObject({
      total: 5,
      completed: 4,
      received: 2,
      'available in stock': 1,
      pending: 1,
    });
  });

  it('includes received requests when filtering for completed requests', () => {
    expect(requestMatchesStatusFilter('received', 'completed')).toBe(true);
    expect(requestMatchesStatusFilter('Available in Stock', 'completed')).toBe(true);
    expect(requestMatchesStatusFilter('completed', 'completed')).toBe(true);
    expect(requestMatchesStatusFilter('approved', 'completed')).toBe(false);
  });
});