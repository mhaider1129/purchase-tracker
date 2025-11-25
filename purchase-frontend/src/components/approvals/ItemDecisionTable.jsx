import React from 'react';
import { Button } from '../ui/Button';
import { FEEDBACK_TEXT_STYLES } from '../../hooks/useApprovalsData';

const STATUS_HIGHLIGHTS = {
  Approved: 'bg-green-50',
  Rejected: 'bg-red-50',
  Pending: '',
};

const ItemDecisionTable = ({
  items = [],
  decisions = {},
  quantityDrafts = {},
  canEdit,
  isItemLockedForUser,
  onStatusChange,
  onCommentChange,
  onQuantityChange,
  onSave,
  saving,
  summary,
  feedback,
  labels = {},
}) => {
  if (!items.length) {
    return <p className="mt-2 text-sm text-slate-500">{labels.emptyLabel || 'No items found for this request.'}</p>;
  }

  const {
    heading = 'Requested Items',
    quantityLabel = 'Qty',
    availableLabel = 'Available Qty',
    unitCostLabel = 'Unit Cost',
    totalCostLabel = 'Total',
    decisionLabel = 'Decision',
    commentsLabel = 'Comments',
    saveLabel = 'Save Item Decisions',
    approvedLabel = 'Approved',
    rejectedLabel = 'Rejected',
    pendingLabel = 'Pending',
  } = labels;

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-800">{heading}</h4>
      <div className="mt-2 space-y-3">
        {summary && (
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
              {approvedLabel}: {summary.approved}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-rose-700">
              {rejectedLabel}: {summary.rejected}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              {pendingLabel}: {summary.pending}
            </span>
          </div>
        )}
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Item</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Brand</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Specs</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">{quantityLabel}</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">{availableLabel}</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">{unitCostLabel}</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">{totalCostLabel}</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">{decisionLabel}</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">{commentsLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const decision = decisions[item.id] || {
                  status: item.approval_status || 'Pending',
                  comments: item.approval_comments || '',
                };
                const normalizedStatus =
                  typeof decision.status === 'string'
                    ? `${decision.status.charAt(0).toUpperCase()}${decision.status.slice(1).toLowerCase()}`
                    : 'Pending';
                const rowHighlight = STATUS_HIGHLIGHTS[normalizedStatus] || '';
                const decisionLocked = canEdit && isItemLockedForUser?.(item);
                const quantityValue = quantityDrafts[item.id] ?? item.quantity ?? '';

                return (
                  <tr key={item.id || item.item_name} className={`${rowHighlight} transition-colors`}>
                    <td className="px-3 py-3 text-slate-800">
                      <div className="font-medium">{item.item_name}</div>
                      {(item.brand || item.specs) && (
                        <div className="mt-1 text-xs text-slate-500">
                          {item.brand && <span className="mr-2">{item.brand}</span>}
                          {item.specs && <span>{item.specs}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{item.brand || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{item.specs || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {canEdit ? (
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={quantityValue}
                          onChange={(event) => onQuantityChange(item.id, event.target.value)}
                          className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={decisionLocked}
                        />
                      ) : (
                        <span>{item.quantity ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{item.available_quantity ?? '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{item.unit_cost}</td>
                    <td className="px-3 py-3 text-slate-600">{item.total_cost}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {canEdit ? (
                        <select
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={decision.status || 'Pending'}
                          onChange={(event) => onStatusChange(item.id, event.target.value)}
                          disabled={decisionLocked}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      ) : (
                        <span>{decision.status || 'Pending'}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {canEdit ? (
                        <textarea
                          className="mt-0 w-full rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          placeholder="Optional comments"
                          value={decision.comments || ''}
                          onChange={(event) => onCommentChange(item.id, event.target.value)}
                          disabled={decisionLocked}
                        />
                      ) : (
                        <span>{decision.comments || '—'}</span>
                      )}
                      {decisionLocked && (
                        <p className="mt-1 text-xs font-medium text-amber-600">
                          Rejected by a previous approver — only they can update this item.
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onSave} isLoading={saving}>
              {saveLabel}
            </Button>
          </div>
        )}
        {feedback?.message && (
          <p className={`text-sm ${FEEDBACK_TEXT_STYLES[feedback.type] || FEEDBACK_TEXT_STYLES.info}`}>
            {feedback.message}
          </p>
        )}
      </div>
    </div>
  );
};

export default ItemDecisionTable;