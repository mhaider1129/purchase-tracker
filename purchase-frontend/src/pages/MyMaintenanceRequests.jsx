// src/pages/MyMaintenanceRequests.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import { saveAs } from 'file-saver';

const MyMaintenanceRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await axios.get('/api/requests/my-maintenance');
        const incoming = Array.isArray(res.data) ? res.data : [];
        const sorted = [...incoming].sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });
        setRequests(sorted);
      } catch (err) {
        console.error('❌ Failed to fetch maintenance requests:', err);
        setError('We could not load your maintenance requests. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, statusFilter, searchTerm, startDate, endDate, sortDirection]);

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

  const exportToCSV = () => {
    const csvRows = [
      ['ID', 'Justification', 'Project', 'Reference #', 'Status', 'Submitted At'],
      ...filteredRequests.map((r) => [
        r.id,
        r.justification,
        r.project_name || '',
        r.maintenance_ref_number || '-',
        r.status,
        new Date(r.created_at).toLocaleString(),
      ]),
    ];

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `My_Maintenance_Requests_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = requests
      .filter((request) => {
        if (statusFilter === 'all') return true;
        return request.status?.toLowerCase() === statusFilter.toLowerCase();
      })
      .filter((request) => {
        if (!normalizedSearch) return true;
        const haystack = [
          request.justification,
          request.project_name,
          request.maintenance_ref_number,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .filter((request) => {
        if (!startDate && !endDate) return true;
        const createdAt = new Date(request.created_at);
        if (Number.isNaN(createdAt.getTime())) return false;
        if (startDate && createdAt < new Date(startDate)) return false;
        if (endDate) {
          const inclusiveEnd = new Date(endDate);
          inclusiveEnd.setHours(23, 59, 59, 999);
          if (createdAt > inclusiveEnd) return false;
        }
        return true;
      });

    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      if (sortDirection === 'asc') {
        return dateA - dateB;
      }
      return dateB - dateA;
    });

    return sorted;
  }, [requests, statusFilter, searchTerm, startDate, endDate, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage));
  const paginated = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const statusSummary = useMemo(() => {
    return filteredRequests.reduce(
      (acc, request) => {
        const key = request.status?.toLowerCase() || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { total: filteredRequests.length },
    );
  }, [filteredRequests]);

  const resetFilters = () => {
    setStatusFilter('all');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSortDirection('desc');
  };

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Maintenance Requests</h1>
            <p className="text-sm text-gray-600">
              Track the status of your submitted maintenance requests and export them for reporting.
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Export CSV
          </button>
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
            Loading maintenance requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-600">
            <p className="font-medium">No maintenance requests found.</p>
            <p className="text-sm">Submit a new maintenance request to see it listed here.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6 mb-6">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
                <p className="mt-1 text-2xl font-semibold">{statusSummary.total || 0}</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-green-700">Approved</p>
                <p className="mt-1 text-xl font-semibold text-green-800">{statusSummary.approved || 0}</p>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-yellow-700">Pending</p>
                <p className="mt-1 text-xl font-semibold text-yellow-800">{statusSummary.pending || 0}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-red-700">Rejected</p>
                <p className="mt-1 text-xl font-semibold text-red-800">{statusSummary.rejected || 0}</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-blue-700">Submitted</p>
                <p className="mt-1 text-xl font-semibold text-blue-800">{statusSummary.submitted || 0}</p>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-indigo-700">Completed</p>
                <p className="mt-1 text-xl font-semibold text-indigo-800">{statusSummary.completed || 0}</p>
              </div>
            </div>

            <div className="mb-6 grid gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-5">
              <div className="md:col-span-2">
                <label htmlFor="search" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  Search
                </label>
                <input
                  id="search"
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search justification, project, or reference"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
                />
              </div>
              <div>
                <label htmlFor="status" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  Status
                </label>
                <select
                  id="status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label htmlFor="start-date" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  From
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
                />
              </div>
              <div>
                <label htmlFor="end-date" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  To
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
                />
              </div>
              <div>
                <label htmlFor="sort" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  Sort
                </label>
                <select
                  id="sort"
                  value={sortDirection}
                  onChange={(event) => setSortDirection(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring"
                >
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
              </div>
              <div className="md:col-span-5 flex justify-end">
                <button
                  onClick={resetFilters}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Reset filters
                </button>
              </div>
            </div>

            <table className="w-full border text-sm mb-4">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-2 text-left">ID</th>
                  <th className="border px-3 py-2 text-left">Justification</th>
                  <th className="border px-3 py-2 text-left">Project</th>
                  <th className="border px-3 py-2 text-left">Ref #</th>
                  <th className="border px-3 py-2 text-left">Status</th>
                  <th className="border px-3 py-2 text-left">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                    <td className="border px-3 py-2">{r.id}</td>
                    <td className="border px-3 py-2">{r.justification}</td>
                    <td className="border px-3 py-2">{r.project_name || '—'}</td>
                    <td className="border px-3 py-2">{r.maintenance_ref_number || '-'}</td>
                    <td className="border px-3 py-2">
                      <span className={getStatusBadge(r.status)}>{r.status}</span>
                    </td>
                    <td className="border px-3 py-2">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span>Rows per page:</span>
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

              <div className="flex items-center gap-4 text-sm">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Prev
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Showing {(currentPage - 1) * itemsPerPage + 1} -{' '}
              {Math.min(currentPage * itemsPerPage, filteredRequests.length)} of {filteredRequests.length}{' '}
              requests
            </p>
          </>
        )}
      </div>
    </>
  );
};

export default MyMaintenanceRequests;