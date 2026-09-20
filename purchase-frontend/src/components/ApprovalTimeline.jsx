import React from "react";
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";

const defaultLabels = {
  title: "Approval Timeline",
  loading: "Loading approvals...",
  empty: "No approvals recorded yet.",
  columns: {
    level: "Level",
    approver: "Approver",
    role: "Role",
    decision: "Decision",
    comment: "Comment",
    date: "Date",
  },
  urgentBadge: {
    title: "Urgent",
    description: "Requires immediate attention",
  },
};

const ApprovalTimeline = ({
  approvals,
  isLoading,
  labels = {},
  isUrgent = false,
  formatDate,
}) => {
  const mergedLabels = {
    ...defaultLabels,
    ...labels,
    columns: {
      ...defaultLabels.columns,
      ...(labels.columns || {}),
    },
    urgentBadge: {
      ...defaultLabels.urgentBadge,
      ...(labels.urgentBadge || {}),
    },
  };

  const formatApprovalDate = (value) => {
    if (!value) return "—";
    if (typeof formatDate === "function") {
      return formatDate(value);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleString("en-GB");
  };

  const decisionStyle = (decision = "") => {
    const value = decision.toLowerCase();
    if (["approved", "approve"].includes(value))
      return {
        className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
        Icon: CheckCircle2,
      };
    if (["rejected", "reject"].includes(value))
      return {
        className: "bg-rose-50 text-rose-700 ring-rose-600/20",
        Icon: XCircle,
      };
    return {
      className: "bg-amber-50 text-amber-700 ring-amber-600/20",
      Icon: Clock3,
    };
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          {mergedLabels.title}
        </h3>
        {!isLoading && approvals?.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {approvals.length} steps
          </span>
        )}
      </div>
      {isUrgent && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="font-semibold uppercase tracking-wide">
            {mergedLabels.urgentBadge.title}
          </span>
          {mergedLabels.urgentBadge.description && (
            <span className="font-normal normal-case">
              {mergedLabels.urgentBadge.description}
            </span>
          )}
        </div>
      )}
      {isLoading ? (
        <div className="space-y-2" aria-live="polite">
          <div className="h-11 animate-pulse rounded-lg bg-slate-100" />
          <p className="text-sm text-slate-500">{mergedLabels.loading}</p>
        </div>
      ) : !approvals || approvals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {mergedLabels.empty}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">
                  {mergedLabels.columns.level}
                </th>
                <th className="px-3 py-2.5 text-left">
                  {mergedLabels.columns.approver}
                </th>
                <th className="px-3 py-2.5 text-left">
                  {mergedLabels.columns.role}
                </th>
                <th className="px-3 py-2.5 text-left">
                  {mergedLabels.columns.decision}
                </th>
                <th className="px-3 py-2.5 text-left">
                  {mergedLabels.columns.comment}
                </th>
                <th className="px-3 py-2.5 text-left">
                  {mergedLabels.columns.date}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {approvals.map((approval, idx) => {
                const { className, Icon } = decisionStyle(approval.status);
                return (
                  <tr key={approval.id ?? idx} className="hover:bg-slate-50/70">
                    <td className="px-3 py-3">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                        {approval.approval_level ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800">
                      {approval.approver_name || "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {approval.role || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${className}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {approval.status || "Pending"}
                      </span>
                    </td>
                    <td className="max-w-xs px-3 py-3 text-slate-600">
                      {approval.comments || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                      {formatApprovalDate(approval.approved_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ApprovalTimeline;