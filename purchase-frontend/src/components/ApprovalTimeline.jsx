import React from 'react';

const defaultLabels = {
  title: 'Approval Timeline',
  loading: 'Loading approvals...',
  empty: 'No approvals recorded yet.',
  columns: {
    level: 'Level',
    approver: 'Approver',
    role: 'Role',
    decision: 'Decision',
    comment: 'Comment',
    date: 'Date',
  },
  urgentBadge: {
    title: 'Urgent',
    description: 'Requires immediate attention',
  },
};

const ApprovalTimeline = ({ approvals, isLoading, labels = {}, isUrgent = false, formatDate }) => {
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
    if (!value) return '—';
    if (typeof formatDate === 'function') {
      return formatDate(value);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString('en-GB');
  };

  return (
    <div>
      <h3 className="font-semibold mb-2">{mergedLabels.title}</h3>
      {isUrgent && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="font-semibold uppercase tracking-wide">
            {mergedLabels.urgentBadge.title}
          </span>
          {mergedLabels.urgentBadge.description && (
            <span className="font-normal normal-case">{mergedLabels.urgentBadge.description}</span>
          )}
        </div>
      )}
      {isLoading ? (
        <p className="text-gray-500">{mergedLabels.loading}</p>
      ) : !approvals || approvals.length === 0 ? (
        <p className="text-sm text-gray-500">{mergedLabels.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1 text-left">{mergedLabels.columns.level}</th>
                <th className="border p-1 text-left">{mergedLabels.columns.approver}</th>
                <th className="border p-1 text-left">{mergedLabels.columns.role}</th>
                <th className="border p-1 text-left">{mergedLabels.columns.decision}</th>
                <th className="border p-1 text-left">{mergedLabels.columns.comment}</th>
                <th className="border p-1 text-left">{mergedLabels.columns.date}</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((approval, idx) => (
                <tr key={idx}>
                  <td className="border p-1">{approval.approval_level ?? '—'}</td>
                  <td className="border p-1">{approval.approver_name || '—'}</td>
                  <td className="border p-1">{approval.role || '—'}</td>
                  <td className="border p-1">{approval.status || '—'}</td>
                  <td className="border p-1">{approval.comments || '—'}</td>
                  <td className="border p-1">{formatApprovalDate(approval.approved_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ApprovalTimeline;