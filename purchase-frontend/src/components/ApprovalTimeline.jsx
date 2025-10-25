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
};

const ApprovalTimeline = ({ approvals, isLoading, labels = {} }) => {
  const mergedLabels = {
    ...defaultLabels,
    ...labels,
    columns: {
      ...defaultLabels.columns,
      ...(labels.columns || {}),
    },
  };

  return (
    <div>
      <h3 className="font-semibold mb-2">{mergedLabels.title}</h3>
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
                  <td className="border p-1">
                    {approval.approved_at
                      ? new Date(approval.approved_at).toLocaleString('en-GB')
                      : '—'}
                  </td>
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