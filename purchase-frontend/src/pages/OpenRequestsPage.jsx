// src/pages/OpenRequestsPage.jsx
import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import { saveAs } from 'file-saver';

const OpenRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [requestType, setRequestType] = useState('');
  const [status, setStatus] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [itemsMap, setItemsMap] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchOpenRequests = async () => {
      try {
        const res = await api.get('/api/requests/my', { params: { search } });
        const open = res.data.filter(
          (r) => !['completed', 'rejected'].includes(r.status.toLowerCase())
        );
        setRequests(open);
        setFiltered(open);
      } catch (err) {
        console.error('❌ Failed to load requests:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOpenRequests();
  }, [search]);

  const handleFilter = () => {
    let data = [...requests];
    if (requestType) data = data.filter((r) => r.request_type === requestType);
    if (status) data = data.filter((r) => r.status === status);
    setFiltered(data);
    setCurrentPage(1);
  };

  const exportToCSV = () => {
    const rows = [
      ['ID', 'Type', 'Status', 'Cost', 'Submitted'],
      ...filtered.map((r) => [
        r.id,
        r.request_type,
        r.status,
        r.estimated_cost,
        new Date(r.created_at).toLocaleString(),
      ]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'Open_Requests.csv');
  };

  const toggleExpand = async (requestId) => {
    if (expandedId === requestId) {
      setExpandedId(null);
      return;
    }
    if (!itemsMap[requestId]) {
      try {
        setLoadingId(requestId);
        const res = await api.get(`/api/requests/${requestId}/items`);
        setItemsMap((prev) => ({ ...prev, [requestId]: res.data.items }));
      } catch (err) {
        console.error('❌ Failed to load items:', err);
      } finally {
        setLoadingId(null);
      }
    }
    setExpandedId(requestId);
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'text-green-600';
      case 'rejected': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Open Requests</h1>
          <button
            onClick={exportToCSV}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Export CSV
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <select className="border p-2 rounded" value={requestType} onChange={(e) => setRequestType(e.target.value)}>
            <option value="">All Types</option>
            <option value="Stock">Stock</option>
            <option value="Non-Stock">Non-Stock</option>
            <option value="Medical Device">Medical Device</option>
          </select>
          <select className="border p-2 rounded" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
          </select>
          <input
            type="text"
            className="border p-2 rounded"
            placeholder="Search items"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleFilter}>Apply Filters</button>
        </div>

        {isLoading ? (
          <p className="text-gray-600">Loading...</p>
        ) : paginated.length === 0 ? (
          <p>No requests found.</p>
        ) : (
          <div className="space-y-4">
            {paginated.map((req) => (
              <div key={req.id} className="border rounded p-4 shadow">
                <div className="flex justify-between items-center">
                  <div>
                    <p><strong>ID:</strong> {req.id}</p>
                    <p><strong>Type:</strong> {req.request_type}</p>
                    {req.is_urgent && <p className="text-red-600 font-bold text-sm mt-1">🚨 Urgent Request</p>}
                    <p>
                      <strong>Status:</strong>{' '}
                      <span className={getStatusColor(req.status)}>{req.status}</span>
                    </p>
                    <p><strong>Cost:</strong> {req.estimated_cost} IQD</p>
                    <p><strong>Submitted:</strong> {new Date(req.created_at).toLocaleString()}</p>
                  </div>
                  <button
                    className="text-blue-600 underline"
                    onClick={() => toggleExpand(req.id)}
                    disabled={loadingId === req.id}
                  >
                    {expandedId === req.id ? 'Hide Items' : 'Show Items'}
                  </button>
                </div>

                {expandedId === req.id && (
                  <div className="mt-4 border-t pt-2">
                    <h3 className="font-semibold mb-2">Requested Items:</h3>
                    {itemsMap[req.id]?.length > 0 ? (
                      <table className="w-full text-sm border">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border p-1">Item</th>
                            <th className="border p-1">Qty</th>
                            <th className="border p-1">Unit Cost</th>
                            <th className="border p-1">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsMap[req.id].map((item, idx) => (
                            <tr key={idx}>
                              <td className="border p-1">{item.item_name}</td>
                              <td className="border p-1">{item.quantity}</td>
                              <td className="border p-1">{item.unit_cost}</td>
                              <td className="border p-1">{item.total_cost}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-sm text-gray-500">No items found for this request.</p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            <div className="flex justify-center items-center gap-4 mt-6 text-sm">
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

export default OpenRequestsPage;