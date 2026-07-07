// src/pages/AssignedRequestsPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from '../api/axios';
import { printRequest } from '../api/requests';
import ProcurementItemStatusPanel from '../components/ProcurementItemStatusPanel';
import PageShell from '../components/layout/PageShell';
import ApprovalTimeline from '../components/ApprovalTimeline';
import AmountInput from '../components/ui/AmountInput';
import useApprovalTimeline from '../hooks/useApprovalTimeline';
import { getDisplayItems } from '../utils/itemUtils';
import { getRequesterDisplay } from '../utils/requester';
import usePageTranslation from '../utils/usePageTranslation';

const SEARCHABLE_REQUEST_FIELDS = [
  'id',
  'request_type',
  'project_name',
  'department_name',
  'requester_name',
  'requested_by_name',
  'requester_email',
  'justification',
  'status',
];

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
    } else if (status === 'pending' || status === 'partially_procured' || !status) {
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
  const hasRecordedCost = !Number.isNaN(numericSavedCost) && numericSavedCost >= 0;

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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [completionFilter, setCompletionFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [sortItemsAlphabetically, setSortItemsAlphabetically] = useState(false);
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
  const [printingRequestId, setPrintingRequestId] = useState(null);
  const [completionStates, setCompletionStates] = useState({});
  const [manualStatusItem, setManualStatusItem] = useState(null);
  const [manualStatusForm, setManualStatusForm] = useState({ status: 'completed', comment: '' });
  const [savingManualStatus, setSavingManualStatus] = useState(false);
  const [, setCompletionFeedback] = useState('');
  const {
    expandedApprovalsId,
    approvalsMap,
    loadingApprovalsId,
    toggleApprovals,
    resetApprovals,
  } = useApprovalTimeline();

  const fetchAssignedRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/requests/assigned');
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
  }, [resetApprovals]);

  const handleRefresh = () => {
    setCompletionFeedback('');
    setExpandedRequestId(null);
    setItems([]);
    setGroupedItems(createEmptyGroups());
    setAttachments([]);
    fetchAssignedRequests();
  };

  const fetchItems = async (requestId) => {
    setLoadingItems(true);
    try {
      const res = await axios.get(`/requests/${requestId}/items`);
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
      const res = await axios.get(`/attachments/${requestId}`);
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
      const response = await axios.patch(
        `/requests/${requestId}/mark-completed`,
      );
      const selectedRequest = requests.find((request) => request.id === requestId);
      const message =
        response?.data?.message ||
        tr('alerts.markCompletedSuccess', 'Request marked as completed.');

      navigate('/request-submitted', {
        state: {
          title: tr('completionScreen.title', 'Request Action Completed Successfully!'),
          message,
          requestId,
          requestType: selectedRequest?.request_type || tr('completionScreen.requestType', 'Request'),
          statusMessage: message,
          nextApprover: tr('completionScreen.none', 'N/A'),
          pendingLevel: tr('completionScreen.none', 'N/A'),
        },
      });
      
      setCompletionFeedback(
        tr(
          'completion.postActionNotice',
          'Action completed successfully. Depending on your browser flow, you may see a popup window or be taken to a completion card.',
        ),
      );
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

    const selectedRequest = requests.find((req) => req.id === requestId);
    if (!selectedRequest) {
      return;
    }

    const isBlank = value === '' || value === null || value === undefined;
    const parsedCost = isBlank ? 0 : Number(value);
    const normalizedCost = Number.isNaN(parsedCost) || parsedCost < 0 ? null : parsedCost;
    const requestWithDraftCost = {
      ...selectedRequest,
      estimated_cost: normalizedCost,
    };
    const itemsOverride = expandedRequestId === requestId && items.length > 0 ? items : null;

    setCompletionStates((prev) => ({
      ...prev,
      [requestId]: evaluateCompletionState(requestWithDraftCost, itemsOverride),
    }));
  };


  const openManualStatusModal = (item, defaultStatus = 'completed') => {
    setManualStatusItem(item);
    setManualStatusForm({
      status: defaultStatus,
      comment: item.procurement_comment || item.latest_note || '',
    });
  };

  const closeManualStatusModal = () => {
    if (savingManualStatus) {
      return;
    }

    setManualStatusItem(null);
    setManualStatusForm({ status: 'completed', comment: '' });
  };

  const submitManualStatus = async (event) => {
    event.preventDefault();

    if (!manualStatusItem?.id) {
      return;
    }

    const requestId = manualStatusItem.request_id || expandedRequestId;
    setSavingManualStatus(true);

    try {
      await axios.put(`/requested-items/${manualStatusItem.id}/procurement-status`, {
        status: manualStatusForm.status,
        comment: manualStatusForm.comment,
      });
      setManualStatusItem(null);
      setManualStatusForm({ status: 'completed', comment: '' });

      if (requestId) {
        await fetchItems(requestId);
      }

      alert(tr('alerts.itemStatusUpdated', 'Item status updated.'));
    } catch (err) {
      console.error('❌ Error updating item final status:', err);
      alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          tr('alerts.itemStatusUpdateFailed', 'Failed to update item status.'),
      );
    } finally {
      setSavingManualStatus(false);
    }
  };

  const handleSaveTotalCost = async (requestId) => {
    const rawValue = requestCosts[requestId];
    const isBlank = rawValue === '' || rawValue === null || rawValue === undefined;
    const cost = isBlank ? 0 : Number(rawValue);

    if (Number.isNaN(cost) || cost < 0) {
      alert(tr('alerts.invalidCost', 'Enter a valid total cost of zero or more.'));
      return;
    }

    try {
      await axios.put(`/requests/${requestId}/cost`, { estimated_cost: cost });
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

  const handlePrintRequest = async (requestId) => {
    const shouldPrint = window.confirm(
      tr(
        'confirm.printRequest',
        'Print this assigned request? This will increase the print count.',
      ),
    );

    if (!shouldPrint) {
      return;
    }

    setPrintingRequestId(requestId);

    try {
      const data = await printRequest(requestId, {
        incrementPrintCount: true,
        language: i18n.language === 'en' ? 'en' : 'ar',
      });
      const {
        request,
        items: printableItems = [],
        message = tr('alerts.printReady', 'Request ready for printing.'),
        print_count: printCount,
      } = data;

      setRequests((prev) =>
        prev.map((req) =>
          req.id === requestId
            ? { ...req, print_count: printCount ?? request?.print_count ?? req.print_count }
            : req,
        ),
      );

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert(tr('alerts.popupBlocked', 'Please enable popups to print the request.'));
        return;
      }

      const escapeHtml = (value) => {
        if (value === null || value === undefined) return '';
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };

      const formatPrintableValue = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        return escapeHtml(value);
      };

      const formatPrintableDate = (value) => {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '—' : escapeHtml(date.toLocaleString());
      };

      const formatPrintableAmount = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return formatPrintableValue(value);
        return escapeHtml(
          numeric.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        );
      };

      const formatFinalApprovalSummary = (name, dateValue) => {
        const formattedDate = formatPrintableDate(dateValue);
        if (formattedDate === '—') return formattedDate;
        return `${name || tr('print.finalApprover', 'Final approver')} ${tr(
          'print.approvedAt',
          'Approved at',
        )} ${formattedDate}`;
      };

      const finalApproval = request?.final_approval?.approved_at
        ? formatFinalApprovalSummary(
            request.final_approval.approver_name,
            request.final_approval.approved_at,
          )
        : null;

      const detailFields = [
        { label: tr('print.requestId', 'Request ID'), value: request?.id || requestId },
        { label: tr('print.status', 'Status'), value: request?.status },
        { label: tr('print.type', 'Type'), value: request?.request_type },
        { label: tr('print.project', 'Project'), value: request?.project_name },
        { label: tr('print.department', 'Department'), value: request?.department_name },
        { label: tr('print.requester', 'Requester'), value: getRequesterDisplay(request || {}) },
        { label: tr('print.createdOn', 'Created On'), value: formatPrintableDate(request?.created_at) },
        { label: tr('print.neededBy', 'Needed By'), value: formatPrintableDate(request?.needed_by) },
        { label: tr('print.printCount', 'Print Count'), value: printCount ?? request?.print_count },
        { label: tr('print.finalApproval', 'Final Approval'), value: finalApproval },
      ]
        .map(({ label, value }) => ({ label, value: formatPrintableValue(value) }))
        .filter(({ value }) => value && value !== '—');

      const detailGrid = detailFields
        .map(
          ({ label, value }) => `
            <div class="detail-item">
              <span class="detail-label">${escapeHtml(label)}</span>
              <span class="detail-value">${value}</span>
            </div>`,
        )
        .join('');

      const itemRows = printableItems
        .map(
          (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>
                <strong>${formatPrintableValue(item.item_name)}</strong>
                ${item.specs ? `<div class="item-note">${formatPrintableValue(item.specs)}</div>` : ''}
              </td>
              <td>${formatPrintableValue(item.brand)}</td>
              <td class="numeric">${formatPrintableValue(item.quantity)}</td>
              <td class="numeric">${formatPrintableValue(item.purchased_quantity)}</td>
              <td class="numeric">${formatPrintableAmount(item.unit_cost)}</td>
              <td class="numeric">${formatPrintableAmount(item.total_cost)}</td>
            </tr>`,
        )
        .join('');

      const totalCost = printableItems.reduce((sum, item) => {
        const value = Number(item.total_cost);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0);

      const justification = request?.justification
        ? `<section class="section">
            <h2>${escapeHtml(tr('print.justification', 'Justification'))}</h2>
            <p>${escapeHtml(request.justification).replace(/\n/g, '<br />')}</p>
          </section>`
        : '';

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${escapeHtml(tr('print.title', 'Purchase Request'))} ${escapeHtml(request?.id || requestId)}</title>
            <style>
              @page { size: A4; margin: 18mm; }
              body { margin: 0; padding: 28px; color: #1f2937; font-family: Arial, sans-serif; background: #f8fafc; }
              .page { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08); }
              header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
              h1 { margin: 0; font-size: 26px; color: #111827; }
              h2 { color: #1d4ed8; border-bottom: 1px solid #bfdbfe; padding-bottom: 6px; font-size: 18px; }
              .print-badge { align-self: center; border-radius: 999px; background: #2563eb; color: white; font-weight: 700; padding: 8px 16px; }
              .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 24px; }
              .detail-item { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
              .detail-label { display: block; color: #6b7280; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; margin-bottom: 4px; text-transform: uppercase; }
              .detail-value { color: #111827; font-weight: 700; word-break: break-word; }
              .section { margin-bottom: 24px; }
              table { border-collapse: collapse; width: 100%; border: 1px solid #e5e7eb; font-size: 13px; }
              th { background: #2563eb; color: white; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
              th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; vertical-align: top; }
              tbody tr:nth-child(even) { background: #f9fafb; }
              .numeric { text-align: right; white-space: nowrap; }
              .item-note { color: #4b5563; font-size: 12px; margin-top: 4px; }
              .totals-row td { background: #eef2ff; font-weight: 700; }
              .signature-blocks { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin-top: 32px; }
              .signature { border-top: 1px solid #9ca3af; padding-top: 12px; text-align: center; font-size: 12px; color: #6b7280; }
              footer { color: #6b7280; font-size: 12px; margin-top: 28px; text-align: right; }
              @media print { body { background: white; padding: 0; } .page { box-shadow: none; border-radius: 0; padding: 0; } }
            </style>
          </head>
          <body>
            <div class="page">
              <header>
                <div>
                  <h1>${escapeHtml(tr('print.heading', 'Purchase Request Summary'))}</h1>
                  <p>${escapeHtml(tr('print.generatedOn', 'Generated on'))} ${escapeHtml(new Date().toLocaleString())}</p>
                </div>
                <span class="print-badge">${escapeHtml(tr('print.printCount', 'Print Count'))}: ${formatPrintableValue(printCount ?? request?.print_count)}</span>
              </header>
              <section class="section">
                <h2>${escapeHtml(tr('print.details', 'Request Details'))}</h2>
                <div class="details-grid">${detailGrid}</div>
              </section>
              ${justification}
              <section class="section">
                <h2>${escapeHtml(tr('print.items', 'Requested Items'))}</h2>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>${escapeHtml(tr('print.item', 'Item'))}</th>
                      <th>${escapeHtml(tr('print.brand', 'Brand'))}</th>
                      <th>${escapeHtml(tr('print.quantity', 'Qty'))}</th>
                      <th>${escapeHtml(tr('print.purchasedQuantity', 'Purchased Qty'))}</th>
                      <th>${escapeHtml(tr('print.unitCost', 'Unit Cost'))}</th>
                      <th>${escapeHtml(tr('print.totalCost', 'Total Cost'))}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemRows || `<tr><td colspan="7" style="text-align:center; padding: 24px;">${escapeHtml(tr('print.noItems', 'No line items recorded.'))}</td></tr>`}
                    <tr class="totals-row">
                      <td colspan="6">${escapeHtml(tr('print.grandTotal', 'Grand Total'))}</td>
                      <td class="numeric">${formatPrintableAmount(totalCost)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
              <section class="signature-blocks">
                <div class="signature">${escapeHtml(tr('print.preparedBy', 'Prepared By'))}</div>
                <div class="signature">${escapeHtml(tr('print.reviewedBy', 'Reviewed By'))}</div>
                <div class="signature">${escapeHtml(tr('print.approvedBy', 'Approved By'))}</div>
              </section>
              <footer>${escapeHtml(tr('print.requestId', 'Request ID'))} ${escapeHtml(request?.id || requestId)}</footer>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };

      alert(message);
    } catch (err) {
      console.error('❌ Failed to print assigned request:', err);
      alert(tr('alerts.printFailed', '❌ Failed to print request.'));
    } finally {
      setPrintingRequestId(null);
    }
  };

  const handleGenerateDoc = async (requestId, type) => {
    try {
      const response = await axios.get(`/requests/${requestId}/rfx`, {
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
      const serverMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message;

      alert(
        serverMessage
          ? tr('alerts.generateDocumentFailedWithReason', `Failed to generate document: ${serverMessage}`)
          : tr('alerts.generateDocumentFailed', 'Failed to generate document.'),
      );
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    const storedPath = attachment.file_path || '';
    const filename = storedPath.split(/[\\/]/).pop();
    const idBasedEndpoint = attachment?.id ? `/attachments/${attachment.id}/download` : null;
    const isLegacyFilenameEndpoint =
      typeof attachment?.download_url === 'string' &&
      /\/attachments\/download\//.test(attachment.download_url);
    const downloadEndpoint = normalizeDownloadEndpoint(
      (isLegacyFilenameEndpoint ? idBasedEndpoint : null) ||
        attachment?.download_url ||
        idBasedEndpoint ||
        (filename ? `/attachments/download/${encodeURIComponent(filename)}` : null),
    );

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
      return item.supports_procurement_events !== false && item.id && !Number.isNaN(requestedQty) && requestedQty > 0;
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
        const purchasedQty = Number(item.purchased_quantity ?? 0);
        const remainingQty = Number(item.remaining_quantity ?? Math.max(requestedQty - purchasedQty, 0));

        if (remainingQty <= 0) {
          continue;
        }

        await axios.post(`/requests/${requestId}/items/${item.id}/procurement-events`, {
          event_quantity: remainingQty,
          unit_cost: item.unit_cost ?? null,
          procurement_note: tr(
            'items.bulkFill.procurementEntryNote',
            'Auto-filled remaining procurement quantity.',
          ),
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


  const filterOptions = useMemo(() => {
    const buildOptions = (key) =>
      Array.from(
        new Set(
          requests
            .map((request) => request?.[key])
            .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
            .map((value) => String(value)),
        ),
      ).sort((a, b) => a.localeCompare(b));

    return {
      types: buildOptions('request_type'),
      departments: buildOptions('department_name'),
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return requests.filter((request) => {
      if (typeFilter !== 'all' && String(request?.request_type || '') !== typeFilter) {
        return false;
      }

      if (departmentFilter !== 'all' && String(request?.department_name || '') !== departmentFilter) {
        return false;
      }

      if (urgencyFilter === 'urgent' && !request?.is_urgent) {
        return false;
      }

      if (urgencyFilter === 'standard' && request?.is_urgent) {
        return false;
      }

      const completionState = completionStates[request.id] || evaluateCompletionState(request);
      if (completionFilter === 'ready' && !completionState.canComplete) {
        return false;
      }

      if (completionFilter === 'needs_attention' && completionState.canComplete) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableValues = [
        ...SEARCHABLE_REQUEST_FIELDS.map((field) => request?.[field]),
        getRequesterDisplay(request),
      ];

      return searchableValues.some((value) =>
        String(value ?? '').toLowerCase().includes(normalizedSearch),
      );
    });
  }, [completionFilter, completionStates, departmentFilter, requests, searchTerm, typeFilter, urgencyFilter]);

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setDepartmentFilter('all');
    setCompletionFilter('all');
    setUrgencyFilter('all');
  };

  const pageKpis = useMemo(() => {
    const totalRequests = filteredRequests.length;
    const urgentRequests = filteredRequests.filter((req) => Boolean(req?.is_urgent)).length;
    const readyToComplete = filteredRequests.filter((req) => completionStates[req.id]?.canComplete).length;
    const pendingCompletion = Math.max(totalRequests - readyToComplete, 0);

    return [
      { label: tr('kpis.totalRequests', 'Total Assigned Requests'), value: totalRequests },
      { label: tr('kpis.urgentRequests', 'Urgent Requests'), value: urgentRequests },
      { label: tr('kpis.readyToComplete', 'Ready to Complete'), value: readyToComplete },
      { label: tr('kpis.pendingCompletion', 'Needs Attention'), value: pendingCompletion },
    ];
  }, [completionStates, filteredRequests, tr]);

  useEffect(() => {
    fetchAssignedRequests();
  }, [fetchAssignedRequests]);

  const toggleExpand = (requestId) => {
    const isExpanded = expandedRequestId === requestId;
    setExpandedRequestId(isExpanded ? null : requestId);
    if (isExpanded) {
      setItems([]);
      setGroupedItems(createEmptyGroups());
      setAttachments([]);
      setSortItemsAlphabetically(false);
    } else {
      fetchItems(requestId);
      fetchAttachments(requestId);
      setSortItemsAlphabetically(false);
    }
  };

  return (
    <PageShell
      title={tr('title', 'Assigned Requests')}
      description={tr('description', 'Track procurement progress, update item statuses, and complete requests once all items are finalized.')}
      actions={(
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading
            ? tr('actions.refreshing', 'Refreshing...')
            : tr('actions.refresh', 'Refresh')}
        </button>
      )}
      kpis={pageKpis}
    >
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          {tr('loading', 'Loading assigned requests...')}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">{tr('empty', 'No requests assigned to you.')}</p>
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <label htmlFor="assigned-request-search" className="mb-1 block text-sm font-medium text-slate-700">
                  {tr('filters.searchLabel', 'Search assigned requests')}
                </label>
                <input
                  id="assigned-request-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={tr('filters.searchPlaceholder', 'Search by ID, requester, project, department, type, or justification')}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label htmlFor="assigned-request-type-filter" className="mb-1 block text-sm font-medium text-slate-700">
                  {tr('filters.typeLabel', 'Type')}
                </label>
                <select
                  id="assigned-request-type-filter"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">{tr('filters.allTypes', 'All types')}</option>
                  {filterOptions.types.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="assigned-request-department-filter" className="mb-1 block text-sm font-medium text-slate-700">
                  {tr('filters.departmentLabel', 'Department')}
                </label>
                <select
                  id="assigned-request-department-filter"
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">{tr('filters.allDepartments', 'All departments')}</option>
                  {filterOptions.departments.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="assigned-request-completion-filter" className="mb-1 block text-sm font-medium text-slate-700">
                  {tr('filters.completionLabel', 'Completion')}
                </label>
                <select
                  id="assigned-request-completion-filter"
                  value={completionFilter}
                  onChange={(event) => setCompletionFilter(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">{tr('filters.allCompletion', 'All completion states')}</option>
                  <option value="ready">{tr('filters.readyToComplete', 'Ready to complete')}</option>
                  <option value="needs_attention">{tr('filters.needsAttention', 'Needs attention')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="assigned-request-urgency-filter" className="mb-1 block text-sm font-medium text-slate-700">
                  {tr('filters.urgencyLabel', 'Urgency')}
                </label>
                <select
                  id="assigned-request-urgency-filter"
                  value={urgencyFilter}
                  onChange={(event) => setUrgencyFilter(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">{tr('filters.allUrgency', 'All urgency levels')}</option>
                  <option value="urgent">{tr('filters.urgentOnly', 'Urgent only')}</option>
                  <option value="standard">{tr('filters.standardOnly', 'Standard only')}</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {tr('filters.resultCount', 'Showing {{shown}} of {{total}} assigned requests', {
                  shown: filteredRequests.length,
                  total: requests.length,
                })}
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="self-start rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:self-auto"
              >
                {tr('filters.reset', 'Reset filters')}
              </button>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-slate-600">{tr('filters.noResults', 'No assigned requests match your search or filters.')}</p>
            </div>
          ) : filteredRequests.map((request) => {
            const summary = request.status_summary || {};
            const autoTotal =
              autoTotals[request.id] ?? summary.items_total_cost ?? null;
            const isUrgent = Boolean(request?.is_urgent);
            const requesterDisplay = getRequesterDisplay(request);
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
                      <strong className="text-gray-700">{tr('requestCard.department', 'Department')}:</strong>{' '}
                      {request.department_name || '—'}
                    </p>
                    <p>
                      <strong className="text-gray-700">{tr('requestCard.requester', 'Requester')}:</strong>{' '}
                      {requesterDisplay}
                    </p>
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
                      type="button"
                      onClick={() => handlePrintRequest(request.id)}
                      disabled={printingRequestId === request.id}
                      className={`px-4 py-2 rounded text-white transition ${
                        printingRequestId === request.id
                          ? 'bg-slate-400 cursor-wait'
                          : 'bg-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {printingRequestId === request.id
                        ? tr('actions.printing', 'Printing…')
                        : tr('actions.print', 'Print')}
                    </button>
                    <Link
                      to={`/requests/${request.id}`}
                      className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 text-center"
                    >
                      Workspace
                    </Link>
                    <button
                      onClick={() => toggleExpand(request.id)}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      {expandedRequestId === request.id
                        ? tr('requestCard.hideItems', 'Hide Items')
                        : tr('requestCard.viewItems', 'View Items')}
                    </button>
                    <Link
                      to={`/requests/${request.id}/procure-to-pay/purchase-orders`}
                      className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-center"
                    >
                      {tr('requestCard.viewPo', 'View PO')}
                    </Link>
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
                          <AmountInput
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
                        {items.some((item) => item.supports_procurement_events !== false) && (
                        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-emerald-900">
                                {tr('items.bulkFill.title', 'Auto-fill purchased quantities')}
                              </h3>
                              <p className="text-sm text-emerald-800">
                                {tr(
                                  'items.bulkFill.description',
                                  'Adds a procurement entry for each remaining quantity and marks fully procured items as purchased.',
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
                        )}
                        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-800">
                              {tr('items.sort.title', 'Item order')}
                            </h3>
                            <p className="text-xs text-slate-500">
                              {tr('items.sort.helper', 'Sorting only changes this view and does not update the saved request.')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSortItemsAlphabetically((prev) => !prev)}
                            disabled={items.length < 2}
                            className="self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
                          >
                            {sortItemsAlphabetically
                              ? tr('items.sort.original', 'Original order')
                              : tr('items.sort.alphabetical', 'Sort A-Z')}
                          </button>
                        </div>
                        {itemSections.map(({ key, title, description, tone, empty }) => {
                          const sectionItems = getDisplayItems(groupedItems[key] || [], sortItemsAlphabetically);
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
                                sectionItems.map((item, idx) => {
                                  const itemWithRequest = { ...item, request_id: item.request_id || request.id };
                                  const itemStatus = String(item.procurement_status || '').trim().toLowerCase();
                                  const canManuallyClose = !['purchased', 'completed', 'not_procured', 'canceled'].includes(itemStatus);

                                  return (
                                    <div key={item.id || idx} className="mb-3 rounded-xl border border-slate-200 bg-white">
                                      {canManuallyClose && (
                                        <div className="flex flex-col gap-2 border-b border-slate-100 bg-amber-50/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                          <p className="text-amber-900">
                                            {tr(
                                              'items.manualClose.helper',
                                              'If no more procurement will happen for this item, close the remaining quantity manually.',
                                            )}
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => openManualStatusModal(itemWithRequest, 'completed')}
                                            className="self-start rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 sm:self-auto"
                                          >
                                            {tr('items.manualClose.cta', 'Close as Completed')}
                                          </button>
                                        </div>
                                      )}
                                      <ProcurementItemStatusPanel
                                        item={itemWithRequest}
                                        onUpdate={() => fetchItems(request.id)}
                                      />
                                    </div>
                                  );
                                })
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
          }
        </>
      )}

      {manualStatusItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {tr('items.manualClose.title', 'Close item procurement')}
                </h3>
                <p className="text-sm text-slate-500">{manualStatusItem.item_name}</p>
              </div>
              <button type="button" onClick={closeManualStatusModal} className="text-slate-500 hover:text-slate-700">×</button>
            </div>

            <form onSubmit={submitManualStatus} className="mt-4 space-y-4">
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                {tr(
                  'items.manualClose.description',
                  'Use this when the item was partially procured, no further procurement will happen, and the remaining quantity should not block completing the request.',
                )}
              </p>

              <label className="block text-sm font-semibold text-slate-700">
                {tr('items.manualClose.statusLabel', 'Final item status')}
                <select
                  value={manualStatusForm.status}
                  onChange={(event) => setManualStatusForm((prev) => ({ ...prev, status: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                >
                  <option value="completed">{tr('items.manualClose.completedOption', 'Completed / Close remaining quantity')}</option>
                  <option value="not_procured">{tr('items.manualClose.notProcuredOption', 'Not Procured / Will not be purchased')}</option>
                  <option value="canceled">{tr('items.manualClose.canceledOption', 'Canceled')}</option>
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                {tr('items.manualClose.commentLabel', 'Reason / note')}
                <textarea
                  value={manualStatusForm.comment}
                  onChange={(event) => setManualStatusForm((prev) => ({ ...prev, comment: event.target.value }))}
                  className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 p-2"
                  placeholder={tr(
                    'items.manualClose.commentPlaceholder',
                    'Explain why this item is being closed and whether any remaining quantity will not be purchased.',
                  )}
                />
              </label>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeManualStatusModal} className="rounded-lg border px-4 py-2">
                  {tr('items.manualClose.cancel', 'Cancel')}
                </button>
                <button disabled={savingManualStatus} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
                  {savingManualStatus ? tr('items.manualClose.saving', 'Saving…') : tr('items.manualClose.save', 'Save status')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
};

export default AssignedRequestsPage;
const normalizeDownloadEndpoint = (endpoint = '') => {
  if (!endpoint || typeof endpoint !== 'string') return null;
  if (/^https?:\/\//i.test(endpoint)) return endpoint;

  const prefixedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return prefixedEndpoint.replace(/^\/api\//, '/');
};