// src/pages/MaintenanceHODApprovals.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import { saveAs } from 'file-saver';

const MaintenanceHODApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchRequests = async () => {
    try {
      const res = await axios.get('/requests/maintenance/pending/hod');
      setRequests(res.data || []);
    } catch (err) {
      console.error('❌ Failed to fetch maintenance requests', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (approvalId, decision) => {
    const confirmed = window.confirm(`Are you sure you want to ${decision.toUpperCase()} this request?`);
    if (!confirmed) return;

    setProcessingId(approvalId);
    try {
      await axios.post(`/approvals/${approvalId}/decision`, { decision });
      fetchRequests();
    } catch (err) {
      alert('❌ Failed to submit decision');
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const exportToCSV = () => {
    const csvRows = [
      ['Reference', 'Justification', 'Budget Month', 'Requested By', 'Submitted At', 'Items'],
      ...requests.map((r) => [
        r.maintenance_ref_number,
        r.justification,
        r.budget_impact_month,
        r.requester_name,
        new Date(r.created_at).toLocaleString(),
        r.items.map(i => `${i.item_name} (x${i.quantity})`).join('; ')
      ])
    ];

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `Maintenance_HOD_Requests_${new Date().toISOString().split('T')[0]}.csv`);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Pagination Logic
  const totalPages = Math.ceil(requests.length / itemsPerPage);
  const paginatedRequests = requests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Maintenance Requests Pending Your Approval</h2>
          <button onClick={exportToCSV} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Export CSV
          </button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : requests.length === 0 ? (
          <p>No pending maintenance requests.</p>
        ) : (
          <div className="space-y-6">
            {paginatedRequests.map((req) => (
              <div key={req.request_id} className="border p-4 rounded shadow bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <p><strong>Ref:</strong> {req.maintenance_ref_number}</p>
                    <p><strong>Justification:</strong> {req.justification}</p>
                    <p><strong>Budget Month:</strong> {req.budget_impact_month}</p>
                    <p><strong>Requested By:</strong> {req.requester_name}</p>
                    <p><strong>Submitted At:</strong> {new Date(req.created_at).toLocaleString()}</p>
                  </div>
                  <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded font-semibold">
                    Pending HOD
                  </span>
                </div>

                <ul className="list-disc pl-5 mt-2 text-sm text-gray-700">
                  {req.items.map((item, idx) => (
                    <li key={idx}>
                      {item.item_name} — Qty: {item.quantity}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex gap-4">
                  <button
                    disabled={processingId === req.approval_id}
                    onClick={() => handleDecision(req.approval_id, 'approved')}
                    className={`px-4 py-2 rounded text-white ${
                      processingId === req.approval_id ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {processingId === req.approval_id ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    disabled={processingId === req.approval_id}
                    onClick={() => handleDecision(req.approval_id, 'rejected')}
                    className={`px-4 py-2 rounded text-white ${
                      processingId === req.approval_id ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {processingId === req.approval_id ? 'Processing...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}

            {/* Pagination */}
            <div className="mt-6 flex justify-center items-center gap-4 text-sm">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MaintenanceHODApprovals;
