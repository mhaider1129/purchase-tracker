import { pendingApprovalSteps, matchesPendingApprovalStep, summarizePendingApprovalSteps } from './pendingApprovalSteps';

test('counts requests once per level/role and retains different parallel steps', () => {
  const request = { current_pending_approvals: [
    { approval_level: 4, approver_role: 'CMO' },
    { approval_level: 4, approver_role: 'cmo' },
    { approval_level: 8, approver_role: 'COO' },
  ] };
  const summary = summarizePendingApprovalSteps([request, { current_pending_approvals: [{ approval_level: 4, approver_role: 'CMO' }] }]);
  expect(summary.map(({ level, count }) => [level, count])).toEqual([['4', 2], ['8', 1]]);
  expect(matchesPendingApprovalStep(request, summary[1].key)).toBe(true);
  expect(matchesPendingApprovalStep({}, 'any')).toBe(false);
});

test('empty authoritative arrays override stale scalar metadata and legacy API supports one current approver', () => {
  const legacy = { current_approval_step: 5, current_pending_approver_name: 'Name', current_pending_approver_role: 'HOD' };
  expect(pendingApprovalSteps(legacy)).toHaveLength(1);
  expect(pendingApprovalSteps({ ...legacy, current_pending_approvals: [] })).toEqual([]);
  expect(pendingApprovalSteps({ current_approval_step: 5 })).toEqual([]);
});

test('missing approver/level data stays explicit, and the same role at different levels stays separate', () => {
  const summary = summarizePendingApprovalSteps([{ current_pending_approvals: [
    { approval_level: null, approver_role: null },
    { approval_level: 2, approver_role: 'SCM' },
    { approval_level: 6, approver_role: 'SCM' },
  ] }]);
  expect(summary.map((step) => step.level)).toEqual(['2', '6', null]);
  expect(summary[2].role).toBe('');
});
