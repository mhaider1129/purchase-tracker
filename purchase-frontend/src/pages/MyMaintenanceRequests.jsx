// src/pages/MyMaintenanceRequests.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import { saveAs } from 'file-saver';

const MyMaintenanceRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await axios.get('/api/requests/my-maintenance');
        setRequests(res.data || []);
      } catch (err) {
        console.error('❌ Failed to fetch maintenance requests:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const getStatusBadge = (status) => {
    const base = 'px-2 py-1 text-xs font-semibold rounded';
    switch (status.toLowerCase()) {
      case 'approved':
        return `${base} bg-green-100 text-green-800`;
      case 'rejected':
        return `${base} bg-red-100 text-red-800`;
      case 'pending':
        return `${base} bg-yellow-100 text-yellow-800`;
      default:
        return `${base} bg-gray-100 text-gray-700`;
    }
  };

  const exportToCSV = () => {
    const csvRows = [
      ['ID', 'Justification', 'Reference #', 'Status', 'Submitted At'],
      ...requests.map((r) => [
        r.id,
        r.justification,
        r.maintenance_ref_number || '-',
        r.status,
        new Date(r.created_at).toLocaleString(),
      ]),
    ];

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `My_Maintenance_Requests_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const totalPages = Math.ceil(requests.length / itemsPerPage);
  const paginated = requests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">My Maintenance Requests</h1>
          <button
            onClick={exportToCSV}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Export CSV
          </button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : requests.length === 0 ? (
          <p>No maintenance requests found.</p>
        ) : (
          <>
            <table className="w-full border text-sm mb-4">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-2 text-left">ID</th>
                  <th className="border px-3 py-2 text-left">Justification</th>
                  <th className="border px-3 py-2 text-left">Ref #</th>
                  <th className="border px-3 py-2 text-left">Status</th>
                  <th className="border px-3 py-2 text-left">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr key={r.id}>
                    <td className="border px-3 py-2">{r.id}</td>
                    <td className="border px-3 py-2">{r.justification}</td>
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

            {/* Pagination */}
            <div className="flex justify-center items-center gap-4 text-sm">
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
          </>
        )}
      </div>
    </>
  );
};

export default MyMaintenanceRequests;