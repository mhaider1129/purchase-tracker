// src/components/approvals/ApprovalsWorkspace.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { saveAs } from 'file-saver';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  GitBranch,
  Loader2,
  PackageCheck,
  RefreshCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import axios from '../../api/axios';
import Navbar from '../Navbar';
import ApprovalTimeline from '../ApprovalTimeline';
import { Button } from '../ui/Button';
import useApprovalTimeline from '../../hooks/useApprovalTimeline';
import useCurrentUser from '../../hooks/useCurrentUser';

const ITEMS_PER_PAGE = 8;
const ITEM_STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected'];

const FEEDBACK_TONE_CLASSES = {
  success: 'text-emerald-600',
  error: 'text-rose-600',
  warning: 'text-amber-600',
  info: 'text-slate-600',
};

const ITEM_ROW_HIGHLIGHTS = {
  Approved: 'bg-emerald-50',
  Rejected: 'bg-rose-50',
  Pending: '',
};

const ApprovalsWorkspace = ({ requestType = 'maintenance' }) => {
  const { t, i18n } = useTranslation();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [processingDecision, setProcessingDecision] = useState(null);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [sortOption, setSortOption] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [decisionDrafts, setDecisionDrafts] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [attachmentsMap, setAttachmentsMap] = useState({});
  const [attachmentLoadingMap, setAttachmentLoadingMap] = useState({});
  const [attachmentErrorMap, setAttachmentErrorMap] = useState({});
  const [itemDecisions, setItemDecisions] = useState({});
  const [itemSummaries, setItemSummaries] = useState({});
  const [itemFeedbackMap, setItemFeedbackMap] = useState({});
  const [savingItemsMap, setSavingItemsMap] = useState({});
  const [urgentSelections, setUrgentSelections] = useState({});
  const [estimatedCostDrafts, setEstimatedCostDrafts] = useState({});
  const [estimatedCostErrors, setEstimatedCostErrors] = useState({});

  const {
    approvalsMap,
    expandedApprovalsId,
    loadingApprovalsId,
    toggleApprovals,
    resetApprovals,
  } = useApprovalTimeline();
  const { user } = useCurrentUser();

  const itemStatusLabels = useMemo(
    () => ({
      Pending: t('maintenanceHODApprovals.itemStatus.pending'),
      Approved: t('maintenanceHODApprovals.itemStatus.approved'),
      Rejected: t('maintenanceHODApprovals.itemStatus.rejected'),
    }),
    [t],
  );

  const buildSummaryFromItems = useCallback((items = [], overrides = {}) => {
    const summary = { approved: 0, rejected: 0, pending: 0 };
    if (!Array.isArray(items)) {
      return summary;
    }

    items.forEach((item) => {
      const override = overrides[item?.id] || {};
      const status = override.status || item?.approval_status || 'Pending';
      const normalized = String(status).trim().toLowerCase();

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

  const formatDate = useCallback(
    (value) => {
      if (!value) return '—';
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return '—';
      return parsed.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : undefined, {
        hour12: false,
      });
    },
    [i18n.language],
  );

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = requestType
        ? `/api/requests/pending-${requestType}-approvals`
        : '/api/requests/pending-maintenance-approvals';
      const res = await axios.get(endpoint);
      const payload = Array.isArray(res.data) ? res.data : [];
      const normalized = payload.map((req) => ({
        ...req,
        items: Array.isArray(req.items) ? req.items : [],
      }));
      setRequests(normalized);

      const nextDecisions = {};
      const nextSummaries = {};
      const nextUrgent = {};
      const nextEstimatedCosts = {};

      normalized.forEach((req) => {
        const decisionsByItem = {};
        req.items.forEach((item) => {
          if (item?.id == null) {
            return;
          }
          decisionsByItem[item.id] = {
            status: item?.approval_status || 'Pending',
            comments: item?.approval_comments || '',
          };
        });

        if (Object.keys(decisionsByItem).length > 0) {
          nextDecisions[req.request_id] = decisionsByItem;
        }

        nextSummaries[req.request_id] = buildSummaryFromItems(req.items, decisionsByItem);
        nextUrgent[req.request_id] = Boolean(req.is_urgent);

        if (req?.estimated_cost !== undefined && req.estimated_cost !== null) {
          nextEstimatedCosts[req.request_id] = String(req.estimated_cost);
        }
      });

      setItemDecisions(nextDecisions);
      setItemSummaries(nextSummaries);
      setItemFeedbackMap({});
      setSavingItemsMap({});
      setUrgentSelections(nextUrgent);
      setEstimatedCostDrafts(nextEstimatedCosts);
      setEstimatedCostErrors({});
      setAttachmentsMap({});
      setAttachmentLoadingMap({});
      setAttachmentErrorMap({});
      resetApprovals();
    } catch (err) {
      console.error('❌ Failed to fetch maintenance requests', err);
      setError(t('maintenanceHODApprovals.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [buildSummaryFromItems, resetApprovals, requestType, t]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const summary = useMemo(() => {
    const departmentSet = new Set();
    const sectionSet = new Set();
    const projectSet = new Set();

    requests.forEach((req) => {
      if (req?.department_name) departmentSet.add(req.department_name);
      if (req?.section_name) sectionSet.add(req.section_name);
      if (req?.project_name) projectSet.add(req.project_name);
    });

    return {
      pending: requests.length,
      departments: departmentSet.size,
      sections: sectionSet.size,
      projects: projectSet.size,
    };
  }, [requests]);

  const uniqueDepartments = useMemo(() => {
    const values = new Set();
    requests.forEach((req) => {
      if (req?.department_name) values.add(req.department_name);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const uniqueSections = useMemo(() => {
    const values = new Set();
    requests.forEach((req) => {
      if (req?.section_name) values.add(req.section_name);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const uniqueProjects = useMemo(() => {
    const values = new Set();
    requests.forEach((req) => {
      if (req?.project_name) values.add(req.project_name);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = requests.filter((req) => {
      if (normalizedSearch) {
        const haystack = [
          req?.maintenance_ref_number,
          req?.justification,
          req?.requester_name,
          req?.department_name,
          req?.section_name,
          req?.project_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(normalizedSearch)) {
          const itemsMatch = req.items.some((item) =>
            [item?.item_name, item?.quantity]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(normalizedSearch),
          );

          if (!itemsMatch) {
            return false;
          }
        }
      }

      if (departmentFilter !== 'all' && req?.department_name !== departmentFilter) {
        return false;
      }

      if (sectionFilter !== 'all' && req?.section_name !== sectionFilter) {
        return false;
      }

      if (projectFilter !== 'all' && req?.project_name !== projectFilter) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortOption === 'oldest') {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      if (sortOption === 'reference') {
        return (a.maintenance_ref_number || '').localeCompare(b.maintenance_ref_number || '');
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return sorted;
  }, [departmentFilter, projectFilter, requests, searchTerm, sectionFilter, sortOption]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, departmentFilter, sectionFilter, projectFilter, sortOption]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredRequests.slice(start, end);
  }, [currentPage, filteredRequests]);

  const resetFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('all');
    setSectionFilter('all');
    setProjectFilter('all');
    setSortOption('newest');
  };

  const handleCommentChange = (requestId, value) => {
    setDecisionDrafts((prev) => ({ ...prev, [requestId]: value }));
  };

  const handleItemStatusChange = (requestId, itemId, status) => {
    if (!requestId || itemId == null) {
      return;
    }

    const request = requests.find((req) => req.request_id === requestId);
    if (!request) {
      return;
    }

    setItemFeedbackMap((prev) => ({ ...prev, [requestId]: null }));

    const previousDecisions = itemDecisions[requestId] || {};
    const nextDecisions = {
      ...previousDecisions,
      [itemId]: {
        status: status || 'Pending',
        comments: previousDecisions[itemId]?.comments || '',
      },
    };

    setItemDecisions((prev) => ({ ...prev, [requestId]: nextDecisions }));
    setItemSummaries((prev) => ({
      ...prev,
      [requestId]: buildSummaryFromItems(request.items, nextDecisions),
    }));
  };

  const handleItemCommentChange = (requestId, itemId, value) => {
    if (!requestId || itemId == null) {
      return;
    }

    const request = requests.find((req) => req.request_id === requestId);
    if (!request) {
      return;
    }

    setItemFeedbackMap((prev) => ({ ...prev, [requestId]: null }));

    const previousDecisions = itemDecisions[requestId] || {};
    const nextDecisions = {
      ...previousDecisions,
      [itemId]: {
        status: previousDecisions[itemId]?.status || 'Pending',
        comments: value,
      },
    };

    setItemDecisions((prev) => ({ ...prev, [requestId]: nextDecisions }));
    setItemSummaries((prev) => ({
      ...prev,
      [requestId]: buildSummaryFromItems(request.items, nextDecisions),
    }));
  };

  const saveItemDecisions = async (request) => {
    if (!request) {
      return;
    }

    const requestId = request.request_id;
    const approvalId = request.approval_id;
    const decisionsForRequest = itemDecisions[requestId] || {};

    const payloadItems = Object.entries(decisionsForRequest)
      .map(([itemId, decision]) => ({
        item_id: Number(itemId),
        status: decision?.status || 'Pending',
        comments: decision?.comments || '',
      }))
      .filter((item) => Number.isInteger(item.item_id));

    if (payloadItems.length === 0) {
      setItemFeedbackMap((prev) => ({
        ...prev,
        [requestId]: {
          type: 'warning',
          message: t('maintenanceHODApprovals.itemActions.noneSelected'),
        },
      }));
      return;
    }

    setSavingItemsMap((prev) => ({ ...prev, [requestId]: true }));
    setItemFeedbackMap((prev) => ({ ...prev, [requestId]: null }));

    try {
      const res = await axios.patch(`/api/approvals/${approvalId}/items`, { items: payloadItems });
      const currentItems = Array.isArray(request.items) ? request.items : [];
      let mergedItems = currentItems;

      if (Array.isArray(res.data?.updatedItems) && res.data.updatedItems.length > 0) {
        const updatedMap = res.data.updatedItems.reduce((acc, item) => {
          if (item?.id != null) {
            acc[item.id] = item;
          }
          return acc;
        }, {});

        mergedItems = currentItems.map((item) => {
          const updated = updatedMap[item.id];
          if (!updated) return item;
          return {
            ...item,
            approval_status: updated.approval_status,
            approval_comments: updated.approval_comments,
            approved_at: updated.approved_at,
            approved_by: updated.approved_by,
          };
        });
      }

      const nextDecisions = mergedItems.reduce((acc, item) => {
        if (item?.id == null) {
          return acc;
        }
        acc[item.id] = {
          status: item?.approval_status || 'Pending',
          comments: item?.approval_comments || '',
        };
        return acc;
      }, {});

      const summaryFromResponse = res.data?.summary;
      const nextSummary = summaryFromResponse
        ? {
            approved: Number(summaryFromResponse.approved || 0),
            rejected: Number(summaryFromResponse.rejected || 0),
            pending: Number(summaryFromResponse.pending || 0),
          }
        : buildSummaryFromItems(mergedItems, nextDecisions);

      setItemDecisions((prev) => ({ ...prev, [requestId]: nextDecisions }));
      setItemSummaries((prev) => ({ ...prev, [requestId]: nextSummary }));
      setRequests((prev) =>
        prev.map((entry) =>
          entry.request_id === requestId
            ? {
                ...entry,
                items: mergedItems,
              }
            : entry,
        ),
      );

      const lockedItems = Array.isArray(res.data?.lockedItems) ? res.data.lockedItems : [];

      if (lockedItems.length > 0) {
        setItemFeedbackMap((prev) => ({
          ...prev,
          [requestId]: {
            type: 'warning',
            message: t('maintenanceHODApprovals.itemActions.locked', {
              count: lockedItems.length,
              approved: nextSummary.approved,
              rejected: nextSummary.rejected,
              pending: nextSummary.pending,
            }),
          },
        }));
      } else {
        setItemFeedbackMap((prev) => ({
          ...prev,
          [requestId]: {
            type: 'success',
            message: t('maintenanceHODApprovals.itemActions.success', {
              approved: nextSummary.approved,
              rejected: nextSummary.rejected,
              pending: nextSummary.pending,
            }),
          },
        }));
      }
    } catch (err) {
      console.error('❌ Failed to save item decisions:', err);
      setItemFeedbackMap((prev) => ({
        ...prev,
        [requestId]: {
          type: 'error',
          message: t('maintenanceHODApprovals.itemActions.error'),
        },
      }));
    } finally {
      setSavingItemsMap((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleUrgentToggle = (requestId, value) => {
    setUrgentSelections((prev) => ({
      ...prev,
      [requestId]: value,
    }));
  };

  const handleDecision = useCallback(
    async (request, decision) => {
      if (!request) return;

      const normalizedDecision = decision === 'Approved' ? 'Approved' : 'Rejected';
      const confirmKey =
        normalizedDecision === 'Approved'
          ? 'maintenanceHODApprovals.actions.confirmApprove'
          : 'maintenanceHODApprovals.actions.confirmReject';

      let normalizedCost = null;
      if (user?.role === 'SCM') {
        const rawCost = estimatedCostDrafts[request.request_id];
        const trimmedCost = rawCost != null ? String(rawCost).trim() : '';

        if (trimmedCost !== '') {
          const numericCost = Number(trimmedCost.replace(/,/g, ''));

          if (Number.isNaN(numericCost) || numericCost <= 0) {
            setEstimatedCostErrors((prev) => ({
              ...prev,
              [request.request_id]: t('maintenanceHODApprovals.cost.invalid'),
            }));
            return;
          }

          normalizedCost = numericCost;
        }

        setEstimatedCostErrors((prev) => ({
          ...prev,
          [request.request_id]: '',
        }));
      }

      const confirmed = window.confirm(
        t(confirmKey, {
          reference: request.maintenance_ref_number,
        }),
      );

      if (!confirmed) return;

      setProcessingId(request.approval_id);
      setProcessingDecision(normalizedDecision);
      setFeedback(null);

      try {
        const comments = decisionDrafts[request.request_id] || '';
        const payload = {
          status: normalizedDecision,
          comments: comments.trim() === '' ? undefined : comments.trim(),
          is_urgent: urgentSelections[request.request_id] ?? Boolean(request.is_urgent),
        };

        if (normalizedCost !== null) {
          payload.estimated_cost = normalizedCost;
        }

        await axios.patch(`/api/approvals/${request.approval_id}/decision`, payload);
        setFeedback({
          type: 'success',
          message:
            normalizedDecision === 'Approved'
              ? t('maintenanceHODApprovals.feedback.approved', {
                  reference: request.maintenance_ref_number,
                })
              : t('maintenanceHODApprovals.feedback.rejected', {
                  reference: request.maintenance_ref_number,
                }),
        });
        setDecisionDrafts((prev) => {
          const next = { ...prev };
          delete next[request.request_id];
          return next;
        });
        setUrgentSelections((prev) => {
          const next = { ...prev };
          delete next[request.request_id];
          return next;
        });
        setEstimatedCostDrafts((prev) => {
          const next = { ...prev };
          delete next[request.request_id];
          return next;
        });
        setEstimatedCostErrors((prev) => {
          const next = { ...prev };
          delete next[request.request_id];
          return next;
        });
        fetchRequests();
      } catch (err) {
        console.error('❌ Failed to submit decision', err);
        setFeedback({
          type: 'error',
          message: t('maintenanceHODApprovals.feedback.failedDecision'),
        });
      } finally {
        setProcessingId(null);
        setProcessingDecision(null);
      }
    },
    [decisionDrafts, estimatedCostDrafts, fetchRequests, t, urgentSelections, user?.role],
  );

  const handleEstimatedCostChange = (requestId, value) => {
    setEstimatedCostDrafts((prev) => ({
      ...prev,
      [requestId]: value,
    }));
    setEstimatedCostErrors((prev) => ({
      ...prev,
      [requestId]: '',
    }));
  };

  const loadAttachments = useCallback(
    async (requestId) => {
      if (!requestId) return;
      setAttachmentLoadingMap((prev) => ({ ...prev, [requestId]: true }));
      setAttachmentErrorMap((prev) => ({ ...prev, [requestId]: null }));

      try {
        const res = await axios.get(`/api/attachments/${requestId}`);
        const attachments = Array.isArray(res.data) ? res.data : [];
        setAttachmentsMap((prev) => ({ ...prev, [requestId]: attachments }));
      } catch (err) {
        console.error(`❌ Failed to load attachments for request ${requestId}`, err);
        setAttachmentErrorMap((prev) => ({
          ...prev,
          [requestId]: t('maintenanceHODApprovals.attachments.loadError'),
        }));
      } finally {
        setAttachmentLoadingMap((prev) => ({ ...prev, [requestId]: false }));
      }
    },
    [t],
  );

  const toggleRequest = useCallback(
    (request) => {
      if (!request) return;
      const isSame = expandedRequestId === request.request_id;
      const nextId = isSame ? null : request.request_id;
      setExpandedRequestId(nextId);

      if (isSame) {
        return;
      }

      if (!attachmentsMap[request.request_id]) {
        loadAttachments(request.request_id);
      }

      if (expandedApprovalsId !== request.request_id) {
        toggleApprovals(request.request_id);
      }
    },
    [attachmentsMap, expandedApprovalsId, expandedRequestId, loadAttachments, toggleApprovals],
  );

  const exportToCSV = useCallback(() => {
    if (!filteredRequests.length) {
      return;
    }

    const csvRows = [
      [
        t('maintenanceHODApprovals.export.columns.reference'),
        t('maintenanceHODApprovals.export.columns.department'),
        t('maintenanceHODApprovals.export.columns.section'),
        t('maintenanceHODApprovals.export.columns.justification'),
        t('maintenanceHODApprovals.export.columns.requester'),
        t('maintenanceHODApprovals.export.columns.project'),
        t('maintenanceHODApprovals.export.columns.submittedAt'),
        t('maintenanceHODApprovals.export.columns.items'),
      ],
      ...filteredRequests.map((r) => [
        r.maintenance_ref_number || '',
        r.department_name || '',
        r.section_name || t('maintenanceHODApprovals.labels.notApplicable'),
        (r.justification || '').replace(/,/g, ';'),
        r.requester_name || '',
        r.project_name || t('maintenanceHODApprovals.labels.notApplicable'),
        formatDate(r.created_at),
        r.items
          .map((item) => `${item.item_name || ''} (x${item.quantity ?? 0})`)
          .join(' | '),
      ]),
    ];

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filePrefix = t('maintenanceHODApprovals.export.fileName');
    saveAs(blob, `${filePrefix}_${new Date().toISOString().split('T')[0]}.csv`);
  }, [filteredRequests, formatDate, t]);

  const approvalTimelineLabels = useMemo(
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

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              {t('maintenanceHODApprovals.title')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {t('maintenanceHODApprovals.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={fetchRequests}
              variant="secondary"
              aria-label={t('maintenanceHODApprovals.actions.refreshAria')}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-600" aria-hidden />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4 text-slate-600" aria-hidden />
              )}
              {t('maintenanceHODApprovals.actions.refresh')}
            </Button>
            <Button onClick={exportToCSV} aria-label={t('maintenanceHODApprovals.actions.exportAria')}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              {t('maintenanceHODApprovals.actions.export')}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  {t('maintenanceHODApprovals.summary.pendingLabel')}
                </p>
                <p className="text-2xl font-semibold text-slate-900">{summary.pending}</p>
              </div>
              <PackageCheck className="h-8 w-8 text-blue-600" aria-hidden />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  {t('maintenanceHODApprovals.summary.departmentsLabel')}
                </p>
                <p className="text-2xl font-semibold text-slate-900">{summary.departments}</p>
              </div>
              <Building2 className="h-8 w-8 text-emerald-600" aria-hidden />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  {t('maintenanceHODApprovals.summary.sectionsLabel')}
                </p>
                <p className="text-2xl font-semibold text-slate-900">{summary.sections}</p>
              </div>
              <GitBranch className="h-8 w-8 text-amber-500" aria-hidden />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  {t('maintenanceHODApprovals.summary.projectsLabel')}
                </p>
                <p className="text-2xl font-semibold text-slate-900">{summary.projects}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-500" aria-hidden />
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
                placeholder={t('maintenanceHODApprovals.filters.searchPlaceholder')}
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
              <label className="flex flex-col text-sm text-slate-600">
                <span className="mb-1 flex items-center gap-1 font-medium">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                  {t('maintenanceHODApprovals.filters.departmentLabel')}
                </span>
                <select
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">{t('maintenanceHODApprovals.filters.allDepartments')}</option>
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm text-slate-600">
                <span className="mb-1 flex items-center gap-1 font-medium">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                  {t('maintenanceHODApprovals.filters.sectionLabel')}
                </span>
                <select
                  value={sectionFilter}
                  onChange={(event) => setSectionFilter(event.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">{t('maintenanceHODApprovals.filters.allSections')}</option>
                  {uniqueSections.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm text-slate-600">
                <span className="mb-1 flex items-center gap-1 font-medium">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                  {t('maintenanceHODApprovals.filters.projectLabel')}
                </span>
                <select
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">{t('maintenanceHODApprovals.filters.allProjects')}</option>
                  {uniqueProjects.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm text-slate-600">
                <span className="mb-1 flex items-center gap-1 font-medium">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                  {t('maintenanceHODApprovals.filters.sortLabel')}
                </span>
                <select
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">{t('maintenanceHODApprovals.filters.sortNewest')}</option>
                  <option value="oldest">{t('maintenanceHODApprovals.filters.sortOldest')}</option>
                  <option value="reference">{t('maintenanceHODApprovals.filters.sortReference')}</option>
                </select>
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={resetFilters} aria-label={t('maintenanceHODApprovals.filters.resetAria')}>
              {t('maintenanceHODApprovals.filters.reset')}
            </Button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-6 rounded-md border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-16">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-blue-600" aria-hidden />
              <span className="text-sm text-slate-600">{t('common.loading')}</span>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">
              {error}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              {t('maintenanceHODApprovals.emptyState')}
            </div>
          ) : (
            <div className="space-y-5">
              {paginatedRequests.map((request) => {
                const isExpanded = expandedRequestId === request.request_id;
                const attachments = attachmentsMap[request.request_id] || [];
                const attachmentsLoading = attachmentLoadingMap[request.request_id];
                const attachmentsError = attachmentErrorMap[request.request_id];
                const commentDraft = decisionDrafts[request.request_id] || '';
                const isProcessing = processingId === request.approval_id;
                const requestSummary = itemSummaries[request.request_id];
                const itemFeedback = itemFeedbackMap[request.request_id];
                const isSavingItems = Boolean(savingItemsMap[request.request_id]);
                const decisionsForRequest = itemDecisions[request.request_id] || {};

                return (
                  <div key={request.request_id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => toggleRequest(request)}
                      className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                          <span>{t('maintenanceHODApprovals.labels.referencePrefix')}</span>
                          <span className="font-semibold text-slate-800">{request.maintenance_ref_number}</span>
                          {request.department_name && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                              {request.department_name}
                            </span>
                          )}
                          {request.section_name && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                              {request.section_name}
                            </span>
                          )}
                          {(urgentSelections[request.request_id] ?? Boolean(request.is_urgent)) && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              {t('maintenanceHODApprovals.flags.urgentBadge')}
                            </span>
                          )}
                        </div>
                        <p className="text-base font-semibold text-slate-900">
                          {request.justification || t('maintenanceHODApprovals.labels.noJustification')}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span>
                            {t('maintenanceHODApprovals.labels.requester', { name: request.requester_name || '—' })}
                          </span>
                          <span>
                            {t('maintenanceHODApprovals.labels.submittedAt', { date: formatDate(request.created_at) })}
                          </span>
                          <span>
                            {t('maintenanceHODApprovals.labels.itemsCount', { count: request.items.length })}
                          </span>
                          {request?.estimated_cost !== undefined && request.estimated_cost !== null && (
                            <span>
                              {t('maintenanceHODApprovals.labels.estimatedCost', {
                                amount: Number(request.estimated_cost).toLocaleString(),
                              })}
                            </span>
                          )}
                          <span>
                            {t('maintenanceHODApprovals.labels.project', {
                              project: request.project_name || t('maintenanceHODApprovals.labels.notApplicable'),
                            })}
                          </span>
                        </div>
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
                            <div>
                              <h3 className="text-sm font-semibold text-slate-800">
                                {t('maintenanceHODApprovals.labels.itemsHeading')}
                              </h3>
                              {request.items.length === 0 ? (
                                <p className="mt-2 text-sm text-slate-500">
                                  {t('maintenanceHODApprovals.labels.noItems')}
                                </p>
                              ) : (
                                <div className="mt-2 space-y-3">
                                  {requestSummary && (
                                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                                        {t('maintenanceHODApprovals.itemSummary.approved', {
                                          count: requestSummary.approved ?? 0,
                                        })}
                                      </span>
                                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                                        {t('maintenanceHODApprovals.itemSummary.rejected', {
                                          count: requestSummary.rejected ?? 0,
                                        })}
                                      </span>
                                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                                        {t('maintenanceHODApprovals.itemSummary.pending', {
                                          count: requestSummary.pending ?? 0,
                                        })}
                                      </span>
                                    </div>
                                  )}
                                  <div className="overflow-x-auto rounded border border-slate-200">
                                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                                      <thead className="bg-slate-50">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-medium text-slate-600">
                                            {t('maintenanceHODApprovals.itemsColumns.name')}
                                          </th>
                                          <th className="px-3 py-2 text-left font-medium text-slate-600">
                                            {t('maintenanceHODApprovals.itemsColumns.quantity')}
                                          </th>
                                          <th className="px-3 py-2 text-left font-medium text-slate-600">
                                            {t('maintenanceHODApprovals.itemsColumns.status')}
                                          </th>
                                          <th className="px-3 py-2 text-left font-medium text-slate-600">
                                            {t('maintenanceHODApprovals.itemsColumns.comments')}
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {request.items.map((item) => {
                                          const decision = decisionsForRequest[item.id] || {
                                            status: item?.approval_status || 'Pending',
                                            comments: item?.approval_comments || '',
                                          };
                                          const normalizedStatus =
                                            ITEM_STATUS_OPTIONS.includes(decision.status)
                                              ? decision.status
                                              : 'Pending';
                                          const rowHighlight = ITEM_ROW_HIGHLIGHTS[normalizedStatus] || '';
                                          const selectId = `item-${request.request_id}-${item.id}-status`;
                                          const commentId = `item-${request.request_id}-${item.id}-comment`;

                                          return (
                                            <tr
                                              key={item.id || `${request.request_id}-${item.item_name}`}
                                              className={`${rowHighlight} transition-colors`}
                                            >
                                              <td className="px-3 py-3 text-slate-800">
                                                <div className="font-medium">{item.item_name || '—'}</div>
                                                {(item.brand || item.specs) && (
                                                  <div className="mt-1 text-xs text-slate-500">
                                                    {item.brand && <span className="mr-2">{item.brand}</span>}
                                                    {item.specs && <span>{item.specs}</span>}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="px-3 py-3 text-slate-600">
                                                <div>{item.quantity ?? '—'}</div>
                                                {item.available_quantity != null && (
                                                  <div className="text-xs text-slate-500">
                                                    {t('maintenanceHODApprovals.itemsColumns.availableQuantity', {
                                                      count: item.available_quantity,
                                                    })}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="px-3 py-3 text-slate-600">
                                                <label htmlFor={selectId} className="sr-only">
                                                  {t('maintenanceHODApprovals.itemsColumns.status')}
                                                </label>
                                                <select
                                                  id={selectId}
                                                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                  value={normalizedStatus}
                                                  onChange={(event) =>
                                                    handleItemStatusChange(
                                                      request.request_id,
                                                      item.id,
                                                      event.target.value,
                                                    )
                                                  }
                                                  disabled={isSavingItems}
                                                >
                                                  {ITEM_STATUS_OPTIONS.map((option) => (
                                                    <option key={option} value={option}>
                                                      {itemStatusLabels[option] || option}
                                                    </option>
                                                  ))}
                                                </select>
                                              </td>
                                              <td className="px-3 py-3 text-slate-600">
                                                <label htmlFor={commentId} className="sr-only">
                                                  {t('maintenanceHODApprovals.itemsColumns.comments')}
                                                </label>
                                                <textarea
                                                  id={commentId}
                                                  className="mt-0 w-full rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                  rows={3}
                                                  placeholder={t(
                                                    'maintenanceHODApprovals.itemsColumns.commentsPlaceholder',
                                                  )}
                                                  value={decision.comments || ''}
                                                  onChange={(event) =>
                                                    handleItemCommentChange(
                                                      request.request_id,
                                                      item.id,
                                                      event.target.value,
                                                    )
                                                  }
                                                  disabled={isSavingItems}
                                                />
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    {itemFeedback?.message && (
                                      <p
                                        className={`text-sm ${
                                          FEEDBACK_TONE_CLASSES[itemFeedback.type] ||
                                          FEEDBACK_TONE_CLASSES.info
                                        }`}
                                      >
                                        {itemFeedback.message}
                                      </p>
                                    )}
                                    <div className="flex justify-end">
                                      <Button
                                        variant="secondary"
                                        onClick={() => saveItemDecisions(request)}
                                        isLoading={isSavingItems}
                                        aria-label={t('maintenanceHODApprovals.itemActions.saveAria', {
                                          reference: request.maintenance_ref_number,
                                        })}
                                      >
                                        {t('maintenanceHODApprovals.itemActions.save')}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-slate-800">
                                  {t('maintenanceHODApprovals.attachments.title')}
                                </h3>
                                <Button
                                  variant="secondary"
                                  onClick={() => loadAttachments(request.request_id)}
                                  isLoading={Boolean(attachmentsLoading)}
                                  className="px-3 py-1 text-xs"
                                >
                                  {t('maintenanceHODApprovals.attachments.refresh')}
                                </Button>
                              </div>

                              <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                                {attachmentsLoading ? (
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden />
                                    <span>{t('maintenanceHODApprovals.attachments.loading')}</span>
                                  </div>
                                ) : attachmentsError ? (
                                  <p className="text-rose-600">{attachmentsError}</p>
                                ) : attachments.length === 0 ? (
                                  <p>{t('maintenanceHODApprovals.attachments.empty')}</p>
                                ) : (
                                  <ul className="space-y-2">
                                    {attachments.map((attachment) => (
                                      <li key={attachment.id} className="flex items-center justify-between gap-2">
                                        <span className="truncate text-slate-700">{attachment.file_name}</span>
                                        {attachment.download_url && (
                                          <a
                                            href={attachment.download_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                                          >
                                            <Download className="h-4 w-4" aria-hidden />
                                            {t('maintenanceHODApprovals.attachments.download')}
                                          </a>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>

                            <div>
                              <button
                                type="button"
                                onClick={() => toggleApprovals(request.request_id)}
                                className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                              >
                                <FileText className="h-4 w-4" aria-hidden />
                                {expandedApprovalsId === request.request_id
                                  ? t('common.hideApprovals')
                                  : t('common.viewApprovals')}
                              </button>
                              {expandedApprovalsId === request.request_id && (
                                <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                                  <ApprovalTimeline
                                    approvals={approvalsMap[request.request_id]}
                                    isLoading={loadingApprovalsId === request.request_id}
                                    labels={approvalTimelineLabels}
                                    formatDate={formatDate}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium text-slate-700" htmlFor={`decision-comment-${request.request_id}`}>
                                {t('maintenanceHODApprovals.actions.commentLabel')}
                              </label>
                              <textarea
                                id={`decision-comment-${request.request_id}`}
                                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={4}
                                placeholder={t('maintenanceHODApprovals.actions.commentPlaceholder')}
                                value={commentDraft}
                                onChange={(event) => handleCommentChange(request.request_id, event.target.value)}
                              />
                              <p className="mt-1 text-xs text-slate-500">
                                {t('maintenanceHODApprovals.actions.commentHint')}
                              </p>
                              {user?.role === 'SCM' && (
                                <div className="mt-3 space-y-1">
                                  <label
                                    htmlFor={`estimated-cost-${request.request_id}`}
                                    className="text-sm font-medium text-slate-800"
                                  >
                                    {t('maintenanceHODApprovals.cost.label')}
                                  </label>
                                  <input
                                    id={`estimated-cost-${request.request_id}`}
                                    type="text"
                                    inputMode="decimal"
                                    className={`w-full rounded-md border px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      estimatedCostErrors[request.request_id]
                                        ? 'border-rose-400'
                                        : 'border-slate-200'
                                    }`}
                                    placeholder={t('maintenanceHODApprovals.cost.placeholder')}
                                    value={estimatedCostDrafts[request.request_id] ?? ''}
                                    onChange={(event) =>
                                      handleEstimatedCostChange(request.request_id, event.target.value)
                                    }
                                  />
                                  <p className="text-xs text-slate-500">
                                    {t('maintenanceHODApprovals.cost.helper')}
                                  </p>
                                  {estimatedCostErrors[request.request_id] && (
                                    <p className="text-xs text-rose-600">
                                      {estimatedCostErrors[request.request_id]}
                                    </p>
                                  )}
                                </div>
                              )}
                              <div className="mt-3 flex items-center gap-2">
                                <input
                                  id={`urgent-flag-${request.request_id}`}
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                                  checked={Boolean(
                                    urgentSelections[request.request_id] ?? request.is_urgent,
                                  )}
                                  onChange={(event) =>
                                    handleUrgentToggle(request.request_id, event.target.checked)
                                  }
                                  disabled={Boolean(request.is_urgent)}
                                />
                                <label
                                  htmlFor={`urgent-flag-${request.request_id}`}
                                  className="text-sm font-medium text-amber-700"
                                >
                                  {t('maintenanceHODApprovals.flags.urgentLabel')}
                                </label>
                              </div>
                              <p className="mt-1 text-xs text-amber-600">
                                {t('maintenanceHODApprovals.flags.urgentHelper')}
                              </p>
                            </div>

                            <div className="flex flex-col gap-3">
                              <Button
                                variant="primary"
                                onClick={() => handleDecision(request, 'Approved')}
                                disabled={isProcessing && processingDecision === 'Rejected'}
                                isLoading={isProcessing && processingDecision === 'Approved'}
                                aria-label={t('maintenanceHODApprovals.actions.approveAria', {
                                  reference: request.maintenance_ref_number,
                                })}
                              >
                                {t('maintenanceHODApprovals.actions.approve')}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleDecision(request, 'Rejected')}
                                disabled={isProcessing && processingDecision === 'Approved'}
                                isLoading={isProcessing && processingDecision === 'Rejected'}
                                aria-label={t('maintenanceHODApprovals.actions.rejectAria', {
                                  reference: request.maintenance_ref_number,
                                })}
                              >
                                {t('maintenanceHODApprovals.actions.reject')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredRequests.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  <div>{t('common.pageOf', { current: currentPage, total: totalPages })}</div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      {t('common.prev')}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ApprovalsWorkspace;