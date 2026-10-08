import { approvalTargetDays, requestApprovalAging, matchesApprovalAgeFilter, compareApprovalAge } from './approvalAging';
import { approvalStepKey } from './pendingApprovalSteps';

const now = Date.parse('2026-10-08T12:00:00Z');
const row = (activated_at, role = 'CMO') => ({ activated_at, approver_role: role, approval_level: 5 });
const request = (...rows) => ({ created_at: '2020-01-01', updated_at: '2020-01-01', current_pending_approvals: rows });

test('only recorded activation times are used; missing, invalid and future starts remain unknown', () => {
  const age = requestApprovalAging(request(row(null), row('invalid'), row('2027-01-01')), { now, targetDays: 1 });
  expect(age).toMatchObject({ pending: true, unknownCount: 3, oldestHours: null, overdue: false });
  expect(matchesApprovalAgeFilter(request(row(null)), 'unknown', { now })).toBe(true);
  expect(matchesApprovalAgeFilter(request(), 'unknown', { now })).toBe(false);
});

test('overdue requires a valid explicit target and a strictly exceeded deadline', () => {
  const r = request(row('2026-10-07T12:00:00Z'));
  expect(requestApprovalAging(r, { now, targetDays: 1 }).overdue).toBe(false);
  expect(requestApprovalAging(r, { now: now + 1, targetDays: 1 }).overdue).toBe(true);
  for (const value of ['', 0, -1, 1.5, 366, 'invalid']) {
    expect(approvalTargetDays(value)).toBeNull();
    expect(requestApprovalAging(r, { now, targetDays: value }).overdue).toBe(false);
  }
});

test('parallel steps count known age and unknown starts separately and honor selected step', () => {
  const r = request(row('2026-10-01T12:00:00Z'), row(null, 'COO'));
  expect(requestApprovalAging(r, { now, targetDays: 2 })).toMatchObject({ oldestHours: 168, overdue: true, unknownCount: 1 });
  expect(requestApprovalAging(r, { now, targetDays: 2, stepKey: approvalStepKey(row(null, 'COO')) })).toMatchObject({ oldestHours: null, overdue: false, unknownCount: 1 });
});

test('oldest known approval comes first, unknown and nonpending requests come last', () => {
  const rows = [request(row(null)), request(row('2026-10-07T12:00:00Z')), request(row('2026-10-01T12:00:00Z')), request()];
  expect([...rows].sort((a, b) => compareApprovalAge(a, b, { now }))).toEqual([rows[2], rows[1], rows[0], rows[3]]);
});
