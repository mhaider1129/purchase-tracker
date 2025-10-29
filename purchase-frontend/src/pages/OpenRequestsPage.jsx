// src/pages/OpenRequestsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import { saveAs } from 'file-saver';
import { useTranslation } from 'react-i18next';
import ApprovalTimeline from '../components/ApprovalTimeline';
import useApprovalTimeline from '../hooks/useApprovalTimeline';
import usePageTranslation from '../utils/usePageTranslation';

const OpenRequestsPage = () => {
  const { t } = useTranslation();
  const tr = usePageTranslation('openRequests');
  const roleLabels = useMemo(
    () => ({
      HOD: tr('roleLabels.hod', 'HOD Approval'),
      CMO: tr('roleLabels.cmo', 'CMO Approval'),
      SCM: tr('roleLabels.scm', 'SCM Approval'),
      COO: tr('roleLabels.coo', 'COO Approval'),
      CEO: tr('roleLabels.ceo', 'CEO Approval'),
      CFO: tr('roleLabels.cfo', 'CFO Approval'),
      WarehouseManager: tr('roleLabels.warehouseManager', 'Warehouse Manager Approval'),
      WarehouseKeeper: tr('roleLabels.warehouseKeeper', 'Warehouse Keeper Approval'),
      ProcurementSpecialist: tr(
        'roleLabels.procurementSpecialist',
        'Procurement Specialist Action'
      ),
    }),
    [tr]
  );
  const [requests, setRequests] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [requestType, setRequestType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    requestType: '',
    status: '',
    fromDate: '',
    toDate: '',
  });
  const [expandedId, setExpandedId] = useState(null);
  const [itemsMap, setItemsMap] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const {
    expandedApprovalsId,
    approvalsMap,
    loadingApprovalsId,
    toggleApprovals,
    resetApprovals,
  } = useApprovalTimeline();
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
    [t]
  );

  useEffect(() => {
    const fetchOpenRequests = async () => {
      setIsLoading(true);
      try {
        const params = { search };
        if (appliedFilters.requestType) params.requestType = appliedFilters.requestType;
        if (appliedFilters.status) params.status = appliedFilters.status;
        if (appliedFilters.fromDate) params.from_date = appliedFilters.fromDate;
        if (appliedFilters.toDate) params.to_date = appliedFilters.toDate;

        const res = await api.get('/api/requests/my', { params });
        const open = res.data.filter(
          (r) => !['completed', 'rejected'].includes((r.status || '').toLowerCase())
        );
        setRequests(open);
        setFiltered(open);
        resetApprovals();
      } catch (err) {
        console.error('❌ Failed to load requests:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOpenRequests();
  }, [resetApprovals, search, appliedFilters]);

  useEffect(() => {
    let data = [...requests];

    if (requestType) {
      const normalizedType = requestType.toLowerCase();
      data = data.filter((r) => (r.request_type || '').toLowerCase() === normalizedType);
    }

    if (statusFilter) {
      const normalizedStatus = statusFilter.toLowerCase();
      data = data.filter((r) => (r.status || '').toLowerCase() === normalizedStatus);
    }

    setFiltered(data);
    setCurrentPage(1);
  }, [requestType, statusFilter, requests]);

  const handleFilter = () => {
    setAppliedFilters({
      requestType,
      status: statusFilter,
      fromDate,
      toDate,
    });
    setCurrentPage(1);
  };

  const statusSummary = useMemo(() => {
    const base = {
      submitted: 0,
      pending: 0,
      approved: 0,
      other: 0,
    };

    requests.forEach((req) => {
      const key = (req.status || '').toLowerCase();
      if (['submitted', 'pending', 'approved'].includes(key)) {
        base[key] += 1;
      } else {
        base.other += 1;
      }
    });

    return {
      total: requests.length,
      ...base,
    };
  }, [requests]);

  const handleStatusCardClick = (value) => {
    if (value === 'total') {
      return;
    }
    setStatusFilter((prev) => (prev === value ? '' : value));
  };

  const exportToCSV = () => {
    const rows = [
      [
        tr('csvHeaders.id', 'ID'),
        tr('csvHeaders.type', 'Type'),
        tr('csvHeaders.project', 'Project'),
        tr('csvHeaders.status', 'Status'),
        tr('csvHeaders.cost', 'Cost'),
        tr('csvHeaders.submitted', 'Submitted'),
      ],
      ...filtered.map((r) => [
        r.id,
        r.request_type,
        r.project_name || '',
        r.status,
        r.estimated_cost,
        new Date(r.created_at).toLocaleString(),
      ]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const fileName = `${tr('csvFileName', 'My_Open_Requests')}.csv`;
    saveAs(blob, fileName);
  };

  const toggleExpand = async (requestId) => {
    if (expandedId === requestId) {
      setExpandedId(null);
      return;
    }
    if (!itemsMap[requestId]) {
      try {
        setLoadingId(requestId);
        const res = await api.get(`/api/requests/${requestId}/items`);
        setItemsMap((prev) => ({ ...prev, [requestId]: res.data.items }));
      } catch (err) {
        console.error('❌ Failed to load items:', err);
      } finally {
        setLoadingId(null);
      }
    }
    setExpandedId(requestId);
  };

  const getStatusColor = (value = '') => {
    switch (value.toLowerCase()) {
      case 'approved': return 'text-green-600';
      case 'rejected': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getRoleLabel = (role) => {
    if (!role) return '';
    if (roleLabels[role]) return roleLabels[role];
    return role.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
  };

  const getCurrentStage = (req) => {
    const normalizedStatus = req.status?.toLowerCase();

    if (!req.status) return tr('stageUnknown', 'Status unavailable');

    if (['approved', 'rejected', 'completed'].includes(normalizedStatus)) {
      return t('openRequests.stageFinalized', { status: req.status });
    }

    if (req.current_approver_role) {
      const step = getRoleLabel(req.current_approver_role);
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

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{t('openRequests.title')}</h1>
          <button
            onClick={exportToCSV}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {t('openRequests.exportCSV')}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {[
            { label: tr('total'), value: 'total', count: statusSummary.total },
            { label: tr('submitted'), value: 'submitted', count: statusSummary.submitted },
            { label: tr('pending'), value: 'pending', count: statusSummary.pending },
            { label: tr('approved'), value: 'approved', count: statusSummary.approved },
          ].map(({ label, value, count }) => (
            <button
              key={value}
              onClick={() => handleStatusCardClick(value)}
              className={`border rounded-lg p-4 text-left shadow-sm transition-colors ${
                value !== 'total' && statusFilter === value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              } ${value === 'total' ? 'cursor-default' : 'hover:border-blue-400'}`}
              type="button"
              disabled={value === 'total'}
            >
              <p className="text-sm text-gray-500 uppercase tracking-wide">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{count}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row mb-4">
          <select
            className="border p-2 rounded"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
          >
            <option value="">{tr('allTypes')}</option>
            <option value="Stock">{tr('stock')}</option>
            <option value="Non-Stock">{tr('nonStock')}</option>
            <option value="Medical Device">{tr('medicalDevice')}</option>
            <option value="Medication">{tr('medication')}</option>
            <option value="IT Item">{tr('itItem')}</option>
          </select>
          <select
            className="border p-2 rounded"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{tr('allStatuses')}</option>
            <option value="submitted">{tr('submitted')}</option>
            <option value="pending">{tr('pending')}</option>
            <option value="approved">{tr('approved')}</option>
          </select>
          <input
            type="date"
            className="border p-2 rounded"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label={tr('fromDate')}
            title={tr('fromDate')}
          />
          <input
            type="date"
            className="border p-2 rounded"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label={tr('toDate')}
            title={tr('toDate')}
          />
          <input
            type="text"
            className="border p-2 rounded"
            placeholder={tr('searchItems')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={handleFilter}
            type="button"
          >
            {tr('applyFilters')}
          </button>
        </div>

        {isLoading ? (
          <p className="text-gray-600">{t('common.loading')}</p>
        ) : paginated.length === 0 ? (
          <p>{tr('noRequests')}</p>
        ) : (
          <div className="space-y-4">
            {paginated.map((req) => (
              <div key={req.id} className="border rounded p-4 shadow">
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <p><strong>{tr('id')}:</strong> {req.id}</p>
                    <p><strong>{tr('type')}:</strong> {req.request_type}</p>
                    <p><strong>{tr('project')}:</strong> {req.project_name || '—'}</p>
                    {req.is_urgent && <p className="text-red-600 font-bold text-sm mt-1">{tr('urgent')}</p>}
                    <p>
                      <strong>{tr('status')}:</strong>{' '}
                      <span className={getStatusColor(req.status)}>{req.status}</span>
                    </p>
                    <p>
                      <strong>{tr('currentStage')}:</strong>{' '}
                      <span>{getCurrentStage(req)}</span>
                    </p>
                    <p>
                      <strong>{tr('cost')}:</strong> {req.estimated_cost}{' '}
                      {tr('currency', 'IQD')}
                    </p>
                    <p><strong>{tr('submitted')}:</strong> {new Date(req.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      className="text-blue-600 underline"
                      onClick={() => toggleExpand(req.id)}
                      disabled={loadingId === req.id}
                    >
                      {expandedId === req.id ? t('openRequests.hideItems') : t('openRequests.showItems')}
                    </button>
                    <button
                      className="text-blue-600 underline"
                      onClick={() => toggleApprovals(req.id)}
                      disabled={loadingApprovalsId === req.id}
                    >
                      {expandedApprovalsId === req.id ? t('common.hideApprovals') : t('common.viewApprovals')}
                    </button>
                  </div>
                </div>

                {expandedId === req.id && (
                  <div className="mt-4 border-t pt-2">
                    <h3 className="font-semibold mb-2">{tr('requestedItems')}</h3>
                    {itemsMap[req.id]?.length > 0 ? (
                      <table className="w-full text-sm border">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border p-1">{tr('item')}</th>
                            <th className="border p-1">{tr('brand', 'Brand')}</th>
                            <th className="border p-1">{tr('qty')}</th>
                            <th className="border p-1">{tr('unitCost')}</th>
                            <th className="border p-1">{tr('total')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsMap[req.id].map((item, idx) => (
                            <tr key={idx}>
                              <td className="border p-1">{item.item_name}</td>
                              <td className="border p-1">{item.brand || '—'}</td>
                              <td className="border p-1">{item.quantity}</td>
                              <td className="border p-1">{item.unit_cost}</td>
                              <td className="border p-1">{item.total_cost}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-sm text-gray-500">{tr('noItemsForRequest')}</p>
                    )}
                  </div>
                )}

                {expandedApprovalsId === req.id && (
                  <div className="mt-4 border-t pt-2">
                    <ApprovalTimeline
                      approvals={approvalsMap[req.id]}
                      isLoading={loadingApprovalsId === req.id}
                      labels={timelineLabels}
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            <div className="flex justify-center items-center gap-4 mt-6 text-sm">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                type="button"
              >
                {t('common.prev')}
              </button>
              <span>
                {t('common.pageOf', { current: currentPage, total: totalPages })}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                type="button"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default OpenRequestsPage;