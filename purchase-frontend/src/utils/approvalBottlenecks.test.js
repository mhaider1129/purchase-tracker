import { summarizeApprovalBottlenecks, waitingBand, matchesWaitingBand } from './approvalBottlenecks';
import { requestApprovalAging } from './approvalAging';
const now = Date.parse('2026-10-09T12:00:00Z');
const row = (id, hours, extra = {}) => ({ approver_id: id, approver_name: 'Same name', approver_role: 'CMO', approval_level: 5, activated_at: hours == null ? null : new Date(now - hours * 3600000).toISOString(), ...extra });
const request = (id, ...rows) => ({ id, current_pending_approvals: rows });

test('bands include exact boundaries and separate unknown values', () => {
  expect([0, 47.9, 48, 167.9, 168, null].map(waitingBand)).toEqual(['under2', 'under2', 'days2to7', 'days2to7', 'days7plus', 'unknown']);
});
test('owners use IDs, requests deduplicate parallel steps, oldest known request is reliable', () => {
  const results = summarizeApprovalBottlenecks([request(1, row(1, 200), row(1, 100)), request(2, row(2, 10)), request(3, row(1, null)), request(4, row(null, null, { approver_name: null }))], { now, targetDays: 2 });
  expect(results).toHaveLength(3);
  expect(results[0]).toMatchObject({ key: 'user:1', count: 2, days7plus: 1, unknown: 1, overdue: 1, oldestRequest: 1, oldestHours: 200 });
  expect(results.find((o) => o.key === 'user:2')).toMatchObject({ count: 1, under2: 1, oldestRequest: 2 });
  expect(results.find((o) => o.key === 'unassigned')).toMatchObject({ oldestRequest: null, oldestHours: null, unknown: 1 });
});
test('owner and step must match the same approval, without another owner determining overdue or band', () => {
  const r = request(1, row(1, 200), row(2, 10, { approval_level: 8, approver_role: 'COO' }));
  expect(requestApprovalAging(r, { now, targetDays: 2, ownerKey: 'user:2' })).toMatchObject({ overdue: false, oldestHours: 10 });
  expect(matchesWaitingBand(r, 'days7plus', { now, ownerKey: 'user:2' })).toBe(false);
  expect(requestApprovalAging(r, { now, ownerKey: 'user:2', stepKey: '["5","cmo"]' }).pending).toBe(false);
});
test('known and unknown parallel starts remain visible without double counting pending requests', () => {
  const r = request(1, row(1, 60), row(1, null));
  expect(summarizeApprovalBottlenecks([r], { now })[0]).toMatchObject({ count: 1, days2to7: 1, unknown: 1 });
  expect(matchesWaitingBand(r, 'unknown', { now })).toBe(true);
});
