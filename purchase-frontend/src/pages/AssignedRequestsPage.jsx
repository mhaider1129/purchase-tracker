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
  const [requestCosts, setRequestCosts] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  const fetchAssignedRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/requests/assigned');
      setRequests(res.data.data || []);
      const costMap = {};
      (res.data.data || []).forEach(r => {
        costMap[r.id] = r.estimated_cost ?? '';
      });
      setRequestCosts(costMap);
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

  const fetchAttachments = async (requestId) => {
    setLoadingAttachments(true);
    try {
      const res = await axios.get(`/api/attachments/${requestId}`);
      setAttachments(res.data || []);
    } catch (err) {
      console.error(`❌ Error fetching attachments for request ${requestId}:`, err);
    } finally {
      setLoadingAttachments(false);
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

  const handleCostChange = (requestId, value) => {
    setRequestCosts((prev) => ({ ...prev, [requestId]: value }));
  };

  const handleSaveTotalCost = async (requestId) => {
    const cost = Number(requestCosts[requestId]);
    if (!cost || isNaN(cost) || cost <= 0) {
      alert('Enter valid total cost.');
      return;
    }

    try {
      await axios.put(`/api/requests/${requestId}/cost`, { estimated_cost: cost });
      alert('Total cost updated.');
      fetchAssignedRequests();
    } catch (err) {
      console.error('❌ Error updating cost:', err);
      alert('Failed to update total cost.');
    }
  };

  const handleGenerateDoc = (requestId, type) => {
    const url = `${axios.defaults.baseURL}api/requests/${requestId}/rfx?type=${type}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    fetchAssignedRequests();
  }, []);

  const toggleExpand = (requestId) => {
    const isExpanded = expandedRequestId === requestId;
    setExpandedRequestId(isExpanded ? null : requestId);
    if (isExpanded) {
      setItems([]);
      setAttachments([]);
    } else {
      fetchItems(requestId);
      fetchAttachments(requestId);
    }
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
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Total Cost</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={requestCosts[request.id] ?? ''}
                      onChange={(e) => handleCostChange(request.id, e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
                    />
                    <button
                      onClick={() => handleSaveTotalCost(request.id)}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Save Total Cost
                    </button>
                  </div>
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

                  {/* 📎 Attachments */}
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Attachments</h3>
                    {loadingAttachments ? (
                      <p className="text-gray-500">Loading attachments...</p>
                    ) : attachments.length === 0 ? (
                      <p className="text-gray-500">No attachments found.</p>
                    ) : (
                      <ul className="list-disc pl-5 text-blue-600">
                        {attachments.map((att) => {
                          const filename = att.file_path.split(/[/\\]/).pop();
                          const url = `${axios.defaults.baseURL}api/attachments/download/${encodeURIComponent(filename)}`;
                          return (
                            <li key={att.id}>
                              <a href={url} className="underline" target="_blank" rel="noopener noreferrer">
                                {att.file_name}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* 📄 Generate RFP/RFI/RFQ */}
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Generate Document</h3>
                    <div className="space-x-2">
                      <button
                        onClick={() => handleGenerateDoc(request.id, 'rfp')}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        RFP
                      </button>
                      <button
                        onClick={() => handleGenerateDoc(request.id, 'rfi')}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        RFI
                      </button>
                      <button
                        onClick={() => handleGenerateDoc(request.id, 'rfq')}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        RFQ
                      </button>
                    </div>
                  </div>

                      {/* ✅ Button to mark request as completed */}
                      <div className="mt-4">
                        <button
                          onClick={() => handleMarkAsCompleted(request.id)}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                          disabled={items.some(
                            item =>
                              !item.procurement_status ||
                              item.purchased_quantity === null ||
                              item.purchased_quantity === undefined
                          )}
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