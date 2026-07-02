// src/pages/AllRequestsPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../api/axios';
import AssignRequestPanel from '../components/AssignRequestPanel';
import { printRequest } from '../api/requests';
import ApprovalTimeline from '../components/ApprovalTimeline';
import useApprovalTimeline from '../hooks/useApprovalTimeline';
import { getRequesterDisplay } from '../utils/requester';
import Card from '../components/Card';
import RequestAttachmentsSection from '../components/RequestAttachmentsSection';
import useRequestAttachments from '../hooks/useRequestAttachments';
import useCurrentUser from '../hooks/useCurrentUser';
import useStatusCommunications from '../hooks/useStatusCommunications';
import useDirectPurchaseCommunications from '../hooks/useDirectPurchaseCommunications';
import { hasPermission } from '../utils/permissions';
import RequestViewModeToggle from '../components/requests/RequestViewModeToggle';
import usePersistedRequestViewMode, { REQUEST_VIEW_MODES } from '../hooks/usePersistedRequestViewMode';
import PaginationControls from '../components/ui/PaginationControls';
import { getDisplayItems } from '../utils/itemUtils';

const PRINT_TRANSLATIONS = {
  en: {
    purchaseSummary: 'Purchase Request Summary',
    generatedOn: 'Generated on',
    requestDetails: 'Request Details',
    justification: 'Justification',
    requestedItems: 'Requested Items',
    specs: 'Specs:',
    approval: 'Approval:',
    approvalSeparator: ' – ',
    noItems: 'No line items recorded.',
    tableHeaders: ['#', 'Item', 'Brand', 'Qty', 'Purchased Qty', 'Unit Cost', 'Total Cost'],
    grandTotal: 'Grand Total',
    preparedBy: 'Prepared By',
    reviewedBy: 'Reviewed By',
    approvedBy: 'Approved By',
    requestId: 'Request ID',
    status: 'Status',
    requestType: 'Request Type',
    createdOn: 'Created On',
    neededBy: 'Needed By',
    estimatedCost: 'Estimated Cost',
    maintenanceRef: 'Maintenance Ref #',
    project: 'Project',
    department: 'Department',
    section: 'Section',
    requester: 'Requester',
    printCount: 'Print Count',
    lastUpdated: 'Last Updated',
    approvalOn: 'on',
    finalApprover: 'Final approver',
    printLanguage: 'Print Language',
    english: 'English',
    arabic: 'Arabic',
    yes: 'Yes',
    no: 'No',
    printConfirm: 'Print this request? This will not increase its print count.',
  },
  ar: {
    purchaseSummary: 'ملخص طلب الشراء',
    generatedOn: 'تم الإنشاء في',
    requestDetails: 'تفاصيل الطلب',
    justification: 'المبررات',
    requestedItems: 'المواد المطلوبة',
    specs: 'المواصفات:',
    approval: 'الاعتماد:',
    approvalSeparator: ' – ',
    noItems: 'لا توجد بنود مسجلة.',
    tableHeaders: ['#', 'المادة', 'العلامة التجارية', 'الكمية', 'الكمية المشتراة', 'تكلفة الوحدة', 'إجمالي التكلفة'],
    grandTotal: 'الإجمالي',
    preparedBy: 'أعدها',
    reviewedBy: 'تمت مراجعتها من',
    approvedBy: 'تم اعتمادها من',
    requestId: 'رقم الطلب',
    status: 'الحالة',
    requestType: 'نوع الطلب',
    createdOn: 'تاريخ الإنشاء',
    neededBy: 'مطلوب في',
    estimatedCost: 'التكلفة التقديرية',
    maintenanceRef: 'رقم مرجع الصيانة',
    project: 'المشروع',
    department: 'القسم',
    section: 'الشعبة',
    requester: 'مقدم الطلب',
    printCount: 'عدد الطباعة',
    lastUpdated: 'آخر تحديث',
    approvalOn: 'بتاريخ',
    finalApprover: 'المعتمد النهائي',
    printLanguage: 'لغة الطباعة',
    english: 'الإنجليزية',
    arabic: 'العربية',
    yes: 'نعم',
    no: 'لا',
    printConfirm: 'هل تريد طباعة هذا الطلب؟ لن يزيد هذا عدد الطباعة.',
  },
};
const DASHBOARD_REFRESH_EVENT = 'dashboard:refresh';
const REQUEST_TYPE_FILTER_OPTIONS = [
  { value: 'Stock', label: 'Stock' },
  { value: 'Non-Stock', label: 'Non-Stock' },
  { value: 'Medical Device', label: 'Medical Device' },
  { value: 'Medication', label: 'Medication' },
  { value: 'IT Item', label: 'IT Item' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Printing Logbook', label: 'Logbooks' },
];

// Map roles returned by the API to human friendly step labels
const STEP_LABELS = {
  HOD: 'HOD Approval',
  CMO: 'CMO Approval',
  SCM: 'SCM Approval',
  COO: 'COO Approval',
  CEO: 'CEO Approval',
  CFO: 'CFO Approval',
  WarehouseManager: 'Warehouse Manager Approval',
  WarehouseKeeper: 'Warehouse Keeper Approval',
  ProcurementSpecialist: 'Procurement Specialist Action',
};

const getMaintenanceReference = (request) => {
  if (request?.request_type !== 'Maintenance') return null;
  const reference = request?.maintenance_ref_number;
  return reference === null || reference === undefined || reference === '' ? '—' : reference;
};


const CURRENT_STEP_FILTER_OPTIONS = [
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Technical Inspection Pending', label: 'Technical Inspection Pending' },
  { value: 'Received', label: 'Received' },
  { value: 'Partially Procured', label: 'Partially Procured' },
  { value: 'Approved', label: 'Approved' },
  ...Object.entries(STEP_LABELS).map(([value, label]) => ({ value, label })),
];

const getCurrentStep = (req) => {
  if (req.status === 'Rejected') return 'Rejected';
  if (req.status?.toLowerCase() === 'completed') return 'Completed';
  if (req.status?.toLowerCase() === 'technical_inspection_pending')
    return 'Technical Inspection Pending';
  if (req.status?.toLowerCase() === 'received') return 'Received';
  if (req.status?.toLowerCase() === 'partially procured') return 'Partially Procured';
  if (req.status === 'Approved' && !req.current_approver_role) return 'Approved';
  if (req.current_approver_role) {
    return STEP_LABELS[req.current_approver_role] || `${req.current_approver_role} Approval`;
  }
  return 'Submitted';
};

// Map the current step to a colorful badge
const getStepColor = (step) => {
  switch (step) {
    case 'Rejected':
      return 'bg-red-100 text-red-800';
    case 'Technical Inspection Pending':
      return 'bg-amber-100 text-amber-800';
    case 'Completed':
    case 'Approved':
    case 'Received':
      return 'bg-green-100 text-green-800';
    case 'Partially Procured':
      return 'bg-amber-100 text-amber-800';
    case 'Submitted':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-blue-100 text-blue-800';
  }
};

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const isCompletedStatus = (status) => ['completed', 'received'].includes(normalizeStatus(status));

const isPostApprovalStatus = (status) => {
  const normalized = normalizeStatus(status);
  return [
    'approved',
    'assigned',
    'partially procured',
    'technical_inspection_pending',
    'completed',
    'received',
  ].includes(normalized);
};

const AllRequestsPage = () => {
  const { user } = useCurrentUser();
  const [requestViewMode, setRequestViewMode] = usePersistedRequestViewMode(
    'all-requests-request-view-mode',
  );
  const [requests, setRequests] = useState([]);
  const [expandedAssignId, setExpandedAssignId] = useState(null);
  const [expandedItemsId, setExpandedItemsId] = useState(null);
  const [alphabetizedItemsId, setAlphabetizedItemsId] = useState(null);
  const [expandedAttachmentsId, setExpandedAttachmentsId] = useState(null);
  const [expandedCommunicationId, setExpandedCommunicationId] = useState(null);
  const [expandedDirectCommId, setExpandedDirectCommId] = useState(null);
  const [itemsMap, setItemsMap] = useState({});
  const [loadingItemsId, setLoadingItemsId] = useState(null);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('');
  const [requestType, setRequestType] = useState('');
  const [search, setSearch] = useState('');
  const [requestId, setRequestId] = useState('');
  const [maintenanceRefNumber, setMaintenanceRefNumber] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [section, setSection] = useState('');
  const [assignedUser, setAssignedUser] = useState('');
  const [departments, setDepartments] = useState([]);
  const [procurementUsers, setProcurementUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRequests, setTotalRequests] = useState(0);
  const [summaryCounts, setSummaryCounts] = useState({ urgent: 0, approved: 0, pending: 0, completed: 0 });
  const [loadingExport, setLoadingExport] = useState(false);
  const [remindingApproverIds, setRemindingApproverIds] = useState(() => new Set());
  const [filtersChanged, setFiltersChanged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [printLanguage, setPrintLanguage] = useState('ar');
  const limit = 10;
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
  const {
    canSendCommunication,
    canViewCommunication,
    communicationDrafts,
    communicationError,
    communicationList,
    communicationLoading,
    communicationSending,
    communicationSuccess,
    handleSendCommunication,
    refreshCommunications,
    setCommunicationDrafts,
  } = useStatusCommunications(user?.role);
  const {
    canDocumentDirectPurchase,
    drafts: directPurchaseDrafts,
    urgencyNotes: directPurchaseUrgency,
    sending: directPurchaseSending,
    error: directPurchaseError,
    success: directPurchaseSuccess,
    entries: directPurchaseEntries,
    setDrafts: setDirectPurchaseDrafts,
    setUrgencyNotes: setDirectPurchaseUrgency,
    handleSendDirectCommunication,
  } = useDirectPurchaseCommunications(user?.role);

  const sectionOptions = useMemo(() => {
    return departments.flatMap((dep) => {
      if (department && String(dep.id) !== String(department)) return [];
      return (dep.sections || []).map((sec) => ({
        ...sec,
        departmentName: dep.name,
      }));
    });
  }, [department, departments]);

  const requestSummary = useMemo(() => {
    return [
      { label: 'Total requests', value: totalRequests },
      { label: 'Urgent requests', value: summaryCounts.urgent },
      { label: 'Approved', value: summaryCounts.approved },
      { label: 'Pending', value: summaryCounts.pending },
      { label: 'Completed', value: summaryCounts.completed },
    ];
  }, [summaryCounts, totalRequests]);
  const canHardDeleteRequests = hasPermission(user || {}, 'requests.manage');
  const canRemindCurrentApprover = String(user?.role || '').trim().toUpperCase() === 'SCM';
  const isSummaryRequestView = requestViewMode === REQUEST_VIEW_MODES.summary;

  useEffect(() => {
    const fetchDeps = async () => {
      try {
        const res = await axios.get('/departments');
        setDepartments(res.data);
      } catch (err) {
        console.error('❌ Failed to load departments:', err);
      }
    };
    fetchDeps();
  }, []);

  useEffect(() => {
    const fetchProcurementUsers = async () => {
      try {
        const res = await axios.get('/requests/procurement-users');
        setProcurementUsers(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('❌ Failed to load assigned-user filter options:', err);
      }
    };
    fetchProcurementUsers();
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    resetAttachments();
    try {
      const res = await axios.get('/requests', {
        params: {
          filter,
          sort,
          request_type: requestType,
          search,
          request_id: requestId.trim() || undefined,
          maintenance_ref_number: maintenanceRefNumber.trim() || undefined,
          current_step: currentStep || undefined,
          from_date: fromDate,
          to_date: toDate,
          status,
          department_id: department,
          section_id: section,
          assigned_to: assignedUser,
          page,
          limit,
        },
      });

      const fetchedRequests = Array.isArray(res?.data?.data) ? [...res.data.data] : [];
      const isCompletedOrRejected = (req) => {
        const normalizedStatus = normalizeStatus(req?.status);
        return isCompletedStatus(normalizedStatus) || normalizedStatus === 'rejected';
      };

      const urgentPinnedRequests = [];
      const regularRequests = [];

      fetchedRequests.forEach((req) => {
        if (req?.is_urgent && !isCompletedOrRejected(req)) {
          urgentPinnedRequests.push(req);
        } else {
          regularRequests.push(req);
        }
      });

      setRequests([...urgentPinnedRequests, ...regularRequests]);
      resetApprovals();
      const total = Number(res?.data?.total) || 0;
      setTotalRequests(total);
      setTotalPages(Math.ceil(total / limit));

      const summaryRes = await axios.get('/requests', {
        params: {
          filter,
          sort,
          request_type: requestType,
          search,
          request_id: requestId.trim() || undefined,
          maintenance_ref_number: maintenanceRefNumber.trim() || undefined,
          current_step: currentStep || undefined,
          from_date: fromDate,
          to_date: toDate,
          status,
          department_id: department,
          section_id: section,
          assigned_to: assignedUser,
          page: 1,
          limit: Math.max(total, limit),
        },
      });

      const summaryRequests = Array.isArray(summaryRes?.data?.data) ? summaryRes.data.data : [];
      const finalizedStatuses = ['approved', 'rejected', 'completed', 'received', 'cancelled'];
      const nextSummary = summaryRequests.reduce(
        (acc, req) => {
          const normalizedStatus = normalizeStatus(req?.status);
          if (req?.is_urgent) acc.urgent += 1;
          if (normalizedStatus === 'approved') acc.approved += 1;
          if (isCompletedStatus(normalizedStatus)) acc.completed += 1;
          if (!finalizedStatuses.includes(normalizedStatus)) acc.pending += 1;
          return acc;
        },
        { urgent: 0, approved: 0, pending: 0, completed: 0 },
      );
      setSummaryCounts(nextSummary);
    } catch (err) {
      console.error(err);
      alert('❌ Failed to fetch requests.');
    } finally {
      setLoading(false);
    }
    }, [
    assignedUser,
    department,
    filter,
    currentStep,
    fromDate,
    maintenanceRefNumber,
    page,
    requestId,
    requestType,
    resetApprovals,
    resetAttachments,
    search,
    section,
    sort,
    status,
    toDate,
  ]);

  useEffect(() => {
    if (filtersChanged) {
      fetchRequests();
      setFiltersChanged(false);
    }
  }, [fetchRequests, filtersChanged]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const applyFilters = () => {
    setPage(1);
    setFiltersChanged(true);
  };

  const clearFilters = () => {
    setFilter('');
    setSort('');
    setRequestType('');
    setSearch('');
    setRequestId('');
    setMaintenanceRefNumber('');
    setCurrentStep('');
    setFromDate('');
    setToDate('');
    setStatus('');
    setDepartment('');
    setSection('');
    setAssignedUser('');
    setPage(1);
    setFiltersChanged(true);
  };

  const toggleItems = async (requestId) => {
    if (expandedItemsId === requestId) {
      setExpandedItemsId(null);
      setAlphabetizedItemsId(null);
      return;
    }
    setAlphabetizedItemsId(null);
    if (!itemsMap[requestId]) {
      try {
        setLoadingItemsId(requestId);
        const res = await axios.get(`/requests/${requestId}/items`);
        setItemsMap((prev) => ({ ...prev, [requestId]: res.data.items || [] }));
      } catch (err) {
        console.error(`❌ Failed to load items for request ${requestId}:`, err);
        alert('Failed to load items');
      } finally {
        setLoadingItemsId(null);
      }
    }
    setExpandedItemsId(requestId);
  };

  const toggleAttachments = async (requestId) => {
    if (expandedAttachmentsId === requestId) {
      setExpandedAttachmentsId(null);
      return;
    }

    await loadAttachmentsForRequest(requestId);
    setExpandedAttachmentsId(requestId);
  };

  const handleExport = async (type) => {
    setLoadingExport(true);
    try {
      const res = await axios.get(`/requests/export/${type}`, {
        params: {
          filter,
          sort,
          request_type: requestType,
          search,
          request_id: requestId.trim() || undefined,
          maintenance_ref_number: maintenanceRefNumber.trim() || undefined,
          current_step: currentStep || undefined,
          from_date: fromDate,
          to_date: toDate,
          status,
          department_id: department,
          section_id: section,
          assigned_to: assignedUser,
        },
        responseType: 'blob',
      });

      const blob = new Blob([res.data], {
        type: type === 'csv' ? 'text/csv' : 'application/pdf',
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `purchase_requests_${dateStr}.${type}`;

      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`❌ Failed to export ${type.toUpperCase()}:`, err);
      alert(`❌ Failed to export ${type.toUpperCase()}`);
    } finally {
      setLoadingExport(false);
    }
  };

  const handlePrint = async (requestId) => {
    const translate = (key) =>
      PRINT_TRANSLATIONS[printLanguage]?.[key] || PRINT_TRANSLATIONS.en[key] || key;

    const shouldPrint = window.confirm(translate('printConfirm'));
    if (!shouldPrint) return;

    try {
      const data = await printRequest(requestId, {
        incrementPrintCount: false,
        language: printLanguage,
      });
      const { request, items, message = 'Request ready for printing.', print_count } = data;

      const locale = printLanguage === 'ar' ? 'ar-EG' : 'en-US';
      const direction = printLanguage === 'ar' ? 'rtl' : 'ltr';
      const win = window.open('', '_blank');
      if (!win) {
        alert('Please enable popups to print the request.');
        return;
      }

      const escapeHtml = (unsafe) => {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };

      const formatValue = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        if (typeof value === 'boolean') return value ? translate('yes') : translate('no');
        return escapeHtml(value);
      };

      const formatDate = (value) => {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '—' : escapeHtml(date.toLocaleString(locale));
      };

      const formatAmount = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return formatValue(value);
        return escapeHtml(
          numeric.toLocaleString(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      };

      const formatFinalApprovalSummary = (name, dateValue) => {
        const formattedDate = formatDate(dateValue);
        if (formattedDate === '—') return formattedDate;
        return `${name || translate('finalApprover')} ${translate('approvalOn')} ${formattedDate}`;
      };

      const now = escapeHtml(new Date().toLocaleString(locale));
      const isMaintenanceRequest = request.request_type === 'Maintenance';
      const maintenanceAssignedToRequester =
        isMaintenanceRequest &&
        request.initiated_by_technician_id &&
        request.requester_id &&
        request.requester_id !== request.initiated_by_technician_id;

      const maintenanceRequesterName = maintenanceAssignedToRequester
        ? request.requester_name
        : request.temporary_requester_name || request.requester_name;

      const requesterName = isMaintenanceRequest
        ? maintenanceRequesterName
        : request.requester_name || request.temporary_requester_name;

      const requesterRole = maintenanceAssignedToRequester
        ? request.requester_role
        : isMaintenanceRequest && request.temporary_requester_name
          ? null
          : request.requester_role;

      const requesterDisplay = requesterName
        ? `${requesterName}${requesterRole ? ` (${requesterRole})` : ''}`
        : requesterName;

      const lastUpdated = request.final_approval?.approved_at
        ? formatFinalApprovalSummary(request.final_approval.approver_name, request.final_approval.approved_at)
        : formatDate(request.updated_at);

      const detailFields = [
        { label: translate('requestId'), value: request.id },
        { label: translate('status'), value: request.status },
        { label: translate('createdOn'), value: formatDate(request.created_at) },
        { label: translate('neededBy'), value: formatDate(request.needed_by) },
        { label: translate('maintenanceRef'), value: request.maintenance_ref_number },
        { label: translate('project'), value: request.project_name },
        { label: translate('department'), value: request.department_name },
        { label: translate('section'), value: request.section_name },
        { label: translate('requester'), value: requesterDisplay },
        { label: translate('printCount'), value: print_count },
        { label: translate('lastUpdated'), value: lastUpdated },
      ]
        .map(({ label, value }) => ({ label, value: formatValue(value) }))
        .filter(({ value }) => value && value !== '—');

      const detailGrid = detailFields
        .map(
          ({ label, value }) => `
            <div class="detail-item">
              <span class="detail-label">${escapeHtml(label)}</span>
              <span class="detail-value">${value}</span>
            </div>`
        )
        .join('');

      const totalCost = items.reduce((sum, item) => {
        const value = Number(item.total_cost);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0);

      const itemRows = items
        .map((item, index) => {
          const specsNote = item.specs
            ? `<div class="item-note"><strong>${translate('specs')}</strong> ${formatValue(item.specs)}</div>`
            : '';
          const approvalNote =
            item.approval_status || item.approval_comments
              ? `<div class="item-note"><strong>${translate('approval')}</strong> ${formatValue(item.approval_status)}${
                  item.approval_comments ? `${translate('approvalSeparator')}${formatValue(item.approval_comments)}` : ''
                }</div>`
              : '';

          return `
            <tr>
              <td>${index + 1}</td>
              <td>
                <div class="item-name">${formatValue(item.item_name)}</div>
                ${specsNote || approvalNote ? `<div class="item-notes">${specsNote}${approvalNote}</div>` : ''}
              </td>
              <td>${formatValue(item.brand)}</td>
              <td class="numeric">${formatValue(item.quantity)}</td>
              <td class="numeric">${formatValue(item.purchased_quantity)}</td>
              <td class="numeric">${formatAmount(item.unit_cost)}</td>
              <td class="numeric">${formatAmount(item.total_cost)}</td>
            </tr>`;
        })
        .join('');

      const justification = request.justification
        ? `<section class="section">
            <h2>${translate('justification')}</h2>
            <p>${escapeHtml(request.justification).replace(/\n/g, '<br />')}</p>
          </section>`
        : '';

      const body = `
        <!DOCTYPE html>
        <html lang="${printLanguage}" dir="${direction}">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Request ${escapeHtml(request.id)}</title>
            <style>
              :root {
                color-scheme: light;
              }
              @page {
                size: A4;
                margin: 20mm;
              }
              body {
                font-family: 'Segoe UI', 'Cairo', Arial, sans-serif;
                color: #1f2937;
                margin: 0;
                padding: 32px;
                background: #f9fafb;
                direction: ${direction};
              }
              .page {
                background: #ffffff;
                border-radius: 12px;
                padding: 32px;
                box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
              }
              header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 24px;
                border-bottom: 3px solid #2563eb;
                padding-bottom: 16px;
                margin-bottom: 24px;
                flex-direction: ${direction === 'rtl' ? 'row-reverse' : 'row'};
              }
              header h1 {
                margin: 0;
                font-size: 28px;
                color: #111827;
              }
              header p {
                margin: 4px 0 0;
                color: #4b5563;
              }
              .print-badge {
                background: #2563eb;
                color: #ffffff;
                padding: 8px 16px;
                border-radius: 999px;
                font-weight: 600;
                font-size: 14px;
                align-self: center;
              }
              .details-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 16px;
                margin-bottom: 24px;
              }
              .detail-item {
                background: #f3f4f6;
                border-radius: 10px;
                padding: 12px 16px;
                border: 1px solid #e5e7eb;
              }
              .detail-label {
                display: block;
                font-size: 12px;
                letter-spacing: 0.06em;
                color: #6b7280;
                text-transform: uppercase;
                margin-bottom: 4px;
                text-align: ${direction === 'rtl' ? 'right' : 'left'};
              }
              .detail-value {
                font-weight: 600;
                font-size: 15px;
                color: #111827;
                word-break: break-word;
                text-align: ${direction === 'rtl' ? 'right' : 'left'};
              }
              .section {
                margin-bottom: 24px;
              }
              .section h2 {
                font-size: 18px;
                margin-bottom: 12px;
                color: #1d4ed8;
                border-bottom: 1px solid #c7d2fe;
                padding-bottom: 6px;
              }
              .items-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 14px;
                background: #ffffff;
                overflow: hidden;
                border-radius: 12px;
                border: 1px solid #e5e7eb;
              }
              .items-table thead {
                background: linear-gradient(120deg, #1d4ed8, #2563eb);
                color: #ffffff;
              }
              .items-table th,
              .items-table td {
                padding: 12px;
                border-bottom: 1px solid #e5e7eb;
                vertical-align: top;
              }
              .items-table th {
                font-weight: 600;
                letter-spacing: 0.03em;
                text-transform: uppercase;
                font-size: 12px;
              }
              .items-table tbody tr:nth-child(even) {
                background: #f9fafb;
              }
              .item-name {
                font-weight: 600;
                color: #111827;
              }
              .item-notes {
                margin-top: 6px;
                color: #4b5563;
                font-size: 12px;
                display: flex;
                flex-direction: column;
                gap: 4px;
              }
              .item-note strong {
                color: #1f2937;
              }
              .numeric {
                text-align: right;
                white-space: nowrap;
              }
              .totals-row td {
                font-weight: 700;
                font-size: 15px;
                color: #111827;
                background: #eef2ff;
              }
              .signature-blocks {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 24px;
                margin-top: 32px;
              }
              .signature {
                border-top: 1px solid #9ca3af;
                padding-top: 12px;
                text-align: center;
                font-size: 12px;
                color: #6b7280;
              }
              footer {
                margin-top: 32px;
                font-size: 12px;
                color: #6b7280;
                text-align: right;
              }
              @media print {
                body {
                  padding: 0;
                  background: #ffffff;
                }
                .page {
                  box-shadow: none;
                  border-radius: 0;
                  padding: 0;
                }
                header {
                  margin-bottom: 16px;
                }
                .detail-item {
                  background: transparent;
                }
                .items-table {
                  border: 1px solid #d1d5db;
                }
                .items-table tbody tr:nth-child(even) {
                  background: #ffffff;
                }
              }
            </style>
          </head>
          <body>
            <div class="page">
              <header>
                <div>
                  <h1>${translate('purchaseSummary')}</h1>
                  <p>${translate('generatedOn')} ${now}</p>
                </div>
                <span class="print-badge">${translate('printCount')}: ${formatValue(print_count)}</span>
              </header>

              <section class="section">
                <h2>${translate('requestDetails')}</h2>
                <div class="details-grid">
                  ${detailGrid}
                </div>
              </section>

              ${justification}

              <section class="section">
                <h2>${translate('requestedItems')}</h2>
                <table class="items-table">
                  <thead>
                    <tr>
                      ${PRINT_TRANSLATIONS[printLanguage].tableHeaders
                        .map((header) => `<th>${escapeHtml(header)}</th>`)
                        .join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      itemRows ||
                      `<tr><td colspan="7" style="text-align:center; padding: 24px;">${translate('noItems')}</td></tr>`
                    }
                    <tr class="totals-row">
                      <td colspan="6">${translate('grandTotal')}</td>
                      <td class="numeric">${formatAmount(totalCost)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section class="signature-blocks">
                <div class="signature">${translate('preparedBy')}</div>
                <div class="signature">${translate('reviewedBy')}</div>
                <div class="signature">${translate('approvedBy')}</div>
              </section>

              <footer>
                ${translate('requestId')} ${escapeHtml(request.id)} • ${now}
              </footer>
            </div>
          </body>
        </html>
      `;

      win.document.write(body);
      win.document.close();
      win.onload = () => {
        win.focus();
        win.print();
      };

      alert(message);
    } catch (err) {
      console.error('❌ Failed to print request:', err);
      alert('❌ Failed to print request.');
    }
  };

  const handleRemindCurrentApprover = async (requestId) => {
    const confirmed = window.confirm(
      `Send an email reminder to the current approver for request ${requestId}?`,
    );
    if (!confirmed) return;

    setRemindingApproverIds((prev) => new Set(prev).add(requestId));
    try {
      const res = await axios.post(`/approvals/request/${requestId}/remind-current`);
      alert(res?.data?.message || '✅ Approval reminder email sent.');
    } catch (err) {
      console.error(`❌ Failed to remind current approver for request ${requestId}:`, err);
      alert(err?.response?.data?.message || '❌ Failed to send approval reminder.');
    } finally {
      setRemindingApproverIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleHardDelete = async (requestId) => {
    const confirmed = window.confirm(
      `Delete request ${requestId} permanently? This removes the request and all related records.`,
    );
    if (!confirmed) return;

    const password = window.prompt('Enter your password to confirm this deletion:');
    if (password === null) return;
    if (!password.trim()) {
      alert('Password is required to delete a request.');
      return;
    }

    try {
      await axios.post('/auth/verify-password', { password });
      await axios.delete(`/requests/${requestId}/hard-delete`);
      if (expandedAssignId === requestId) setExpandedAssignId(null);
      if (expandedItemsId === requestId) setExpandedItemsId(null);
      if (expandedAttachmentsId === requestId) setExpandedAttachmentsId(null);
      if (expandedCommunicationId === requestId) setExpandedCommunicationId(null);
      if (expandedDirectCommId === requestId) setExpandedDirectCommId(null);
      alert('✅ Request deleted permanently.');
      fetchRequests();
      window.dispatchEvent(new Event(DASHBOARD_REFRESH_EVENT));
    } catch (err) {
      console.error(`❌ Failed to delete request ${requestId}:`, err);
      alert(err?.response?.data?.message || 'Failed to delete request.');
    }
  };

  return (
    <>
      <div className="p-6">
      <Card className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-1">All Purchase Requests</h1>
            <p className="text-sm text-gray-600">Track all submitted requests, filter quickly, and take actions by request.</p>
          </div>
          <button
            type="button"
            className="self-start rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={fetchRequests}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {requestSummary.map((item) => (
          <Card key={item.label}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{item.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <p className="text-sm font-medium text-gray-700">Filters & export</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Showing <strong className="text-gray-700">{requests.length}</strong> of <strong className="text-gray-700">{totalRequests}</strong> request(s)</span>
            {filtersChanged && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Unsaved filter changes</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <select className="border p-2 rounded" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All Requests</option>
            <option value="unassigned">Unassigned Only</option>
        </select>

        <select className="border p-2 rounded" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="">Newest First</option>
          <option value="assigned">Sort by Assigned</option>
        </select>

        <select className="border p-2 rounded" value={requestType} onChange={(e) => setRequestType(e.target.value)}>
          <option value="">All Types</option>
          {REQUEST_TYPE_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          className="border p-2 rounded"
          placeholder="Search keyword"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <input
          type="text"
          className="border p-2 rounded"
          placeholder="Request ID"
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
        />

        <input
          type="text"
          className="border p-2 rounded"
          placeholder="Maintenance Reference Number"
          value={maintenanceRefNumber}
          onChange={(e) => setMaintenanceRefNumber(e.target.value)}
        />

        <select className="border p-2 rounded" value={currentStep} onChange={(e) => setCurrentStep(e.target.value)}>
          <option value="">All Current Steps</option>
          {CURRENT_STEP_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          className="border p-2 rounded"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />

        <input
          type="date"
          className="border p-2 rounded"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />

        <select className="border p-2 rounded" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Partially Procured">Partially Procured</option>
          <option value="Received">Received</option>
          <option value="Rejected">Rejected</option>
          <option value="Completed">Completed</option>
        </select>

        <select
          className="border p-2 rounded"
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value);
            setSection('');
          }}
        >
          <option value="">All Departments</option>
          {departments.map((dep) => (
            <option key={dep.id} value={dep.id}>
              {dep.name}
            </option>
          ))}
        </select>

        <select className="border p-2 rounded" value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">All Sections</option>
          {sectionOptions.map((sec) => (
            <option key={sec.id} value={sec.id}>
              {department ? sec.name : `${sec.departmentName} — ${sec.name}`}
            </option>
          ))}
        </select>

        <select className="border p-2 rounded" value={assignedUser} onChange={(e) => setAssignedUser(e.target.value)}>
          <option value="">All Assigned Users</option>
          <option value="unassigned">Unassigned</option>
          {procurementUsers.map((procurementUser) => (
            <option key={procurementUser.id} value={procurementUser.id}>
              {procurementUser.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700" htmlFor="print-language">
            {PRINT_TRANSLATIONS[printLanguage].printLanguage}
          </label>
          <select
            id="print-language"
            className="border p-2 rounded"
            value={printLanguage}
            onChange={(e) => setPrintLanguage(e.target.value)}
          >
            <option value="en">{PRINT_TRANSLATIONS.en.english}</option>
            <option value="ar">{PRINT_TRANSLATIONS.en.arabic}</option>
          </select>
        </div>

        <button
          onClick={applyFilters}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Apply Filters
        </button>

        <button
          onClick={clearFilters}
          className="bg-white text-gray-700 border px-4 py-2 rounded hover:bg-gray-50"
        >
          Clear Filters
        </button>

        <button
          onClick={() => handleExport('csv')}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          disabled={loadingExport}
        >
          {loadingExport ? 'Exporting...' : 'Export CSV'}
        </button>

        <button
          onClick={() => handleExport('pdf')}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          disabled={loadingExport}
        >
          {loadingExport ? 'Exporting...' : 'Export PDF'}
        </button>
        </div>
      </Card>

      <RequestViewModeToggle
        className="mb-4"
        value={requestViewMode}
        onChange={setRequestViewMode}
        description="Use summary view to scan IT, stock, non-stock, maintenance, and other request types without opening every detailed card."
      />

      {loading ? (
        <p className="text-gray-600">Loading requests...</p>
      ) : requests.length === 0 ? (
        <Card><p className="text-sm text-gray-600">No requests found for the selected filters. Try adjusting or clearing filters.</p></Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const step = getCurrentStep(request);
            const isUrgent = Boolean(request?.is_urgent);
            const cardClasses = isUrgent
              ? 'border-red-300 ring-1 ring-red-200/70 bg-red-50/70'
              : '';
            const requesterDisplay = getRequesterDisplay(request);
            const showCommunication =
              canViewCommunication && isPostApprovalStatus(request.status);
            const isCommunicationExpanded = expandedCommunicationId === request.id;
            const showDirectPurchaseSection = canDocumentDirectPurchase && isUrgent;
            const isDirectPurchaseExpanded = expandedDirectCommId === request.id;
            const statusLabel = request.status || step;
            const loadedItems = itemsMap[request.id] || [];
            const itemCount = Number(
              request.item_count ?? request.items_count ?? loadedItems.length ?? 0,
            );
            const attachmentCount = Number(
              request.attachment_count ?? request.attachments_count ?? (attachmentsMap[request.id] || []).length,
            );
            const estimatedCostValue = Number(request.estimated_cost || 0);
            const assignedDisplay = request.assigned_user_name
              ? `${request.assigned_user_name} (${request.assigned_user_role})`
              : request.split_assignees?.length > 0
              ? `Split among ${request.split_assignees.map((user) => user.name).join(', ')}`
              : 'Not Assigned';

            const toggleCommunication = (requestId) => {
              const nextId = expandedCommunicationId === requestId ? null : requestId;
              setExpandedCommunicationId(nextId);

              if (nextId && !communicationList[requestId] && !communicationLoading[requestId]) {
                refreshCommunications(requestId);
              }
            };

            return (
              <Card key={request.id} className={`transition ${cardClasses}`}>
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div className={isSummaryRequestView ? 'min-w-0 flex-1 space-y-2' : 'space-y-1'}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-semibold text-gray-800">ID: {request.id}</p>
                      {isUrgent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
                          <span className="block h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                          Urgent
                        </span>
                      )}
                      {isSummaryRequestView && (
                        <>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getStepColor(step)}`}>
                            {step}
                          </span>
                          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                            {request.request_type || 'Request'}
                          </span>
                        </>
                      )}
                    </div>

                    {isSummaryRequestView ? (
                      <>
                        <p className="line-clamp-2 text-sm font-medium text-gray-800">
                          {request.justification || 'No justification provided.'}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600" aria-label={`Summary for request ${request.id}`}>
                          {getMaintenanceReference(request) && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5">Maintenance Ref #: {getMaintenanceReference(request)}</span>
                          )}
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">Project: {request.project_name || '—'}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">Department: {request.department_name || '—'}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">Requester: {requesterDisplay}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">Assigned: {assignedDisplay}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">Items: {Number.isFinite(itemCount) ? itemCount : 0}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">Attachments: {attachmentCount}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">Estimated: {estimatedCostValue.toLocaleString()} IQD</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <p><strong>Type:</strong> {request.request_type}</p>
                        {getMaintenanceReference(request) && (
                          <p>
                            <strong>Maintenance Ref #:</strong> {getMaintenanceReference(request)}
                          </p>
                        )}
                        <p>
                          <strong>Project:</strong> {request.project_name || '—'}
                        </p>
                        <p>
                          <strong>Department:</strong> {request.department_name || '—'}
                        </p>
                        <p>
                          <strong>Section:</strong> {request.section_name || '—'}
                        </p>
                        <p>
                          <strong>Requester:</strong> {requesterDisplay}
                        </p>
                        <p><strong>Justification:</strong> {request.justification}</p>
                        <p>
                          <strong>Assigned To:</strong> {assignedDisplay}
                        </p>
                        <p>
                          <strong>Current Step:</strong>{' '}
                          <span className={`px-2 py-1 rounded ${getStepColor(step)}`}>
                            {step}
                          </span>
                          {request.current_approver_role && request.current_approval_level && (
                            <> (Level {request.current_approval_level})</>
                          )}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Link
                      to={`/requests/${request.id}`}
                      className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Open Workspace
                    </Link>
                    <button
                      className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                      onClick={() => handlePrint(request.id)}
                    >
                      Print
                    </button>
                    {canRemindCurrentApprover && (
                      <button
                        type="button"
                        className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => handleRemindCurrentApprover(request.id)}
                        disabled={remindingApproverIds.has(request.id) || !request.current_approver_role}
                        title={request.current_approver_role ? 'Email a reminder to the current approver' : 'No current approver to remind'}
                      >
                        {remindingApproverIds.has(request.id) ? 'Sending reminder...' : 'Remind Approver'}
                      </button>
                    )}
                    {canHardDeleteRequests && (
                      <button
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        onClick={() => handleHardDelete(request.id)}
                      >
                        Delete Permanently
                      </button>
                    )}
                    <button
                      className="text-blue-600 underline"
                      onClick={() => toggleItems(request.id)}
                      disabled={loadingItemsId === request.id}
                    >
                      {expandedItemsId === request.id ? 'Hide Items' : 'View Items'}
                    </button>
                    <button
                      className="text-blue-600 underline"
                      onClick={() => toggleAttachments(request.id)}
                      disabled={attachmentLoadingMap[request.id]}
                    >
                      {expandedAttachmentsId === request.id ? 'Hide Attachments' : 'View Attachments'}
                    </button>
                    <button
                      className="text-blue-600 underline"
                      onClick={() => toggleApprovals(request.id)}
                      disabled={loadingApprovalsId === request.id}
                    >
                      {expandedApprovalsId === request.id ? 'Hide Approvals' : 'View Approvals'}
                    </button>
                    {showCommunication && (
                      <button
                        className="text-indigo-700 underline"
                        onClick={() => toggleCommunication(request.id)}
                        disabled={communicationLoading[request.id]}
                      >
                        {isCommunicationExpanded ? 'Hide Status Chat' : 'View Status Chat'}
                      </button>
                    )}
                    {showDirectPurchaseSection && (
                      <button
                        className="text-amber-700 underline"
                        onClick={() =>
                          setExpandedDirectCommId(
                            isDirectPurchaseExpanded ? null : request.id
                          )
                        }
                        disabled={directPurchaseSending[request.id]}
                      >
                        {isDirectPurchaseExpanded
                          ? 'Hide Direct Purchase Note'
                          : 'Document Direct Purchase'}
                      </button>
                    )}
                    {request.status === 'Approved' && (
                      <button
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        onClick={() =>
                          setExpandedAssignId(
                            expandedAssignId === request.id ? null : request.id
                          )
                        }
                      >
                        {expandedAssignId === request.id
                          ? 'Hide'
                          : request.assigned_user_name
                          ? 'Reassign'
                          : 'Assign'}
                      </button>
                    )}
                  </div>
                </div>

                {expandedAssignId === request.id && (
                  <AssignRequestPanel
                    requestId={request.id}
                    currentAssignee={request.assigned_user_name}
                    onSuccess={fetchRequests}
                  />
                )}

                {expandedAttachmentsId === request.id && (
                  <div className="mt-4 border-t pt-2">
                    <RequestAttachmentsSection
                      attachments={attachmentsMap[request.id] || []}
                      isLoading={Boolean(attachmentLoadingMap[request.id])}
                      error={attachmentErrorMap[request.id]}
                      onDownload={handleDownloadAttachment}
                      downloadingAttachmentId={downloadingAttachmentId}
                      onRetry={() => loadAttachmentsForRequest(request.id, { force: true })}
                    />
                  </div>
                )}

                {expandedItemsId === request.id && (
                  <div className="mt-4 border-t pt-2">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">Requested Items</h3>
                        <p className="text-xs text-gray-500">
                          Sort items in this request view only; the saved request order is unchanged.
                        </p>
                      </div>
                      {itemsMap[request.id]?.length > 1 && (
                        <button
                          type="button"
                          aria-pressed={alphabetizedItemsId === request.id}
                          onClick={() =>
                            setAlphabetizedItemsId((prev) => (prev === request.id ? null : request.id))
                          }
                          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100"
                        >
                          {alphabetizedItemsId === request.id ? 'Original order' : 'Sort A-Z'}
                        </button>
                      )}
                    </div>
                    {loadingItemsId === request.id ? (
                      <p className="text-gray-500">Loading items...</p>
                    ) : itemsMap[request.id]?.length > 0 ? (
                      <table className="w-full text-sm border">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border p-1">Item</th>
                            <th className="border p-1">Specs</th>
                            <th className="border p-1">Brand</th>
                            <th className="border p-1">Qty</th>
                            <th className="border p-1">Procured Qty</th>
                            <th className="border p-1">Unit Cost</th>
                            <th className="border p-1">Total</th>
                            <th className="border p-1">Assigned To</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getDisplayItems(itemsMap[request.id], alphabetizedItemsId === request.id).map((item, idx) => (
                            <tr key={item.id ?? idx}>
                              <td className="border p-1 align-top font-medium text-gray-900">
                                {item.item_name}
                              </td>
                              <td className="border p-1 align-top whitespace-pre-wrap text-gray-700">
                                {item.specs || '—'}
                              </td>
                              <td className="border p-1 align-top">{item.brand || '—'}</td>
                              <td className="border p-1 align-top">{item.quantity}</td>
                              <td className="border p-1 align-top">{item.purchased_quantity ?? 0}</td>
                              <td className="border p-1 align-top">{item.unit_cost}</td>
                              <td className="border p-1 align-top">{item.total_cost}</td>
                              <td className="border p-1 align-top">{item.assigned_user_name || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  ) : (
                    <p className="text-sm text-gray-500">No items found.</p>
                  )}
                </div>
              )}

              {expandedApprovalsId === request.id && (
                <div className="mt-4 border-t pt-2">
                  <ApprovalTimeline
                    approvals={approvalsMap[request.id]}
                    isLoading={loadingApprovalsId === request.id}
                    isUrgent={Boolean(request?.is_urgent)}
                  />
                </div>
              )}

              {showDirectPurchaseSection && isDirectPurchaseExpanded && (
                <div className="mt-4 border-t pt-3 space-y-3 rounded border-amber-200 bg-amber-50 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        Urgent Direct Purchase Communication
                      </p>
                      <p className="text-xs text-amber-700">
                        Document urgent department-led purchasing so supply chain can align and follow up.
                      </p>
                    </div>
                    <p className="text-xs text-amber-800 font-medium">
                      Recipients: Supply Chain + Requesting Department
                    </p>
                  </div>

                  {directPurchaseError[request.id] && (
                    <p className="text-xs text-rose-700">{directPurchaseError[request.id]}</p>
                  )}
                  {directPurchaseSuccess[request.id] && (
                    <p className="text-xs text-emerald-700">{directPurchaseSuccess[request.id]}</p>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-amber-900">
                        What is being purchased directly?
                      </label>
                      <textarea
                        className="w-full rounded border border-amber-200 bg-white p-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        rows={3}
                        placeholder="Describe the items or services procured directly and who initiated it."
                        value={directPurchaseDrafts[request.id] || ''}
                        onChange={(event) =>
                          setDirectPurchaseDrafts((prev) => ({
                            ...prev,
                            [request.id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-amber-900">
                        Urgency / policy alignment notes (optional)
                      </label>
                      <textarea
                        className="w-full rounded border border-amber-200 bg-white p-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        rows={3}
                        placeholder="Share the urgency reason, risk, or policy guidance needed from supply chain."
                        value={directPurchaseUrgency[request.id] || ''}
                        onChange={(event) =>
                          setDirectPurchaseUrgency((prev) => ({
                            ...prev,
                            [request.id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 disabled:opacity-70"
                      onClick={() => handleSendDirectCommunication(request.id)}
                      disabled={!!directPurchaseSending[request.id]}
                    >
                      {directPurchaseSending[request.id] ? 'Sending...' : 'Send update'}
                    </button>
                    <p className="text-xs text-amber-800">
                      These notes are logged to the request and shared with supply chain stakeholders.
                    </p>
                  </div>

                  {(directPurchaseEntries[request.id] || []).slice(0, 3).map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded border border-amber-100 bg-white px-3 py-2 text-xs text-slate-700"
                    >
                      <div className="flex flex-wrap justify-between gap-1">
                        <span className="font-semibold text-amber-900">
                          Direct purchase documented
                        </span>
                        <span className="text-slate-500">
                          {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-slate-700">{entry.comments}</p>
                    </div>
                  ))}
                </div>
              )}

              {showCommunication && isCommunicationExpanded && (
                <div className="mt-4 border-t pt-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-indigo-900">SCM Status Communication</p>
                      <p className="text-xs text-indigo-700">
                        Discuss the status of this approved request (current status: {statusLabel}).
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-medium text-indigo-700 underline"
                      onClick={() => refreshCommunications(request.id)}
                      disabled={communicationLoading[request.id]}
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="space-y-2">
                    {communicationLoading[request.id] && (
                      <p className="text-xs text-indigo-700">Loading communications...</p>
                    )}
                    {communicationError[request.id] && (
                      <p className="text-xs text-rose-600">{communicationError[request.id]}</p>
                    )}
                    {communicationSuccess[request.id] && (
                      <p className="text-xs text-emerald-700">{communicationSuccess[request.id]}</p>
                    )}

                    {(communicationList[request.id] || []).slice(0, 6).map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded border border-indigo-100 bg-white px-3 py-2 text-xs text-slate-700"
                      >
                        <div className="flex flex-wrap justify-between gap-1">
                          <span className="font-semibold text-indigo-900">{entry.actor_name || 'Unknown'}</span>
                          <span className="text-slate-500">{entry.status_at_time || 'Pending'}</span>
                          <span className="text-slate-400">
                            {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-slate-700">{entry.comments}</p>
                      </div>
                    ))}

                    {canSendCommunication && (
                      <div className="space-y-2">
                        <textarea
                          className="w-full rounded border border-indigo-200 bg-white p-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          rows={3}
                          placeholder="Share an update with the SCM team..."
                          value={communicationDrafts[request.id] || ''}
                          onChange={(event) =>
                            setCommunicationDrafts((prev) => ({
                              ...prev,
                              [request.id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          className="bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 disabled:opacity-70"
                          onClick={() => handleSendCommunication(request.id, statusLabel)}
                          disabled={!!communicationSending[request.id]}
                        >
                          {communicationSending[request.id] ? 'Sending...' : 'Send to SCM'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
            );
          })}
        </div>
      )}

      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        className="mt-6"
        summary={`Page ${page} of ${totalPages}`}
      />
     </div>
    </>
  );
};

export default AllRequestsPage;