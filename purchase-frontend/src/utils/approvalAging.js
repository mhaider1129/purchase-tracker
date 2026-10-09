import { activePendingApprovals, approvalStepKey, approvalOwnerKey } from './pendingApprovalSteps';

export const approvalTargetDays = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 365 ? number : null;
};

export const requestApprovalAging = (request, { stepKey = '', ownerKey = '', now = Date.now(), targetDays = null } = {}) => {
  const rows = activePendingApprovals(request).filter((row) => (!stepKey || stepKey === 'any' || approvalStepKey(row) === stepKey) && (!ownerKey || approvalOwnerKey(row) === ownerKey));
  const hours = rows.map((row) => {
    const start = row.activated_at ? Date.parse(row.activated_at) : NaN;
    return Number.isFinite(start) && start <= now ? (now - start) / 3600000 : null;
  });
  const known = hours.filter((age) => age != null);
  const target = approvalTargetDays(targetDays);
  return {
    rows, pending: rows.length > 0,
    unknownCount: hours.filter((age) => age == null).length,
    oldestHours: known.length ? Math.max(...known) : null,
    overdue: target != null && known.some((age) => age > target * 24),
  };
};

export const matchesApprovalAgeFilter = (request, filter, options) => {
  if (filter === 'all') return true;
  const age = requestApprovalAging(request, options);
  return filter === 'overdue' ? age.overdue : age.pending && age.unknownCount > 0;
};

export const compareApprovalAge = (a, b, options) => {
  const left = requestApprovalAging(a, options).oldestHours;
  const right = requestApprovalAging(b, options).oldestHours;
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return right - left;
};
