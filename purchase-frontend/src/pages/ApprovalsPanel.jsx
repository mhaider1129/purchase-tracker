//src/pages/ApprovalsPanel.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  PackageCheck,
  RefreshCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import axios from '../api/axios';
import { Button } from '../components/ui/Button';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';
import { extractItems } from '../utils/itemUtils';

const STATUS_HIGHLIGHTS = {
  Approved: 'bg-green-50',
  Rejected: 'bg-red-50',
  Pending: '',
};

const FEEDBACK_TEXT_STYLES = {
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-slate-600',
};

const ApprovalsPanel = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [itemsMap, setItemsMap] = useState({});
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [selectedApprovalId, setSelectedApprovalId] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [selectedDecision, setSelectedDecision] = useState('');
  const [comments, setComments] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [itemDecisions, setItemDecisions] = useState({});
  const [savingItems, setSavingItems] = useState({});
  const [itemSummaries, setItemSummaries] = useState({});
  const [itemFeedback, setItemFeedback] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [sortOption, setSortOption] = useState('newest');
  const [attachmentsMap, setAttachmentsMap] = useState({});
  const [attachmentLoadingMap, setAttachmentLoadingMap] = useState({});
  const [attachmentErrorMap, setAttachmentErrorMap] = useState({});
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [estimatedCostError, setEstimatedCostError] = useState('');
  const [estimatedCostDrafts, setEstimatedCostDrafts] = useState({});

  const formatDateTime = useCallback((value) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString('en-GB', { hour12: false });
  }, []);

  const { user } = useCurrentUser();
  const canMarkUrgent = ['HOD', 'CMO', 'COO', 'WarehouseManager'].includes(user?.role);
  const normalizedUserId = useMemo(
    () => (user?.id != null ? String(user.id) : null),
    [user?.id],
  );

  const isItemLockedForUser = useCallback(
    (item) => {
      if (!item) return false;

      const status = String(item?.approval_status || 'Pending').toLowerCase();
      if (status !== 'rejected') {
        return false;
      }

      const approvedBy =
        item?.approved_by != null ? String(item.approved_by) : null;

      if (!approvedBy) {
        // If we do not know who rejected the item, treat it as locked so later approvers
        // cannot override it without visibility.
        return true;
      }

      return approvedBy !== (normalizedUserId ?? '');
    },
    [normalizedUserId],
  );

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/requests/pending-approvals');
      setRequests(res.data);
    } catch (err) {
      console.error('❌ Failed to fetch approvals:', err);
      setError('Failed to load pending approvals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  useEffect(() => {
    if (!Array.isArray(requests) || requests.length === 0) {
      return;
    }

    setEstimatedCostDrafts((prev) => {
      let updated = prev;
      requests.forEach((req) => {
        if (req?.request_id == null) return;
        if (Object.prototype.hasOwnProperty.call(prev, req.request_id)) return;

        const initial =
          req?.estimated_cost !== undefined && req?.estimated_cost !== null && req.estimated_cost !== ''
            ? String(req.estimated_cost)
            : '';

        if (initial === '' && prev[req.request_id] === '') {
          return;
        }

        if (updated === prev) {
          updated = { ...prev };
        }
        updated[req.request_id] = initial;
      });

      return updated;
    });
  }, [requests]);

  const fetchAttachmentsForRequest = useCallback(async (requestId) => {
    setAttachmentLoadingMap((prev) => ({ ...prev, [requestId]: true }));
    setAttachmentErrorMap((prev) => ({ ...prev, [requestId]: null }));

    try {
      const res = await axios.get(`/api/attachments/${requestId}`);
      const attachments = Array.isArray(res.data) ? res.data : [];
      setAttachmentsMap((prev) => ({ ...prev, [requestId]: attachments }));
    } catch (err) {
      console.error(`❌ Failed to fetch attachments for request ${requestId}:`, err);
      setAttachmentErrorMap((prev) => ({
        ...prev,
        [requestId]: 'Failed to load attachments.',
      }));
      setAttachmentsMap((prev) => ({ ...prev, [requestId]: [] }));
    } finally {
      setAttachmentLoadingMap((prev) => ({ ...prev, [requestId]: false }));
    }
  }, []);

  const getItemSummaryFromItems = useCallback((items) => {
    const summary = { approved: 0, rejected: 0, pending: 0 };
    if (!Array.isArray(items)) {
      return summary;
    }

    items.forEach((item) => {
      const normalized = String(item?.approval_status || 'Pending').toLowerCase();
      if (normalized === 'approved') {
        summary.approved += 1;
      } else if (normalized === 'rejected') {
        summary.rejected += 1;
      } else {
        summary.pending += 1;
      }
    });

    return summary;
  }, []);

  const toggleExpand = async (requestId) => {
    const isSameRequest = expandedId === requestId;
    const nextExpandedId = isSameRequest ? null : requestId;
    setExpandedId(nextExpandedId);

    if (isSameRequest) {
      return;
    }
    if (!itemsMap[requestId]) {
      try {
        const res = await axios.get(`/api/requests/${requestId}/items`);
        const fetchedItems = extractItems(res.data);
        setItemsMap((prev) => ({ ...prev, [requestId]: fetchedItems }));
        setItemDecisions((prev) => ({
          ...prev,
          [requestId]: fetchedItems.reduce((acc, item) => {
            if (!item?.id) return acc;
            acc[item.id] = {
              status: item.approval_status || 'Pending',
              comments: item.approval_comments || '',
            };
            return acc;
          }, {}),
        }));
        setItemSummaries((prev) => ({
          ...prev,
          [requestId]: getItemSummaryFromItems(fetchedItems),
        }));
      } catch (err) {
        console.error('❌ Failed to load items:', err);
      }
    }

    if (
      !Object.prototype.hasOwnProperty.call(attachmentsMap, requestId) ||
      attachmentErrorMap[requestId]
    ) {
      fetchAttachmentsForRequest(requestId);
    }
  };

  const handleItemStatusChange = (requestId, itemId, status) => {
    const currentItems = itemsMap[requestId] || [];
    const targetItem = currentItems.find((it) => it.id === itemId);

    if (targetItem && isItemLockedForUser(targetItem)) {
      setItemFeedback((prev) => ({
        ...prev,
        [requestId]: {
          type: 'warning',
          message: 'Items rejected by a previous approver cannot be changed.',
        },
      }));
      return;
    }

    setItemDecisions((prev) => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || {}),
        [itemId]: {
          status,
          comments: prev[requestId]?.[itemId]?.comments || '',
        },
      },
    }));
  };

  const handleDownloadAttachment = useCallback(async (attachment) => {
    const storedPath = attachment?.file_path || '';
    const filename = storedPath.split(/[\\/]/).pop();
    const downloadEndpoint =
      attachment?.download_url || (filename ? `/api/attachments/download/${encodeURIComponent(filename)}` : null);

    if (!downloadEndpoint) {
      alert('Attachment file is missing.');
      return;
    }

    setDownloadingAttachmentId(attachment.id);
    try {
      const response = await axios.get(downloadEndpoint, {
        responseType: 'blob',
        baseURL: '',
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
      console.error(`❌ Error downloading attachment ${attachment?.id}:`, err);
      alert('Failed to download attachment. Please try again.');
    } finally {
      setDownloadingAttachmentId(null);
    }
  }, []);

  const handleItemCommentChange = (requestId, itemId, commentsValue) => {
    const currentItems = itemsMap[requestId] || [];
    const targetItem = currentItems.find((it) => it.id === itemId);

    if (targetItem && isItemLockedForUser(targetItem)) {
      setItemFeedback((prev) => ({
        ...prev,
        [requestId]: {
          type: 'warning',
          message: 'Items rejected by a previous approver cannot be changed.',
        },
      }));
      return;
    }

    setItemDecisions((prev) => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || {}),
        [itemId]: {
          status: prev[requestId]?.[itemId]?.status || 'Pending',
          comments: commentsValue,
        },
      },
    }));
  };
  const saveItemDecisions = async (requestId, approvalId) => {
    const decisionsForRequest = itemDecisions[requestId] || {};
    const payloadItems = Object.entries(decisionsForRequest)
      .map(([itemId, decision]) => ({
        item_id: Number(itemId),
        status: decision?.status || 'Pending',
        comments: decision?.comments || '',
      }))
      .filter((item) => !Number.isNaN(item.item_id));

    if (payloadItems.length === 0) {
      setItemFeedback((prev) => ({
        ...prev,
        [requestId]: {
          type: 'warning',
          message: 'Please record at least one item decision before saving.',
        },
      }));
      return;
    }

    setSavingItems((prev) => ({ ...prev, [requestId]: true }));

    try {
      const res = await axios.patch(`/api/approvals/${approvalId}/items`, { items: payloadItems });
      const currentItems = itemsMap[requestId] || [];
      let mergedItems = currentItems;

      if (Array.isArray(res.data?.updatedItems)) {
        const updatedItemMap = res.data.updatedItems.reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});

        mergedItems = currentItems.map((item) => {
          const updated = updatedItemMap[item.id];
          if (!updated) return item;
          return {
            ...item,
            approval_status: updated.approval_status,
            approval_comments: updated.approval_comments,
            approved_at: updated.approved_at,
            approved_by: updated.approved_by,
          };
        });

        setItemsMap((prev) => ({
          ...prev,
          [requestId]: mergedItems,
        }));

        setItemDecisions((prev) => {
          const existing = { ...(prev[requestId] || {}) };
          res.data.updatedItems.forEach((item) => {
            existing[item.id] = {
              status: item.approval_status || 'Pending',
              comments: item.approval_comments || '',
            };
          });

          return { ...prev, [requestId]: existing };
        });
      }

      const summary = res.data?.summary || getItemSummaryFromItems(mergedItems);
      setItemSummaries((prev) => ({
        ...prev,
        [requestId]: summary,
      }));

      const lockedFromResponse = Array.isArray(res.data?.lockedItems)
        ? res.data.lockedItems
        : [];

      if (lockedFromResponse.length > 0) {
        const lockedIds = new Set(lockedFromResponse.map((item) => item.id));

        setItemDecisions((prev) => {
          const existing = { ...(prev[requestId] || {}) };
          currentItems.forEach((item) => {
            if (lockedIds.has(item.id)) {
              existing[item.id] = {
                status: item.approval_status || 'Pending',
                comments: item.approval_comments || '',
              };
            }
          });
          return { ...prev, [requestId]: existing };
        });

        const baseSummaryMessage = ` Current totals — Approved: ${summary.approved}, Rejected: ${summary.rejected}, Pending: ${summary.pending}.`;
        const lockedMessage =
          lockedFromResponse.length === 1
            ? '1 item was rejected by a previous approver and could not be updated.'
            : `${lockedFromResponse.length} items were rejected by previous approvers and could not be updated.`;

        setItemFeedback((prev) => ({
          ...prev,
          [requestId]: {
            type: 'warning',
            message: `${lockedMessage}${baseSummaryMessage}`,
          },
        }));
      } else {
        setItemFeedback((prev) => ({
          ...prev,
          [requestId]: {
            type: 'success',
            message: `Item decisions saved. Approved: ${summary.approved}, Rejected: ${summary.rejected}, Pending: ${summary.pending}.`,
          },
        }));
      }
    } catch (err) {
      console.error('❌ Failed to save item decisions:', err);
      setItemFeedback((prev) => ({
        ...prev,
        [requestId]: {
          type: 'error',
          message: 'Failed to save item decisions. Please try again.',
        },
      }));
    } finally {
      setSavingItems((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const submitDecision = async () => {
    if (user?.role === 'SCM') {
      const trimmedCost = estimatedCost.trim();
      if (trimmedCost !== '') {
        const normalized = Number(trimmedCost.replace(/,/g, ''));
        if (Number.isNaN(normalized) || normalized <= 0) {
          setEstimatedCostError('Enter a positive number for the estimated cost or leave it blank.');
          return;
        }
      }
      setEstimatedCostError('');
    }

    const confirmed = window.confirm(
      `Are you sure you want to ${selectedDecision.toLowerCase()} Request #${selectedRequestId}?`
    );
    if (!confirmed) return;

    try {
      const payload = {
        status: selectedDecision,
        comments,
        is_urgent: canMarkUrgent ? isUrgent : false,
      };

      if (user?.role === 'SCM') {
        const trimmedCost = estimatedCost.trim();
        if (trimmedCost !== '') {
          const normalized = Number(trimmedCost.replace(/,/g, ''));
          payload.estimated_cost = Number.isNaN(normalized) ? undefined : normalized;
        }
      }

      await axios.put(`/api/requests/approval/${selectedApprovalId}`, {
        ...payload,
      });

      setRequests((prev) => prev.filter((r) => r.approval_id !== selectedApprovalId));
      if (selectedRequestId != null) {
        setEstimatedCostDrafts((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, selectedRequestId)) {
            return prev;
          }
          const next = { ...prev };
          delete next[selectedRequestId];
          return next;
        });
      }
      resetCommentModal();
    } catch (err) {
      console.error('❌ Action failed:', err);
      alert('Failed to process your decision. Please try again.');
    }
  };

  const reassignToDepartmentRequester = async (requestId, approvalId) => {
    const confirmed = window.confirm(
      `Assign Maintenance Request #${requestId} to a designated requester in your department?`
    );
    if (!confirmed) return;

    try {
      await axios.put(`/api/requests/maintenance/reassign-to-requester`, {
        request_id: requestId,
        approval_id: approvalId,
      });

      alert(`✅ Request #${requestId} has been reassigned to a department requester.`);
      fetchApprovals();
    } catch (err) {
      console.error('❌ Reassignment failed:', err);
      alert('Failed to assign request to department requester.');
    }
  };

  const openCommentModal = (approvalId, requestId, decision) => {
    setSelectedApprovalId(approvalId);
    setSelectedRequestId(requestId);
    setSelectedDecision(decision);
    setComments('');
    const request = requests.find((r) => r.approval_id === approvalId);
    setIsUrgent(Boolean(request?.is_urgent));
    const draftCost = estimatedCostDrafts[requestId];
    if (draftCost !== undefined) {
      setEstimatedCost(draftCost);
    } else {
      if (request?.estimated_cost != null && request.estimated_cost !== '') {
        setEstimatedCost(String(request.estimated_cost));
      } else {
        setEstimatedCost('');
      }
    }
    setEstimatedCostError('');
    setShowCommentBox(true);
  };

  const resetCommentModal = () => {
    setShowCommentBox(false);
    setSelectedApprovalId(null);
    setSelectedRequestId(null);
    setSelectedDecision('');
    setComments('');
    setIsUrgent(false);
    setEstimatedCost('');
    setEstimatedCostError('');
  };

  const handleEstimatedCostDraftChange = (requestId, value) => {
    setEstimatedCostDrafts((prev) => ({
      ...prev,
      [requestId]: value,
    }));

    if (requestId === selectedRequestId) {
      setEstimatedCost(value);
    }
  };

  const handleModalEstimatedCostChange = (value) => {
    setEstimatedCost(value);
    if (selectedRequestId != null) {
      setEstimatedCostDrafts((prev) => ({
        ...prev,
        [selectedRequestId]: value,
      }));
    }
  };

  const getCostLabel = (cost) => {
    if (cost > 100_000_000) return { label: '⬤ Very High Cost', color: 'bg-red-600' };
    if (cost > 50_000_000) return { label: '⬤ High Cost', color: 'bg-orange-500' };
    if (cost > 10_000_000) return { label: '⬤ Medium Cost', color: 'bg-yellow-400' };
    return { label: '⬤ Low Cost', color: 'bg-green-500' };
  };

  const summary = useMemo(() => {
    if (!Array.isArray(requests) || requests.length === 0) {
      return {
        total: 0,
        urgent: 0,
        estimatedTotal: 0,
        byType: {},
      };
    }

    return requests.reduce(
      (acc, req) => {
        acc.total += 1;
        if (req?.is_urgent) acc.urgent += 1;

        const estimated = Number(req?.estimated_cost) || 0;
        acc.estimatedTotal += estimated;

        if (req?.request_type) {
          const typeKey = req.request_type;
          acc.byType[typeKey] = (acc.byType[typeKey] || 0) + 1;
        }

        return acc;
      },
      { total: 0, urgent: 0, estimatedTotal: 0, byType: {} },
    );
  }, [requests]);

  const availableRequestTypes = useMemo(() => {
    const typeSet = new Set();
    requests.forEach((req) => {
      if (req?.request_type) typeSet.add(req.request_type);
    });
    return Array.from(typeSet).sort();
  }, [requests]);

  const getDateSortableValue = (request) => {
    const sourceDate =
      request?.updated_at ||
      request?.submitted_at ||
      request?.created_at ||
      request?.requested_at ||
      request?.request_date;
    if (!sourceDate) return 0;
    const parsed = new Date(sourceDate).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const filteredRequests = useMemo(() => {
    let result = Array.isArray(requests) ? [...requests] : [];

    if (searchTerm.trim()) {
      const lowered = searchTerm.trim().toLowerCase();
      result = result.filter((req) => {
        const idMatch = String(req?.request_id || '')
          .toLowerCase()
          .includes(lowered);
        const justificationMatch = (req?.justification || '')
          .toLowerCase()
          .includes(lowered);
        const departmentMatch = (req?.department_name || '')
          .toLowerCase()
          .includes(lowered);
        const sectionMatch = (req?.section_name || '')
          .toLowerCase()
          .includes(lowered);

        return idMatch || justificationMatch || departmentMatch || sectionMatch;
      });
    }

    if (typeFilter !== 'all') {
      result = result.filter((req) => req?.request_type === typeFilter);
    }

    if (urgencyFilter === 'urgent') {
      result = result.filter((req) => req?.is_urgent);
    } else if (urgencyFilter === 'non-urgent') {
      result = result.filter((req) => !req?.is_urgent);
    }

    const sorter = {
      newest: (a, b) => getDateSortableValue(b) - getDateSortableValue(a),
      oldest: (a, b) => getDateSortableValue(a) - getDateSortableValue(b),
      costHigh: (a, b) => (Number(b?.estimated_cost) || 0) - (Number(a?.estimated_cost) || 0),
      costLow: (a, b) => (Number(a?.estimated_cost) || 0) - (Number(b?.estimated_cost) || 0),
    };

    const sortFn = sorter[sortOption] || sorter.newest;
    result.sort(sortFn);

    const urgentRequests = [];
    const nonUrgentRequests = [];

    result.forEach((req) => {
      if (req?.is_urgent) {
        urgentRequests.push(req);
      } else {
        nonUrgentRequests.push(req);
      }
    });

    return [...urgentRequests, ...nonUrgentRequests];
  }, [requests, searchTerm, typeFilter, urgencyFilter, sortOption]);

  const hasActiveFilters = useMemo(() => {
    return (
      Boolean(searchTerm.trim()) ||
      typeFilter !== 'all' ||
      urgencyFilter !== 'all' ||
      sortOption !== 'newest'
    );
  }, [searchTerm, typeFilter, urgencyFilter, sortOption]);

  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setUrgencyFilter('all');
    setSortOption('newest');
  };

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Pending Approvals</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Review and process all outstanding approval requests from your departments.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchApprovals} variant="secondary" aria-label="Refresh approvals list">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-600" aria-hidden />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4 text-slate-600" aria-hidden />
              )}
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Pending</p>
                <p className="text-2xl font-semibold text-slate-900">{summary.total}</p>
              </div>
              <PackageCheck className="h-8 w-8 text-blue-600" aria-hidden />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Marked Urgent</p>
                <p className="text-2xl font-semibold text-slate-900">{summary.urgent}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" aria-hidden />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Estimated Value</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {summary.estimatedTotal.toLocaleString()} IQD
                </p>
              </div>
              <FileText className="h-8 w-8 text-purple-500" aria-hidden />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Requests by Type</p>
                {Object.keys(summary.byType).length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">No type data</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {Object.entries(summary.byType).map(([type, count]) => (
                      <li key={type} className="flex items-center justify-between">
                        <span>{type}</span>
                        <span className="font-semibold text-slate-900">{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Building2 className="h-8 w-8 text-emerald-600" aria-hidden />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-500" aria-hidden />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by ID, justification, department or section"
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-3 xl:grid-cols-4">
              <label className="flex flex-col text-sm text-slate-600">
                <span className="mb-1 flex items-center gap-1 font-medium">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                  Request Type
                </span>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All types</option>
                  {availableRequestTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm text-slate-600">
                <span className="mb-1 flex items-center gap-1 font-medium">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                  Urgency
                </span>
                <select
                  value={urgencyFilter}
                  onChange={(event) => setUrgencyFilter(event.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="urgent">Urgent only</option>
                  <option value="non-urgent">Non-urgent</option>
                </select>
              </label>
              <label className="flex flex-col text-sm text-slate-600">
                <span className="mb-1 flex items-center gap-1 font-medium">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                  Sort by
                </span>
                <select
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="costHigh">Cost: high to low</option>
                  <option value="costLow">Cost: low to high</option>
                </select>
              </label>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={clearFilters}>
                Reset filters
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-16">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-blue-600" aria-hidden />
              <span className="text-sm text-slate-600">Loading approvals...</span>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
          ) : requests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              No pending approvals.
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              <p>No pending approvals match the selected filters.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-blue-600 underline"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {filteredRequests.map((req) => {
                  const estimatedCostValue = Number(req.estimated_cost) || 0;
                  const tag = getCostLabel(estimatedCostValue);
                  const canEditItems = req.request_type !== 'Warehouse Supply';
                  const requestSummary = itemSummaries[req.request_id];
                  const feedback = itemFeedback[req.request_id];
                  const attachments = attachmentsMap[req.request_id] || [];
                  const attachmentsLoading = attachmentLoadingMap[req.request_id];
                  const attachmentsError = attachmentErrorMap[req.request_id];
                  const isUrgentRequest = Boolean(req.is_urgent);
                  const isExpanded = expandedId === req.request_id;

                  return (
                    <div key={req.approval_id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => toggleExpand(req.request_id)}
                        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <div className="flex flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                            <span>Request #</span>
                            <span className="font-semibold text-slate-800">{req.request_id}</span>
                            {req.request_type && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                                {req.request_type}
                              </span>
                            )}
                            {isUrgentRequest && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-base font-semibold text-slate-900">
                            {req.justification || 'No justification provided.'}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                            <p>
                              <strong>Department:</strong> {req.department_name || '—'}
                            </p>
                            {req.requester_name && (
                              <p>
                                <strong>Requester:</strong> {req.requester_name}
                                {req.requester_role && ` (${req.requester_role})`}
                              </p>
                            )}
                            <span>Submitted: {formatDateTime(req.created_at || req.request_date)}</span>
                            <span>Estimated Cost: {estimatedCostValue.toLocaleString()} IQD</span>
                            <span className="inline-flex items-center gap-1">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white ${tag.color}`}>
                                {tag.label}
                              </span>
                            </span>
                          </div>
                          {req.updated_by && (
                            <p className="text-xs text-slate-500">
                              Last updated by <span className="font-medium text-slate-700">{req.updated_by}</span> on {formatDateTime(req.updated_at)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center text-slate-500">
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5" aria-hidden />
                          ) : (
                            <ChevronDown className="h-5 w-5" aria-hidden />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-100 px-5 py-4">
                          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                            <div className="space-y-4">
                              {user?.role === 'SCM' && (
                                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                                  <label
                                    htmlFor={`scm-estimated-cost-${req.request_id}`}
                                    className="block text-sm font-medium text-blue-900"
                                  >
                                    Update Estimated Cost (IQD)
                                  </label>
                                  <input
                                    id={`scm-estimated-cost-${req.request_id}`}
                                    type="text"
                                    inputMode="decimal"
                                    className="mt-1 w-full rounded border border-blue-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    placeholder="Add an estimated total before approving"
                                    value={estimatedCostDrafts[req.request_id] ?? ''}
                                    onChange={(event) => handleEstimatedCostDraftChange(req.request_id, event.target.value)}
                                  />
                                  <p className="mt-1 text-xs text-blue-800">
                                    This amount will be confirmed when you approve or reject the request. Leave blank to keep the existing value.
                                  </p>
                                </div>
                              )}

                              <div>
                                <h4 className="text-sm font-semibold text-slate-800">Attachments</h4>
                                {attachmentsLoading ? (
                                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden />
                                    <span>Loading attachments…</span>
                                  </div>
                                ) : attachmentsError ? (
                                  <p className="mt-2 text-sm text-red-600">{attachmentsError}</p>
                                ) : attachments.length === 0 ? (
                                  <p className="mt-2 text-sm text-slate-500">No attachments uploaded.</p>
                                ) : (
                                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                                    {attachments.map((att) => {
                                      const filename = att.file_name || (att.file_path || '').split(/[\\/]/).pop();
                                      const viewUrl = att.file_url || null;
                                      return (
                                        <li key={att.id} className="flex flex-wrap items-center gap-3">
                                          <span className="break-all">{filename}</span>
                                          {viewUrl && (
                                            <a
                                              href={viewUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 underline hover:text-blue-800"
                                            >
                                              View
                                            </a>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handleDownloadAttachment(att)}
                                            className="text-blue-600 underline hover:text-blue-800 disabled:opacity-50"
                                            disabled={downloadingAttachmentId === att.id}
                                          >
                                            {downloadingAttachmentId === att.id ? 'Downloading…' : 'Download'}
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold text-slate-800">Requested Items</h4>
                                {itemsMap[req.request_id]?.length > 0 ? (
                                  <div className="mt-2 space-y-3">
                                    {requestSummary && (
                                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                                          Approved: {requestSummary.approved}
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                                          Rejected: {requestSummary.rejected}
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                                          Pending: {requestSummary.pending}
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
                                            <th className="px-3 py-2 text-left font-medium text-slate-600">Qty</th>
                                            <th className="px-3 py-2 text-left font-medium text-slate-600">Available Qty</th>
                                            <th className="px-3 py-2 text-left font-medium text-slate-600">Unit Cost</th>
                                            <th className="px-3 py-2 text-left font-medium text-slate-600">Total</th>
                                            <th className="px-3 py-2 text-left font-medium text-slate-600">Decision</th>
                                            <th className="px-3 py-2 text-left font-medium text-slate-600">Comments</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {itemsMap[req.request_id].map((item) => {
                                            const decision = itemDecisions[req.request_id]?.[item.id] || {
                                              status: item.approval_status || 'Pending',
                                              comments: item.approval_comments || '',
                                            };
                                            const normalizedStatus = typeof decision.status === 'string'
                                              ? `${decision.status.charAt(0).toUpperCase()}${decision.status.slice(1).toLowerCase()}`
                                              : 'Pending';
                                            const rowHighlight = STATUS_HIGHLIGHTS[normalizedStatus] || '';
                                            const decisionLocked = canEditItems && isItemLockedForUser(item);

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
                                                <td className="px-3 py-3 text-slate-600">{item.quantity}</td>
                                                <td className="px-3 py-3 text-slate-600">{item.available_quantity ?? '—'}</td>
                                                <td className="px-3 py-3 text-slate-600">{item.unit_cost}</td>
                                                <td className="px-3 py-3 text-slate-600">{item.total_cost}</td>
                                                <td className="px-3 py-3 text-slate-600">
                                                  {canEditItems ? (
                                                    <select
                                                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                      value={decision.status || 'Pending'}
                                                      onChange={(event) =>
                                                        handleItemStatusChange(req.request_id, item.id, event.target.value)
                                                      }
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
                                                  {canEditItems ? (
                                                    <textarea
                                                      className="mt-0 w-full rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                      rows={3}
                                                      placeholder="Optional comments"
                                                      value={decision.comments || ''}
                                                      onChange={(event) =>
                                                        handleItemCommentChange(req.request_id, item.id, event.target.value)
                                                      }
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
                                    {canEditItems && (
                                      <div className="flex justify-end">
                                        <Button
                                          variant="secondary"
                                          onClick={() => saveItemDecisions(req.request_id, req.approval_id)}
                                          isLoading={!!savingItems[req.request_id]}
                                        >
                                          Save Item Decisions
                                        </Button>
                                      </div>
                                    )}
                                    {feedback?.message && (
                                      <p
                                        className={`text-sm ${
                                          FEEDBACK_TEXT_STYLES[feedback.type] || FEEDBACK_TEXT_STYLES.info
                                        }`}
                                      >
                                        {feedback.message}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-sm text-slate-500">No items found for this request.</p>
                                )}
                              </div>
                            </div>

                            <div className="space-y-4">
                              {isUrgentRequest && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                                  Requires immediate attention
                                </div>
                              )}
                              <div className="space-y-3">
                                {req.request_type === 'Maintenance' && req.approval_level === 1 ? (
                                  <Button onClick={() => reassignToDepartmentRequester(req.request_id, req.approval_id)}>
                                    Assign to Department Requester
                                  </Button>
                                ) : (
                                  <>
                                    <Button onClick={() => openCommentModal(req.approval_id, req.request_id, 'Approved')}>
                                      Approve
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => openCommentModal(req.approval_id, req.request_id, 'Rejected')}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {showCommentBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">
              {selectedDecision === 'Approved' ? 'Approve' : 'Reject'} Request #{selectedRequestId}
            </h2>
            <textarea
              className="mt-3 h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter optional comments..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
            {user?.role === 'SCM' && (
              <div className="mt-3">
                <label htmlFor="estimated-cost" className="block text-sm font-medium text-slate-700">
                  Estimated Cost (IQD)
                </label>
                <input
                  id="estimated-cost"
                  type="text"
                  inputMode="decimal"
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    estimatedCostError ? 'border-red-500' : 'border-slate-300'
                  }`}
                  placeholder="Enter a number or leave blank"
                  value={estimatedCost}
                  onChange={(e) => handleModalEstimatedCostChange(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Provide an updated estimate so downstream approvers can see the projected cost. Leave blank to keep the current
                  value.
                </p>
                {estimatedCostError && (
                  <p className="mt-1 text-xs text-red-600">{estimatedCostError}</p>
                )}
              </div>
            )}
            {canMarkUrgent && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="urgent"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="urgent" className="text-sm font-medium">
                  Mark this request as <span className="font-semibold text-red-600">Urgent</span>
                </label>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <Button onClick={submitDecision}>Submit</Button>
              <Button variant="ghost" onClick={resetCommentModal}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ApprovalsPanel;