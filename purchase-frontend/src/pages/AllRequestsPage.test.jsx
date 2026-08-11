import { getCurrentStep, getStepColor } from './AllRequestsPage';
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

describe('request reclassification access', () => {
  it('requires the explicit reclassification permission instead of an SCM role alone', () => {
    expect(hasPermission({ role: 'SCM', permissions: [] }, 'requests.reclassify')).toBe(false);
    expect(hasPermission({ permissions: ['requests.reclassify'] }, 'requests.reclassify')).toBe(true);
  });
});