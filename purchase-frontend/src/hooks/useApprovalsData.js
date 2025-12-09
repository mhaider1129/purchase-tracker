import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import { extractItems } from '../utils/itemUtils';

const STATUS_HIGHLIGHTS = {
  Approved: 'bg-green-50',
  Rejected: 'bg-red-50',
  Pending: '',
};

export const FEEDBACK_TEXT_STYLES = {
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-slate-600',
};

const useApprovalsData = (user) => {
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
  const [itemQuantityDrafts, setItemQuantityDrafts] = useState({});
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
  const [showHodModal, setShowHodModal] = useState(false);
  const [hodOptions, setHodOptions] = useState([]);
  const [hodOptionsLoading, setHodOptionsLoading] = useState(false);
  const [hodOptionsError, setHodOptionsError] = useState('');
  const [selectedHodId, setSelectedHodId] = useState('');
  const [hodModalRequestId, setHodModalRequestId] = useState(null);
  const [hodSubmitLoading, setHodSubmitLoading] = useState(false);
  const [holdLoadingMap, setHoldLoadingMap] = useState({});

  const canMarkUrgent = useMemo(
    () => ['HOD', 'CMO', 'COO', 'WarehouseManager'].includes(user?.role),
    [user?.role],
  );

  const normalizedUserId = useMemo(
    () => (user?.id != null ? String(user.id) : null),
    [user?.id],
  );

  const formatDateTime = useCallback((value) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString('en-GB', { hour12: false });
  }, []);

  const isItemLockedForUser = useCallback(
    (item) => {
      if (!item) return false;

      const status = String(item?.approval_status || 'Pending').toLowerCase();
      if (status !== 'rejected') {
        return false;
      }

      const approvedBy = item?.approved_by != null ? String(item.approved_by) : null;

      if (!approvedBy) {
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
      const normalized = Array.isArray(res.data)
        ? res.data.map((row) => ({
            ...row,
            approval_status: row?.approval_status || 'Pending',
          }))
        : [];
      setRequests(normalized);
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

  const loadHodOptions = useCallback(async () => {
    setHodOptionsLoading(true);
    setHodOptionsError('');

    try {
      const res = await axios.get('/api/requests/hod-approvers');
      setHodOptions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('❌ Failed to load HOD approvers:', err);
      setHodOptions([]);
      setHodOptionsError('Failed to load HOD approvers. Please try again.');
    } finally {
      setHodOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if ((user?.role || '').toUpperCase() === 'SCM') {
      loadHodOptions();
    }
  }, [loadHodOptions, user?.role]);

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
        setItemQuantityDrafts((prev) => ({
          ...prev,
          [requestId]: fetchedItems.reduce((acc, item) => {
            if (!item?.id) return acc;
            acc[item.id] = item.quantity ?? '';
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

  const handleItemQuantityChange = (requestId, itemId, quantityValue) => {
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

    setItemQuantityDrafts((prev) => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || {}),
        [itemId]: quantityValue,
      },
    }));
  };

  const saveItemDecisions = async (requestId, approvalId) => {
    const decisionsForRequest = itemDecisions[requestId] || {};
    const quantityDrafts = itemQuantityDrafts[requestId] || {};
    const itemsForRequest = itemsMap[requestId] || [];

    const payloadItems = [];

    for (const item of itemsForRequest) {
      if (!item?.id) continue;

      const decision = decisionsForRequest[item.id] || {
        status: item?.approval_status || 'Pending',
        comments: item?.approval_comments || '',
      };

      const status = decision?.status || 'Pending';
      const commentsValue = decision?.comments || '';
      const rawQuantity = quantityDrafts[item.id];
      const hasQuantityDraft = rawQuantity !== undefined && rawQuantity !== null && rawQuantity !== '';

      let parsedQuantity = null;
      if (hasQuantityDraft) {
        parsedQuantity = Number(rawQuantity);
        if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
          setItemFeedback((prev) => ({
            ...prev,
            [requestId]: {
              type: 'error',
              message: 'Enter a valid quantity greater than zero for changed items.',
            },
          }));
          return;
        }

        if (!Number.isInteger(parsedQuantity)) {
          setItemFeedback((prev) => ({
            ...prev,
            [requestId]: {
              type: 'error',
              message: 'Quantity must be a whole number.',
            },
          }));
          return;
        }
      }

      const statusChanged =
        status !== (item.approval_status || 'Pending') || commentsValue !== (item.approval_comments || '');
      const quantityChanged = hasQuantityDraft && parsedQuantity !== Number(item.quantity);

      if (statusChanged || quantityChanged) {
        payloadItems.push({
          item_id: Number(item.id),
          status,
          comments: commentsValue,
          ...(hasQuantityDraft ? { quantity: parsedQuantity } : {}),
        });
      }
    }

    if (payloadItems.length === 0) {
      setItemFeedback((prev) => ({
        ...prev,
        [requestId]: {
          type: 'warning',
          message: 'Record at least one item decision or quantity change before saving.',
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
            quantity: updated.quantity ?? item.quantity,
            total_cost: updated.total_cost ?? item.total_cost,
            unit_cost: updated.unit_cost ?? item.unit_cost,
          };
        });

        setItemsMap((prev) => ({
          ...prev,
          [requestId]: mergedItems,
        }));

        setItemQuantityDrafts((prev) => {
          const existing = { ...(prev[requestId] || {}) };
          mergedItems.forEach((item) => {
            if (item?.id) {
              existing[item.id] = item.quantity ?? '';
            }
          });

          return { ...prev, [requestId]: existing };
        });

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

      if (res.data?.updatedEstimatedCost !== undefined) {
        setRequests((prev) =>
          prev.map((req) =>
            req.request_id === requestId
              ? { ...req, estimated_cost: res.data.updatedEstimatedCost }
              : req,
          ),
        );

        setEstimatedCostDrafts((prev) => ({
          ...prev,
          [requestId]: res.data.updatedEstimatedCost,
        }));
      }

      if (res.data?.lockedItems?.length) {
        const lockedMessage = `Items locked by previous approvers: ${res.data.lockedItems.join(', ')}.`;
        const baseSummaryMessage = ` Approved: ${summary.approved}, Rejected: ${summary.rejected}, Pending: ${summary.pending}.`;
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
      `Are you sure you want to ${selectedDecision.toLowerCase()} Request #${selectedRequestId}?`,
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

  const toggleApprovalHoldStatus = async (approvalId, requestId, placeOnHold) => {
    const actionLabel = placeOnHold ? 'put on hold' : 'resume';
    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} Request #${requestId}?`,
    );
    if (!confirmed) return;

    setHoldLoadingMap((prev) => ({ ...prev, [approvalId]: true }));

    try {
      const res = await axios.patch(`/api/approvals/${approvalId}/hold`, {
        on_hold: placeOnHold,
      });

      const nextStatus = res.data?.status || (placeOnHold ? 'On Hold' : 'Pending');
      setRequests((prev) =>
        prev.map((req) =>
          req.approval_id === approvalId ? { ...req, approval_status: nextStatus } : req,
        ),
      );
    } catch (err) {
      console.error('❌ Failed to update approval hold status:', err);
      alert('Unable to update the approval hold status. Please try again.');
    } finally {
      setHoldLoadingMap((prev) => ({ ...prev, [approvalId]: false }));
    }
  };

  const reassignToDepartmentRequester = async (requestId, approvalId) => {
    const confirmed = window.confirm(
      `Assign Maintenance Request #${requestId} to a designated requester in your department?`,
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

  const openHodModal = (requestId) => {
    setHodModalRequestId(requestId);
    setSelectedHodId('');
    setHodOptionsError('');
    setShowHodModal(true);

    if ((user?.role || '').toUpperCase() === 'SCM') {
      loadHodOptions();
    }
  };

  const closeHodModal = () => {
    setShowHodModal(false);
    setHodModalRequestId(null);
    setSelectedHodId('');
    setHodOptionsError('');
  };

  const submitHodForward = async () => {
    if (!hodModalRequestId) return;

    if (!selectedHodId) {
      setHodOptionsError('Select a department HOD to continue.');
      return;
    }

    setHodOptionsError('');
    setHodSubmitLoading(true);

    try {
      await axios.post(`/api/requests/${hodModalRequestId}/request-hod-approval`, {
        hod_user_id: Number(selectedHodId),
      });

      closeHodModal();
      alert('Request forwarded to the selected HOD for approval.');
    } catch (err) {
      console.error('❌ Failed to forward request to HOD:', err);
      setHodOptionsError('Failed to send the request to the selected HOD. Please try again.');
    } finally {
      setHodSubmitLoading(false);
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
      request?.updated_at || request?.submitted_at || request?.created_at || request?.requested_at || request?.request_date;
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
    return Boolean(searchTerm.trim()) || typeFilter !== 'all' || urgencyFilter !== 'all' || sortOption !== 'newest';
  }, [searchTerm, typeFilter, urgencyFilter, sortOption]);

  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setUrgencyFilter('all');
    setSortOption('newest');
  };

  const getRowHighlight = (status) => STATUS_HIGHLIGHTS[status] || '';

  return {
    availableRequestTypes,
    attachmentErrorMap,
    attachmentLoadingMap,
    attachmentsMap,
    canMarkUrgent,
    clearFilters,
    comments,
    downloadingAttachmentId,
    error,
    estimatedCost,
    estimatedCostDrafts,
    estimatedCostError,
    expandedId,
    fetchApprovals,
    filteredRequests,
    formatDateTime,
    getCostLabel,
    getRowHighlight,
    handleDownloadAttachment,
    handleEstimatedCostDraftChange,
    handleItemCommentChange,
    handleItemQuantityChange,
    handleItemStatusChange,
    handleModalEstimatedCostChange,
    hasActiveFilters,
    hodModalRequestId,
    hodOptions,
    hodOptionsError,
    hodOptionsLoading,
    hodSubmitLoading,
    holdLoadingMap,
    isItemLockedForUser,
    isUrgent,
    itemDecisions,
    itemFeedback,
    itemsMap,
    itemQuantityDrafts,
    itemSummaries,
    loadHodOptions,
    loading,
    openCommentModal,
    openHodModal,
    closeHodModal,
    reassignToDepartmentRequester,
    resetCommentModal,
    requests,
    saveItemDecisions,
    savingItems,
    searchTerm,
    selectedApprovalId,
    selectedDecision,
    selectedHodId,
    selectedRequestId,
    setComments,
    setSearchTerm,
    setSelectedHodId,
    setHodOptionsError,
    setSortOption,
    setIsUrgent,
    setTypeFilter,
    setUrgencyFilter,
    showCommentBox,
    showHodModal,
    sortOption,
    submitDecision,
    submitHodForward,
    toggleApprovalHoldStatus,
    summary,
    toggleExpand,
    typeFilter,
    urgencyFilter,
  };
};

export default useApprovalsData;