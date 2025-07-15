// src/pages/AllRequestsPage.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import AssignRequestPanel from '../components/AssignRequestPanel';
import Navbar from '../components/Navbar';

const AllRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('');
  const [requestType, setRequestType] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingExport, setLoadingExport] = useState(false);
  const [filtersChanged, setFiltersChanged] = useState(false);
  const limit = 10;

  const fetchRequests = async () => {
    try {
      const res = await axios.get('/api/requests', {
        params: {
          filter,
          sort,
          request_type: requestType,
          search,
          from_date: fromDate,
          to_date: toDate,
          page,
          limit,
        },
      });

      setRequests(res?.data?.data || []);
      const total = res?.data?.total || 0;
      setTotalPages(Math.ceil(total / limit));
    } catch (err) {
      console.error(err);
      alert('❌ Failed to fetch requests.');
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [page]);

  useEffect(() => {
    if (filtersChanged) {
      fetchRequests();
      setFiltersChanged(false);
    }
  }, [filtersChanged]);

  const applyFilters = () => {
    setPage(1);
    setFiltersChanged(true);
  };

  const handleExport = async (type) => {
    setLoadingExport(true);
    try {
      const res = await axios.get(`/api/requests/export/${type}`, {
        params: {
          filter,
          sort,
          request_type: requestType,
          search,
          from_date: fromDate,
          to_date: toDate,
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

  return (
    <>
      <Navbar />
      <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">All Purchase Requests</h1>

      <div className="flex flex-wrap gap-4 mb-4">
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
          <option value="Stock">Stock</option>
          <option value="Non-Stock">Non-Stock</option>
          <option value="Medical Device">Medical Device</option>
        </select>

        <input
          type="text"
          className="border p-2 rounded"
          placeholder="Search keyword"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

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

        <button
          onClick={applyFilters}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Apply
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

      {requests.length === 0 ? (
        <p>No requests found.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="border rounded p-4 shadow bg-white">
              <div className="flex justify-between items-center">
                <div>
                  <p><strong>ID:</strong> {request.id}</p>
                  <p><strong>Type:</strong> {request.request_type}</p>
                  <p><strong>Justification:</strong> {request.justification}</p>
                  <p>
                    <strong>Assigned To:</strong>{' '}
                    {request.assigned_user_name
                      ? `${request.assigned_user_name} (${request.assigned_user_role})`
                      : 'Not Assigned'}
                  </p>
                  <p>
                    <strong>Current Step:</strong>{' '}
                    {request.current_approver_role
                      ? `${request.current_approver_role} (Level ${request.current_approval_level})`
                      : 'Finalized'}
                  </p>
                </div>

                {request.status === 'Approved' && (
                  <button
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    onClick={() =>
                      setExpandedRequestId(expandedRequestId === request.id ? null : request.id)
                    }
                  >
                    {expandedRequestId === request.id
                      ? 'Hide'
                      : request.assigned_user_name
                      ? 'Reassign'
                      : 'Assign'}                  </button>
                )}
              </div>

              {expandedRequestId === request.id && (
                <AssignRequestPanel
                  requestId={request.id}
                  currentAssignee={request.assigned_user_name}                  
                  onSuccess={fetchRequests}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
            disabled={page === 1}
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          >
            Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
            disabled={page === totalPages}
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          >
            Next
          </button>
        </div>
      )}
     </div>
    </>
  );
};

export default AllRequestsPage;
