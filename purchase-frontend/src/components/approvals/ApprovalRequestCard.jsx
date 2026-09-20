import React from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Package2,
  Paperclip,
} from "lucide-react";

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
    requestIdLabel = "Request #",
    departmentLabel = "Department",
    requesterLabel = "Requester",
    submittedLabel = "Submitted",
    estimatedCostLabel = "Estimated Cost",
    maintenanceRefLabel = "Maintenance Ref #",
    urgentLabel = "Urgent",
    approvalStatusLabel = "Approval Status",
    compactSummaryLabel = "Request summary",
    itemsLabel = "Items",
    attachmentsLabel = "Attachments",
    viewDetailsLabel = "View details",
    hideDetailsLabel = "Hide details",
  } = labels;

  const isUrgentRequest = Boolean(request?.is_urgent);
  const itemsCount = Number(
    summaryStats.itemsCount ?? request?.items?.length ?? 0,
  );
  const attachmentsCount = Number(summaryStats.attachmentsCount ?? 0);
  const headerPaddingClass = compactView ? "px-4 py-3" : "px-5 py-4";
  const detailsPaddingClass = compactView ? "px-4 py-3" : "px-5 py-4";
  const titleClass = compactView
    ? "line-clamp-2 text-sm font-semibold text-slate-900"
    : "text-base font-semibold text-slate-900";
  const getApprovalStatusChip = () => {
    if (!approvalStatus) return null;

    const normalized = approvalStatus.toLowerCase();
    const styleMap = {
      pending: "bg-slate-100 text-slate-700",
      "on hold": "bg-amber-100 text-amber-800",
      approved: "bg-emerald-100 text-emerald-800",
      rejected: "bg-rose-100 text-rose-800",
    };

    const chipClasses = styleMap[normalized] || "bg-slate-100 text-slate-700";

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${chipClasses}`}
      >
        {approvalStatusLabel}: {approvalStatus}
      </span>
    );
  };

  return (
    <article
      className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isUrgentRequest ? "border-amber-200" : "border-slate-200"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={`relative flex w-full items-start justify-between gap-4 ${headerPaddingClass} text-left transition-colors hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500`}
      >
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <span>{requestIdLabel}</span>
            <span className="font-semibold text-slate-800">
              {request.request_id}
            </span>
            {request.request_type && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                {request.request_type}
              </span>
            )}
            {request.maintenance_ref_number && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {maintenanceRefLabel}: {request.maintenance_ref_number}
              </span>
            )}
            {isUrgentRequest && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                <AlertTriangle className="h-3 w-3" aria-hidden />
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
            {request.justification || "No justification provided."}
          </p>
          {compactView && (
            <div
              className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-slate-600"
              aria-label={compactSummaryLabel}
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                <Package2 className="h-3 w-3" aria-hidden />
                {itemsLabel}: {Number.isFinite(itemsCount) ? itemsCount : 0}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                <Paperclip className="h-3 w-3" aria-hidden />
                {attachmentsLabel}:{" "}
                {Number.isFinite(attachmentsCount) ? attachmentsCount : 0}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                <CircleDollarSign className="h-3 w-3" aria-hidden />
                {estimatedCostLabel}: {estimatedCostValue.toLocaleString()} IQD
              </span>
              {request.maintenance_ref_number && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  {maintenanceRefLabel}: {request.maintenance_ref_number}
                </span>
              )}
            </div>
          )}
          <div
            className={`${compactView ? "sr-only" : "mt-1 flex"} flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600`}
          >
            <p>
              <strong>{departmentLabel}:</strong>{" "}
              {request.department_name || "—"}
            </p>
            <p>
              <strong>{requesterLabel}:</strong> {requesterDisplay}
            </p>
            <span className="inline-flex items-center gap-1">
              <CalendarDays
                className="h-3.5 w-3.5 text-slate-400"
                aria-hidden
              />
              {submittedLabel}:{" "}
              {formatDateTime(request.created_at || request.request_date)}
            </span>
            <span>
              {estimatedCostLabel}: {estimatedCostValue.toLocaleString()} IQD
            </span>
            {request.maintenance_ref_number && (
              <span>
                <strong>{maintenanceRefLabel}:</strong>{" "}
                {request.maintenance_ref_number}
              </span>
            )}
            {costTag ? (
              <span className="inline-flex items-center gap-1">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white ${costTag.color}`}
                >
                  {costTag.label}
                </span>
              </span>
            ) : null}
          </div>
          {request?.budget_exceeded && (
            <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              Red flag: this request exceeds the allocated budget. Available:{" "}
              {Number(request.budget_available_amount || 0).toLocaleString()}{" "}
              {request.budget_currency || "USD"}; estimated:{" "}
              {estimatedCostValue.toLocaleString()}{" "}
              {request.budget_currency || "USD"}. Approval can still continue.
            </div>
          )}
          {request.updated_by && (
            <p className="text-xs text-slate-500">
              Last updated by{" "}
              <span className="font-medium text-slate-700">
                {request.updated_by}
              </span>{" "}
              on {formatDateTime(request.updated_at)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-slate-500">
          {compactView && (
            <span className="hidden rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 sm:inline-flex">
              {isExpanded ? hideDetailsLabel : viewDetailsLabel}
            </span>
          )}
          <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 transition-colors group-hover:bg-blue-50 group-hover:text-blue-700">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5" aria-hidden />
            )}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div
          className={`border-t border-slate-100 bg-slate-50/40 ${detailsPaddingClass}`}
        >
          {children}
        </div>
      )}
    </article>
  );
};

export default ApprovalRequestCard;