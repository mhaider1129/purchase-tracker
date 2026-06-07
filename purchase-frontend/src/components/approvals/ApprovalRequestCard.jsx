import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
  compactView = false,
  summaryStats = {},
}) => {
  const {
    requestIdLabel = 'Request #',
    departmentLabel = 'Department',
    requesterLabel = 'Requester',
    submittedLabel = 'Submitted',
    estimatedCostLabel = 'Estimated Cost',
    urgentLabel = 'Urgent',
    approvalStatusLabel = 'Approval Status',
    compactSummaryLabel = 'Request summary',
    itemsLabel = 'Items',
    attachmentsLabel = 'Attachments',
    viewDetailsLabel = 'View details',
    hideDetailsLabel = 'Hide details',
  } = labels;

  const isUrgentRequest = Boolean(request?.is_urgent);
  const itemsCount = Number(summaryStats.itemsCount ?? request?.items?.length ?? 0);
  const attachmentsCount = Number(summaryStats.attachmentsCount ?? 0);
  const headerPaddingClass = compactView ? 'px-4 py-3' : 'px-5 py-4';
  const detailsPaddingClass = compactView ? 'px-4 py-3' : 'px-5 py-4';
  const titleClass = compactView
    ? 'line-clamp-2 text-sm font-semibold text-slate-900'
    : 'text-base font-semibold text-slate-900';
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
        className={`flex w-full items-start justify-between gap-4 ${headerPaddingClass} text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
            {request?.budget_exceeded && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                Over budget
              </span>
            )}
            {getApprovalStatusChip()}
          </div>
          <p className={titleClass}>
            {request.justification || 'No justification provided.'}
          </p>
          {compactView && (
            <div
              className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-slate-600"
              aria-label={compactSummaryLabel}
            >
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                {itemsLabel}: {Number.isFinite(itemsCount) ? itemsCount : 0}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                {attachmentsLabel}: {Number.isFinite(attachmentsCount) ? attachmentsCount : 0}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                {estimatedCostLabel}: {estimatedCostValue.toLocaleString()} IQD
              </span>
            </div>
          )}
          <div className={`${compactView ? 'sr-only' : 'mt-1 flex'} flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600`}>
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
          {request?.budget_exceeded && (
            <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              Red flag: this request exceeds the allocated budget. Available:{' '}
              {Number(request.budget_available_amount || 0).toLocaleString()} {request.budget_currency || 'USD'};
              estimated: {estimatedCostValue.toLocaleString()} {request.budget_currency || 'USD'}. Approval can still continue.
            </div>
          )}
          {request.updated_by && (
            <p className="text-xs text-slate-500">
              Last updated by <span className="font-medium text-slate-700">{request.updated_by}</span> on {formatDateTime(request.updated_at)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-slate-500">
          {compactView && (
            <span className="hidden rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 sm:inline-flex">
              {isExpanded ? hideDetailsLabel : viewDetailsLabel}
            </span>
          )}
          {isExpanded ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
        </div>
      </button>

      {isExpanded && <div className={`border-t border-slate-100 ${detailsPaddingClass}`}>{children}</div>}
    </div>
  );
};

export default ApprovalRequestCard;