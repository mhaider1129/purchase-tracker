// Count requests per active approval level/role, rather than approval rows.
export const activePendingApprovals = (request) => {
  // An explicit empty list is authoritative. Scalar fallback supports rollout
  // against the older API, which exposes one active pending approver only.
  return Array.isArray(request.current_pending_approvals)
    ? request.current_pending_approvals
    : request.current_pending_approver_name || request.current_pending_approver_role
      ? [{ approval_level: request.current_approval_step, approver_role: request.current_pending_approver_role, approver_name: request.current_pending_approver_name }]
      : [];
};

export const approvalStepKey = (row) => JSON.stringify([
  row.approval_level == null ? null : String(row.approval_level),
  String(row.approver_role || '').trim().toLowerCase(),
]);

export const approvalOwnerKey = (row) => row.approver_id != null
  ? `user:${row.approver_id}`
  : row.approver_name ? JSON.stringify([row.approver_name.trim().toLowerCase(), String(row.approver_role || '').trim().toLowerCase()]) : 'unassigned';

export const pendingApprovalSteps = (request) => {
  const rows = activePendingApprovals(request);
  const steps = new Map();
  rows.forEach((row) => {
    const role = String(row.approver_role || '').trim();
    const level = row.approval_level == null ? null : String(row.approval_level);
    const key = approvalStepKey(row);
    steps.set(key, { key, level, role });
  });
  return [...steps.values()];
};

export const matchesPendingApprovalStep = (request, key) =>
  !key || (key === 'any'
    ? pendingApprovalSteps(request).length > 0
    : pendingApprovalSteps(request).some((step) => step.key === key));

export const summarizePendingApprovalSteps = (requests) => {
  const groups = new Map();
  requests.forEach((request) => {
    pendingApprovalSteps(request).forEach((step) => {
      const group = groups.get(step.key) || { ...step, count: 0 };
      group.count += 1;
      groups.set(step.key, group);
    });
  });
  return [...groups.values()].sort((a, b) => {
    if (a.level == null && b.level != null) return 1;
    if (b.level == null && a.level != null) return -1;
    return Number(a.level) - Number(b.level) || a.role.localeCompare(b.role);
  });
};
