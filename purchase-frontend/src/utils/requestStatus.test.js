import {
  isCompletedRequestStatus,
  requestMatchesStatusFilter,
  summarizeRequestStatuses,
} from './requestStatus';

describe('request status helpers', () => {
  it.each(['completed', 'Completed', ' received ', 'RECEIVED'])(
    'treats %s as a completed request status',
    (status) => {
      expect(isCompletedRequestStatus(status)).toBe(true);
    },
  );

  it('includes received requests in the completed summary', () => {
    expect(
      summarizeRequestStatuses([
        { status: 'Completed' },
        { status: 'received' },
        { status: 'Received' },
        { status: 'Pending' },
      ]),
    ).toMatchObject({ total: 4, completed: 3, received: 2, pending: 1 });
  });

  it('includes received requests when filtering for completed requests', () => {
    expect(requestMatchesStatusFilter('received', 'completed')).toBe(true);
    expect(requestMatchesStatusFilter('completed', 'completed')).toBe(true);
    expect(requestMatchesStatusFilter('approved', 'completed')).toBe(false);
  });
});