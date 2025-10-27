import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Navbar from '../components/Navbar';

const statusClasses = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
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

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/warehouse-supply');
      setRequests(res.data || []);
    } catch (err) {
      console.error('Failed to load requests:', err);
      setError('Failed to load warehouse supply requests. Please try again.');
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
          [requestId]: res.data?.items || [],
        }));
      } catch (err) {
        console.error('Failed to load requested items:', err);
        setItemsError((prev) => ({
          ...prev,
          [requestId]: 'Failed to load requested items. Please try again later.',
        }));
      } finally {
        setItemsLoadingId(null);
      }
    }

    setExpandedRequestId(requestId);
  };

  const renderStatusBadge = (status) => {
    if (!status) {
      return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">Unknown</span>;
    }

    const key = status.toLowerCase();
    const badgeClass = statusClasses[key] || 'bg-gray-100 text-gray-600';
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badgeClass}`}>
        {status}
      </span>
    );
  };

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Warehouse Supply Requests</h1>
            <p className="text-gray-600">Review approved warehouse requests and record supplied items.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={fetchRequests}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total Requests</p>
            <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
          </div>
          {Object.entries(summary.byStatus).map(([status, count]) => (
            <div key={status} className="rounded border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">{status}</p>
              <p className="mt-1 text-2xl font-semibold">{count}</p>
            </div>
          ))}
        </section>

        <section className="rounded border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Filters</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="search">Search</label>
              <input
                id="search"
                type="text"
                placeholder="Search by ID, department, section or justification"
                value={filters.search}
                onChange={handleFilterChange('search')}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="department">Department</label>
              <select
                id="department"
                value={filters.department}
                onChange={handleFilterChange('department')}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="section">Section</label>
              <select
                id="section"
                value={filters.section}
                onChange={handleFilterChange('section')}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All</option>
                {sections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="status">Status</label>
              <select
                id="status"
                value={filters.status}
                onChange={handleFilterChange('status')}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="fromDate">From</label>
              <input
                id="fromDate"
                type="date"
                value={filters.fromDate}
                onChange={handleFilterChange('fromDate')}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="toDate">To</label>
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
            <p className="text-gray-600">Loading requests…</p>
          ) : filteredRequests.length === 0 ? (
            <p className="rounded border border-gray-200 bg-white p-6 text-center text-gray-600">
              No warehouse supply requests match the selected filters.
            </p>
          ) : (
            filteredRequests.map((req) => (
              <article key={req.id} className="rounded border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">Request ID</p>
                    <p className="text-xl font-semibold">{req.id}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    <div>
                      <span className="font-medium text-gray-700">Department:</span> {req.department_name || '—'}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Section:</span> {req.section_name || '—'}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Submitted:</span> {formatDateTime(req.created_at)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Status:</span>
                      {renderStatusBadge(req.status)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="font-medium text-gray-900">Justification</p>
                  <p className="mt-1 whitespace-pre-line">{req.justification || 'No justification provided.'}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/warehouse-supply/${req.id}`)}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Record Supplied Items
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleItems(req.id)}
                    className="rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  >
                    {expandedRequestId === req.id ? 'Hide Requested Items' : 'View Requested Items'}
                  </button>
                </div>

                {expandedRequestId === req.id && (
                  <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-4">
                    {itemsLoadingId === req.id ? (
                      <p className="text-sm text-gray-600">Loading requested items…</p>
                    ) : itemsError[req.id] ? (
                      <p className="text-sm text-red-600">{itemsError[req.id]}</p>
                    ) : itemsCache[req.id] && itemsCache[req.id].length > 0 ? (
                      <ul className="space-y-2 text-sm text-gray-700">
                        {itemsCache[req.id].map((item) => (
                          <li key={item.item_id || item.id} className="flex items-center justify-between rounded bg-white px-3 py-2 shadow">
                            <span className="font-medium text-gray-900">{item.item_name}</span>
                            <span className="text-gray-600">Requested: {item.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600">No requested items available.</p>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </>
  );
};

export default WarehouseSupplyRequestsPage;