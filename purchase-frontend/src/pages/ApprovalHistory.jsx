//src/pages/ApprovalHistory.js
import { useTranslation } from 'react-i18next';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import useCurrentUser from '../hooks/useCurrentUser';
import useStatusCommunications from '../hooks/useStatusCommunications';

const ApprovalHistory = () => {
  const { t } = useTranslation();
  const [history, setHistory] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCommunicationId, setExpandedCommunicationId] = useState(null);
  const [expandedItemsId, setExpandedItemsId] = useState(null);
  const [itemsMap, setItemsMap] = useState({});
  const [loadingItemsId, setLoadingItemsId] = useState(null);
  const { user } = useCurrentUser();
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

    // Load departments
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

  const applySearch = useCallback((items, term) => {
    if (!term.trim()) return items;

    const lowered = term.toLowerCase();
    return items.filter((item) =>
      [
        item.request_id,
        item.request_type,
        item.department_name,
        item.project_name,
        item.justification,
        item.status,
        item.decision,
        item.comments,
      ]
        .filter(Boolean)
        .some((value) => value.toString().toLowerCase().includes(lowered))
    );
  }, []);

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) return value;

    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 2,
    }).format(numberValue);
  };

  const getRequestItems = (requestId) => (Array.isArray(itemsMap[requestId]) ? itemsMap[requestId] : []);

  const summarizeRequestItems = (items) => {
    if (!items.length) return 'Open the request items view to load item details';
    return items.map((requestItem) => `${requestItem.item_name || 'Unnamed item'} (${requestItem.quantity ?? '—'})`).join('; ');
  };

  const toggleItems = async (requestId) => {
    if (expandedItemsId === requestId) {
      setExpandedItemsId(null);
      return;
    }

    if (!itemsMap[requestId]) {
      try {
        setLoadingItemsId(requestId);
        const res = await axios.get(`/requests/${requestId}/items`);
        setItemsMap((prev) => ({ ...prev, [requestId]: res.data.items || [] }));
      } catch (err) {
        console.error(`❌ Failed to load items for request ${requestId}:`, err);
        setError('Failed to load request items');
      } finally {
        setLoadingItemsId(null);
      }
    }

    setExpandedItemsId(requestId);
  };

  const statusVariant = {
    Approved: 'text-green-700 bg-green-100 border-green-200',
    Rejected: 'text-red-700 bg-red-100 border-red-200',
    Pending: 'text-yellow-700 bg-yellow-100 border-yellow-200',
  };

  const isPostApprovalStatus = (status) => {
    const normalized = (status || '').toLowerCase();
    return [
      'approved',
      'assigned',
      'technical_inspection_pending',
      'completed',
      'received',
    ].includes(normalized);
  };

  const resetFilters = () => {
    setStatusFilter('');
    setFromDate('');
    setToDate('');
    setDepartment('');
    setSearchTerm('');
  };

  const summary = useMemo(() => {
    const base = {
      total: filtered.length,
      approved: 0,
      rejected: 0,
      pending: 0,
      spend: 0,
    };

    return filtered.reduce((acc, item) => {
      if (item.decision === 'Approved') acc.approved += 1;
      if (item.decision === 'Rejected') acc.rejected += 1;
      if (item.status === 'Pending' || item.decision === 'Pending') acc.pending += 1;
      const cost = Number(item.estimated_cost);
      if (!Number.isNaN(cost)) {
        acc.spend += cost;
      }
      return acc;
    }, base);
  }, [filtered]);

  // Fetch history whenever filters change
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const params = Object.fromEntries(
          Object.entries({
            status: statusFilter,
            from_date: fromDate,
            to_date: toDate,
            department_id: department,
          }).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
        );

        const res = await axios.get('/requests/approval-history', { params });
        setHistory(res.data);
        setFiltered(applySearch(res.data, searchTerm));
        setCurrentPage(1);
      } catch (err) {
        console.error('❌ Failed to fetch approval history:', err);
        setError('Failed to load approval history');
      } finally {
        setLoading(false);
      }
    };

     fetchHistory();
  }, [statusFilter, fromDate, toDate, department, searchTerm, applySearch]);

  useEffect(() => {
    setFiltered(applySearch(history, searchTerm));
    setCurrentPage(1);
  }, [history, searchTerm, applySearch]);

  const downloadCSV = () => {
    const sorted = [...filtered].sort((a, b) => new Date(b.approved_at) - new Date(a.approved_at));
    const csv = Papa.unparse(
      sorted.map(item => ({
        'Request ID': item.request_id,
        Type: item.request_type,
        Department: item.department_name,
        Project: item.project_name || '—',
        Justification: item.justification,
        Cost: formatCurrency(item.estimated_cost),
        'Final Status': item.status,
        'Your Decision': item.decision,
        'Your Comment': item.comments || '—',
        Items: summarizeRequestItems(getRequestItems(item.request_id)),
        Level: item.approval_level || '—',
        Date: item.approved_at ? new Date(item.approved_at).toLocaleString('en-GB') : '—'
      }))
    );

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `approval-history-${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = () => {
    const sorted = [...filtered].sort((a, b) => new Date(b.approved_at) - new Date(a.approved_at));
    const doc = new jsPDF();
    doc.text(t('approvalHistory.title'), 14, 15);

    const tableData = sorted.map(item => [
      item.request_id,
      item.request_type,
      item.department_name,
      item.project_name || '—',
      item.justification,
      formatCurrency(item.estimated_cost),
      item.status,
      item.decision,
      item.comments || '—',
      summarizeRequestItems(getRequestItems(item.request_id)),
      item.approval_level || '—',
      item.approved_at ? new Date(item.approved_at).toLocaleString('en-GB') : '—'
    ]);

    autoTable(doc, {
      head: [[
        'Request ID', 'Type', 'Department', 'Project', 'Justification', 'Cost', 'Final Status',
        'Your Decision', 'Comment', 'Items', 'Level', 'Date'
      ]],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 }
    });

    const today = new Date().toISOString().split('T')[0];
    doc.save(`approval-history-${today}.pdf`);
  };

  return (
    <>
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">{t('approvalHistory.title')}</h1>

        {/* 🔍 Filters */}
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-medium mb-1">{t('approvalHistory.filters.search')}</label>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('approvalHistory.filters.searchPlaceholder')}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('approvalHistory.filters.status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="">{t('approvalHistory.filters.all')}</option>
              <option value="Approved">{t('approvalHistory.filters.approved')}</option>
              <option value="Rejected">{t('approvalHistory.filters.rejected')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('approvalHistory.filters.department')}</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="">{t('approvalHistory.filters.all')}</option>
              {departments.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('approvalHistory.filters.from')}</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('approvalHistory.filters.to')}</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="p-2 border rounded"
            />
          </div>

          <button
            onClick={resetFilters}
            className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
          >
            Reset
          </button>
        </div>

        {/* 📁 Export Buttons */}
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={downloadCSV}
            title="Export to CSV"
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Download CSV
          </button>
          <button
            onClick={downloadPDF}
            title="Export to PDF"
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Download PDF
          </button>
          <div className="ml-auto flex items-center text-sm text-gray-500">
            <span>
              {t('approvalHistory.summary.showing', { filtered: filtered.length, total: history.length })}
            </span>
          </div>
        </div>

        {/* 📊 Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-6">
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <p className="text-sm text-gray-500">{t('approvalHistory.summary.total')}</p>
            <p className="text-2xl font-semibold text-gray-900">{summary.total}</p>
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <p className="text-sm text-gray-500">{t('approvalHistory.filters.approved')}</p>
            <p className="text-2xl font-semibold text-green-600">{summary.approved}</p>
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <p className="text-sm text-gray-500">{t('approvalHistory.filters.rejected')}</p>
            <p className="text-2xl font-semibold text-red-600">{summary.rejected}</p>
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <p className="text-sm text-gray-500">{t('approvalHistory.summary.pending')}</p>
            <p className="text-2xl font-semibold text-yellow-600">{summary.pending}</p>
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <p className="text-sm text-gray-500">{t('approvalHistory.summary.spend')}</p>
            <p className="text-2xl font-semibold text-gray-900">{formatCurrency(summary.spend)}</p>
          </div>
        </div>

        {/* 📋 Table */}
        {loading ? (
          <p>{t('approvalHistory.states.loading')}</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : filtered.length === 0 ? (
          <p>{t('approvalHistory.states.empty')}</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left uppercase tracking-wide text-xs text-gray-500">
                  <tr>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.requestId')}</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.type')}</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.department')}</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.requester')}</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.project')}</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.justification')}</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.cost')}</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.finalStatus')}</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.decision')}</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.comment')}</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.items')}</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.level')}</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.date')}</th>
                    {canViewCommunication && (
                      <th className="border-b border-gray-200 p-3 font-semibold">{t('approvalHistory.table.scm')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, idx) => (
                    <React.Fragment key={item.request_id || idx}>
                      <tr className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="border-r p-2 align-top text-gray-900 font-medium">{item.request_id}</td>
                        <td className="border-r p-2 align-top text-gray-700">{item.request_type}</td>
                        <td className="border-r p-2 align-top text-gray-700">{item.department_name}</td>
                        <td className="border-r p-2 align-top text-gray-700">
                          {item.requester_name}
                          {item.requester_role && ` (${item.requester_role})`}
                        </td>
                        <td className="border-r p-2 align-top text-gray-700">{item.project_name || '—'}</td>
                        <td className="border-r p-2 align-top text-gray-600 max-w-xs">
                          <p className="whitespace-pre-wrap leading-snug">{item.justification}</p>
                        </td>
                        <td className="border-r p-2 align-top text-gray-700">{formatCurrency(item.estimated_cost)}</td>
                        <td className="border-r p-2 align-top">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              statusVariant[item.status] || 'text-blue-700 bg-blue-100 border-blue-200'
                            }`}
                          >
                            {item.status || '—'}
                          </span>
                        </td>
                        <td className="border-r p-2 align-top">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              statusVariant[item.decision] || 'text-gray-700 bg-gray-100 border-gray-200'
                            }`}
                          >
                            {item.decision || '—'}
                          </span>
                        </td>
                        <td className="border-r p-2 align-top text-gray-600">
                          {item.comments ? (
                            <span className="block truncate max-w-[180px]" title={item.comments}>
                              {item.comments}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="border-r p-2 align-top text-gray-600">
                          <button
                            type="button"
                            className="text-blue-700 underline disabled:text-gray-400 disabled:no-underline"
                            onClick={() => toggleItems(item.request_id)}
                            disabled={loadingItemsId === item.request_id}
                          >
                            {loadingItemsId === item.request_id
                              ? t('approvalHistory.table.loadingItems')
                              : expandedItemsId === item.request_id
                                ? t('approvalHistory.table.hideItems')
                                : t('approvalHistory.table.viewItems')}
                          </button>
                        </td>
                        <td className="border-r p-2 align-top text-gray-600">{item.approval_level || '—'}</td>
                        <td className="p-2 align-top text-gray-600">
                          {item.approved_at
                            ? new Date(item.approved_at).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        {canViewCommunication && (
                          <td className="p-2 align-top text-gray-600">
                            {isPostApprovalStatus(item.status) ? (
                              <button
                                type="button"
                                className="text-indigo-700 underline"
                                onClick={() => {
                                  const nextId =
                                    expandedCommunicationId === item.request_id
                                      ? null
                                      : item.request_id;
                                  setExpandedCommunicationId(nextId);

                                  if (
                                    nextId &&
                                    !communicationList[item.request_id] &&
                                    !communicationLoading[item.request_id]
                                  ) {
                                    refreshCommunications(item.request_id);
                                  }
                                }}
                                disabled={communicationLoading[item.request_id]}
                              >
                                {expandedCommunicationId === item.request_id ? 'Hide' : 'View'} updates
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">{t('approvalHistory.table.notAvailable')}</span>
                            )}
                          </td>
                        )}
                      </tr>

                      {expandedItemsId === item.request_id && (
                        <tr className="bg-blue-50/40">
                          <td colSpan={canViewCommunication ? 14 : 13} className="p-3 align-top">
                            <p className="text-sm font-semibold text-blue-900">{t('approvalHistory.table.requestedItems', { id: item.request_id })}</p>
                            <div className="mt-3 overflow-x-auto rounded border border-blue-100 bg-white">
                              <table className="min-w-full text-xs">
                                <thead className="bg-blue-50 text-left uppercase tracking-wide text-blue-700">
                                  <tr>
                                    <th className="p-2 font-semibold">{t('approvalHistory.table.item')}</th>
                                    <th className="p-2 font-semibold">{t('approvalHistory.table.specs')}</th>
                                    <th className="p-2 font-semibold">{t('approvalHistory.table.brand')}</th>
                                    <th className="p-2 font-semibold">{t('approvalHistory.table.quantity')}</th>
                                    <th className="p-2 font-semibold">{t('approvalHistory.table.unitCost')}</th>
                                    <th className="p-2 font-semibold">{t('approvalHistory.table.totalCost')}</th>
                                    <th className="p-2 font-semibold">{t('approvalHistory.table.decision')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {getRequestItems(item.request_id).length > 0 ? (
                                    getRequestItems(item.request_id).map((requestItem, itemIdx) => (
                                      <tr key={requestItem.id ?? itemIdx} className="border-t border-blue-100">
                                        <td className="p-2 font-medium text-gray-900">{requestItem.item_name || '—'}</td>
                                        <td className="p-2 text-gray-700 whitespace-pre-wrap">{requestItem.specs || '—'}</td>
                                        <td className="p-2 text-gray-700">{requestItem.brand || '—'}</td>
                                        <td className="p-2 text-gray-700">{requestItem.quantity ?? '—'}</td>
                                        <td className="p-2 text-gray-700">{formatCurrency(requestItem.unit_cost)}</td>
                                        <td className="p-2 text-gray-700">{formatCurrency(requestItem.total_cost)}</td>
                                        <td className="p-2 text-gray-700">{requestItem.approval_status || '—'}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={7} className="border-t border-blue-100 p-3 text-center text-gray-500">{t('approvalHistory.table.noItems')}</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}

                      {canViewCommunication &&
                        expandedCommunicationId === item.request_id && (
                          <tr className="bg-indigo-50/40">
                            <td colSpan={14} className="p-3 align-top">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-indigo-900">{t('approvalHistory.table.communication')}</p>
                                  <p className="text-xs text-indigo-700">
                                    {t('approvalHistory.table.communicationHelp', { status: item.status || t('approvalHistory.table.unknown') })}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className="text-xs font-medium text-indigo-700 underline"
                                  onClick={() => refreshCommunications(item.request_id)}
                                  disabled={communicationLoading[item.request_id]}
                                >
                                  Refresh
                                </button>
                              </div>

                              <div className="mt-3 space-y-2">
                                {communicationLoading[item.request_id] && (
                                  <p className="text-xs text-indigo-700">{t('approvalHistory.table.loadingComms')}</p>
                                )}
                                {communicationError[item.request_id] && (
                                  <p className="text-xs text-rose-600">{communicationError[item.request_id]}</p>
                                )}
                                {communicationSuccess[item.request_id] && (
                                  <p className="text-xs text-emerald-700">{communicationSuccess[item.request_id]}</p>
                                )}

                                {(communicationList[item.request_id] || []).slice(0, 6).map((entry) => (
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
                                      placeholder={t('approvalHistory.table.commentsPlaceholder')}
                                      value={communicationDrafts[item.request_id] || ''}
                                      onChange={(event) =>
                                        setCommunicationDrafts((prev) => ({
                                          ...prev,
                                          [item.request_id]: event.target.value,
                                        }))
                                      }
                                    />
                                    <button
                                      className="bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 disabled:opacity-70"
                                      onClick={() => handleSendCommunication(item.request_id, item.status)}
                                      disabled={!!communicationSending[item.request_id]}
                                    >
                                      {communicationSending[item.request_id] ? 'Sending...' : 'Send to SCM'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 🔁 Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  Previous
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToPage(i + 1)}
                    className={`px-3 py-1 border rounded ${
                      currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default ApprovalHistory;
