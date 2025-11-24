// src/pages/IncompleteOperationalRequestsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import { Link } from 'react-router-dom';

const IncompleteOperationalRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const fetchOperationalRequests = async () => {
      try {
        const res = await axios.get('/api/requests/incomplete/operational');
        setRequests(res.data || []);
        setLastUpdated(new Date().toLocaleString());
      } catch (err) {
        console.error('❌ Error fetching operational incomplete requests:', err);
        setError(err?.response?.data?.message || 'Failed to load operational requests');
      } finally {
        setLoading(false);
      }
    };

    fetchOperationalRequests();
  }, []);

  const totalEstimatedCost = useMemo(() => {
    return requests.reduce((sum, req) => {
      const cost = Number(req.estimated_cost);
      return Number.isFinite(cost) ? sum + cost : sum;
    }, 0);
  }, [requests]);

  const uniqueDepartments = useMemo(() => {
    const departments = new Set();
    requests.forEach(req => {
      if (req.department_name) departments.add(req.department_name);
    });
    return departments.size;
  }, [requests]);

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
        <h1 className="text-2xl font-bold mb-6 text-purple-800">Operational Incomplete Requests</h1>

        <div className="flex flex-wrap gap-3 mb-6 text-sm text-blue-700">
          <Link
            to="/incomplete/medical"
            className="px-3 py-1 bg-blue-50 rounded-full border border-blue-200 hover:bg-blue-100 transition"
          >
            View Medical Requests
          </Link>
          <Link
            to="/incomplete"
            className="px-3 py-1 bg-indigo-50 rounded-full border border-indigo-200 hover:bg-indigo-100 transition"
          >
            View Admin / SCM Requests
          </Link>
        </div>

        <div className="grid gap-4 mb-8 sm:grid-cols-3">
          <div className="rounded border p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500">Total Incomplete</p>
            <p className="text-2xl font-semibold text-purple-700">{requests.length}</p>
            {lastUpdated && (
              <p className="text-xs text-gray-400 mt-1">Last updated {lastUpdated}</p>
            )}
          </div>
          <div className="rounded border p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500">Estimated Cost</p>
            <p className="text-2xl font-semibold text-green-600">{formatCurrency(totalEstimatedCost)}</p>
            <p className="text-xs text-gray-400 mt-1">Across all results</p>
          </div>
          <div className="rounded border p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500">Departments involved</p>
            <p className="text-2xl font-semibold text-indigo-600">{uniqueDepartments}</p>
            <p className="text-xs text-gray-400 mt-1">Unique departments</p>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading requests...</p>
        ) : error ? (
          <p className="text-red-600">❌ {error}</p>
        ) : (
          <>
            <div className="overflow-x-auto border rounded shadow-sm">
              <table className="min-w-full text-sm" aria-label="Operational incomplete requests table">
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
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-purple-50 transition">
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
          </>
        )}
      </div>
    </>
  );
};

export default IncompleteOperationalRequestsPage;