import { getWorkspaceItemStatus, isRejectedItem } from './RequestDetailWorkspace';

describe('request workspace item approval state', () => {
  const rejectedPendingItem = { approval_status: 'Rejected', procurement_status: 'pending' };

  it('identifies rejected items as ineligible for procurement', () => {
    expect(isRejectedItem(rejectedPendingItem)).toBe(true);
  });

  it('displays Rejected instead of the stale pending procurement status', () => {
    expect(getWorkspaceItemStatus(rejectedPendingItem)).toBe('Rejected');
  });
});