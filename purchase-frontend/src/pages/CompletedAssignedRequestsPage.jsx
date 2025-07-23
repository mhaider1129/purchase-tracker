// src/pages/CompletedAssignedRequestsPage.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';

const CompletedAssignedRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [itemsCache, setItemsCache] = useState({});
  const [search, setSearch] = useState('');

  const fetchCompleted = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/requests/completed-assigned', {
        params: { search },
      });
      setRequests(res.data.data || []);
    } catch (err) {
      console.error('❌ Failed to fetch completed requests:', err);
      alert('Error loading completed requests.');
    } finally {
      setLoading(false);
    }
  };

  const toggleItems = async (requestId) => {
    if (expandedRequestId === requestId) {
      setExpandedRequestId(null);
      return;
    }

    // If not cached, fetch items
    if (!itemsCache[requestId]) {
      try {
        const res = await axios.get(`/api/requests/${requestId}/items`);
        setItemsCache((prev) => ({ ...prev, [requestId]: res.data.items }));
      } catch (err) {
        console.error(`❌ Failed to fetch items for request ${requestId}:`, err);
        alert('Error loading request items.');
        return;
      }
    }

    setExpandedRequestId(requestId);
  };

  useEffect(() => {
    fetchCompleted();
  }, [search]);

  return (
    <>
      <Navbar />
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">My Completed Requests</h1>

        <input
          type="text"
          className="border p-2 rounded mb-4"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="text-gray-500">No completed requests found.</p>
        ) : (
          requests.map((req) => (
            <div key={req.id} className="mb-4 p-4 border rounded shadow bg-white">
              <p><strong>ID:</strong> {req.id}</p>
              <p><strong>Type:</strong> {req.request_type}</p>
              <p><strong>Justification:</strong> {req.justification}</p>
              <p><strong>Submitted by:</strong> {req.requester_name} ({req.requester_role})</p>
              <p><strong>Completed At:</strong> {new Date(req.completed_at).toLocaleString()}</p>

              <button
                onClick={() => toggleItems(req.id)}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                {expandedRequestId === req.id ? 'Hide Items' : 'View Items'}
              </button>

              {expandedRequestId === req.id && (
                <div className="mt-3 pl-4 border-l">
                  {itemsCache[req.id]?.length > 0 ? (
  itemsCache[req.id].map((item) => (
    <div key={item.id} className="mb-2">
      <p>
        🔹 <strong>{item.item_name}</strong>
        {item.brand && <span> ({item.brand})</span>} — Qty: {item.quantity}, Purchased:{' '}
        {item.purchased_quantity ?? '—'}, Status: {item.procurement_status}
      </p>
      {item.procurement_comment && (
        <p className="text-sm text-gray-500 italic">📝 {item.procurement_comment}</p>
      )}
    </div>
  ))
) : (
  <p className="text-sm text-gray-500">No items found.</p>
)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default CompletedAssignedRequestsPage;
