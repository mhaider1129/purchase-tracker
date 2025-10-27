// src/pages/CompletedAssignedRequestsPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';

const CompletedAssignedRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [itemsCache, setItemsCache] = useState({});
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const fetchCompleted = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/requests/completed-assigned', {
        params: { search },
      });
      setRequests(res.data.data || []);
    } catch (err) {
      console.error('❌ Failed to fetch completed requests:', err);
      alert('Error loading completed requests.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const toggleItems = async (requestId) => {
    if (expandedRequestId === requestId) {
      setExpandedRequestId(null);
      return;
    }

    if (!itemsCache[requestId]) {
      try {
        const res = await axios.get(`/api/requests/${requestId}/items`);
        setItemsCache((prev) => ({ ...prev, [requestId]: res.data.items }));
      } catch (err) {
        console.error(`❌ Failed to fetch items for request ${requestId}:`, err);
        alert('Error loading request items.');
        return;
      }
    }

    setExpandedRequestId(requestId);
  };

  useEffect(() => {
    fetchCompleted();
  }, [fetchCompleted]);

  const requestTypeOptions = useMemo(() => {
    const types = new Set();
    requests.forEach((req) => {
      if (req.request_type) {
        types.add(req.request_type);
      }
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const now = new Date();

    return requests.filter((req) => {
      if (typeFilter !== 'all' && req.request_type !== typeFilter) {
        return false;
      }

      if (dateFilter !== 'all') {
        const completedAt = new Date(req.completed_at);
        if (Number.isNaN(completedAt.getTime())) {
          return false;
        }

        const diffInDays = (now - completedAt) / (1000 * 60 * 60 * 24);

        if (dateFilter === '7' && diffInDays > 7) {
          return false;
        }

        if (dateFilter === '30' && diffInDays > 30) {
          return false;
        }

        if (dateFilter === '90' && diffInDays > 90) {
          return false;
        }
      }

      return true;
    });
  }, [requests, typeFilter, dateFilter]);

  const typeBreakdown = useMemo(() => {
    return filteredRequests.reduce((acc, req) => {
      const type = req.request_type || 'Other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }, [filteredRequests]);

  const formatDateTime = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setDateFilter('all');
  };

  const renderLoadingState = () => (
    <div className="space-y-4">
      {[...Array(3)].map((_, idx) => (
        <div
          key={idx}
          className="bg-white shadow rounded-lg p-4 border border-gray-100 animate-pulse"
        >
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Navbar />
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">My Completed Requests</h1>
          <p className="text-gray-600">
            Review the purchases you have completed, apply quick filters, and dive into the
            fulfillment details for each request.
          </p>
        </div>

        <section className="bg-white shadow-sm border border-gray-100 rounded-lg p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Find a specific request</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700">Search</span>
              <input
                type="search"
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search by requester, justification, or ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700">Request type</span>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All types</option>
                {requestTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700">Completion date</span>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">Any time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>

            <div className="flex items-end">

              <button
                type="button"
                className="w-full inline-flex justify-center items-center gap-2 border border-gray-300 text-gray-700 rounded-md px-3 py-2 hover:bg-gray-100"
                onClick={handleResetFilters}
              >
                Reset filters
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="bg-white border border-blue-100 rounded-lg p-5 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-blue-600 font-semibold">Completed</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{filteredRequests.length}</p>
            <p className="text-sm text-gray-500 mt-1">
              Requests that match your current filters.
            </p>
          </div>

          <div className="bg-white border border-gray-100 rounded-lg p-5 shadow-sm md:col-span-2">
            <p className="text-sm font-semibold text-gray-700">Breakdown by request type</p>
            {Object.keys(typeBreakdown).length === 0 ? (
              <p className="text-sm text-gray-500 mt-2">No data available for the selected filters.</p>
            ) : (
              <ul className="flex flex-wrap gap-2 mt-3">
                {Object.entries(typeBreakdown).map(([type, count]) => (
                  <li
                    key={type}
                    className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-3 py-1 text-sm"
                  >
                    <span className="font-medium">{type}</span>
                    <span className="text-xs bg-white border border-blue-200 rounded-full px-2 py-0.5">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {loading ? (
          renderLoadingState()
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-lg p-8 text-center text-gray-500 shadow-sm">
            <p className="text-lg font-medium text-gray-700">No completed requests found.</p>
            <p className="mt-2 text-sm text-gray-500">
              Try adjusting your search or filter selections to see more results.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((req) => (
              <article
                key={req.id}
                className="bg-white border border-gray-100 rounded-lg shadow-sm p-5 transition hover:border-blue-200"
              >
                <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-xl font-semibold text-gray-900">Request #{req.id}</h3>
                      {req.request_type && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-sm font-medium">
                          {req.request_type}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Completed {formatDateTime(req.completed_at)}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    <p>
                      <span className="font-medium text-gray-700">Submitted by:</span>{' '}
                      {req.requester_name}
                      {req.requester_role && <span className="text-gray-400"> • {req.requester_role}</span>}
                    </p>
                  </div>
                </header>

                {req.justification && (
                  <p className="mt-4 text-gray-700">
                    <span className="font-medium text-gray-900">Justification:</span> {req.justification}
                  </p>
                )}

                <footer className="mt-4">
                  <button
                    type="button"
                    onClick={() => toggleItems(req.id)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    <span>{expandedRequestId === req.id ? 'Hide Items' : 'View Items'}</span>
                    <span aria-hidden="true">{expandedRequestId === req.id ? '▲' : '▼'}</span>
                  </button>

                  {expandedRequestId === req.id && (
                    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                      {itemsCache[req.id]?.length > 0 ? (
                        itemsCache[req.id].map((item) => (
                          <div
                            key={item.id}
                            className="rounded-md border border-gray-100 bg-gray-50 p-3"
                          >
                            <p className="text-sm font-semibold text-gray-800">
                              {item.item_name}
                              {item.brand && <span className="text-gray-500"> ({item.brand})</span>}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-medium text-gray-700">Requested:</span> {item.quantity}
                              <span className="mx-2 text-gray-400">•</span>
                              <span className="font-medium text-gray-700">Purchased:</span>{' '}
                              {item.purchased_quantity ?? '—'}
                              <span className="mx-2 text-gray-400">•</span>
                              <span className="font-medium text-gray-700">Status:</span> {item.procurement_status || '—'}
                            </p>
                            {item.procurement_comment && (
                              <p className="text-sm text-gray-500 italic mt-2">{item.procurement_comment}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No items found.</p>
                      )}
                    </div>
                  )}
                </footer>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default CompletedAssignedRequestsPage;
