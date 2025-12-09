//src/pages/ApprovalHistory.js
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ApprovalHistory = () => {
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
        const res = await axios.get('/api/departments');
        setDepartments(res.data);
      } catch (err) {
        console.error('❌ Failed to load departments:', err);
      }
    };
    fetchDeps();
  }, []);

  const applySearch = (items, term) => {
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
  };

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

  const statusVariant = {
    Approved: 'text-green-700 bg-green-100 border-green-200',
    Rejected: 'text-red-700 bg-red-100 border-red-200',
    Pending: 'text-yellow-700 bg-yellow-100 border-yellow-200',
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
        const res = await axios.get('/api/requests/approval-history', {
          params: {
            status: statusFilter,
            from_date: fromDate,
            to_date: toDate,
            department_id: department,
          },
        });
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
  }, [statusFilter, fromDate, toDate, department]);

  useEffect(() => {
    setFiltered(applySearch(history, searchTerm));
    setCurrentPage(1);
  }, [history, searchTerm]);

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
    doc.text('Approval History', 14, 15);

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
      item.approval_level || '—',
      item.approved_at ? new Date(item.approved_at).toLocaleString('en-GB') : '—'
    ]);

    autoTable(doc, {
      head: [[
        'Request ID', 'Type', 'Department', 'Project', 'Justification', 'Cost', 'Final Status',
        'Your Decision', 'Comment', 'Level', 'Date'
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
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Approval History</h1>

        {/* 🔍 Filters */}
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by request ID, department, justification..."
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="">All</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Department:</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="">All</option>
              {departments.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">From Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">To Date:</label>
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
              Showing {filtered.length} of {history.length} approvals
            </span>
          </div>
        </div>

        {/* 📊 Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-6">
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <p className="text-sm text-gray-500">Total Decisions</p>
            <p className="text-2xl font-semibold text-gray-900">{summary.total}</p>
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <p className="text-sm text-gray-500">Approved</p>
            <p className="text-2xl font-semibold text-green-600">{summary.approved}</p>
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <p className="text-sm text-gray-500">Rejected</p>
            <p className="text-2xl font-semibold text-red-600">{summary.rejected}</p>
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-semibold text-yellow-600">{summary.pending}</p>
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <p className="text-sm text-gray-500">Estimated Spend</p>
            <p className="text-2xl font-semibold text-gray-900">{formatCurrency(summary.spend)}</p>
          </div>
        </div>

        {/* 📋 Table */}
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : filtered.length === 0 ? (
          <p>No approvals found.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left uppercase tracking-wide text-xs text-gray-500">
                  <tr>
                    <th className="border-b border-gray-200 p-3 font-semibold">Request ID</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">Type</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">Department</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">Requester</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">Project</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">Justification</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">Cost</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">Final Status</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">Your Decision</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">Your Comment</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">Level</th>
                    <th className="border-b border-gray-200 p-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-b-0 hover:bg-gray-50">
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
                    </tr>
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
