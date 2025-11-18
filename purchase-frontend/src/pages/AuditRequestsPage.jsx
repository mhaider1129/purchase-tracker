import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import { saveAs } from 'file-saver';
import ApprovalTimeline from '../components/ApprovalTimeline';
import useApprovalTimeline from '../hooks/useApprovalTimeline';
import usePageTranslation from '../utils/usePageTranslation';

const AuditRequestsPage = () => {
  const { t } = useTranslation();
  const tr = usePageTranslation('auditRequests');
  const [requests, setRequests] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedItemsId, setExpandedItemsId] = useState(null);
  const [itemsMap, setItemsMap] = useState({});
  const [loadingItemsId, setLoadingItemsId] = useState(null);
  const {
    expandedApprovalsId,
    approvalsMap,
    loadingApprovalsId,
    toggleApprovals,
    resetApprovals,
  } = useApprovalTimeline();
  const statusOptions = useMemo(
    () => [
      { value: 'all', label: tr('filters.status.all', 'All Statuses') },
      { value: 'approved', label: tr('filters.status.approved', 'Approved') },
      { value: 'completed', label: tr('filters.status.completed', 'Completed') },
      { value: 'received', label: tr('filters.status.received', 'Received') },
      { value: 'rejected', label: tr('filters.status.rejected', 'Rejected') },
    ],
    [tr],
  );
  const typeOptions = useMemo(
    () => [
      { value: 'all', label: tr('filters.type.all', 'All Request Types') },
      { value: 'it item', label: tr('filters.type.itItem', 'IT Item') },
      { value: 'stock', label: tr('filters.type.stock', 'Stock') },
      { value: 'non-stock', label: tr('filters.type.nonStock', 'Non-Stock') },
    ],
    [tr],
  );
  const tableHeaders = useMemo(
    () => [
      tr('table.headers.id', 'ID'),
      tr('table.headers.type', 'Type'),
      tr('table.headers.project', 'Project'),
      tr('table.headers.justification', 'Justification'),
      tr('table.headers.status', 'Status'),
      tr('table.headers.approvalTimestamp', 'Approval Timestamp'),
      tr('table.headers.actions', 'Actions'),
    ],
    [tr],
  );
  const csvHeaders = useMemo(
    () =>
      tableHeaders.slice(0, 6),
    [tableHeaders],
  );
  const exportFileName = tr('export.fileName', 'Audit_Requests.csv');

  const stats = useMemo(() => {
    const totals = requests.reduce(
      (acc, req) => {
        const status = req.status?.toLowerCase();
        if (status === 'approved') acc.approved += 1;
        else if (status === 'rejected') acc.rejected += 1;
        acc.total += 1;
        return acc;
      },
      { total: 0, approved: 0, rejected: 0 }
    );

    return totals;
  }, [requests]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setFromDate('');
    setToDate('');
  };

  const getStatusLabel = (status) => {
    if (!status) {
      return tr('statuses.unknown', 'Unknown');
    }
    return tr(`statuses.${status.toLowerCase()}`, status);
  };

  const exportCSV = (data) => {
    const rows = [
      csvHeaders,
      ...data.map((r) => [
        r.id,
        r.request_type,
        r.project_name || '',
        r.justification || '',
        getStatusLabel(r.status),
        r.approval_timestamp ? new Date(r.approval_timestamp).toLocaleString() : '',
      ]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, exportFileName);
  };

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/requests/audit/approved-rejected');
        setRequests(res.data);
        setFiltered(res.data);
        resetApprovals();
        setExpandedItemsId(null);
        setItemsMap({});
        setLoadingItemsId(null);
      } catch (err) {
        console.error('Failed to fetch audit requests:', err);
        alert(tr('alerts.loadFailed', 'Failed to load audit requests.'));
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [resetApprovals]);

  const toggleItems = async (requestId) => {
    if (expandedItemsId === requestId) {
      setExpandedItemsId(null);
      return;
    }

    if (!itemsMap[requestId]) {
      try {
        setLoadingItemsId(requestId);
        const res = await axios.get(`/api/requests/${requestId}/items`);
        setItemsMap((prev) => ({ ...prev, [requestId]: res.data.items || [] }));
      } catch (err) {
        console.error(`❌ Failed to load items for request ${requestId}:`, err);
        alert(tr('alerts.itemsLoadFailed', 'Failed to load items.'));
      } finally {
        setLoadingItemsId(null);
      }
    }

    setExpandedItemsId(requestId);
  };

  useEffect(() => {
    const term = search.trim().toLowerCase();
    const filteredRequests = requests.filter((r) => {
      const matchesSearch =
        !term ||
        r.request_type?.toLowerCase().includes(term) ||
        r.justification?.toLowerCase().includes(term) ||
        r.status?.toLowerCase().includes(term) ||
        r.project_name?.toLowerCase().includes(term) ||
        String(r.id).includes(term);

      if (!matchesSearch) return false;

      const matchesStatus =
        statusFilter === 'all' || r.status?.toLowerCase() === statusFilter;
      if (!matchesStatus) return false;

      const matchesType =
        typeFilter === 'all' || r.request_type?.toLowerCase() === typeFilter;
      if (!matchesType) return false;


      if (!fromDate && !toDate) return true;

      const approvalDate = r.approval_timestamp ? new Date(r.approval_timestamp) : null;
      if (!approvalDate) return false;

      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

      if (from && approvalDate < from) return false;
      if (to && approvalDate > to) return false;

      return true;
    });

    setFiltered(filteredRequests);
  }, [fromDate, requests, search, statusFilter, toDate, typeFilter]);

  const renderStatusBadge = (status) => {
    const normalized = status?.toLowerCase();
    const styles =
      normalized === 'approved'
        ? 'bg-green-100 text-green-700'
        : normalized === 'rejected'
        ? 'bg-red-100 text-red-700'
        : 'bg-gray-100 text-gray-700';
    const label = getStatusLabel(status);

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles}`}>
        {label}
      </span>
    );
  };

  return (
    <>
      <Navbar />
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-semibold">{tr('title', 'Audit Requests')}</h1>
          <div className="flex gap-2">
            <button
              onClick={resetFilters}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50"
            >
              {tr('actions.reset', 'Reset Filters')}
            </button>
            <button
              onClick={() => exportCSV(filtered)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              {tr('actions.exportCsv', 'Export CSV')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500">{tr('stats.total', 'Total Requests')}</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500">{tr('stats.approved', 'Approved')}</p>
            <p className="text-2xl font-semibold text-green-600">{stats.approved}</p>
          </div>
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500">{tr('stats.rejected', 'Rejected')}</p>
            <p className="text-2xl font-semibold text-red-600">{stats.rejected}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <input
            type="text"
            className="border p-2 rounded"
            placeholder={tr('filters.searchPlaceholder', 'Search by ID, project, justification...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border p-2 rounded"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="border p-2 rounded"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {typeOptions.map((option) => (
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
            aria-label={tr('filters.from', 'From')}
          />
          <input
            type="date"
            className="border p-2 rounded"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label={tr('filters.to', 'To')}
          />
        </div>
        {loading ? (
          <p className="text-gray-500">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">{tr('table.empty', 'No requests found.')}</p>
        ) : (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {tableHeaders.map((header, index) => (
                    <th key={index} className="p-2 border">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => (
                  <React.Fragment key={req.id}>
                    <tr>
                      <td className="p-2 border">{req.id}</td>
                      <td className="p-2 border">{req.request_type}</td>
                      <td className="p-2 border">{req.project_name || '—'}</td>
                      <td className="p-2 border max-w-xs">
                        <span className="block truncate" title={req.justification}>
                          {req.justification || '—'}
                        </span>
                      </td>
                      <td className="p-2 border">{renderStatusBadge(req.status)}</td>
                      <td className="p-2 border">
                        {req.approval_timestamp
                          ? new Date(req.approval_timestamp).toLocaleString()
                          : ''}
                      </td>
                      <td className="p-2 border">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="text-blue-600 underline"
                            onClick={() => toggleItems(req.id)}
                            disabled={loadingItemsId === req.id}
                          >
                            {loadingItemsId === req.id
                              ? t('common.loading')
                              : expandedItemsId === req.id
                              ? tr('table.actions.hideItems', 'Hide Items')
                              : tr('table.actions.viewItems', 'View Items')}
                          </button>
                          <button
                            className="text-blue-600 underline"
                            onClick={() => toggleApprovals(req.id)}
                            disabled={loadingApprovalsId === req.id}
                          >
                            {loadingApprovalsId === req.id
                              ? t('common.loading')
                              : expandedApprovalsId === req.id
                              ? t('common.hideApprovals')
                              : t('common.viewApprovals')}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedItemsId === req.id && (
                      <tr>
                        <td colSpan={7} className="p-4 bg-gray-50 border-t">
                          <h3 className="font-semibold mb-2">{tr('items.title', 'Requested Items')}</h3>
                          {loadingItemsId === req.id ? (
                            <p className="text-gray-500">{tr('items.loading', 'Loading items...')}</p>
                          ) : itemsMap[req.id]?.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border p-1">{tr('items.headers.item', 'Item')}</th>
                                    <th className="border p-1">{tr('items.headers.brand', 'Brand')}</th>
                                    <th className="border p-1">{tr('items.headers.quantity', 'Qty')}</th>
                                    <th className="border p-1">{tr('items.headers.unitCost', 'Unit Cost')}</th>
                                    <th className="border p-1">{tr('items.headers.total', 'Total')}</th>
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
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">{tr('items.empty', 'No items found.')}</p>
                          )}
                        </td>
                      </tr>
                    )}
                    {expandedApprovalsId === req.id && (
                      <tr>
                        <td colSpan={7} className="p-4 bg-gray-50 border-t">
                          <h3 className="font-semibold mb-2">{t('common.approvalTimeline')}</h3>
                          <ApprovalTimeline
                            approvals={approvalsMap[req.id]}
                            isLoading={loadingApprovalsId === req.id}
                            isUrgent={Boolean(req?.is_urgent)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default AuditRequestsPage;