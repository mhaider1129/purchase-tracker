import React, { useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import { Link } from 'react-router-dom';

const IncompleteRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [requestType, setRequestType] = useState('');
  const [department, setDepartment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loadingExport, setLoadingExport] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);


  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('/api/requests/incomplete');
        const data = Array.isArray(res.data) ? res.data : [];
        setRequests(data);
        setFiltered(data);
        setLastUpdated(new Date().toLocaleString());
      } catch (err) {
        console.error('❌ Error fetching incomplete requests:', err);
        setError('Failed to load requests');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    let data = [...requests];

    if (requestType) {
      data = data.filter(r => r.request_type === requestType);
    }

    if (department) {
      data = data.filter(r =>
        r.department_name.toLowerCase().includes(department.toLowerCase())
      );
    }

    if (fromDate) {
      data = data.filter(r => new Date(r.created_at) >= new Date(fromDate));
    }

    if (toDate) {
      data = data.filter(r => new Date(r.created_at) <= new Date(toDate));
    }

    if (status) {
      data = data.filter(r =>
        (r.status || '').toLowerCase() === status.toLowerCase()
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(r => {
        const valuesToSearch = [
          r.id,
          r.request_type,
          r.department_name,
          r.section_name,
          r.justification,
          r.status,
        ]
          .filter(Boolean)
          .map(v => String(v).toLowerCase());
        return valuesToSearch.some(value => value.includes(term));
      });
    }

    setFiltered(data);
    setPage(1);
  }, [requestType, department, fromDate, toDate, status, searchTerm, requests]);

  const statusOptions = useMemo(() => {
    const uniqueStatuses = new Set();
    requests.forEach(req => {
      if (req.status) {
        uniqueStatuses.add(req.status);
      }
    });
    return Array.from(uniqueStatuses).sort();
  }, [requests]);

  const paginatedData = filtered.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(filtered.length / limit);

  const totalEstimatedCost = useMemo(() => {
    return filtered.reduce((sum, req) => {
      const numericCost = Number(req.estimated_cost);
      return sum + (Number.isFinite(numericCost) ? numericCost : 0);
    }, 0);
  }, [filtered]);

  const uniqueDepartments = useMemo(() => {
    return new Set(filtered.map(req => req.department_name).filter(Boolean)).size;
  }, [filtered]);

  const typeBreakdown = useMemo(() => {
    const counts = filtered.reduce((acc, req) => {
      if (!req.request_type) return acc;
      const type = req.request_type;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const formatCurrency = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '—';
    return numericValue.toLocaleString('en-US', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
    });
  };

  const formatDate = (value) => {
    const date = value ? new Date(value) : null;
    return date ? date.toLocaleString('en-GB') : '—';
  };

  const handleExport = async (type) => {
    setLoadingExport(true);
    try {
      const res = await axios.get(`/api/requests/incomplete/export/${type}`, {
        params: {
          request_type: requestType,
          department,
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
      link.download = `incomplete_requests_${dateStr}.${type}`;

      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`❌ Failed to export ${type.toUpperCase()}:`, err);
      alert(`❌ Failed to export ${type.toUpperCase()}`);
    } finally {
      setLoadingExport(false);
    }
  };

  const getStatusTagClass = (status) => {
    if (!status) return 'bg-gray-300';
    const s = status.toLowerCase();
    if (s.includes('pending')) return 'bg-yellow-400 text-black';
    if (s.includes('rejected')) return 'bg-red-500 text-white';
    if (s.includes('approved')) return 'bg-green-500 text-white';
    return 'bg-blue-400 text-white';
  };

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-blue-800">Incomplete Requests (Admin / SCM)</h1>

        <div className="flex flex-wrap gap-3 mb-6 text-sm text-blue-700">
          <Link
            to="/incomplete/medical"
            className="px-3 py-1 bg-blue-50 rounded-full border border-blue-200 hover:bg-blue-100 transition"
          >
            View Medical Requests
          </Link>
          <Link
            to="/incomplete/operational"
            className="px-3 py-1 bg-purple-50 rounded-full border border-purple-200 hover:bg-purple-100 transition"
          >
            View Operational Requests
          </Link>
        </div>

        <div className="grid gap-4 mb-8 sm:grid-cols-3">
          <div className="rounded border p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500">Total Incomplete</p>
            <p className="text-2xl font-semibold text-blue-700">{filtered.length}</p>
            {lastUpdated && (
              <p className="text-xs text-gray-400 mt-1">Last updated {lastUpdated}</p>
            )}
          </div>
          <div className="rounded border p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500">Estimated Cost</p>
            <p className="text-2xl font-semibold text-green-600">{formatCurrency(totalEstimatedCost)}</p>
            <p className="text-xs text-gray-400 mt-1">Across filtered results</p>
          </div>
          <div className="rounded border p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500">Departments involved</p>
            <p className="text-2xl font-semibold text-indigo-600">{uniqueDepartments}</p>
            <p className="text-xs text-gray-400 mt-1">Unique departments in view</p>
          </div>
        </div>

        {typeBreakdown.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Request type breakdown</p>
            <div className="flex flex-wrap gap-2">
              {typeBreakdown.map(([type, count]) => (
                <span
                  key={type}
                  className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium"
                >
                  {type}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 mb-6 items-end">
          <div>
            <label className="block text-sm font-medium">Request Type</label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="">All</option>
              <option value="Stock">Stock</option>
              <option value="Non-Stock">Non-Stock</option>
              <option value="Medical Device">Medical Device</option>
              <option value="Medication">Medication</option>
              <option value="IT Item">IT Item</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Search department"
              className="p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="">All</option>
              {statusOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, status, or keywords"
              className="p-2 border rounded w-full"
            />
          </div>

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

        {loading ? (
          <p className="text-gray-600">Loading requests...</p>
        ) : error ? (
          <p className="text-red-600">❌ {error}</p>
        ) : paginatedData.length === 0 ? (
          <p>No matching requests found.</p>
        ) : (
          <>
            <div className="overflow-x-auto border rounded shadow-sm">
              <table className="min-w-full text-sm" aria-label="Incomplete requests table">
                <thead className="bg-gray-100 text-left">
                  <tr>
                    <th className="p-2 border">ID</th>
                    <th className="p-2 border">Type</th>
                    <th className="p-2 border">Department</th>
                    <th className="p-2 border">Section</th>
                    <th className="p-2 border">Justification</th>
                    <th className="p-2 border">Estimated Cost</th>
                    <th className="p-2 border">Status</th>
                    <th className="p-2 border">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((req) => (
                    <tr key={req.id} className="hover:bg-blue-50 transition">
                      <td className="p-2 border font-medium">{req.id}</td>
                      <td className="p-2 border">{req.request_type}</td>
                      <td className="p-2 border">{req.department_name}</td>
                      <td className="p-2 border">{req.section_name || '—'}</td>
                      <td className="p-2 border max-w-xs">
                        <span className="block text-sm text-gray-700 truncate" title={req.justification}>
                          {req.justification || '—'}
                        </span>
                      </td>
                      <td className="p-2 border whitespace-nowrap">{formatCurrency(req.estimated_cost)}</td>
                      <td className="p-2 border">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusTagClass(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="p-2 border whitespace-nowrap">{formatDate(req.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-4 flex justify-center items-center gap-4">
                <button
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                  disabled={page === 1}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                >
                  Prev
                </button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                  disabled={page === totalPages}
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
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

export default IncompleteRequestsPage;
