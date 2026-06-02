import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const getPreviousApprovers = (request) => {
  const value = request?.previous_approvers;

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return [];
};

const formatPreviousApprover = (approver, formatDateTime) => {
  const name = approver?.approver_name || approver?.name || 'Unknown approver';
  const role = approver?.approver_role || approver?.role;
  const level = approver?.approval_level;
  const approvedAt = approver?.approved_at;

  const details = [
    role,
    level ? `Level ${level}` : null,
    approvedAt ? formatDateTime(approvedAt) : null,
  ].filter(Boolean);

  return details.length ? `${name} (${details.join(' • ')})` : name;
};

const ApprovalRequestCard = ({
  request,
  requesterDisplay,
  isExpanded,
  onToggle,
  formatDateTime,
  estimatedCostValue,
  costTag,
  approvalStatus,
  children,
  labels = {},
}) => {
  const {
    requestIdLabel = 'Request #',
    departmentLabel = 'Department',
    requesterLabel = 'Requester',
    submittedLabel = 'Submitted',
    estimatedCostLabel = 'Estimated Cost',
    urgentLabel = 'Urgent',
    approvalStatusLabel = 'Approval Status',
    previousApproversLabel = 'Previously approved by',
    noPreviousApproversLabel = 'No previous approvers yet',
  } = labels;

  const isUrgentRequest = Boolean(request?.is_urgent);
  const previousApprovers = getPreviousApprovers(request);

  const getApprovalStatusChip = () => {
    if (!approvalStatus) return null;

    const normalized = approvalStatus.toLowerCase();
    const styleMap = {
      pending: 'bg-slate-100 text-slate-700',
      'on hold': 'bg-amber-100 text-amber-800',
      approved: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-rose-100 text-rose-800',
    };

    const chipClasses = styleMap[normalized] || 'bg-slate-100 text-slate-700';

    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${chipClasses}`}>
        {approvalStatusLabel}: {approvalStatus}
      </span>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <span>{requestIdLabel}</span>
            <span className="font-semibold text-slate-800">{request.request_id}</span>
            {request.request_type && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                {request.request_type}
              </span>
            )}
            {isUrgentRequest && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                {urgentLabel}
              </span>
            )}
            {getApprovalStatusChip()}
          </div>
          <p className="text-base font-semibold text-slate-900">
            {request.justification || 'No justification provided.'}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            <p>
              <strong>{departmentLabel}:</strong> {request.department_name || '—'}
            </p>
            <p>
              <strong>{requesterLabel}:</strong> {requesterDisplay}
            </p>
            <span>
              {submittedLabel}: {formatDateTime(request.created_at || request.request_date)}
            </span>
            <span>
              {estimatedCostLabel}: {estimatedCostValue.toLocaleString()} IQD
            </span>
            {costTag ? (
              <span className="inline-flex items-center gap-1">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white ${costTag.color}`}>
                  {costTag.label}
                </span>
              </span>
            ) : null}
          </div>
          <div className="mt-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">{previousApproversLabel}:</span>{' '}
            {previousApprovers.length > 0 ? (
              <span>{previousApprovers.map((approver) => formatPreviousApprover(approver, formatDateTime)).join(', ')}</span>
            ) : (
              <span>{noPreviousApproversLabel}</span>
            )}
          </div>
          {request.updated_by && (
            <p className="text-xs text-slate-500">
              Last updated by <span className="font-medium text-slate-700">{request.updated_by}</span> on {formatDateTime(request.updated_at)}
            </p>
          )}
        </div>
        <div className="flex items-center text-slate-500">
          {isExpanded ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
        </div>
      </button>

      {isExpanded && <div className="border-t border-slate-100 px-5 py-4">{children}</div>}
    </div>
  );
};

export default ApprovalRequestCard;