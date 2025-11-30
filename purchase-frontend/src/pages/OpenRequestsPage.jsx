// src/pages/OpenRequestsPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';
import { updateRequest } from '../api/requests';
import Navbar from '../components/Navbar';
import { saveAs } from 'file-saver';
import { useTranslation } from 'react-i18next';
import ApprovalTimeline from '../components/ApprovalTimeline';
import useApprovalTimeline from '../hooks/useApprovalTimeline';
import RequestAttachmentsSection from '../components/RequestAttachmentsSection';
import useRequestAttachments from '../hooks/useRequestAttachments';
import { deriveItemPurchaseState } from '../utils/itemPurchaseStatus';
import { extractItems } from '../utils/itemUtils';
import { useLocation, useSearchParams } from 'react-router-dom';

const ITEMS_PER_PAGE = 10;

const formatDate = (value, locale) => {
  if (!value) {
    return '—';
  }

  try {
    return new Date(value).toLocaleString(locale || undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch (error) {
    return new Date(value).toLocaleString();
  }
};

const mapStatusColor = (status) => {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-700 ring-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-700 ring-red-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-700 ring-yellow-200';
    default:
      return 'bg-gray-100 text-gray-700 ring-gray-200';
  }
};

const OpenRequestsPage = () => {
  const { t: translate, i18n } = useTranslation();
  const tr = useMemo(
    () => (key, options) => translate(`openRequests.${key}`, options),
    [translate]
  );
  const te = useMemo(
    () => (key, options) => translate(`edit.${key}`, options),
    [translate]
  );

  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [requestType, setRequestType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedAttachmentsId, setExpandedAttachmentsId] = useState(null);
  const [itemsMap, setItemsMap] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [focusedRequestId, setFocusedRequestId] = useState(null);
  const [editingRequest, setEditingRequest] = useState(null);
  const [editForm, setEditForm] = useState({ justification: '', items: [] });
  const [editError, setEditError] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const focusAppliedRef = useRef(false);
  const lastFocusIdRef = useRef(null);
  const lastLocationKeyRef = useRef(null);
  const {
    expandedApprovalsId,
    approvalsMap,
    loadingApprovalsId,
    toggleApprovals,
    resetApprovals,
  } = useApprovalTimeline();
  const {
    attachmentsMap,
    attachmentLoadingMap,
    attachmentErrorMap,
    downloadingAttachmentId,
    loadAttachmentsForRequest,
    handleDownloadAttachment,
    resetAttachments,
  } = useRequestAttachments();

  const timelineLabels = useMemo(
    () => ({
      title: translate('common.approvalTimeline'),
      loading: translate('common.loadingApprovals'),
      empty: translate('common.noApprovals'),
      columns: {
        level: translate('common.approvalLevel'),
        approver: translate('common.approver'),
        role: translate('common.approverRole'),
        decision: translate('common.approvalDecision'),
        comment: translate('common.approvalComment'),
        date: translate('common.approvalDate'),
      },
    }),
    [translate]
  );

  useEffect(() => {
    const fetchOpenRequests = async () => {
      setLoading(true);
      setError('');

      try {
        resetAttachments();
        const response = await api.get('/api/requests/my');
        const open = response.data.filter(
          (r) => !['completed', 'received', 'rejected'].includes((r.status || '').toLowerCase())
        );
        setRequests(open || []);
        resetApprovals();
      } catch (err) {
        console.error('Failed to fetch open requests:', err);
        setError(tr('errorLoading'));
      } finally {
        setLoading(false);
      }
    };

    fetchOpenRequests();
  }, [resetApprovals, resetAttachments, tr]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, requestType, statusFilter, sortOrder, requests.length, fromDate, toDate]);

  const statusCounts = useMemo(() => {
    return requests.reduce(
      (acc, req) => {
        const key = (req.status || '').toLowerCase();
        if (!key) {
          return acc;
        }

        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {}
    );
  }, [requests]);

  const statusCards = useMemo(() => {
    const entries = Object.entries(statusCounts).map(([status, count]) => ({
      key: status,
      label: translate(`openRequests.statuses.${status}`, {
        defaultValue: status ? status.charAt(0).toUpperCase() + status.slice(1) : status,
      }),
      count,
    }));

    if (!entries.some(({ key }) => key === 'received')) {
      entries.push({
        key: 'received',
        label: translate('openRequests.statuses.received', {
          defaultValue: 'Received',
        }),
        count: statusCounts.received || 0,
      });
    }

    entries.sort((a, b) => b.count - a.count);

    return [
      {
        key: 'total',
        label: tr('cards.total'),
        count: requests.length,
        isTotal: true,
      },
      ...entries,
    ];
  }, [statusCounts, requests.length, tr, translate]);

  const uniqueTypes = useMemo(() => {
    return Array.from(
      new Set(requests.map((req) => req.request_type).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const normalizedLocale = useMemo(() => {
    return i18n.language?.startsWith('ar') ? 'ar' : undefined;
  }, [i18n.language]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const normalizedStatus = statusFilter === 'all' ? '' : statusFilter.toLowerCase();
    const normalizedType = requestType === 'all' ? '' : requestType.toLowerCase();

    const finalizedStatuses = ['completed', 'received', 'approved', 'rejected', 'cancelled'];

    return requests.filter((req) => {
      const status = (req.status || '').toLowerCase();
      const type = (req.request_type || '').toLowerCase();
      const matchesStatus = !normalizedStatus
        ? true
        : normalizedStatus === 'pending'
        ? !finalizedStatuses.includes(status)
        : status === normalizedStatus;
      const matchesType = !normalizedType || type === normalizedType;

      const matchesSearch =
        !term ||
        [
          req.request_type,
          req.justification,
          req.status,
          req.assigned_user_name,
          req.project_name,
          req.id,
        ]
          .filter((value) => value !== undefined && value !== null)
          .some((value) => String(value).toLowerCase().includes(term));

      const createdAt = new Date(req.created_at);
      const matchesFromDate = !fromDate || createdAt >= new Date(fromDate);
      const matchesToDate = !toDate || createdAt <= new Date(toDate);

      return matchesStatus && matchesType && matchesSearch && matchesFromDate && matchesToDate;
    });
  }, [requests, search, statusFilter, requestType, fromDate, toDate]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const first = new Date(a.updated_at || a.created_at || 0).getTime();
      const second = new Date(b.updated_at || b.created_at || 0).getTime();

      return sortOrder === 'newest' ? second - first : first - second;
    });
  }, [filtered, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sorted.slice(start, start + ITEMS_PER_PAGE);
  }, [sorted, currentPage]);

  const getCurrentStage = (req) => {
    const normalizedStatus = req.status?.toLowerCase();

    if (!req.status) return tr('stageUnknown', 'Status unavailable');

    if (['approved', 'rejected', 'completed'].includes(normalizedStatus)) {
      return tr('stageFinalized', { status: req.status });
    }

    if (req.current_approver_role) {
      const step = req.current_approver_role;
      return tr('awaitingStep', 'Awaiting {{step}}', { step });
    }

    if (req.current_approval_level) {
      return tr(
        'awaitingLevelOnly',
        'Awaiting approval level {{level}}',
        { level: req.current_approval_level }
      );
    }

    return tr('stageUnknown', 'Status unavailable');
  };

  const openRequestDetails = useCallback(
    async (requestId) => {
      if (!requestId) {
        return;
      }

      if (!itemsMap[requestId]) {
        try {
          setLoadingId(requestId);
          const res = await api.get(`/api/requests/${requestId}/items`);
          setItemsMap((prev) => ({ ...prev, [requestId]: extractItems(res.data) }));
        } catch (err) {
          console.error('❌ Failed to load items:', err);
        } finally {
          setLoadingId(null);
        }
      }

      setExpandedId(requestId);
    },
    [itemsMap],
  );

  const toggleExpand = async (requestId) => {
    if (expandedId === requestId) {
      setExpandedId(null);
      setFocusedRequestId(null);
      if (expandedAttachmentsId === requestId) {
        setExpandedAttachmentsId(null);
      }
      return;
    }

    await openRequestDetails(requestId);
    setFocusedRequestId(requestId);
  };

  const toggleAttachments = async (requestId) => {
    if (expandedAttachmentsId === requestId) {
      setExpandedAttachmentsId(null);
      return;
    }

    await loadAttachmentsForRequest(requestId);
    setExpandedAttachmentsId(requestId);
  };

  const resetEditState = useCallback(() => {
    setEditingRequest(null);
    setEditForm({ justification: '', items: [] });
    setEditError('');
    setIsEditModalOpen(false);
    setEditSubmitting(false);
  }, []);

  const canEditRequest = useCallback((req) => {
    const normalizedStatus = (req?.status || '').toLowerCase();
    const approvalsStarted = Boolean(req?.has_approval_activity);
    const finalizedStatuses = ['approved', 'rejected', 'completed', 'received', 'cancelled'];
    return !approvalsStarted && !finalizedStatuses.includes(normalizedStatus);
  }, []);

  const prepareEditableItems = useCallback((rawItems = []) => {
    return (rawItems || []).map((item) => ({
      item_name: item.item_name || '',
      brand: item.brand || '',
      quantity: item.quantity ?? '',
      unit_cost: item.unit_cost ?? '',
      specs: item.specs || '',
    }));
  }, []);

  const loadItemsForEditing = useCallback(
    async (requestId) => {
      if (itemsMap[requestId]) {
        return itemsMap[requestId];
      }

      const res = await api.get(`/api/requests/${requestId}/items`);
      const normalizedItems = extractItems(res.data);
      setItemsMap((prev) => ({ ...prev, [requestId]: normalizedItems }));
      return normalizedItems;
    },
    [itemsMap],
  );

  const openEditRequest = async (request) => {
    if (!request?.id) return;
    setEditError('');

    try {
      const rawItems = await loadItemsForEditing(request.id);
      setEditForm({
        justification: request.justification || '',
        items: prepareEditableItems(rawItems),
      });
      setEditingRequest(request);
      setIsEditModalOpen(true);
      setExpandedId(request.id);
    } catch (err) {
      console.error('❌ Failed to prepare request for editing:', err);
      setEditError(te('loadError'));
    }
  };

  const handleEditItemChange = (index, field, value) => {
    setEditForm((prev) => {
      const updatedItems = [...prev.items];
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value,
      };
      return { ...prev, items: updatedItems };
    });
  };

  const handleAddEditItem = () => {
    setEditForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { item_name: '', brand: '', quantity: '', unit_cost: '', specs: '' },
      ],
    }));
  };

  const handleRemoveEditItem = (index) => {
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmitEdit = async (event) => {
    event?.preventDefault?.();
    if (!editingRequest) return;

    const sanitizedItems = editForm.items.map((item) => ({
      item_name: item.item_name?.trim(),
      brand: item.brand?.trim() || undefined,
      quantity: Number(item.quantity),
      unit_cost:
        item.unit_cost === '' || item.unit_cost === null || item.unit_cost === undefined
          ? null
          : Number(item.unit_cost),
      specs: item.specs?.trim() || undefined,
    }));

    if (sanitizedItems.length === 0) {
      setEditError(te('validationError'));
      return;
    }

    const hasInvalidItem = sanitizedItems.some(
      (item) => !item.item_name || !Number.isFinite(item.quantity) || item.quantity <= 0,
    );

    if (hasInvalidItem) {
      setEditError(te('validationError'));
      return;
    }

    setEditSubmitting(true);

    try {
      await updateRequest(editingRequest.id, {
        justification: editForm.justification,
        items: sanitizedItems,
      });

      const updatedAt = new Date().toISOString();
      setRequests((prev) =>
        prev.map((req) =>
          req.id === editingRequest.id
            ? { ...req, justification: editForm.justification, updated_at: updatedAt }
            : req,
        ),
      );

      setItemsMap((prev) => ({
        ...prev,
        [editingRequest.id]: sanitizedItems.map((item) => ({
          ...item,
          total_cost:
            item.unit_cost === null || item.unit_cost === undefined
              ? null
              : Number(item.unit_cost || 0) * Number(item.quantity || 0),
        })),
      }));

      resetEditState();
    } catch (err) {
      console.error('❌ Failed to update request:', err);
      const message =
        err?.response?.data?.error || te('error', { defaultValue: 'Failed to update request.' });
      setEditError(message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      [
        tr('table.id'),
        tr('table.type'),
        tr('table.project'),
        tr('table.status'),
        tr('table.assigned'),
        tr('table.updated'),
      ],
      ...sorted.map((req) => [
        req.id,
        req.request_type,
        req.project_name || tr('notAvailable'),
        req.status,
        req.assigned_user_name || tr('notAvailable'),
        formatDate(req.updated_at || req.created_at, normalizedLocale),
      ]),
    ];

    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${tr('csvFileName')}.csv`);
  };

  const handleStatusCardClick = (value) => {
    if (value === 'total') {
      return;
    }

    setStatusFilter((prev) => (prev === value ? 'all' : value));
  };

  const renderApprovalButtonText = (requestId) =>
    expandedApprovalsId === requestId
      ? translate('common.hideApprovals')
      : translate('common.viewApprovals');

  const focusRequestIdFromState = location.state?.focusRequestId;

  useEffect(() => {
    const queryRequestId = searchParams.get('requestId');
    const rawFocusId =
      focusRequestIdFromState != null && focusRequestIdFromState !== ''
        ? String(focusRequestIdFromState)
        : queryRequestId;

    if (!rawFocusId) {
      focusAppliedRef.current = false;
      lastFocusIdRef.current = null;
      return;
    }

    if (lastFocusIdRef.current !== rawFocusId) {
      focusAppliedRef.current = false;
      lastFocusIdRef.current = rawFocusId;
    }

    if (lastLocationKeyRef.current !== location.key) {
      focusAppliedRef.current = false;
      lastLocationKeyRef.current = location.key;
    }

    if (focusAppliedRef.current) {
      return;
    }

    const targetIndex = sorted.findIndex((req) => String(req.id) === rawFocusId);

    if (targetIndex === -1) {
      setFocusedRequestId(null);
      return;
    }

    const targetPage = Math.floor(targetIndex / ITEMS_PER_PAGE) + 1;

    if (currentPage !== targetPage) {
      setCurrentPage(targetPage);
      return;
    }

    const targetRequest = sorted[targetIndex];

    if (!targetRequest) {
      return;
    }

    focusAppliedRef.current = true;
    setFocusedRequestId(targetRequest.id);
    openRequestDetails(targetRequest.id);

    window.requestAnimationFrame(() => {
      const element = document.querySelector(
        `[data-request-id="${targetRequest.id}"]`
      );
      if (element?.scrollIntoView) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, [
    currentPage,
    focusRequestIdFromState,
    location.key,
    openRequestDetails,
    searchParams,
    sorted,
  ]);

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {tr('title')}
          </h1>
          <button
            type="button"
            onClick={exportCSV}
            disabled={sorted.length === 0}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {tr('exportCSV')}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statusCards.map(({ key, label, count, isTotal }) => {
            const isActive = !isTotal && statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleStatusCardClick(key)}
                disabled={isTotal}
                className={`group rounded-xl border p-4 text-start shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isTotal
                    ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 cursor-default'
                    : isActive
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                    : 'border-gray-200 bg-white hover:border-blue-400 dark:border-gray-700 dark:bg-gray-800'
                } ${isTotal ? '' : 'disabled:cursor-not-allowed'}`}
              >
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {count}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr('searchLabel')}
            </label>
            <input
              type="search"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              placeholder={tr('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="md:w-48">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr('filters.fromDate')}
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="md:w-48">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr('filters.toDate')}
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="md:w-48">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr('filters.type')}
            </label>
            <select
              className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
            >
              <option value="all">{tr('filters.allTypes')}</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type.toLowerCase()}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="md:w-48">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr('filters.status')}
            </label>
            <select
              className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">{tr('filters.allStatuses')}</option>
              {statusCards
                .filter(({ isTotal }) => !isTotal)
                .map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </div>
          <div className="md:w-48">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr('filters.sort')}
            </label>
            <select
              className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="newest">{tr('sort.newest')}</option>
              <option value="oldest">{tr('sort.oldest')}</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-400 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-300">{tr('loading')}</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-300">{tr('emptyState')}</p>
        ) : (
          <div className="space-y-4">
            <div className="hidden overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700 md:block">
              <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                      {tr('table.id')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                      {tr('table.type')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                      {tr('table.project')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                      {tr('table.status')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                      {tr('table.assigned')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                      {tr('table.submitted')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                      {tr('table.updated')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                      {tr('table.stage')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                      {tr('table.edit')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                      {tr('table.attachments', { defaultValue: 'Attachments' })}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                      {tr('table.items')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                      {tr('table.approvals')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginated.map((req) => {
                    const normalizedStatus = (req.status || '').toLowerCase();
                    const statusLabel = translate(`openRequests.statuses.${normalizedStatus}`, {
                      defaultValue:
                        normalizedStatus.length > 0
                          ? normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)
                          : tr('notAvailable'),
                    });
                    const attachments = attachmentsMap[req.id] || [];
                    const attachmentsLoading = Boolean(attachmentLoadingMap[req.id]);
                    const attachmentsError = attachmentErrorMap[req.id];
                    const attachmentsButtonLabel =
                      expandedAttachmentsId === req.id
                        ? tr('hideAttachments', { defaultValue: 'Hide Attachments' })
                        : tr('viewAttachments', { defaultValue: 'View Attachments' });

                    const canEdit = canEditRequest(req);

                    const isFocused = focusedRequestId === req.id;

                    return (
                      <React.Fragment key={req.id}>
                        <tr
                          className={`${
                            isFocused
                              ? 'bg-blue-50/70 transition-colors dark:bg-blue-950/30'
                              : 'bg-white transition-colors dark:bg-gray-900'
                          }`}
                          data-request-id={req.id}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                            #{req.id}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            {req.request_type || tr('notAvailable')}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            {req.project_name || tr('notAvailable')}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${mapStatusColor(
                                normalizedStatus
                              )}`}
                            >
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            {req.assigned_user_name || tr('notAvailable')}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            {formatDate(req.created_at, normalizedLocale)}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            {formatDate(req.updated_at, normalizedLocale)}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            {getCurrentStage(req)}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            <button
                              type="button"
                              onClick={() => openEditRequest(req)}
                              disabled={!canEdit || loadingId === req.id}
                              title={!canEdit ? te('lockedTooltip') : undefined}
                              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              {te('buttonLabel')}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            <button
                              type="button"
                              onClick={() => toggleAttachments(req.id)}
                              disabled={attachmentsLoading}
                              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              {attachmentsButtonLabel}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            <button
                              type="button"
                              onClick={() => toggleExpand(req.id)}
                              disabled={loadingId === req.id}
                              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              {expandedId === req.id ? tr('hideItems') : tr('showItems')}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            <button
                              type="button"
                              onClick={() => toggleApprovals(req.id)}
                              disabled={loadingApprovalsId === req.id}
                              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              {renderApprovalButtonText(req.id)}
                            </button>
                          </td>
                        </tr>
                        {expandedAttachmentsId === req.id && (
                          <tr>
                            <td colSpan={12} className="bg-gray-50 px-4 py-4 dark:bg-gray-800">
                              <RequestAttachmentsSection
                                attachments={attachments}
                                isLoading={attachmentsLoading}
                                error={attachmentsError}
                                onDownload={handleDownloadAttachment}
                                downloadingAttachmentId={downloadingAttachmentId}
                                onRetry={() => loadAttachmentsForRequest(req.id, { force: true })}
                                title={tr('attachmentsTitle', { defaultValue: 'Attachments' })}
                                emptyMessage={tr('attachmentsEmpty', { defaultValue: 'No attachments uploaded.' })}
                                loadingMessage={tr('attachmentsLoading', { defaultValue: 'Loading attachments…' })}
                              />
                            </td>
                          </tr>
                        )}
                        {expandedId === req.id && (
                          <tr>
                            <td colSpan={12} className="bg-gray-50 px-4 py-4 dark:bg-gray-800">
                              <h3 className="font-semibold mb-2">{tr('requestedItems')}</h3>
                              {itemsMap[req.id]?.length > 0 ? (
                                <table className="w-full text-sm border">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="border p-1">{tr('item')}</th>
                                      <th className="border p-1">{tr('brand')}</th>
                                      <th className="border p-1">{tr('qty')}</th>
                                      <th className="border p-1">{tr('purchasedQty')}</th>
                                      <th className="border p-1">{tr('itemStatus')}</th>
                                      <th className="border p-1">{tr('unitCost')}</th>
                                      <th className="border p-1">{tr('total')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {itemsMap[req.id].map((item, idx) => {
                                      const {
                                        statusKey,
                                        quantity: normalizedQuantity,
                                        purchasedQuantity,
                                      } = deriveItemPurchaseState(item);
                                      const statusLabel =
                                        tr(`itemStatusLabels.${statusKey}`) ?? tr('itemStatusLabels.notPurchased');

                                      return (
                                        <tr key={idx}>
                                          <td className="border p-1">{item.item_name}</td>
                                          <td className="border p-1">{item.brand || '—'}</td>
                                          <td className="border p-1">{normalizedQuantity ?? item.quantity ?? 0}</td>
                                          <td className="border p-1">{purchasedQuantity ?? 0}</td>
                                          <td className="border p-1">{statusLabel}</td>
                                          <td className="border p-1">{item.unit_cost}</td>
                                          <td className="border p-1">{item.total_cost}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-sm text-gray-500">{tr('noItemsForRequest')}</p>
                              )}
                            </td>
                          </tr>
                        )}
                        {expandedApprovalsId === req.id && (
                          <tr>
                            <td colSpan={12} className="bg-gray-50 px-4 py-4 dark:bg-gray-800">
                              <ApprovalTimeline
                                approvals={approvalsMap[req.id]}
                                isLoading={loadingApprovalsId === req.id}
                                labels={timelineLabels}
                                isUrgent={Boolean(req?.is_urgent)}
                                formatDate={(value) => formatDate(value, normalizedLocale)}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {paginated.map((req) => {
                const normalizedStatus = (req.status || '').toLowerCase();
                const statusLabel = translate(`openRequests.statuses.${normalizedStatus}`, {
                  defaultValue:
                    normalizedStatus.length > 0
                      ? normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)
                      : tr('notAvailable'),
                });
                const attachments = attachmentsMap[req.id] || [];
                const attachmentsLoading = Boolean(attachmentLoadingMap[req.id]);
                const attachmentsError = attachmentErrorMap[req.id];
                const attachmentsButtonLabel =
                  expandedAttachmentsId === req.id
                    ? tr('hideAttachments', { defaultValue: 'Hide Attachments' })
                    : tr('viewAttachments', { defaultValue: 'View Attachments' });

                const canEdit = canEditRequest(req);

                const isFocused = focusedRequestId === req.id;

                return (
                  <article
                    key={`card-${req.id}`}
                    data-request-id={req.id}
                    className={`rounded-lg border p-4 shadow-sm transition-colors ${
                      isFocused
                        ? 'border-blue-400 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/30'
                        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                    }`}
                  >
                    <header className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {tr('table.id')} #{req.id}
                        </p>
                        <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {req.request_type || tr('notAvailable')}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {tr('table.project')}: {req.project_name || tr('notAvailable')}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${mapStatusColor(
                          normalizedStatus
                        )}`}
                      >
                        {statusLabel}
                      </span>
                    </header>

                    <dl className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                      {req.assigned_user_name && (
                        <div className="flex justify-between gap-3">
                          <dt className="font-medium">{tr('table.assigned')}</dt>
                          <dd className="text-right">{req.assigned_user_name}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <dt className="font-medium">{tr('table.submitted')}</dt>
                        <dd className="text-right">{formatDate(req.created_at, normalizedLocale)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="font-medium">{tr('table.updated')}</dt>
                        <dd className="text-right">{formatDate(req.updated_at, normalizedLocale)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="font-medium">{tr('table.stage')}</dt>
                        <dd className="text-right">{getCurrentStage(req)}</dd>
                      </div>
                    </dl>

                    {req.justification && (
                      <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        <p className="font-medium">{tr('table.justification')}</p>
                        <p className="mt-1 whitespace-pre-line">{req.justification}</p>
                      </div>
                    )}

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => openEditRequest(req)}
                        disabled={!canEdit || loadingId === req.id}
                        title={!canEdit ? te('lockedTooltip') : undefined}
                        className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {te('buttonLabel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleExpand(req.id)}
                        disabled={loadingId === req.id}
                        className="ml-2 inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {expandedId === req.id ? tr('hideItems') : tr('showItems')}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAttachments(req.id)}
                        disabled={attachmentsLoading}
                        className="ml-2 inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {attachmentsButtonLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleApprovals(req.id)}
                        disabled={loadingApprovalsId === req.id}
                        className="ml-2 inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {renderApprovalButtonText(req.id)}
                      </button>
                    </div>

                    {expandedAttachmentsId === req.id && (
                      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                        <RequestAttachmentsSection
                          attachments={attachments}
                          isLoading={attachmentsLoading}
                          error={attachmentsError}
                          onDownload={handleDownloadAttachment}
                          downloadingAttachmentId={downloadingAttachmentId}
                          onRetry={() => loadAttachmentsForRequest(req.id, { force: true })}
                          title={tr('attachmentsTitle', { defaultValue: 'Attachments' })}
                          emptyMessage={tr('attachmentsEmpty', { defaultValue: 'No attachments uploaded.' })}
                          loadingMessage={tr('attachmentsLoading', { defaultValue: 'Loading attachments…' })}
                        />
                      </div>
                    )}

                    {expandedId === req.id && (
                      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                        <h3 className="font-semibold mb-2">{tr('requestedItems')}</h3>
                        {itemsMap[req.id]?.length > 0 ? (
                          <table className="w-full text-sm border">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border p-1">{tr('item')}</th>
                                <th className="border p-1">{tr('brand')}</th>
                                <th className="border p-1">{tr('qty')}</th>
                                <th className="border p-1">{tr('purchasedQty')}</th>
                                <th className="border p-1">{tr('itemStatus')}</th>
                                <th className="border p-1">{tr('unitCost')}</th>
                                <th className="border p-1">{tr('total')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itemsMap[req.id].map((item, idx) => {
                                const {
                                  statusKey,
                                  quantity: normalizedQuantity,
                                  purchasedQuantity,
                                } = deriveItemPurchaseState(item);
                                const statusLabel =
                                  tr(`itemStatusLabels.${statusKey}`) ?? tr('itemStatusLabels.notPurchased');

                                return (
                                  <tr key={idx}>
                                    <td className="border p-1">{item.item_name}</td>
                                    <td className="border p-1">{item.brand || '—'}</td>
                                    <td className="border p-1">{normalizedQuantity ?? item.quantity ?? 0}</td>
                                    <td className="border p-1">{purchasedQuantity ?? 0}</td>
                                    <td className="border p-1">{statusLabel}</td>
                                    <td className="border p-1">{item.unit_cost}</td>
                                    <td className="border p-1">{item.total_cost}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-sm text-gray-500">{tr('noItemsForRequest')}</p>
                        )}
                      </div>
                    )}
                    {expandedApprovalsId === req.id && (
                      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                        <ApprovalTimeline
                          approvals={approvalsMap[req.id]}
                          isLoading={loadingApprovalsId === req.id}
                          labels={timelineLabels}
                          isUrgent={Boolean(req?.is_urgent)}
                          formatDate={(value) => formatDate(value, normalizedLocale)}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300 md:flex-row">
              <span>{translate('common.pageOf', { current: currentPage, total: totalPages })}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {translate('common.prev')}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {translate('common.next')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {te('title')} {editingRequest?.id ? `#${editingRequest.id}` : ''}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {te('subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={resetEditState}
                className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-800"
                aria-label={te('closeLabel')}
              >
                ×
              </button>
            </div>

            {editError && (
              <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-200">
                {editError}
              </div>
            )}

            <form onSubmit={handleSubmitEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {te('justificationLabel')}
                </label>
                <textarea
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  rows={3}
                  value={editForm.justification}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, justification: e.target.value }))}
                  placeholder={te('justificationPlaceholder')}
                />
              </div>

              <div className="space-y-3">
                {editForm.items.map((item, idx) => (
                  <div
                    key={`edit-item-${idx}`}
                    className="rounded-md border border-gray-200 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {te('itemHeading', { index: idx + 1 })}
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleRemoveEditItem(idx)}
                        className="text-xs font-medium text-red-600 transition hover:text-red-700 disabled:opacity-50 dark:text-red-300 dark:hover:text-red-200"
                        disabled={editForm.items.length === 1}
                      >
                        {te('removeItem')}
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          {tr('item')}
                        </label>
                        <input
                          type="text"
                          value={item.item_name}
                          onChange={(e) => handleEditItemChange(idx, 'item_name', e.target.value)}
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          {tr('brand')}
                        </label>
                        <input
                          type="text"
                          value={item.brand}
                          onChange={(e) => handleEditItemChange(idx, 'brand', e.target.value)}
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          {te('quantityLabel')}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleEditItemChange(idx, 'quantity', e.target.value)}
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          {te('unitCostLabel')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.unit_cost}
                          onChange={(e) => handleEditItemChange(idx, 'unit_cost', e.target.value)}
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        {te('specsLabel')}
                      </label>
                      <textarea
                        rows={2}
                        value={item.specs}
                        onChange={(e) => handleEditItemChange(idx, 'specs', e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                        placeholder={te('specsPlaceholder')}
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddEditItem}
                  className="inline-flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {te('addItem')}
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetEditState}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {te('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {editSubmitting ? te('saving') : te('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default OpenRequestsPage;