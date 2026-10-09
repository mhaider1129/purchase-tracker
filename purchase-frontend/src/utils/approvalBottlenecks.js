import { approvalOwnerKey } from './pendingApprovalSteps';
import { requestApprovalAging } from './approvalAging';

export const waitingBand = (hours) => hours == null ? 'unknown' : hours < 48 ? 'under2' : hours < 168 ? 'days2to7' : 'days7plus';
export const matchesWaitingBand = (request, band, options) => {
  if (band === 'all') return true;
  const age = requestApprovalAging(request, options);
  return age.pending && (band === 'unknown' ? age.unknownCount > 0 : waitingBand(age.oldestHours) === band);
};

export function summarizeApprovalBottlenecks(requests, options) {
  const owners = new Map();
  requests.forEach((request) => {
    const rows = requestApprovalAging(request, { ...options, ownerKey: '' }).rows;
    const perRequest = new Map(rows.map((row) => [approvalOwnerKey(row), row]));
    perRequest.forEach((row, key) => {
      const age = requestApprovalAging(request, { ...options, ownerKey: key });
      const owner = owners.get(key) || { key, name: row.approver_name || '', role: key === 'unassigned' ? '' : row.approver_role || '', count: 0, overdue: 0, unknown: 0, under2: 0, days2to7: 0, days7plus: 0, oldestHours: null, oldestRequest: null };
      owner.count += 1;
      if (age.overdue) owner.overdue += 1;
      if (age.unknownCount) owner.unknown += 1;
      if (age.oldestHours != null) {
        owner[waitingBand(age.oldestHours)] += 1;
        if (owner.oldestHours == null || age.oldestHours > owner.oldestHours) {
          owner.oldestHours = age.oldestHours;
          owner.oldestRequest = request.id;
        }
      }
      owners.set(key, owner);
    });
  });
  return [...owners.values()].sort((a, b) => (b.oldestHours ?? -1) - (a.oldestHours ?? -1) || b.count - a.count || a.key.localeCompare(b.key));
}
