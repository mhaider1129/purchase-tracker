import { getCurrentStep, getItemStatus, getStepColor } from './AllRequestsPage';
import { hasPermission } from '../utils/permissions';

describe('AllRequestsPage current step', () => {
  it('shows a terminal in-stock request as Available in Stock', () => {
    const request = {
      status: 'Available in Stock',
      current_approver_role: null,
    };

    expect(getCurrentStep(request)).toBe('Available in Stock');
    expect(getStepColor(getCurrentStep(request))).toBe('bg-green-100 text-green-800');
  });
});

describe('All Requests item status', () => {
  it('shows an approval rejection instead of the procurement status', () => {
    expect(getItemStatus({ approval_status: 'Rejected', procurement_status: 'pending' }).label).toBe('Rejected');
  });

  it('shows items closed without procurement', () => {
    expect(getItemStatus({ approval_status: 'Approved', procurement_status: 'not_procured' }).label).toBe('Not Procured');
  });
});

describe('request reclassification access', () => {
  it('requires the explicit reclassification permission instead of an SCM role alone', () => {
    expect(hasPermission({ role: 'SCM', permissions: [] }, 'requests.reclassify')).toBe(false);
    expect(hasPermission({ permissions: ['requests.reclassify'] }, 'requests.reclassify')).toBe(true);
  });
});
describe('All Requests terminal and held stages', () => {
  it.each([[' rejected ', 'Rejected'], ['cancelled', 'Cancelled'], ['canceled', 'Cancelled'], ['On Hold', 'On Hold'], ['on_hold', 'On Hold']])('keeps %s ahead of stale approver data', (status, expected) => {
    expect(getCurrentStep({ status, current_approver_role: 'SCM' })).toBe(expected);
  });
  it('recognizes lowercase approved without an approver', () => {
    expect(getCurrentStep({ status: 'approved' })).toBe('Approved');
  });
});
