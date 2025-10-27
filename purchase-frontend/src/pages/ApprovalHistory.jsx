//src/pages/ApprovalHistory.js
import React, { useEffect, useState } from 'react';
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
        setFiltered(res.data);
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

  const downloadCSV = () => {
    const sorted = [...filtered].sort((a, b) => new Date(b.approved_at) - new Date(a.approved_at));
    const csv = Papa.unparse(
      sorted.map(item => ({
        'Request ID': item.request_id,
        Type: item.request_type,
        Department: item.department_name,
        Project: item.project_name || '—',
        Justification: item.justification,
        Cost: item.estimated_cost,
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
      item.estimated_cost,
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
          <div>
            <label className="block text-sm font-medium">Filter by Status:</label>
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
            <label className="block text-sm font-medium">Department:</label>
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
            <label className="block text-sm font-medium">From Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">To Date:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="p-2 border rounded"
            />
          </div>
        </div>

        {/* 📁 Export Buttons */}
        <div className="flex gap-4 mb-4">
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
        </div>

        {/* 📊 Stats */}
        <p className="text-sm text-gray-600 mb-2">
          Showing {filtered.length} of {history.length} approvals
        </p>

        {/* 📋 Table */}
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : filtered.length === 0 ? (
          <p>No approvals found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2">Request ID</th>
                    <th className="border p-2">Type</th>
                    <th className="border p-2">Department</th>
                    <th className="border p-2">Project</th>
                    <th className="border p-2">Justification</th>
                    <th className="border p-2">Cost</th>
                    <th className="border p-2">Final Status</th>
                    <th className="border p-2">Your Decision</th>
                    <th className="border p-2">Your Comment</th>
                    <th className="border p-2">Level</th>
                    <th className="border p-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="border p-2">{item.request_id}</td>
                      <td className="border p-2">{item.request_type}</td>
                      <td className="border p-2">{item.department_name}</td>
                      <td className="border p-2">{item.project_name || '—'}</td>
                      <td className="border p-2">{item.justification}</td>
                      <td className="border p-2">{item.estimated_cost}</td>
                      <td className="border p-2">{item.status}</td>
                      <td className={`border p-2 ${item.decision === 'Approved' ? 'text-green-600' : 'text-red-600'}`}>
                        {item.decision}
                      </td>
                      <td className="border p-2">{item.comments || '—'}</td>
                      <td className="border p-2">{item.approval_level || '—'}</td>
                      <td className="border p-2">
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
