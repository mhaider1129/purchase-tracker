import { stableRequestItemId } from '../utils/requestItemIdentity';
// src/pages/MyMaintenanceRequests.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from '../api/axios';
import { saveAs } from 'file-saver';
import { buildExcelWorkbookBlob } from '../utils/excelWorkbookExport';
import { getMaintenanceApprovalStepLabel } from '../utils/maintenanceApprovalStatus';
import { matchesPendingApprovalStep, pendingApprovalSteps, summarizePendingApprovalSteps } from '../utils/pendingApprovalSteps';
import { approvalTargetDays, requestApprovalAging, matchesApprovalAgeFilter, compareApprovalAge } from '../utils/approvalAging';
import ApprovalTimeline from '../components/ApprovalTimeline';
import RequestAttachmentsSection from '../components/RequestAttachmentsSection';
import useApprovalTimeline from '../hooks/useApprovalTimeline';
import useRequestAttachments from '../hooks/useRequestAttachments';
import { deriveItemPurchaseState } from '../utils/itemPurchaseStatus';
import PaginationControls from '../components/ui/PaginationControls';
import { getDisplayItems } from '../utils/itemUtils';
import { updateRequest } from '../api/requests';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../utils/permissions';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Filter,
  Search,
  Send,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  requestMatchesStatusFilter,
  summarizeRequestStatuses,
} from '../utils/requestStatus';

const MyMaintenanceRequests = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canViewAllMaintenanceRequests = hasPermission(user, 'maintenance-requests.view-all');
  const tr = useCallback(
    (key, options) => t(`myMaintenanceRequestsPage.${key}`, options),
    [t],
  );
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState('all');
  const [approvalStepFilter, setApprovalStepFilter] = useState('');
  const [approvalAgeFilter, setApprovalAgeFilter] = useState('all');
  const [targetDays, setTargetDays] = useState('');
  const [approvalNow, setApprovalNow] = useState(Date.now);
  const [searchTerm, setSearchTerm] = useState('');
  const [referenceSearch, setReferenceSearch] = useState('');
  const [requesterSearch, setRequesterSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortDirection, setSortDirection] = useState('desc');
  const [expandedItemsId, setExpandedItemsId] = useState(null);
  const [alphabetizedItemsId, setAlphabetizedItemsId] = useState(null);
  const [expandedAttachmentsId, setExpandedAttachmentsId] = useState(null);
  const [editingRequest, setEditingRequest] = useState(null);
  const [editForm, setEditForm] = useState({ justification: '', department_id: '', section_id: '', items: [] });
  const [departments, setDepartments] = useState([]);
  const [editSections, setEditSections] = useState([]);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
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
      title: t('common.approvalTimeline'),
      loading: t('common.loadingApprovals'),
      empty: t('common.noApprovals'),
      columns: {
        level: t('common.approvalLevel'),
        approver: t('common.approver'),
        role: t('common.approverRole'),
        decision: t('common.approvalDecision'),
        comment: t('common.approvalComment'),
        date: t('common.approvalDate'),
      },
    }),
    [t],
  );

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await axios.get('/departments');
        setDepartments(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('❌ Failed to fetch departments:', err);
      }
    };

    fetchDepartments();
  }, []);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await axios.get('/requests/my-maintenance');
        const incoming = Array.isArray(res.data) ? res.data : [];
        const sorted = [...incoming].sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });
        setRequests(sorted);
        resetApprovals();
        resetAttachments();
      } catch (err) {
        console.error('❌ Failed to fetch maintenance requests:', err);
        setError(tr('errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [tr, resetApprovals, resetAttachments]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    itemsPerPage,
    statusFilter,
    approvalStepFilter,
    approvalAgeFilter,
    targetDays,
    searchTerm,
    referenceSearch,
    requesterSearch,
    startDate,
    endDate,
    sortDirection,
  ]);

  const statusLabels = tr('statuses', { returnObjects: true });
  useEffect(() => {
    const timer = setInterval(() => setApprovalNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const agingOptions = useMemo(() => ({ now: approvalNow, targetDays: approvalTargetDays(targetDays), stepKey: approvalStepFilter }), [approvalNow, targetDays, approvalStepFilter]);
  const waitingLabel = (age) => age.oldestHours == null
    ? tr('approvalAging.unknown')
    : tr('approvalAging.hours', { hours: Math.floor(age.oldestHours) });
  const ownerLabel = (row) => [row.approver_name, row.approver_role].filter(Boolean).join(' · ') || tr('approvalSteps.unknownApprover');

  const itemStatusLabels = useMemo(
    () => ({
      purchased: tr('items.statusLabels.purchased', {
        defaultValue: 'Purchased',
      }),
      partiallyPurchased: tr('items.statusLabels.partiallyPurchased', {
        defaultValue: 'Partially purchased',
      }),
      notPurchased: tr('items.statusLabels.notPurchased', {
        defaultValue: 'Not purchased',
      }),
    }),
    [tr],
  );

  const itemCopy = useMemo(
    () => ({
      heading: tr('items.heading', { defaultValue: 'Requested items' }),
      empty: tr('items.empty', { defaultValue: 'No items recorded for this request.' }),
      columns: {
        item: tr('items.columns.item', { defaultValue: 'Item' }),
        specs: tr('items.columns.specs', { defaultValue: 'Specs' }),
        quantity: tr('items.columns.quantity', { defaultValue: 'Requested' }),
        purchased: tr('items.columns.purchased', { defaultValue: 'Purchased' }),
        status: tr('items.columns.status', { defaultValue: 'Status' }),
      },
      actions: {
        show: tr('items.actions.show', { defaultValue: 'View items' }),
        hide: tr('items.actions.hide', { defaultValue: 'Hide items' }),
      },
    }),
    [tr],
  );

  const attachmentsCopy = useMemo(
    () => ({
      title: tr('attachments.title', { defaultValue: 'Attachments' }),
      empty: tr('attachments.empty', {
        defaultValue: 'No attachments uploaded for this request.',
      }),
      loading: tr('attachments.loading', { defaultValue: 'Loading attachments…' }),
      error: tr('attachments.error', {
        defaultValue: 'Unable to load attachments. Please try again.',
      }),
      retryLabel: tr('attachments.retry', { defaultValue: 'Try again' }),
      countLabel: (count) =>
        tr('attachments.countLabel', {
          count,
          defaultValue: count === 1 ? '1 attachment' : `${count} attachments`,
        }),
      actions: {
        show: tr('attachments.actions.show', { defaultValue: 'View attachments' }),
        hide: tr('attachments.actions.hide', { defaultValue: 'Hide attachments' }),
      },
    }),
    [tr],
  );


  const canEditBeforeFinalApproval = useCallback((request) => {
    if (canViewAllMaintenanceRequests) return false;
    const normalizedStatus = (request?.status || '').trim().toLowerCase();
    return !['approved', 'completed', 'received', 'cancelled'].includes(normalizedStatus);
  }, [canViewAllMaintenanceRequests]);

  const openEditRequest = useCallback((request) => {
    setEditError('');
    setEditingRequest(request);
    setEditForm({
      justification: request?.justification || '',
      department_id: request?.department_id ? String(request.department_id) : '',
      section_id: request?.section_id ? String(request.section_id) : '',
      items: Array.isArray(request?.items) && request.items.length > 0
        ? request.items.map((item) => ({
            ...stableRequestItemId(item),
            item_name: item?.item_name || '',
            brand: item?.brand || '',
            quantity: item?.quantity ?? '',
            unit_cost: item?.unit_cost ?? '',
            specs: item?.specs || '',
          }))
        : [{ item_name: '', brand: '', quantity: 1, unit_cost: '', specs: '' }],
    });
  }, []);

  const closeEditRequest = useCallback(() => {
    setEditingRequest(null);
    setEditForm({ justification: '', department_id: '', section_id: '', items: [] });
    setEditError('');
    setEditSubmitting(false);
  }, []);

  useEffect(() => {
    const fetchEditSections = async () => {
      if (!editingRequest || !editForm.department_id) {
        setEditSections([]);
        return;
      }

      try {
        const res = await axios.get(`/departments/${editForm.department_id}/sections`);
        const incomingSections = Array.isArray(res.data) ? res.data : [];
        setEditSections(incomingSections);
        if (editForm.section_id && !incomingSections.some((section) => String(section.id) === String(editForm.section_id))) {
          setEditForm((prev) => ({ ...prev, section_id: '' }));
        }
      } catch (err) {
        console.error('❌ Failed to fetch edit sections:', err);
        setEditSections([]);
      }
    };

    fetchEditSections();
  }, [editingRequest, editForm.department_id, editForm.section_id]);

  const handleEditItemChange = (index, field, value) => {
    setEditForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addEditItem = () => {
    setEditForm((prev) => ({
      ...prev,
      items: [...prev.items, { item_name: '', brand: '', quantity: 1, unit_cost: '', specs: '' }],
    }));
  };

  const removeEditItem = (index) => {
    if (editForm.items[index]?.id) {
      setEditError('Existing lines retain their IDs. Use the controlled item cancellation action to remove demand.');
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const submitEditRequest = async (event) => {
    event.preventDefault();
    if (!editingRequest) return;

    const sanitizedItems = editForm.items.map((item) => ({
      ...stableRequestItemId(item),
      item_name: item.item_name?.trim(),
      brand: item.brand?.trim() || undefined,
      quantity: Number(item.quantity),
      unit_cost: item.unit_cost === '' || item.unit_cost === null || item.unit_cost === undefined
        ? null
        : Number(item.unit_cost),
      specs: item.specs?.trim() || undefined,
    }));

    if (!editForm.department_id) {
      setEditError('Select the correct department.');
      return;
    }

    if (editSections.length > 0 && !editForm.section_id) {
      setEditError('Select the correct section for this department.');
      return;
    }

    if (sanitizedItems.some((item) => !item.item_name || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      setEditError('Enter at least one valid item name and whole-number quantity.');
      return;
    }

    setEditSubmitting(true);
    setEditError('');

    try {
      const updated = await updateRequest(editingRequest.id, {
        justification: editForm.justification,
        department_id: Number(editForm.department_id),
        section_id: editForm.section_id ? Number(editForm.section_id) : null,
        items: sanitizedItems,
      });

      setRequests((prev) => prev.map((request) => (
        request.id === editingRequest.id
          ? {
              ...request,
              justification: editForm.justification,
              status: 'Submitted',
              department_id: Number(editForm.department_id),
              section_id: editForm.section_id ? Number(editForm.section_id) : null,
              department_name: departments.find((dept) => String(dept.id) === String(editForm.department_id))?.name || request.department_name,
              section_name: editSections.find((section) => String(section.id) === String(editForm.section_id))?.name || '',
              items: (updated.items || editingRequest.items || []).map((item) => ({
                ...item,
                total_cost: item.unit_cost === null ? null : item.unit_cost * item.quantity,
              })),
            }
          : request
      )));
      closeEditRequest();
    } catch (err) {
      console.error('❌ Failed to edit maintenance request:', err);
      setEditError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to update maintenance request.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const getStatusBadge = (status = '') => {
    const base = 'px-2 py-1 text-xs font-semibold rounded';
    switch (status.toLowerCase()) {
      case 'approved':
        return `${base} bg-green-100 text-green-800`;
      case 'rejected':
        return `${base} bg-red-100 text-red-800`;
      case 'pending':
        return `${base} bg-yellow-100 text-yellow-800`;
      case 'submitted':
        return `${base} bg-blue-100 text-blue-800`;
      case 'completed':
        return `${base} bg-indigo-100 text-indigo-800`;
      default:
        return `${base} bg-gray-100 text-gray-700`;
    }
  };

  const formatItemsForExport = useCallback(
    (items) => {
      if (!Array.isArray(items) || items.length === 0) {
        return tr('export.noItems');
      }

      return items
        .map((item) => {
          if (!item) {
            return '';
          }

          const parts = [];

          if (item.item_name) {
            parts.push(item.item_name);
          }

          const { statusKey, quantity, purchasedQuantity } = deriveItemPurchaseState(item);
          const statusLabel = itemStatusLabels[statusKey] ?? itemStatusLabels.notPurchased;

          if (quantity !== null && quantity !== undefined) {
            parts.push(`x${quantity}`);
          }

          if (purchasedQuantity !== null && purchasedQuantity !== undefined) {
            parts.push(`(purchased: ${purchasedQuantity})`);
          }

          if (item.specs) {
            parts.push(`(${item.specs})`);
          }

          parts.push(`[${statusLabel}]`);

          return parts.join(' ').trim();
        })
        .filter(Boolean)
        .join(' | ');
    },
    [itemStatusLabels, tr],
  );

  const toggleItems = useCallback((requestId) => {
    setExpandedItemsId((prev) => {
      setAlphabetizedItemsId(null);
      return prev === requestId ? null : requestId;
    });
  }, []);

  const toggleAttachments = useCallback(
    (requestId) => {
      if (!requestId) {
        return;
      }

      setExpandedAttachmentsId((prev) => {
        if (prev === requestId) {
          return null;
        }

        loadAttachmentsForRequest(requestId);
        return requestId;
      });
    },
    [loadAttachmentsForRequest],
  );

  const retryAttachments = useCallback(
    (requestId) => {
      if (!requestId) {
        return;
      }

      loadAttachmentsForRequest(requestId, { force: true });
    },
    [loadAttachmentsForRequest],
  );

  const getFinalApprovalDetails = (request) => {
    if (!request || !request.final_approval_date || !request.final_approver_name) {
      return null;
    }

    const date = new Date(request.final_approval_date);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return {
      approver: request.final_approver_name,
      formattedDate: date.toLocaleString(),
    };
  };

  const getCurrentApprovalStepLabel = (request) => getMaintenanceApprovalStepLabel(request, tr);

  const formatExportDate = (value) => {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  };

  const getFinalApprovalDateLabel = (request) => {
    const normalizedStatus = request.status?.toLowerCase();
    const finalDetails = getFinalApprovalDetails(request);

    if ((normalizedStatus === 'approved' || normalizedStatus === 'completed') && finalDetails) {
      return tr('export.finalApprovalBy', {
        approver: finalDetails.approver,
        date: finalDetails.formattedDate,
      });
    }

    return tr('export.finalApprovalPending');
  };

  const [exporting, setExporting] = useState(false);

  const exportToExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const headers = tr('export.headers', { returnObjects: true });
      const csvRows = [
        headers,
        ...filteredRequests.map((r) => {
          const normalizedStatus = r.status?.trim().toLowerCase();
          const statusLabel = statusLabels[normalizedStatus] || r.status || '';
          const age = requestApprovalAging(r, agingOptions);

          return [
            r.id,
            r.department_name || tr('table.notAvailable'),
            r.requester_name || tr('table.notAvailable'),
            r.justification || '',
            r.project_name || '',
            r.maintenance_ref_number || '-',
            formatItemsForExport(r.items),
            statusLabel,
            r.submission_timeline || '',
            formatExportDate(r.approval_started_at),
            formatExportDate(r.first_approval_at),
            formatExportDate(r.final_approval_at),
            r.approval_duration_days ?? '',
            r.approval_timeline || '',
            getCurrentApprovalStepLabel(r),
            getFinalApprovalDateLabel(r),
            age.rows.map(ownerLabel).join(' | '),
            age.pending ? tr('approvalAging.approve') : tr('approvalAging.noTask'),
            age.pending ? waitingLabel(age) : '',
            age.overdue ? tr('approvalAging.overdue') : '',
          ];
        }),
      ];

      const blob = await buildExcelWorkbookBlob(csvRows, {
        sheetName: tr('export.sheetName'),
        rtl: document?.documentElement?.dir === 'rtl',
      });
      saveAs(blob, `${tr('export.filePrefix')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Failed to export maintenance requests:', err);
      window.alert(tr('errors.exportFailed', { defaultValue: 'Unable to export. Please try again.' }));
    } finally {
      setExporting(false);
    }
  };

  const matchingRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filteredList = requests
      .filter((request) => {
        if (!normalizedSearch) return true;
        const itemsText = Array.isArray(request.items)
          ? request.items
              .map((item) => {
                const { statusKey } = deriveItemPurchaseState(item);
                const statusLabel = itemStatusLabels[statusKey] ?? statusKey;
                return [item?.item_name, item?.specs, statusLabel]
                  .filter(Boolean)
                  .join(' ');
              })
              .join(' ')
          : '';

        const haystack = [
          request.justification,
          request.project_name,
          request.maintenance_ref_number,
          request.department_name,
          request.requester_name,
          itemsText,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .filter((request) => {
        const normalizedReference = referenceSearch.trim().toLowerCase();
        if (!normalizedReference) return true;
        return (request.maintenance_ref_number || '')
          .toLowerCase()
          .includes(normalizedReference);
      })
      .filter((request) => {
        const normalizedRequester = requesterSearch.trim().toLowerCase();
        if (!normalizedRequester) return true;
        return (request.requester_name || '')
          .toLowerCase()
          .includes(normalizedRequester);
      })
      .filter((request) => {
        if (!startDate && !endDate) return true;
        const createdAt = new Date(request.created_at);
        if (Number.isNaN(createdAt.getTime())) return false;
        if (startDate && createdAt < new Date(`${startDate}T00:00:00`)) return false;
        if (endDate) {
          const inclusiveEnd = new Date(`${endDate}T00:00:00`);
          inclusiveEnd.setHours(23, 59, 59, 999);
          if (createdAt > inclusiveEnd) return false;
        }
        return true;
      });

    const sorted = [...filteredList].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      if (sortDirection === 'asc') {
        return dateA - dateB;
      }
      return dateB - dateA;
    });

    return sorted;
  }, [
    requests,
    searchTerm,
    referenceSearch,
    requesterSearch,
    startDate,
    endDate,
    sortDirection,
    itemStatusLabels,
  ]);

  // Status cards are facets: count the search/date subset before the selected status.
  const approvalFilteredRequests = useMemo(
    () => matchingRequests.filter((request) => matchesPendingApprovalStep(request, approvalStepFilter) && matchesApprovalAgeFilter(request, approvalAgeFilter, agingOptions)),
    [matchingRequests, approvalStepFilter, approvalAgeFilter, agingOptions],
  );
  const filteredRequests = useMemo(
    () => approvalFilteredRequests.filter((request) => requestMatchesStatusFilter(request.status, statusFilter)).sort((a, b) => sortDirection === 'approval-oldest' ? compareApprovalAge(a, b, agingOptions) : 0),
    [approvalFilteredRequests, statusFilter, sortDirection, agingOptions],
  );
  const pendingApprovalSummary = useMemo(() => {
    const subset = matchingRequests.filter((request) => requestMatchesStatusFilter(request.status, statusFilter));
    const counts = new Map(summarizePendingApprovalSteps(subset).map((step) => [step.key, step.count]));
    const metrics = (stepKey) => {
      const ages = subset.map((request) => requestApprovalAging(request, { ...agingOptions, stepKey })).filter((age) => age.pending);
      const known = ages.map((age) => age.oldestHours).filter((hours) => hours != null);
      return { overdue: ages.filter((age) => age.overdue).length, unknown: ages.filter((age) => age.unknownCount > 0).length, oldestHours: known.length ? Math.max(...known) : null };
    };
    return {
      total: subset.filter((request) => pendingApprovalSteps(request).length > 0).length,
      ...metrics('any'),
      steps: summarizePendingApprovalSteps(requests).map((step) => ({ ...step, count: counts.get(step.key) || 0, ...metrics(step.key) })),
    };
  }, [matchingRequests, requests, statusFilter, agingOptions]);
  const approvalStepLabel = (step) => tr('approvalSteps.stepLabel', {
    level: step.level ?? tr('approvalSteps.unknownLevel'),
    role: step.role || tr('approvalSteps.unknownApprover'),
  });

  useEffect(() => {
    if (!expandedApprovalsId) {
      return;
    }

    const hasExpandedRequest = filteredRequests.some(
      (request) => String(request.id) === String(expandedApprovalsId),
    );

    if (!hasExpandedRequest) {
      resetApprovals();
    }
  }, [expandedApprovalsId, filteredRequests, resetApprovals]);

  useEffect(() => {
    if (!expandedItemsId) {
      return;
    }

    const hasExpandedRequest = filteredRequests.some(
      (request) => String(request.id) === String(expandedItemsId),
    );

    if (!hasExpandedRequest) {
      setExpandedItemsId(null);
    }
  }, [expandedItemsId, filteredRequests]);

  useEffect(() => {
    if (!expandedAttachmentsId) {
      return;
    }

    const hasExpandedRequest = filteredRequests.some(
      (request) => String(request.id) === String(expandedAttachmentsId),
    );

    if (!hasExpandedRequest) {
      setExpandedAttachmentsId(null);
    }
  }, [expandedAttachmentsId, filteredRequests]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage));
  const paginated = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const statusSummary = useMemo(() => summarizeRequestStatuses(approvalFilteredRequests), [approvalFilteredRequests]);

  const hasActiveFilters = Boolean(
    statusFilter !== 'all'
      || approvalStepFilter
      || approvalAgeFilter !== 'all'
      || searchTerm
      || referenceSearch
      || requesterSearch
      || startDate
      || endDate
      || sortDirection !== 'desc',
  );

  const statusCards = [
    { key: 'all', label: tr('summary.total'), value: statusSummary.total, icon: FileText, tone: 'slate' },
    { key: 'approved', label: statusLabels.approved, value: statusSummary.approved, icon: CheckCircle2, tone: 'emerald' },
    { key: 'pending', label: statusLabels.pending, value: statusSummary.pending, icon: Clock3, tone: 'amber' },
    { key: 'rejected', label: statusLabels.rejected, value: statusSummary.rejected, icon: XCircle, tone: 'rose' },
    { key: 'submitted', label: statusLabels.submitted, value: statusSummary.submitted, icon: Send, tone: 'sky' },
    { key: 'completed', label: statusLabels.completed, value: statusSummary.completed, icon: Activity, tone: 'indigo' },
  ];

  const statusCardStyles = {
    slate: 'border-slate-200 bg-white text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50/70 text-amber-700',
    rose: 'border-rose-200 bg-rose-50/70 text-rose-700',
    sky: 'border-sky-200 bg-sky-50/70 text-sky-700',
    indigo: 'border-indigo-200 bg-indigo-50/70 text-indigo-700',
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setApprovalStepFilter('');
    setApprovalAgeFilter('all');
    setSearchTerm('');
    setReferenceSearch('');
    setRequesterSearch('');
    setStartDate('');
    setEndDate('');
    setSortDirection('desc');
  };

  return (
    <>
      <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 px-6 py-7 text-white shadow-lg sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-400/10 blur-2xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden rounded-xl bg-white/10 p-3 ring-1 ring-white/15 sm:block">
              <Wrench className="h-6 w-6 text-blue-200" aria-hidden="true" />
            </div>
            <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              {tr('eyebrow', { defaultValue: 'Maintenance operations' })}
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {canViewAllMaintenanceRequests
                ? tr('engineerTitle', { defaultValue: 'Maintenance Request Status' })
                : t('pageTitles.myMaintenanceRequests')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {canViewAllMaintenanceRequests
                ? tr('engineerIntro', {
                    defaultValue: 'Review all submitted maintenance requests, monitor their current status, and filter the queue for the requests you need.',
                  })
                : tr('intro')}
            </p>
            </div>
          </div>
          <button
            onClick={exportToExcel}
            disabled={exporting}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exporting ? tr('actions.exporting') : tr('actions.exportExcel')}
          </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-gray-600">
            <svg
              className="h-5 w-5 animate-spin text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              ></path>
            </svg>
            {tr('loading')}
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-600">
            <p className="font-medium">{tr('empty.noRequests')}</p>
            <p className="text-sm">{tr('empty.prompt')}</p>
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {statusCards.map(({ key, label, value, icon: Icon, tone }) => {
                const selected = statusFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    aria-pressed={selected}
                    className={`group rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${statusCardStyles[tone]} ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
                      <Icon className="h-4 w-4 opacity-70" aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{value || 0}</p>
                  </button>
                );
              })}
            </div>

            <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label={tr('approvalSteps.heading')}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-slate-900">{tr('approvalSteps.heading')}</h2>
                  <p className="text-sm text-slate-500">{tr('approvalSteps.helper')}</p>
                </div>
                {approvalStepFilter && <button type="button" onClick={() => setApprovalStepFilter('')} className="text-sm text-blue-600 underline">{tr('approvalSteps.clear')}</button>}
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[{ ...pendingApprovalSummary, key: 'any', count: pendingApprovalSummary.total, label: tr('approvalSteps.all') }, ...pendingApprovalSummary.steps.map((step) => ({ ...step, label: approvalStepLabel(step) }))].map((step) => (
                  <button
                    key={step.key}
                    type="button"
                    aria-pressed={approvalStepFilter === step.key}
                    aria-label={`${step.label}: ${step.count}`}
                    onClick={() => setApprovalStepFilter((current) => current === step.key ? '' : step.key)}
                    className={`rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-left hover:bg-blue-100 ${approvalStepFilter === step.key ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                  >
                    <span className="text-sm font-semibold text-blue-800">{step.label}</span>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{step.count}</p>
                    <p className="mt-2 text-xs text-slate-600">{tr('approvalAging.oldest')}: {waitingLabel(step)}</p>
                    <p className="text-xs text-slate-600">{tr('approvalAging.overdue')}: {approvalTargetDays(targetDays) == null ? tr('approvalAging.targetUnset') : step.overdue}</p>
                    {step.unknown > 0 && <p className="text-xs text-slate-500">{tr('approvalAging.unknownCount', { count: step.unknown })}</p>}
                  </button>
                ))}
              </div>
              {pendingApprovalSummary.total === 0 && <p className="mt-3 text-sm text-slate-500">{tr('approvalSteps.empty')}</p>}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">{tr('approvalAging.target')}<input type="number" min="1" max="365" step="1" value={targetDays} onChange={(event) => { setTargetDays(event.target.value); setApprovalAgeFilter('all'); }} className="ml-2 rounded border px-3 py-2" /></label>
                <label className="text-sm">{tr('approvalAging.filter')}<select value={approvalAgeFilter} onChange={(event) => setApprovalAgeFilter(event.target.value)} className="ml-2 rounded border px-3 py-2">
                  <option value="all">{tr('approvalAging.all')}</option>
                  <option value="overdue" disabled={approvalTargetDays(targetDays) == null}>{tr('approvalAging.overdue')}</option>
                  <option value="unknown">{tr('approvalAging.unknown')}</option>
                </select></label>
              </div>
              <p className="mt-2 text-xs text-slate-500">{tr('approvalAging.targetHelp')}</p>
            </section>

            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Filter className="h-4 w-4" aria-hidden="true" /></span>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{tr('filters.heading', { defaultValue: 'Filter requests' })}</h2>
                    <p className="text-xs text-slate-500">{tr('filters.helper', { defaultValue: 'Narrow the queue by request details, status, or date.' })}</p>
                  </div>
                </div>
                <button
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {tr('filters.reset')}
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-6 lg:grid-cols-8">
              <div className="md:col-span-2">
                <label htmlFor="search" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  {tr('filters.searchLabel')}
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <input
                    id="search"
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={tr('filters.searchPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="reference" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  {tr('filters.referenceLabel')}
                </label>
                <input
                  id="reference"
                  type="text"
                  value={referenceSearch}
                  onChange={(event) => setReferenceSearch(event.target.value)}
                  placeholder={tr('filters.referencePlaceholder')}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
                />
              </div>
              <div>
                <label htmlFor="requester" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  {tr('filters.requesterLabel')}
                </label>
                <input
                  id="requester"
                  type="text"
                  value={requesterSearch}
                  onChange={(event) => setRequesterSearch(event.target.value)}
                  placeholder={tr('filters.requesterPlaceholder')}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
                />
              </div>
              <div>
                <label htmlFor="status" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  {tr('filters.statusLabel')}
                </label>
                <select
                  id="status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
                >
                  <option value="all">{tr('filters.statusOptions.all')}</option>
                  <option value="pending">{statusLabels.pending}</option>
                  <option value="submitted">{statusLabels.submitted}</option>
                  <option value="approved">{statusLabels.approved}</option>
                  <option value="completed">{statusLabels.completed}</option>
                  <option value="rejected">{statusLabels.rejected}</option>
                </select>
              </div>
              <div>
                <label htmlFor="start-date" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  {tr('filters.from')}
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  data-placeholder="سنة/شهر/يوم"
                  lang="ar"
                  dir="rtl"
                  className="arabic-date-input w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
                />
              </div>
              <div>
                <label htmlFor="end-date" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  {tr('filters.to')}
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  data-placeholder="سنة/شهر/يوم"
                  lang="ar"
                  dir="rtl"
                  className="arabic-date-input w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
                />
              </div>
              <div>
                <label htmlFor="sort" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  {tr('filters.sortLabel')}
                </label>
                <select
                  id="sort"
                  value={sortDirection}
                  onChange={(event) => setSortDirection(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
                >
                  <option value="approval-oldest">{tr('approvalAging.sortOldest')}</option>
                  <option value="desc">{tr('filters.sortOptions.desc')}</option>
                  <option value="asc">{tr('filters.sortOptions.asc')}</option>
                </select>
              </div>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{tr('results.heading', { defaultValue: 'Request queue' })}</h2>
                <p className="text-sm text-slate-500">{tr('results.count', { count: filteredRequests.length, defaultValue: `${filteredRequests.length} matching requests` })}</p>
              </div>
              {hasActiveFilters && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{tr('results.filtered', { defaultValue: 'Filters applied' })}</span>}
            </div>

            <div className="mb-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[1250px] w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-2 text-left">{tr('table.id')}</th>
                  <th className="border px-3 py-2 text-left">{tr('table.justification')}</th>
                  <th className="border px-3 py-2 text-left">Department / Section</th>
                  <th className="border px-3 py-2 text-left">{tr('table.project')}</th>
                  <th className="border px-3 py-2 text-left">{tr('table.reference')}</th>
                  <th className="border px-3 py-2 text-left">{tr('table.status')}</th>
                  <th className="border px-3 py-2 text-left">{tr('approvalAging.ownerAction')}</th>
                  <th className="border px-3 py-2 text-left">{tr('table.submitted')}</th>
                  <th className="border px-3 py-2 text-left">{tr('table.attachments')}</th>
                  <th className="border px-3 py-2 text-left">{tr('table.items')}</th>
                  <th className="border px-3 py-2 text-left">{tr('table.approvals')}</th>
                  <th className="border px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((r) => {
                  const age = requestApprovalAging(r, agingOptions);
                  const isApprovalsExpanded =
                    String(expandedApprovalsId) === String(r.id);
                  const isItemsExpanded = String(expandedItemsId) === String(r.id);
                  const isAttachmentsExpanded =
                    String(expandedAttachmentsId) === String(r.id);
                  const attachments = attachmentsMap[r.id] || [];
                  const hasLoadedAttachments = Object.prototype.hasOwnProperty.call(
                    attachmentsMap,
                    r.id,
                  );
                  const attachmentsLoading = Boolean(attachmentLoadingMap[r.id]);
                  const attachmentsErrorRaw = attachmentErrorMap[r.id] || '';
                  const attachmentsError = attachmentsErrorRaw ? attachmentsCopy.error : '';
                  const attachmentsCount = hasLoadedAttachments
                    ? attachments.length
                    : typeof r.attachments_count === 'number'
                      ? r.attachments_count
                      : 0;
                  const attachmentsButtonLabel = isAttachmentsExpanded
                    ? attachmentsCopy.actions.hide
                    : attachmentsCopy.actions.show;
                  const attachmentsCountLabel = attachmentsCopy.countLabel(attachmentsCount);

                  return (
                    <React.Fragment key={r.id}>
                      <tr className="bg-white transition hover:bg-blue-50/40">
                        <td className="border px-3 py-2">{r.id}</td>
                        <td className="border px-3 py-2">{r.justification}</td>
                        <td className="border px-3 py-2">
                          <div>{r.department_name || tr('table.notAvailable')}</div>
                          <div className="text-xs text-gray-500">{r.section_name || tr('table.notAvailable')}</div>
                        </td>
                        <td className="border px-3 py-2">{r.project_name || tr('table.notAvailable')}</td>
                        <td className="border px-3 py-2">{r.maintenance_ref_number || '-'}</td>
                        <td className="border px-3 py-2">
                          <span className={getStatusBadge(r.status)}>{statusLabels[r.status?.toLowerCase()] || r.status}</span>
                        </td>
                        <td className="border px-3 py-2 text-sm">
                          {age.rows.map((row, index) => <div key={row.approval_id ?? index}>{ownerLabel(row)}</div>)}
                          <p>{age.pending ? tr('approvalAging.approve') : tr('approvalAging.noTask')}</p>
                          {age.pending && <p className="text-xs text-slate-500">{waitingLabel(age)}{age.unknownCount > 0 && age.oldestHours != null ? ` · ${tr('approvalAging.unknown')}` : ''}</p>}
                          {age.overdue && <span className="text-xs font-semibold text-amber-800">{tr('approvalAging.overdue')}</span>}
                        </td>
                        <td className="border px-3 py-2">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="border px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-600">{attachmentsCountLabel}</span>
                            <button
                              type="button"
                              onClick={() => toggleAttachments(r.id)}
                              className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-60"
                              disabled={attachmentsLoading}
                            >
                              {attachmentsButtonLabel}
                            </button>
                          </div>
                        </td>
                        <td className="border px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleItems(r.id)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {isItemsExpanded
                              ? itemCopy.actions.hide
                              : itemCopy.actions.show}
                          </button>
                        </td>
                        <td className="border px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleApprovals(r.id)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {isApprovalsExpanded
                              ? t('common.hideApprovals')
                              : t('common.viewApprovals')}
                          </button>
                        </td>
                        <td className="border px-3 py-2">
                          {canEditBeforeFinalApproval(r) ? (
                            <button
                              type="button"
                              onClick={() => openEditRequest(r)}
                              className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                            >
                              Edit request
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                      {isAttachmentsExpanded && (
                        <tr>
                          <td colSpan={12} className="border-t border-gray-200 bg-gray-50 px-4 py-4">
                            <RequestAttachmentsSection
                              attachments={attachments}
                              isLoading={attachmentsLoading}
                              error={attachmentsError}
                              onDownload={handleDownloadAttachment}
                              downloadingAttachmentId={downloadingAttachmentId}
                              onRetry={() => retryAttachments(r.id)}
                              retryLabel={attachmentsCopy.retryLabel}
                              title={attachmentsCopy.title}
                              emptyMessage={attachmentsCopy.empty}
                              loadingMessage={attachmentsCopy.loading}
                              className="space-y-2"
                            />
                          </td>
                        </tr>
                      )}
                      {isItemsExpanded && (
                        <tr>
                          <td colSpan={12} className="border-t border-gray-200 bg-gray-50 px-4 py-4">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="font-semibold text-gray-700">{itemCopy.heading}</h3>
                                {Array.isArray(r.items) && r.items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAlphabetizedItemsId((prev) => (prev === r.id ? null : r.id))
                                    }
                                    className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                                  >
                                    {alphabetizedItemsId === r.id
                                      ? tr('items.actions.sortOriginal')
                                      : tr('items.actions.sortAlphabetical')}
                                  </button>
                                )}
                              </div>
                              {Array.isArray(r.items) && r.items.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full border text-sm">
                                    <thead className="bg-white">
                                      <tr>
                                        <th className="border px-2 py-1 text-left">{itemCopy.columns.item}</th>
                                        <th className="border px-2 py-1 text-left">{itemCopy.columns.specs}</th>
                                        <th className="border px-2 py-1 text-right">{itemCopy.columns.quantity}</th>
                                        <th className="border px-2 py-1 text-right">{itemCopy.columns.purchased}</th>
                                        <th className="border px-2 py-1 text-left">{itemCopy.columns.status}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {getDisplayItems(r.items, alphabetizedItemsId === r.id).map((item, idx) => {
                                        const {
                                          statusKey,
                                          quantity: normalizedQuantity,
                                          purchasedQuantity,
                                        } = deriveItemPurchaseState(item);
                                        const statusLabel =
                                          itemStatusLabels[statusKey] ?? itemStatusLabels.notPurchased;

                                        const displayName =
                                          item?.item_name || item?.name || item?.title || tr('table.notAvailable');
                                        const rowKey = item?.id ?? `${r.id}-${idx}`;

                                        return (
                                          <tr key={rowKey}>
                                            <td className="border px-2 py-1">{displayName}</td>
                                            <td className="border px-2 py-1">{item?.specs || tr('table.notAvailable')}</td>
                                            <td className="border px-2 py-1 text-right">{normalizedQuantity ?? item?.quantity ?? 0}</td>
                                            <td className="border px-2 py-1 text-right">{purchasedQuantity ?? 0}</td>
                                            <td className="border px-2 py-1">{statusLabel}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-600">{itemCopy.empty}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      {isApprovalsExpanded && (
                        <tr>
                          <td colSpan={12} className="border-t border-gray-200 bg-gray-50 px-4 py-4">
                            <ApprovalTimeline
                              approvals={approvalsMap[r.id]}
                              isLoading={loadingApprovalsId === r.id}
                              labels={timelineLabels}
                              isUrgent={Boolean(r?.is_urgent)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {filteredRequests.length === 0 && (
              <div className="border-t border-slate-200 px-6 py-12 text-center">
                <Search className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="mt-3 font-semibold text-slate-700">{tr('results.empty', { defaultValue: 'No requests match these filters' })}</p>
                <button type="button" onClick={resetFilters} className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-800">{tr('filters.reset')}</button>
              </div>
            )}
            </div>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span>{tr('pagination.rowsPerPage')}</span>
                <select
                  value={itemsPerPage}
                  onChange={(event) => setItemsPerPage(Number(event.target.value))}
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring"
                >
                  {[5, 10, 20, 50].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                summary={tr('pagination.pageOf', { current: currentPage, total: totalPages })}
                previousLabel={tr('pagination.prev')}
                nextLabel={tr('pagination.next')}
              />
            </div>

            <p className="mt-3 text-xs text-gray-500">
              {tr('pagination.showingRange', {
                start: filteredRequests.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1,
                end: Math.min(currentPage * itemsPerPage, filteredRequests.length),
                total: filteredRequests.length,
              })}
            </p>
          </>
        )}
      </div>

      {editingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitEditRequest} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Edit maintenance request #{editingRequest.id}</h2>
                <p className="text-sm text-gray-600">After saving, only SCM approval will be requested again.</p>
              </div>
              <button type="button" onClick={closeEditRequest} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            {editError && <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{editError}</div>}
            <label className="mb-3 block text-sm font-medium text-gray-700">
              Justification
              <textarea
                value={editForm.justification}
                onChange={(event) => setEditForm((prev) => ({ ...prev, justification: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                rows={3}
              />
            </label>
            <div className="mb-3 grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Department
                <select
                  value={editForm.department_id}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, department_id: event.target.value, section_id: '' }))}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  required
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Section
                <select
                  value={editForm.section_id}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, section_id: event.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  disabled={!editForm.department_id || editSections.length === 0}
                  required={editSections.length > 0}
                >
                  <option value="">{editSections.length > 0 ? 'Select section' : 'No section'}</option>
                  {editSections.map((section) => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Items</h3>
                <button type="button" onClick={addEditItem} className="rounded border px-3 py-1 text-sm font-medium hover:bg-gray-50">Add item</button>
              </div>
              {editForm.items.map((item, index) => (
                <div key={index} className="grid gap-2 rounded border border-gray-200 p-3 md:grid-cols-5">
                  <input value={item.item_name} onChange={(event) => handleEditItemChange(index, 'item_name', event.target.value)} placeholder="Item name" className="rounded border px-2 py-1 md:col-span-2" />
                  <input value={item.quantity} onChange={(event) => handleEditItemChange(index, 'quantity', event.target.value)} placeholder="Qty" type="number" min="1" className="rounded border px-2 py-1" />
                  <input value={item.unit_cost} onChange={(event) => handleEditItemChange(index, 'unit_cost', event.target.value)} placeholder="Unit cost" type="number" min="0" className="rounded border px-2 py-1" />
                  <button type="button" onClick={() => removeEditItem(index)} disabled={editForm.items.length === 1} className="rounded border px-2 py-1 text-sm text-red-600 disabled:opacity-50">Remove</button>
                  <input value={item.brand} onChange={(event) => handleEditItemChange(index, 'brand', event.target.value)} placeholder="Brand" className="rounded border px-2 py-1" />
                  <input value={item.specs} onChange={(event) => handleEditItemChange(index, 'specs', event.target.value)} placeholder="Specs" className="rounded border px-2 py-1 md:col-span-4" />
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeEditRequest} className="rounded border px-4 py-2">Cancel</button>
              <button type="submit" disabled={editSubmitting} className="rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60">{editSubmitting ? 'Saving…' : 'Save and request SCM approval'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default MyMaintenanceRequests;
