import React, { useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import { saveAs } from 'file-saver';

const AuditRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);

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

  const exportCSV = (data) => {
    const rows = [
      ['ID', 'Type', 'Project', 'Justification', 'Status', 'Approval Timestamp'],
      ...data.map((r) => [
        r.id,
        r.request_type,
        r.project_name || '',
        r.justification || '',
        r.status,
        r.approval_timestamp ? new Date(r.approval_timestamp).toLocaleString() : '',
      ]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'Audit_Requests.csv');
  };

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/requests/audit/approved-rejected');
        setRequests(res.data);
        setFiltered(res.data);
      } catch (err) {
        console.error('Failed to fetch audit requests:', err);
        alert('Failed to load audit requests.');
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

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

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles}`}>
        {status}
      </span>
    );
  };

  return (
    <>
      <Navbar />
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-semibold">Audit Requests</h1>
          <div className="flex gap-2">
            <button
              onClick={resetFilters}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50"
            >
              Reset Filters
            </button>
            <button
              onClick={() => exportCSV(filtered)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500">Total Requests</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500">Approved</p>
            <p className="text-2xl font-semibold text-green-600">{stats.approved}</p>
          </div>
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <p className="text-sm text-gray-500">Rejected</p>
            <p className="text-2xl font-semibold text-red-600">{stats.rejected}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <input
            type="text"
            className="border p-2 rounded"
            placeholder="Search by ID, project, justification..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border p-2 rounded"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            className="border p-2 rounded"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Request Types</option>
            <option value="it item">IT Item</option>
            <option value="stock">Stock</option>
            <option value="non-stock">Non-Stock</option>
          </select>
          <input
            type="date"
            className="border p-2 rounded"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="From"
          />
          <input
            type="date"
            className="border p-2 rounded"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="To"
          />
        </div>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">No requests found.</p>
        ) : (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">ID</th>
                  <th className="p-2 border">Type</th>
                  <th className="p-2 border">Project</th>
                  <th className="p-2 border">Justification</th>
                  <th className="p-2 border">Status</th>
                  <th className="p-2 border">Approval Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => (
                  <tr key={req.id}>
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
                  </tr>
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