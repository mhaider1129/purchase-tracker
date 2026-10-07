import { isCompletedRequestStatus } from './requestStatus';

export const getMaintenanceApprovalStepLabel = (request, tr) => {
  const status = String(request.status || '').trim().toLowerCase();
  const name = request.current_pending_approver_name;
  const role = request.current_pending_approver_role;
  const level = request.current_approval_step;
  if (name) {
    const approver = role ? `${name} (${role})` : name;
    return level != null
      ? tr('export.currentStepPendingWithApproverAndLevel', { level, approver })
      : tr('export.currentStepPendingWithApprover', { approver });
  }
  if (status === 'approved' || isCompletedRequestStatus(status)) {
    const date = new Date(request.final_approval_date);
    if (request.final_approval_date && request.final_approver_name && !Number.isNaN(date.getTime())) {
      return tr('export.currentStepFinalized', {
        approver: request.final_approver_name, date: date.toLocaleString(),
      });
    }
    return tr('export.currentStepCompleted');
  }
  if (status === 'rejected') return tr('export.currentStepRejected');
  if (status === 'pending' || status === 'submitted') {
    return level != null
      ? tr('export.currentStepPendingAtLevel', { level })
      : tr('export.currentStepPending');
  }
  // Keep an actual lifecycle status visible without inventing approval evidence.
  if (status) return tr('export.currentStepRequestStatus', { status: tr(`statuses.${status}`, { defaultValue: request.status.trim() }) });
  return tr('export.currentStepUnknown');
};
