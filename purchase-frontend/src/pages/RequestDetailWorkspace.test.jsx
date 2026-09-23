import { filterWorkspaceItems, getWorkspaceItemStatus, isRejectedItem } from './RequestDetailWorkspace';

describe('request workspace item approval state', () => {
  const rejectedPendingItem = { approval_status: 'Rejected', procurement_status: 'pending' };

  it('identifies rejected items as ineligible for procurement', () => {
    expect(isRejectedItem(rejectedPendingItem)).toBe(true);
  });

  it('displays Rejected instead of the stale pending procurement status', () => {
    expect(getWorkspaceItemStatus(rejectedPendingItem)).toBe('Rejected');
  });
});

describe('request workspace item filters', () => {
  const items = [
    { item_name: 'Infusion pump', specs: 'Portable', supplier_name: 'MediCo', procurement_status: 'purchased' },
    { item_name: 'Patient monitor', intended_use: 'ICU bedside', procurement_status: 'pending' },
    { item_name: 'Old ventilator', approval_status: 'Rejected', procurement_status: 'pending' },
  ];

  it('searches across operational item details', () => {
    expect(filterWorkspaceItems(items, 'bedside')).toEqual([items[1]]);
    expect(filterWorkspaceItems(items, 'medico')).toEqual([items[0]]);
  });

  it('filters using the displayed status, including rejected items', () => {
    expect(filterWorkspaceItems(items, '', 'pending')).toEqual([items[1]]);
    expect(filterWorkspaceItems(items, '', 'rejected')).toEqual([items[2]]);
  });

  it('combines search and status filters case-insensitively', () => {
    expect(filterWorkspaceItems(items, 'PUMP', 'purchased')).toEqual([items[0]]);
  });
});