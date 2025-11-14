// src/pages/AssignedRequestsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from '../api/axios';
import ProcurementItemStatusPanel from '../components/ProcurementItemStatusPanel';
import Navbar from '../components/Navbar';
import ApprovalTimeline from '../components/ApprovalTimeline';
import useApprovalTimeline from '../hooks/useApprovalTimeline';
import usePageTranslation from '../utils/usePageTranslation';

const createEmptyGroups = () => ({
  purchased: [],
  pending: [],
  notProcured: [],
  other: [],
});

const categorizeItems = (items = []) => {
  const groups = createEmptyGroups();

  items.forEach((item) => {
    const status = (item.procurement_status || '').toLowerCase();

    if (status === 'purchased' || status === 'completed') {
      groups.purchased.push(item);
    } else if (status === 'not_procured' || status === 'canceled') {
      groups.notProcured.push(item);
    } else if (status === 'pending' || !status) {
      groups.pending.push(item);
    } else {
      groups.other.push(item);
    }
  });

  return groups;
};

const computeSummaryFromItems = (items = [], recordedCost = null) => {
  const summary = {
    total_items: items.length,
    purchased_count: 0,
    pending_count: 0,
    not_procured_count: 0,
    calculated_total_cost: 0,
    items_total_cost: 0,
    recorded_total_cost: null,
  };

  items.forEach((item) => {
    const status = (item.procurement_status || '').toLowerCase();

    if (status === 'purchased' || status === 'completed') {
      summary.purchased_count += 1;
    } else if (status === 'not_procured' || status === 'canceled') {
      summary.not_procured_count += 1;
    } else {
      summary.pending_count += 1;
    }

    const quantity = Number(item.purchased_quantity ?? item.quantity ?? 0);
    const unitCost = Number(item.unit_cost ?? 0);
    if (!Number.isNaN(quantity) && !Number.isNaN(unitCost)) {
      summary.items_total_cost += quantity * unitCost;
    }
  });

  summary.items_total_cost = Number(summary.items_total_cost.toFixed(2));

  const fallbackNumber = Number(recordedCost);
  const hasFallback = Number.isFinite(fallbackNumber) && fallbackNumber >= 0;
  summary.recorded_total_cost = hasFallback
    ? Number(fallbackNumber.toFixed(2))
    : null;

  if (summary.recorded_total_cost !== null) {
    summary.calculated_total_cost = summary.recorded_total_cost;
  } else if (summary.items_total_cost > 0) {
    summary.calculated_total_cost = summary.items_total_cost;
  } else {
    summary.calculated_total_cost = 0;
  }

  return summary;
};

const formatAmount = (value) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return '—';
  }

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const summaryToneClasses = {
  default: 'bg-slate-100 text-slate-700 border border-slate-200',
  success: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border border-amber-200',
  danger: 'bg-rose-100 text-rose-700 border border-rose-200',
};

const evaluateCompletionState = (request = {}, itemsOverride = null) => {
  const summary = request.status_summary || {};
  const itemsList = Array.isArray(itemsOverride) ? itemsOverride : null;

  const savedCost = request?.estimated_cost;
  const numericSavedCost =
    savedCost !== undefined && savedCost !== null ? Number(savedCost) : NaN;
  const hasRecordedCost = !Number.isNaN(numericSavedCost) && numericSavedCost > 0;

  let itemsComplete = false;

  if (itemsList) {
    itemsComplete = itemsList.every((item) => {
      const status = (item.procurement_status || '').toLowerCase();
      const qty = item.purchased_quantity;

      if (qty === null || qty === undefined) {
        return false;
      }

      if (status === 'purchased' || status === 'completed') {
        return true;
      }

      if (status === 'not_procured' || status === 'canceled') {
        return true;
      }

      return false;
    });
  } else {
    const totalItems = Number(summary.total_items ?? 0);
    const purchasedCount = Number(summary.purchased_count ?? 0);
    const notProcuredCount = Number(summary.not_procured_count ?? 0);

    if (totalItems > 0) {
      itemsComplete = purchasedCount + notProcuredCount >= totalItems;
    } else {
      itemsComplete = false;
    }
  }

  return {
    canComplete: hasRecordedCost && itemsComplete,
    missingCost: !hasRecordedCost,
    incompleteItems: !itemsComplete,
  };
};

const SummaryBadge = ({ label, value, tone = 'default' }) => (
  <div
    className={`rounded-md px-3 py-2 text-sm flex flex-col ${
      summaryToneClasses[tone] || summaryToneClasses.default
    }`}
  >
    <span className="text-lg font-semibold">{value ?? 0}</span>
    <span className="text-[11px] uppercase tracking-wide">{label}</span>
  </div>
);

const ITEM_SECTION_CONFIG = [
  {
    key: 'purchased',
    tone: 'success',
    titleKey: 'sections.purchased.title',
    descriptionKey: 'sections.purchased.description',
    emptyKey: 'sections.purchased.empty',
    defaults: {
      title: 'Purchased Items',
      description: 'Items that have been successfully procured.',
      empty: 'No items have been marked as purchased yet.',
    },
  },
  {
    key: 'pending',
    tone: 'warning',
    titleKey: 'sections.pending.title',
    descriptionKey: 'sections.pending.description',
    emptyKey: 'sections.pending.empty',
    defaults: {
      title: 'Pending Purchase',
      description: 'Items still awaiting procurement action.',
      empty: 'No items are currently pending purchase.',
    },
  },
  {
    key: 'notProcured',
    tone: 'danger',
    titleKey: 'sections.notProcured.title',
    descriptionKey: 'sections.notProcured.description',
    emptyKey: 'sections.notProcured.empty',
    defaults: {
      title: 'Unable to Procure',
      description: 'Items that could not be sourced or were canceled.',
      empty: 'No items are marked as unable to procure.',
    },
  },
  {
    key: 'other',
    tone: 'default',
    titleKey: 'sections.other.title',
    descriptionKey: 'sections.other.description',
    emptyKey: 'sections.other.empty',
    defaults: {
      title: 'Other Updates',
      description: 'Items that have been updated with a different status.',
      empty: 'There are no additional item updates.',
    },
  },
];

const AssignedRequestsPage = () => {
  const { t } = useTranslation();
  const tr = usePageTranslation('assignedRequests');
  const itemSections = useMemo(
    () =>
      ITEM_SECTION_CONFIG.map((section) => ({
        ...section,
        title: tr(section.titleKey, section.defaults.title),
        description: tr(section.descriptionKey, section.defaults.description),
        empty: tr(section.emptyKey, section.defaults.empty),

      })),
    [tr],
  );
  const summaryLabels = useMemo(
    () => ({
      total: tr('summary.totalItems', 'Total Items'),
      purchased: tr('summary.purchased', 'Purchased'),
      pending: tr('summary.pending', 'Pending'),
      notProcured: tr('summary.notProcured', 'Not Procured'),
    }),
    [tr],
  );

  const [requests, setRequests] = useState([]);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [items, setItems] = useState([]);
  const [groupedItems, setGroupedItems] = useState(() => createEmptyGroups());
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [requestCosts, setRequestCosts] = useState({});
  const [autoTotals, setAutoTotals] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);
  const [bulkUpdatingRequestId, setBulkUpdatingRequestId] = useState(null);
  const [completionStates, setCompletionStates] = useState({});
  const {
    expandedApprovalsId,
    approvalsMap,
    loadingApprovalsId,
    toggleApprovals,
    resetApprovals,
  } = useApprovalTimeline();
  
  const fetchAssignedRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/requests/assigned');
      const fetched = res.data.data || [];
      setRequests(fetched);

      const costMap = {};
      const autoMap = {};
      const completionMap = {};

      fetched.forEach((req) => {
        const recordedCost = req.estimated_cost ?? '';
        const autoTotal = req.status_summary?.items_total_cost ?? null;
        autoMap[req.id] = autoTotal;

        if (recordedCost === '' && autoTotal !== null) {
          costMap[req.id] = autoTotal;
        } else {
          costMap[req.id] = recordedCost;
        }

        completionMap[req.id] = evaluateCompletionState(req);
      });

      setRequestCosts(costMap);
      resetApprovals();
      setAutoTotals(autoMap);
      setCompletionStates(completionMap);
    } catch (err) {
      console.error('❌ Failed to fetch assigned requests:', err);
      alert('Failed to load assigned requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (requestId) => {
    setLoadingItems(true);
    try {
      const res = await axios.get(`/api/requests/${requestId}/items`);
      const fetchedItems = res.data.items || [];
      setItems(fetchedItems);
      const groups = categorizeItems(fetchedItems);
      setGroupedItems(groups);

      const targetRequest = requests.find((req) => req.id === requestId);
      const summary = computeSummaryFromItems(
        fetchedItems,
        targetRequest?.estimated_cost,
      );
      let computedState = null;
      setRequests((prev) =>
        prev.map((req) => {
          if (req.id === requestId) {
            const updatedRequest = { ...req, status_summary: summary };
            computedState = evaluateCompletionState(updatedRequest, fetchedItems);
            return updatedRequest;
          }
          return req;
        }),
      );
      setAutoTotals((prev) => ({ ...prev, [requestId]: summary.items_total_cost }));
      if (computedState) {
        setCompletionStates((prev) => ({ ...prev, [requestId]: computedState }));
      }
    } catch (err) {
      console.error(`❌ Error fetching items for request ${requestId}:`, err);
      alert(tr('alerts.itemsLoadFailed', 'Failed to load request items'));
      setGroupedItems(createEmptyGroups());
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchAttachments = async (requestId) => {
    setLoadingAttachments(true);
    try {
      const res = await axios.get(`/api/attachments/${requestId}`);
      setAttachments(res.data || []);
    } catch (err) {
      console.error(`❌ Error fetching attachments for request ${requestId}:`, err);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleMarkAsCompleted = async (requestId) => {
    if (
      !window.confirm(
        tr('confirm.markComplete', 'Are you sure you want to mark this request as completed?'),
      )
    ) {
      return;
    }

    try {
      await axios.patch(`/api/requests/${requestId}/mark-completed`);
      alert(tr('alerts.markCompletedSuccess', '✅ Request marked as completed.'));
      setExpandedRequestId(null);
      setItems([]);
      setGroupedItems(createEmptyGroups());
      fetchAssignedRequests();
    } catch (err) {
      console.error('❌ Error marking request as completed:', err);
      alert(tr('alerts.markCompletedFailed', '❌ Failed to mark request as completed.'));
    }
  };

  const handleCostChange = (requestId, value) => {
    setRequestCosts((prev) => ({ ...prev, [requestId]: value }));
  };

  const handleSaveTotalCost = async (requestId) => {
    const rawValue = requestCosts[requestId];
    const cost = Number(rawValue);

    if (Number.isNaN(cost) || cost <= 0) {
      alert(tr('alerts.invalidCost', 'Enter a total cost greater than zero.'));
      return;
    }

    try {
      await axios.put(`/api/requests/${requestId}/cost`, { estimated_cost: cost });
      alert(tr('alerts.costUpdated', 'Total cost updated.'));
      let updatedRequestRef = null;
      setRequests((prev) =>
        prev.map((req) => {
          if (req.id === requestId) {
            const updatedRequest = { ...req, estimated_cost: cost };
            updatedRequestRef = updatedRequest;
            return updatedRequest;
          }
          return req;
        }),
      );
      if (updatedRequestRef) {
        const itemsOverride =
          expandedRequestId === requestId && items.length > 0 ? items : null;
        setCompletionStates((prev) => ({
          ...prev,
          [requestId]: evaluateCompletionState(updatedRequestRef, itemsOverride),
        }));
      }
    } catch (err) {
      console.error('❌ Error updating cost:', err);
      alert(tr('alerts.costUpdateFailed', 'Failed to update total cost.'));
    }
  };

  const handleGenerateDoc = async (requestId, type) => {
    try {
      const response = await axios.get(`/api/requests/${requestId}/rfx`, {
        params: { type },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/pdf',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${type.toUpperCase()}_${requestId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(`❌ Error generating ${type.toUpperCase()} document for request ${requestId}:`, err);
      alert(tr('alerts.generateDocumentFailed', 'Failed to generate document.'));
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    const storedPath = attachment.file_path || '';
    const filename = storedPath.split(/[\\/]/).pop();
    const downloadEndpoint =
      attachment.download_url || (filename ? `/api/attachments/download/${encodeURIComponent(filename)}` : null);

    if (!downloadEndpoint) {
      alert(tr('alerts.attachmentMissing', 'Attachment file is missing.'));
      return;
    }

    setDownloadingAttachmentId(attachment.id);
    try {
      const response = await axios.get(downloadEndpoint, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = attachment.file_name || filename || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(`❌ Error downloading attachment ${attachment.id}:`, err);
      alert(tr('alerts.attachmentDownloadFailed', 'Failed to download attachment. Please try again.'));
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const handleAutoPurchaseAll = async (requestId) => {
    if (expandedRequestId !== requestId) {
      return;
    }

    if (!items.length) {
      alert(tr('alerts.noItemsForBulkUpdate', 'No items available to update for this request.'));
      return;
    }

    const updatableItems = items.filter((item) => {
      const requestedQty = Number(item.quantity ?? 0);
      return item.id && !Number.isNaN(requestedQty) && requestedQty > 0;
    });

    if (updatableItems.length === 0) {
      alert(
        tr(
          'alerts.invalidBulkItems',
          'Items must have a requested quantity greater than zero to be auto-filled.',
        ),
      );
      return;
    }

    const shouldProceed = window.confirm(
      tr(
        'confirm.bulkPurchase',
        'This will copy the requested quantity into the purchased quantity and mark every item as purchased. Continue?',
      ),
    );

    if (!shouldProceed) {
      return;
    }

    setBulkUpdatingRequestId(requestId);
    try {
      for (const item of updatableItems) {
        const requestedQty = Number(item.quantity ?? 0);

        await axios.put(`/api/requested-items/${item.id}/purchased-quantity`, {
          purchased_quantity: requestedQty,
        });

        await axios.put(`/api/requested-items/${item.id}/procurement-status`, {
          procurement_status: 'purchased',
          procurement_comment: item.procurement_comment || '',
        });
      }

      await fetchItems(requestId);
      alert(
        tr(
          'alerts.bulkPurchaseSuccess',
          'All items were marked as purchased using their requested quantities.',
        ),
      );
    } catch (err) {
      console.error('❌ Error performing bulk purchase update:', err);
      alert(
        tr(
          'alerts.bulkPurchaseFailed',

          'Failed to update all items. Some items may not have been updated.',
        ),
      );
    } finally {
      setBulkUpdatingRequestId(null);
    }
  };

  useEffect(() => {
    fetchAssignedRequests();
  }, [resetApprovals]);

  const toggleExpand = (requestId) => {
    const isExpanded = expandedRequestId === requestId;
    setExpandedRequestId(isExpanded ? null : requestId);
    if (isExpanded) {
      setItems([]);
      setGroupedItems(createEmptyGroups());
      setAttachments([]);
    } else {
      fetchItems(requestId);
      fetchAttachments(requestId);
    }
  };

  return (
    <>
      <Navbar />

      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">{tr('title', 'Assigned Requests')}</h1>

        {loading ? (
          <p className="text-gray-600">{tr('loading', 'Loading assigned requests...')}</p>
        ) : requests.length === 0 ? (
          <p>{tr('empty', 'No requests assigned to you.')}</p>
        ) : (
          requests.map((request) => {
            const summary = request.status_summary || {};
            const autoTotal =
              autoTotals[request.id] ?? summary.items_total_cost ?? null;
            const isUrgent = Boolean(request?.is_urgent);
            const completionState =
              completionStates[request.id] || {
                canComplete: false,
                missingCost: false,
                incompleteItems: true,
              };
            const showCompletionHints =
              expandedRequestId === request.id && items.length > 0 && !completionState.canComplete;
            const containerClasses = [
              'mb-6 border rounded-lg p-5 bg-white shadow-sm transition',
              isUrgent ? 'border-red-300 ring-1 ring-red-200/70 bg-red-50/70' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div key={request.id} className={containerClasses}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-700">
                        {tr('requestCard.requestId', 'Request ID')}: {request.id}
                      </p>
                      {isUrgent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
                          <span className="block h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                          {tr('requestCard.urgent', 'Urgent')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      <strong className="text-gray-700">{tr('requestCard.type', 'Type')}:</strong> {request.request_type}
                    </p>
                    <p className="text-sm text-gray-500">
                      <strong className="text-gray-700">{tr('requestCard.project', 'Project')}:</strong>{' '}
                      {request.project_name || '—'}
                    </p>
                    <p>
                        <strong>Department:</strong> {request.department_name || '—'}
                    </p>
                    {request.requester_name && (
                      <p>
                        <strong>Requester:</strong> {request.requester_name}
                        {request.requester_role && ` (${request.requester_role})`}
                      </p>
                    )}
                    <p className="text-sm text-gray-500">
                      <strong className="text-gray-700">{tr('requestCard.justification', 'Justification')}:</strong>{' '}
                      {request.justification}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => handleMarkAsCompleted(request.id)}
                      className={`px-4 py-2 rounded text-white transition ${
                        completionState.canComplete
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-gray-300 cursor-not-allowed'
                      }`}
                      disabled={!completionState.canComplete}
                    >
                      {tr('completion.markComplete', 'Mark Request as Completed')}
                    </button>
                    <button
                      onClick={() => toggleExpand(request.id)}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      {expandedRequestId === request.id
                        ? tr('requestCard.hideItems', 'Hide Items')
                        : tr('requestCard.viewItems', 'View Items')}
                    </button>
                    <button
                      className="text-blue-600 underline"
                      onClick={() => toggleApprovals(request.id)}
                      disabled={loadingApprovalsId === request.id}
                    >
                      {expandedApprovalsId === request.id
                        ? t('common.hideApprovals')
                        : t('common.viewApprovals')}
                    </button>
                    {showCompletionHints && (
                      <div className="text-xs text-right text-rose-600 space-y-1">
                        {completionState.missingCost && (
                          <p>
                            {tr(
                              'completion.missingCost',
                              'Record and save the total cost of this request before completing it.',
                            )}
                          </p>
                        )}
                        {completionState.incompleteItems && (
                          <p>
                            {tr(
                              'completion.incompleteItems',
                              'All items must be marked as purchased or unable to procure with recorded quantities before completing the request.',
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              {expandedApprovalsId === request.id && (
                <div className="mt-4 border-t pt-2">
                  <ApprovalTimeline
                    approvals={approvalsMap[request.id]}
                    isLoading={loadingApprovalsId === request.id}
                    isUrgent={Boolean(request?.is_urgent)}
                  />
                </div>
              )}
              
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <SummaryBadge label={summaryLabels.total} value={summary.total_items ?? 0} />
                  <SummaryBadge
                    label={summaryLabels.purchased}
                    value={summary.purchased_count ?? 0}
                    tone="success"
                  />
                  <SummaryBadge
                    label={summaryLabels.pending}
                    value={summary.pending_count ?? 0}
                    tone="warning"
                  />
                  <SummaryBadge
                    label={summaryLabels.notProcured}
                    value={summary.not_procured_count ?? 0}
                    tone="danger"
                  />
                </div>

                {autoTotal !== null && (
                  <p className="mt-2 text-xs text-gray-500">
                    {tr('summary.autoCalculated', 'Auto-calculated total from items:')}{' '}
                    <strong>{formatAmount(autoTotal)}</strong>
                  </p>
                )}

                {expandedRequestId === request.id && (
                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div className="flex-1">
                          <label className="block text-sm font-medium mb-1 text-slate-700">
                            {tr('cost.recordedLabel', 'Total Cost Recorded')}
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={requestCosts[request.id] ?? ''}
                            onChange={(e) => handleCostChange(request.id, e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
                          />
                          {autoTotal !== null && (
                            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                              <span>
                                {tr('cost.suggestedLabel', 'Suggested total:')}{' '}
                                <strong>{formatAmount(autoTotal)}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCostChange(request.id, autoTotal)}
                                className="text-blue-600 hover:text-blue-500"
                              >
                                {tr('cost.useSuggested', 'Use suggested value')}
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleSaveTotalCost(request.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        >
                          {tr('cost.saveButton', 'Save Total Cost')}
                        </button>
                      </div>
                    </div>

                    {loadingItems ? (
                      <p className="text-gray-500">{tr('items.loading', 'Loading items...')}</p>
                    ) : items.length === 0 ? (
                      <p className="text-gray-500">{tr('items.empty', 'No items found for this request.')}</p>
                    ) : (
                      <>
                        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-emerald-900">
                                {tr('items.bulkFill.title', 'Auto-fill purchased quantities')}
                              </h3>
                              <p className="text-sm text-emerald-800">
                                {tr(
                                  'items.bulkFill.description',
                                  'Copies each requested quantity into the purchased quantity field and marks the item as purchased.',
                                )}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAutoPurchaseAll(request.id)}
                              disabled={bulkUpdatingRequestId === request.id}
                              className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition ${
                                bulkUpdatingRequestId === request.id
                                  ? 'bg-emerald-400 cursor-wait'
                                  : 'bg-emerald-600 hover:bg-emerald-700'
                              }`}
                            >
                              {bulkUpdatingRequestId === request.id
                                ? tr('items.bulkFill.updating', 'Updating items…')
                                : tr('items.bulkFill.cta', 'Mark all as purchased')}
                            </button>
                          </div>
                        </div>
                        {itemSections.map(({ key, title, description, tone, empty }) => {
                          const sectionItems = groupedItems[key] || [];
                          if (key === 'other' && sectionItems.length === 0) {
                            return null;
                          }

                          return (
                            <div key={key} className="mt-6">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
                                  <p className="text-sm text-gray-500">{description}</p>
                                </div>
                                <span
                                  className={`text-xs font-medium px-3 py-1 rounded-full ${
                                    summaryToneClasses[tone] || summaryToneClasses.default
                                  }`}
                                >
                                  {tr('sections.count', '{{count}} item', { count: sectionItems.length })}
                                </span>
                              </div>
                              {sectionItems.length === 0 ? (
                                <p className="mt-3 text-sm italic text-gray-500">{empty}</p>
                              ) : (
                                sectionItems.map((item, idx) => (
                                  <ProcurementItemStatusPanel
                                    key={item.id || idx}
                                    item={item}
                                    onUpdate={() => fetchItems(request.id)}
                                  />
                                ))
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}

                    <div className="mt-6">
                      <h3 className="font-semibold mb-2">{tr('attachments.title', 'Attachments')}</h3>
                      {loadingAttachments ? (
                        <p className="text-gray-500">{tr('attachments.loading', 'Loading attachments...')}</p>
                      ) : attachments.length === 0 ? (
                        <p className="text-gray-500">{tr('attachments.empty', 'No attachments found.')}</p>
                      ) : (
                        <ul className="list-disc pl-5 text-blue-600">
                          {attachments.map((att) => {
                            const filename = att.file_name || att.file_path.split(/[\\/]/).pop();
                            return (
                              <li key={att.id}>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttachment(att)}
                                  className="underline text-left text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                  disabled={downloadingAttachmentId === att.id}
                                >
                                  {downloadingAttachmentId === att.id
                                    ? tr('attachments.downloading', 'Downloading…')
                                    : filename}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="mt-6 border-t border-slate-200 pt-6">
                      <h3 className="font-semibold mb-3">{tr('documents.title', 'Generate Document')}</h3>
                      <div className="flex flex-wrap gap-3">
                        {['rfp', 'rfi', 'rfq'].map((type) => (
                          <button
                            key={type}
                            onClick={() => handleGenerateDoc(request.id, type)}
                            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
                          >
                            {type.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
};

export default AssignedRequestsPage;