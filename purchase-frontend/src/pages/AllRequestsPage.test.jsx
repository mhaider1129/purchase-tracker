import { getCurrentStep, getStepColor } from './AllRequestsPage';

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