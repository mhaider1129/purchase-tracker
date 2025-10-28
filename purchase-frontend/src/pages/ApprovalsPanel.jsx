//src/pages/ApprovalsPanel.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from '../api/axios';
import { Button } from '../components/ui/Button';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';

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

  const { user } = useCurrentUser();
  const canMarkUrgent = ['HOD', 'CMO', 'COO', 'WarehouseManager'].includes(user?.role);

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
        const fetchedItems = Array.isArray(res.data?.items) ? res.data.items : [];
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

      setItemFeedback((prev) => ({
        ...prev,
        [requestId]: {
          type: 'success',
          message: `Item decisions saved. Approved: ${summary.approved}, Rejected: ${summary.rejected}, Pending: ${summary.pending}.`,
        },
      }));
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
    const confirmed = window.confirm(
      `Are you sure you want to ${selectedDecision.toLowerCase()} Request #${selectedRequestId}?`
    );
    if (!confirmed) return;

    try {
      await axios.put(`/api/requests/approval/${selectedApprovalId}`, {
        status: selectedDecision,
        comments,
        is_urgent: canMarkUrgent ? isUrgent : false,
      });

      setRequests((prev) => prev.filter((r) => r.approval_id !== selectedApprovalId));
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
    setIsUrgent(false);
    setShowCommentBox(true);
  };

  const resetCommentModal = () => {
    setShowCommentBox(false);
    setSelectedApprovalId(null);
    setSelectedRequestId(null);
    setSelectedDecision('');
    setComments('');
    setIsUrgent(false);
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

    return result;
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

  if (loading) return <div className="p-6">Loading approvals...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div>
      <Navbar />
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Pending Approvals</h1>

        {requests.length === 0 ? (
          <p>No pending approvals.</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
              <div className="bg-white border rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500">Total Pending</p>
                <p className="text-2xl font-semibold">{summary.total}</p>
              </div>
              <div className="bg-white border rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500">Marked Urgent</p>
                <p className="text-2xl font-semibold text-red-600">{summary.urgent}</p>
              </div>
              <div className="bg-white border rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500">Total Estimated Value</p>
                <p className="text-2xl font-semibold">
                  {summary.estimatedTotal.toLocaleString()} IQD
                </p>
              </div>
              <div className="bg-white border rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500">Requests by Type</p>
                {Object.keys(summary.byType).length === 0 ? (
                  <p className="text-sm text-gray-600 mt-1">No type data</p>
                ) : (
                  <ul className="text-sm text-gray-700 space-y-1 mt-1">
                    {Object.entries(summary.byType).map(([type, count]) => (
                      <li key={type} className="flex justify-between">
                        <span>{type}</span>
                        <span className="font-medium">{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="bg-white border rounded-lg p-4 shadow-sm mb-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-600 mb-1" htmlFor="approval-search">
                    Search
                  </label>
                  <input
                    id="approval-search"
                    type="search"
                    className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-200"
                    placeholder="Search by ID, justification, department or section"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-600 mb-1" htmlFor="approval-type-filter">
                    Request Type
                  </label>
                  <select
                    id="approval-type-filter"
                    className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-200"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="all">All types</option>
                    {availableRequestTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-600 mb-1" htmlFor="approval-urgency-filter">
                    Urgency
                  </label>
                  <select
                    id="approval-urgency-filter"
                    className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-200"
                    value={urgencyFilter}
                    onChange={(e) => setUrgencyFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="urgent">Urgent only</option>
                    <option value="non-urgent">Non-urgent</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-600 mb-1" htmlFor="approval-sort">
                    Sort by
                  </label>
                  <select
                    id="approval-sort"
                    className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-200"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="costHigh">Cost: high to low</option>
                    <option value="costLow">Cost: low to high</option>
                  </select>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex justify-end mt-4">
                  <Button variant="secondary" onClick={clearFilters}>
                    Reset filters
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {filteredRequests.length === 0 ? (
                <div className="border rounded-lg p-6 text-center text-gray-500">
                  <p>No pending approvals match the selected filters.</p>
                  {hasActiveFilters && (
                    <button
                      className="mt-2 text-blue-600 underline text-sm"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const estimatedCostValue = Number(req.estimated_cost) || 0;
                  const tag = getCostLabel(estimatedCostValue);
                  const canEditItems = req.request_type !== 'Warehouse Supply';
                  const requestSummary = itemSummaries[req.request_id];
                  const feedback = itemFeedback[req.request_id];
                  const attachments = attachmentsMap[req.request_id] || [];
                  const attachmentsLoading = attachmentLoadingMap[req.request_id];
                  const attachmentsError = attachmentErrorMap[req.request_id];

                  return (
                    <div key={req.approval_id} className="border rounded-lg p-4 shadow-sm">
                      <p>
                        <strong>Request ID:</strong> {req.request_id}
                      </p>
                      <p>
                        <strong>Type:</strong> {req.request_type}
                      </p>
                      <p>
                        <strong>Justification:</strong> {req.justification}
                      </p>
                      <p>
                        <strong>Department:</strong> {req.department_name || '—'}
                      </p>
                      <p>
                        <strong>Section:</strong> {req.section_name || '—'}
                      </p>
                      <p>
                        <strong>Estimated Cost:</strong> {estimatedCostValue.toLocaleString()} IQD
                      </p>
                      <p className={`inline-block mt-1 text-xs text-white px-2 py-1 rounded ${tag.color}`}>
                        {tag.label}
                      </p>

                      {req.is_urgent && (
                        <span className="inline-block ml-2 text-xs text-white px-2 py-1 rounded bg-red-600 font-bold">
                          Urgent
                        </span>
                      )}

                      {req.updated_by && (
                        <p className="text-sm text-gray-500 mt-2">
                          Last Updated by <strong>{req.updated_by}</strong> on{' '}
                          {req.updated_at ? new Date(req.updated_at).toLocaleString('en-GB') : '—'}
                        </p>
                      )}

                      <button
                        className="text-blue-600 underline text-sm mt-2"
                        onClick={() => toggleExpand(req.request_id)}
                      >
                        {expandedId === req.request_id ? 'Hide Items' : 'Show Requested Items'}
                      </button>

                      {expandedId === req.request_id && (
                        <div className="mt-3">
                          <div className="mb-4">
                            <h4 className="font-semibold text-sm text-slate-800">Attachments</h4>
                            {attachmentsLoading ? (
                              <p className="text-sm text-gray-500 mt-1">Loading attachments...</p>
                            ) : attachmentsError ? (
                              <p className="text-sm text-red-600 mt-1">{attachmentsError}</p>
                            ) : attachments.length === 0 ? (
                              <p className="text-sm text-gray-500 mt-1">No attachments uploaded.</p>
                            ) : (
                              <ul className="mt-1 space-y-1 text-sm text-slate-700">
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
                          {itemsMap[req.request_id]?.length > 0 ? (
                            <>
                              {requestSummary && (
                                <div className="mb-3 flex flex-wrap gap-2 text-xs">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                                    Approved: {requestSummary.approved}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 font-medium text-red-600">
                                    Rejected: {requestSummary.rejected}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                                    Pending: {requestSummary.pending}
                                  </span>
                                </div>
                              )}
                              <table className="w-full text-sm border">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border p-1">Item</th>
                                    <th className="border p-1">Brand</th>
                                    <th className="border p-1">Specs</th>
                                    <th className="border p-1">Qty</th>
                                    <th className="border p-1">Available Qty</th>
                                    <th className="border p-1">Unit Cost</th>
                                    <th className="border p-1">Total</th>
                                    <th className="border p-1">Decision</th>
                                    <th className="border p-1">Comments</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itemsMap[req.request_id].map((item) => {
                                    const decision = itemDecisions[req.request_id]?.[item.id] || {
                                      status: item.approval_status || 'Pending',
                                      comments: item.approval_comments || '',
                                    };
                                    const normalizedStatus = typeof decision.status === 'string'
                                      ? `${decision.status.charAt(0).toUpperCase()}${decision.status.slice(1).toLowerCase()}`
                                      : 'Pending';
                                    const rowHighlight = STATUS_HIGHLIGHTS[normalizedStatus] || '';

                                    return (
                                      <tr key={item.id || item.item_name} className={`${rowHighlight} border-b last:border-b-0`}>
                                        <td className="border p-1">{item.item_name}</td>
                                        <td className="border p-1">{item.brand || '—'}</td>
                                        <td className="border p-1">{item.specs || '—'}</td>
                                        <td className="border p-1">{item.quantity}</td>
                                        <td className="border p-1">{item.available_quantity ?? '—'}</td>
                                        <td className="border p-1">{item.unit_cost}</td>
                                        <td className="border p-1">{item.total_cost}</td>
                                        <td className="border p-1">
                                          {canEditItems ? (
                                            <select
                                              className="w-full border rounded px-1 py-1 text-sm"
                                              value={decision.status || 'Pending'}
                                              onChange={(e) =>
                                                handleItemStatusChange(req.request_id, item.id, e.target.value)
                                              }
                                            >
                                              <option value="Pending">Pending</option>
                                              <option value="Approved">Approved</option>
                                              <option value="Rejected">Rejected</option>
                                            </select>
                                          ) : (
                                            <span>{decision.status || 'Pending'}</span>
                                          )}
                                        </td>
                                        <td className="border p-1">
                                          {canEditItems ? (
                                            <textarea
                                              className="w-full border rounded px-1 py-1 text-sm"
                                              rows={2}
                                              value={decision.comments || ''}
                                              onChange={(e) =>
                                                handleItemCommentChange(req.request_id, item.id, e.target.value)
                                              }
                                              placeholder="Optional comments"
                                            />
                                          ) : (
                                            <span>{decision.comments || '—'}</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {canEditItems && (
                                <div className="mt-2 flex justify-end">
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
                                  className={`mt-2 text-sm ${
                                    FEEDBACK_TEXT_STYLES[feedback.type] || FEEDBACK_TEXT_STYLES.info
                                  }`}
                                >
                                  {feedback.message}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-gray-500">No items found for this request.</p>
                          )}
                        </div>
                      )}

                      <div className="mt-4 flex gap-3">
                        {req.request_type === 'Maintenance' && req.approval_level === 1 ? (
                          <Button
                            onClick={() => reassignToDepartmentRequester(req.request_id, req.approval_id)}
                          >
                            Assign to Department Requester
                          </Button>
                        ) : (
                          <>
                            <Button
                              onClick={() => openCommentModal(req.approval_id, req.request_id, 'Approved')}
                            >
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
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {showCommentBox && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg w-[90%] max-w-md">
            <h2 className="text-lg font-semibold mb-2">
              {selectedDecision === 'Approved' ? 'Approve' : 'Reject'} Request #{selectedRequestId}
            </h2>
            <textarea
              className="w-full h-28 border rounded p-2 text-sm"
              placeholder="Enter optional comments..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
            {canMarkUrgent && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="urgent"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="urgent" className="text-sm font-medium">
                  Mark this request as <span className="text-red-600 font-semibold">Urgent</span>
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
    </div>
  );
};

export default ApprovalsPanel;