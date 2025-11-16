import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import usePageTranslation from '../utils/usePageTranslation';
import { extractItems } from '../utils/itemUtils';

const statusClasses = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (err) {
    return value;
  }
};

const WarehouseSupplyRequestsPage = () => {
  const { t } = useTranslation();
  const tr = usePageTranslation('warehouseSupplyRequests');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    department: 'all',
    section: 'all',
    status: 'all',
    fromDate: '',
    toDate: '',
  });
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [itemsCache, setItemsCache] = useState({});
  const [itemsError, setItemsError] = useState({});
  const [itemsLoadingId, setItemsLoadingId] = useState(null);
  const navigate = useNavigate();

  const normalizeItems = (items = []) =>
    items.map((item) => ({
      ...item,
      item_id: item.item_id || item.id,
      item_name: item.item_name || item.name,
      quantity: Number(item.quantity ?? item.requested_quantity ?? 0),
      supplied_quantity: Number(item.supplied_quantity ?? item.supplied ?? 0),
    }));

  const getFulfillmentStats = (request) => {
    const items = itemsCache[request.id] || normalizeItems(request.items || []);
    const requestedTotal = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const suppliedTotal = items.reduce(
      (sum, item) => sum + Number(item.supplied_quantity || 0),
      0,
    );
    const outstanding = Math.max(requestedTotal - suppliedTotal, 0);
    const progress = requestedTotal
      ? Math.min(100, Math.round((suppliedTotal / requestedTotal) * 100))
      : 0;
    const fullySupplied =
      items.length > 0 &&
      items.every((item) => Number(item.supplied_quantity || 0) >= Number(item.quantity || 0));

    return { requestedTotal, suppliedTotal, outstanding, progress, fullySupplied };
  };
  const getStatusLabel = (status) => {
    if (!status) {
      return tr('statuses.unknown', 'Unknown');
    }
    return tr(`statuses.${status.toLowerCase()}`, status);
  };

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/warehouse-supply');
      const data = res.data || [];
      setRequests(data);
      setItemsCache((prev) => {
        const next = { ...prev };
        data.forEach((request) => {
          if (request.items && request.items.length > 0) {
            next[request.id] = normalizeItems(request.items);
          }
        });
        return next;
      });
    } catch (err) {
      console.error('Failed to load requests:', err);
      setError(
        tr('alerts.loadFailed', 'Failed to load warehouse supply requests. Please try again.'),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleFilterChange = (key) => (event) => {
    const value = event.target.value;
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      department: 'all',
      section: 'all',
      status: 'all',
      fromDate: '',
      toDate: '',
    });
  };

  const departments = useMemo(
    () => Array.from(new Set(requests.map((req) => req.department_name).filter(Boolean))).sort(),
    [requests],
  );

  const sections = useMemo(
    () => Array.from(new Set(requests.map((req) => req.section_name).filter(Boolean))).sort(),
    [requests],
  );

  const statuses = useMemo(
    () => Array.from(new Set(requests.map((req) => (req.status || '').trim()).filter(Boolean))).sort(),
    [requests],
  );

  const filteredRequests = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const from = filters.fromDate ? new Date(filters.fromDate) : null;
    const to = filters.toDate ? new Date(filters.toDate) : null;

    if (from) {
      from.setHours(0, 0, 0, 0);
    }

    if (to) {
      to.setHours(23, 59, 59, 999);
    }

    return requests.filter((req) => {
      const createdAt = req.created_at ? new Date(req.created_at) : null;

      if (from && createdAt && createdAt < from) {
        return false;
      }

      if (to && createdAt && createdAt > to) {
        return false;
      }

      if (filters.department !== 'all' && req.department_name !== filters.department) {
        return false;
      }

      if (filters.section !== 'all' && req.section_name !== filters.section) {
        return false;
      }

      if (filters.status !== 'all' && (req.status || '') !== filters.status) {
        return false;
      }

      if (normalizedSearch) {
        const haystack = [
          req.id,
          req.department_name,
          req.section_name,
          req.justification,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase())
          .join(' ');

        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      return true;
    });
  }, [filters, requests]);

  const summary = useMemo(() => {
    const totals = {
      total: requests.length,
      byStatus: {},
    };

    requests.forEach((req) => {
      const key = (req.status || 'Unknown').trim() || 'Unknown';
      totals.byStatus[key] = (totals.byStatus[key] || 0) + 1;
    });

    return totals;
  }, [requests]);

  const toggleItems = async (requestId) => {
    if (expandedRequestId === requestId) {
      setExpandedRequestId(null);
      return;
    }

    if (!itemsCache[requestId] && !itemsError[requestId]) {
      try {
        setItemsLoadingId(requestId);
        const res = await api.get(`/api/requests/${requestId}/items`);
        setItemsCache((prev) => ({
          ...prev,
          [requestId]: normalizeItems(extractItems(res.data)),
        }));
      } catch (err) {
        console.error('Failed to load requested items:', err);
        setItemsError((prev) => ({
          ...prev,
          [requestId]: tr(
            'alerts.itemsLoadFailed',
            'Failed to load requested items. Please try again later.',
          ),
        }));
      } finally {
        setItemsLoadingId(null);
      }
    }

    setExpandedRequestId(requestId);
  };

  const renderStatusBadge = (status) => {
    if (!status) {
      return (
        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
          {tr('statuses.unknown', 'Unknown')}
        </span>
      );
    }

    const key = status.toLowerCase();
    const badgeClass = statusClasses[key] || 'bg-gray-100 text-gray-600';
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badgeClass}`}>
        {getStatusLabel(status)}
      </span>
    );
  };

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{tr('title', 'Warehouse Supply Requests')}</h1>
            <p className="text-gray-600">{tr('subtitle', 'Review approved warehouse requests and record supplied items.')}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={fetchRequests}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {tr('actions.refresh', 'Refresh')}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              {tr('actions.clearFilters', 'Clear Filters')}
            </button>
          </div>
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">{tr('summary.total', 'Total Requests')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
          </div>
          {Object.entries(summary.byStatus).map(([status, count]) => (
            <div key={status} className="rounded border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">{getStatusLabel(status)}</p>
              <p className="mt-1 text-2xl font-semibold">{count}</p>
            </div>
          ))}
        </section>

        <section className="rounded border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">{tr('filters.title', 'Filters')}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="search">
                {tr('filters.searchLabel', 'Search')}
              </label>
              <input
                id="search"
                type="text"
                placeholder={tr(
                  'filters.searchPlaceholder',
                  'Search by ID, department, section or justification',
                )}
                value={filters.search}
                onChange={handleFilterChange('search')}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="department">
                {tr('filters.department', 'Department')}
              </label>
              <select
                id="department"
                value={filters.department}
                onChange={handleFilterChange('department')}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">{tr('filters.allOption', 'All')}</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="section">
                {tr('filters.section', 'Section')}
              </label>
              <select
                id="section"
                value={filters.section}
                onChange={handleFilterChange('section')}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">{tr('filters.allOption', 'All')}</option>
                {sections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="status">
                {tr('filters.status', 'Status')}
              </label>
              <select
                id="status"
                value={filters.status}
                onChange={handleFilterChange('status')}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">{tr('filters.allOption', 'All')}</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="fromDate">
                {tr('filters.from', 'From')}
              </label>
              <input
                id="fromDate"
                type="date"
                value={filters.fromDate}
                onChange={handleFilterChange('fromDate')}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="toDate">
                {tr('filters.to', 'To')}
              </label>
              <input
                id="toDate"
                type="date"
                value={filters.toDate}
                onChange={handleFilterChange('toDate')}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {loading ? (
            <p className="text-gray-600">{tr('list.loading', 'Loading requests…')}</p>
          ) : filteredRequests.length === 0 ? (
            <p className="rounded border border-gray-200 bg-white p-6 text-center text-gray-600">
              {tr('list.empty', 'No warehouse supply requests match the selected filters.')}
            </p>
          ) : (
            filteredRequests.map((req) => {
              const items = itemsCache[req.id] || normalizeItems(req.items || []);
              const stats = getFulfillmentStats({ ...req, items });

              return (
                <article key={req.id} className="rounded border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">{tr('requestCard.requestId', 'Request ID')}</p>
                      <p className="text-xl font-semibold">{req.id}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <div>
                        <span className="font-medium text-gray-700">{tr('requestCard.department', 'Department')}:</span>{' '}
                        {req.department_name || '—'}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">{tr('requestCard.section', 'Section')}:</span>{' '}
                        {req.section_name || '—'}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">{tr('requestCard.submitted', 'Submitted')}:</span>{' '}
                        {formatDateTime(req.created_at)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">{tr('requestCard.status', 'Status')}:</span>
                        {renderStatusBadge(req.status)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded bg-gray-50 p-4 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">{tr('requestCard.justification', 'Justification')}</p>
                    <p className="mt-1 whitespace-pre-line">
                      {req.justification || tr('requestCard.noJustification', 'No justification provided.')}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
                      <p className="text-sm text-gray-500">{tr('requestCard.itemsCount', 'Items in request')}</p>
                      <p className="mt-1 text-xl font-semibold">{items.length}</p>
                    </div>
                    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
                      <p className="text-sm text-gray-500">{tr('requestCard.supplied', 'Supplied so far')}</p>
                      <p className="mt-1 text-xl font-semibold">{stats.suppliedTotal}</p>
                    </div>
                    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
                      <p className="text-sm text-gray-500">{tr('requestCard.outstanding', 'Outstanding')}</p>
                      <p className={`mt-1 text-xl font-semibold ${stats.outstanding > 0 ? 'text-amber-600' : 'text-green-700'}`}>
                        {stats.outstanding}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-gray-800">
                        {tr('requestCard.progressLabel', '{{progress}}% fulfilled', {
                          progress: stats.progress,
                        })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {tr('requestCard.suppliedSummary', '{{supplied}} of {{requested}} supplied', {
                          supplied: stats.suppliedTotal,
                          requested: stats.requestedTotal || '—',
                        })}
                      </p>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className={`h-2 rounded-full transition-all ${stats.fullySupplied ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${stats.progress}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600">
                      {stats.fullySupplied
                        ? tr('requestCard.fullySupplied', 'All requested quantities have been supplied.')
                        : tr(
                          'requestCard.fulfillmentHint',
                          'Record supplied quantities to complete this request.',
                        )}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/warehouse-supply/${req.id}`)}
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      {tr('requestCard.recordSupplied', 'Record Supplied Items')}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleItems(req.id)}
                      className="rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                    >
                      {expandedRequestId === req.id
                        ? tr('requestCard.hideItems', 'Hide Requested Items')
                        : tr('requestCard.viewItems', 'View Requested Items')}
                    </button>
                  </div>

                  {expandedRequestId === req.id && (
                    <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-4">
                      {itemsLoadingId === req.id ? (
                        <p className="text-sm text-gray-600">{tr('items.loading', 'Loading requested items…')}</p>
                      ) : itemsError[req.id] ? (
                        <p className="text-sm text-red-600">{itemsError[req.id]}</p>
                      ) : items && items.length > 0 ? (
                        <ul className="space-y-2 text-sm text-gray-700">
                          {items.map((item) => (
                            <li
                              key={item.item_id || item.id}
                              className="rounded bg-white px-3 py-2 shadow"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">{item.item_name}</p>
                                  <p className="text-xs text-gray-500">ID: {item.item_id || item.id}</p>
                                </div>
                                <div className="flex flex-wrap gap-3 text-sm">
                                  <span className="text-gray-700">
                                    {tr('items.requestedQuantity', 'Requested: {{quantity}}', {
                                      quantity: item.quantity,
                                    })}
                                  </span>
                                  <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                                    {tr('items.suppliedQuantity', 'Supplied: {{quantity}}', {
                                      quantity: item.supplied_quantity || 0,
                                    })}
                                  </span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-600">{tr('items.empty', 'No requested items available.')}</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>
      </div>
    </>
  );
};

export default WarehouseSupplyRequestsPage;