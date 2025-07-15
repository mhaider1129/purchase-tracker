// src/pages/AssignedRequestsPage.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axios';
import ProcurementItemStatusPanel from '../components/ProcurementItemStatusPanel';
import Navbar from '../components/Navbar';

const AssignedRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchAssignedRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/requests/assigned');
      setRequests(res.data.data || []);
    } catch (err) {
      console.error('❌ Failed to fetch assigned requests:', err);
      alert('Failed to load assigned requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (requestId) => {
    setLoadingItems(true);
    try {
      const res = await axios.get(`/api/requests/${requestId}/items`);
      setItems(res.data.items || []);
    } catch (err) {
      console.error(`❌ Error fetching items for request ${requestId}:`, err);
      alert('Failed to load request items');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleMarkAsCompleted = async (requestId) => {
    if (!window.confirm('Are you sure you want to mark this request as completed?')) return;

    try {
      await axios.patch(`/api/requests/${requestId}/mark-completed`);
      alert('✅ Request marked as completed.');
      setExpandedRequestId(null);
      fetchAssignedRequests();
    } catch (err) {
      console.error('❌ Error marking request as completed:', err);
      alert('❌ Failed to mark request as completed.');
    }
  };

  useEffect(() => {
    fetchAssignedRequests();
  }, []);

  const toggleExpand = (requestId) => {
    const isExpanded = expandedRequestId === requestId;
    setExpandedRequestId(isExpanded ? null : requestId);
    if (!isExpanded) fetchItems(requestId);
  };

  return (
    <>
      <Navbar />

      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Assigned Requests</h1>

        {loading ? (
          <p className="text-gray-600">Loading assigned requests...</p>
        ) : requests.length === 0 ? (
          <p>No requests assigned to you.</p>
        ) : (
          requests.map((request) => (
            <div key={request.id} className="mb-6 border rounded p-4 bg-white shadow">
              <div className="flex justify-between items-center">
                <div>
                  <p><strong>ID:</strong> {request.id}</p>
                  <p><strong>Type:</strong> {request.request_type}</p>
                  <p><strong>Justification:</strong> {request.justification}</p>
                </div>
                <button
                  onClick={() => toggleExpand(request.id)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  {expandedRequestId === request.id ? 'Hide Items' : 'View Items'}
                </button>
              </div>

              {expandedRequestId === request.id && (
                <div className="mt-4">
                  {loadingItems ? (
                    <p className="text-gray-500">Loading items...</p>
                  ) : items.length === 0 ? (
                    <p className="text-gray-500">No items found for this request.</p>
                  ) : (
                    <>
                      {items.map((item, idx) => (
                        <ProcurementItemStatusPanel
                          key={item.id || idx}
                          item={item}
                          onUpdate={() => fetchItems(request.id)}
                        />
                      ))}

                      {/* ✅ Button to mark request as completed */}
                      <div className="mt-4">
                        <button
                          onClick={() => handleMarkAsCompleted(request.id)}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                          disabled={items.some(item => !item.procurement_status)}
                        >
                          Mark Request as Completed
                        </button>
                      </div>
                    </>
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

export default AssignedRequestsPage;
