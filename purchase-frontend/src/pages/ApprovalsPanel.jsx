//src/pages/ApprovalsPanel.js
import React, { useEffect, useState, useCallback } from 'react';
import axios from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';

const ApprovalsPanel = () => {
  const { token } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [itemsMap, setItemsMap] = useState({});
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [selectedApprovalId, setSelectedApprovalId] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [selectedDecision, setSelectedDecision] = useState('');
  const [comments, setComments] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  const { user } = useCurrentUser();
  const canMarkUrgent = ['HOD', 'CMO', 'COO', 'WarehouseManager'].includes(user?.role);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/requests/pending-approvals');
      setRequests(res.data);
    } catch (err) {
      console.error('❌ Failed to fetch approvals:', err);
      setError('Failed to load pending approvals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const toggleExpand = async (requestId) => {
    setExpandedId(expandedId === requestId ? null : requestId);
    if (!itemsMap[requestId]) {
      try {
        const res = await axios.get(`/api/requests/${requestId}/items`);
        setItemsMap(prev => ({ ...prev, [requestId]: res.data.items }));
      } catch (err) {
        console.error('❌ Failed to load items:', err);
      }
    }
  };

  const submitDecision = async () => {
    const confirmed = window.confirm(`Are you sure you want to ${selectedDecision.toLowerCase()} Request #${selectedRequestId}?`);
    if (!confirmed) return;

    try {
      await axios.put(`/api/requests/approval/${selectedApprovalId}`, {
        status: selectedDecision,
        comments,
        is_urgent: canMarkUrgent ? isUrgent : false,
      });

      setRequests(prev => prev.filter(r => r.approval_id !== selectedApprovalId));
      resetCommentModal();
    } catch (err) {
      console.error('❌ Action failed:', err);
      alert('Failed to process your decision. Please try again.');
    }
  };

  const reassignToDepartmentRequester = async (requestId, approvalId) => {
    const confirmed = window.confirm(`Assign Maintenance Request #${requestId} to a designated requester in your department?`);
    if (!confirmed) return;

    try {
      await axios.put(`/api/requests/maintenance/reassign-to-requester`, {
        request_id: requestId,
        approval_id: approvalId
      });

      alert(`✅ Request #${requestId} has been reassigned to a department requester.`);
      fetchApprovals(); // reload list
    } catch (err) {
      console.error('❌ Reassignment failed:', err);
      alert('Failed to assign request to department requester.');
    }
  };

  const openCommentModal = (approvalId, requestId, decision) => {
    setSelectedApprovalId(approvalId);
    setSelectedRequestId(requestId);
    setSelectedDecision(decision);
    setComments('');
    setIsUrgent(false);
    setShowCommentBox(true);
  };

  const resetCommentModal = () => {
    setShowCommentBox(false);
    setSelectedApprovalId(null);
    setSelectedRequestId(null);
    setSelectedDecision('');
    setComments('');
    setIsUrgent(false);
  };

  const getCostLabel = (cost) => {
    if (cost > 100_000_000) return { label: '⬤ Very High Cost', color: 'bg-red-600' };
    if (cost > 50_000_000) return { label: '⬤ High Cost', color: 'bg-orange-500' };
    if (cost > 10_000_000) return { label: '⬤ Medium Cost', color: 'bg-yellow-400' };
    return { label: '⬤ Low Cost', color: 'bg-green-500' };
  };

  if (loading) return <div className="p-6">Loading approvals...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div>
      <Navbar />
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Pending Approvals</h1>

        {requests.length === 0 ? (
          <p>No pending approvals.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const tag = getCostLabel(req.estimated_cost);

              return (
                <div key={req.approval_id} className="border rounded-lg p-4 shadow-sm">
                  <p><strong>Request ID:</strong> {req.request_id}</p>
                  <p><strong>Type:</strong> {req.request_type}</p>
                  <p><strong>Justification:</strong> {req.justification}</p>
                  <p><strong>Department:</strong> {req.department_name || '—'}</p>
                  <p><strong>Section:</strong> {req.section_name || '—'}</p>
                  <p><strong>Estimated Cost:</strong> {req.estimated_cost.toLocaleString()} IQD</p>
                  <p className={`inline-block mt-1 text-xs text-white px-2 py-1 rounded ${tag.color}`}>
                    {tag.label}
                  </p>

                  {req.is_urgent && (
                    <span className="inline-block ml-2 text-xs text-white px-2 py-1 rounded bg-red-600 font-bold">
                      Urgent
                    </span>
                  )}

                  {req.updated_by && (
                    <p className="text-sm text-gray-500 mt-2">
                      Last Updated by <strong>{req.updated_by}</strong> on{' '}
                      {req.updated_at ? new Date(req.updated_at).toLocaleString('en-GB') : '—'}
                    </p>
                  )}

                  <button
                    className="text-blue-600 underline text-sm mt-2"
                    onClick={() => toggleExpand(req.request_id)}
                  >
                    {expandedId === req.request_id ? 'Hide Items' : 'Show Requested Items'}
                  </button>

                  {expandedId === req.request_id && (
                    <div className="mt-3">
                      {itemsMap[req.request_id]?.length > 0 ? (
                        <table className="w-full text-sm border">
                          <thead>
                          <tr className="bg-gray-100">
                              <th className="border p-1">Item</th>
                              <th className="border p-1">Brand</th>
                              <th className="border p-1">Qty</th>
                              <th className="border p-1">Available Qty</th>
                              <th className="border p-1">Unit Cost</th>
                              <th className="border p-1">Total</th>
                          </tr>
                          </thead>
                          <tbody>
                            {itemsMap[req.request_id].map((item, idx) => (
                              <tr key={idx}>
                                <td className="border p-1">{item.item_name}</td>
                                <td className="border p-1">{item.brand || '—'}</td>
                                <td className="border p-1">{item.quantity}</td>
                                <td className="border p-1">{item.available_quantity ?? '—'}</td>
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

                  <div className="mt-4 flex gap-3">
                    {req.request_type === 'Maintenance' && req.approval_level === 1 ? (
                      <Button onClick={() => reassignToDepartmentRequester(req.request_id, req.approval_id)}>
                        Assign to Department Requester
                      </Button>
                    ) : (
                      <>
                        <Button onClick={() => openCommentModal(req.approval_id, req.request_id, 'Approved')}>
                          Approve
                        </Button>
                        <Button variant="destructive" onClick={() => openCommentModal(req.approval_id, req.request_id, 'Rejected')}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 💬 Comment Modal */}
      {showCommentBox && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg w-[90%] max-w-md">
            <h2 className="text-lg font-semibold mb-2">
              {selectedDecision === 'Approved' ? 'Approve' : 'Reject'} Request #{selectedRequestId}
            </h2>
            <textarea
              className="w-full h-28 border rounded p-2 text-sm"
              placeholder="Enter optional comments..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
            {canMarkUrgent && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="urgent"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="urgent" className="text-sm font-medium">
                  Mark this request as <span className="text-red-600 font-semibold">Urgent</span>
                </label>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <Button onClick={submitDecision}>Submit</Button>
              <Button variant="ghost" onClick={resetCommentModal}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsPanel;