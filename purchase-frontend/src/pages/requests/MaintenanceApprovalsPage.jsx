// src/pages/requests/MaintenanceApprovalsPage.jsx
import React, { useEffect, useState } from 'react';
import axios from '../../api/axios';
import Navbar from '../../components/Navbar';
import { Button } from '../../components/ui/Button';

const MaintenanceApprovalsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentsMap, setCommentsMap] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [itemsMap, setItemsMap] = useState({});

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await axios.get('/api/requests/pending-maintenance-approvals');
        setRequests(res.data);
      } catch (err) {
        console.error('❌ Failed to load maintenance requests:', err);
        setError('Failed to load maintenance requests. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const confirmAction = (action) =>
    window.confirm(`Are you sure you want to ${action.toLowerCase()} this maintenance request?`);

  const handleApproval = async (id, decision) => {
    if (!confirmAction(decision)) return;
    setSubmittingId(id);

    try {
      await axios.post('/api/requests/approve-maintenance', {
        request_id: id,
        decision,
        comments: commentsMap[id] || '',
      });

      setRequests((prev) => prev.filter((r) => r.request_id !== id));
      setCommentsMap((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    } catch (err) {
      console.error('❌ Failed to submit decision:', err);
      alert('❌ Failed to process your decision. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  };

  const toggleExpand = async (id) => {
    setExpandedId(expandedId === id ? null : id);
    if (!itemsMap[id]) {
      try {
        const res = await axios.get(`/api/requests/${id}/items`);
        setItemsMap((prev) => ({ ...prev, [id]: res.data.items }));
      } catch (err) {
        console.error('❌ Failed to load items:', err);
      }
    }
  };

  return (
    <>
      <Navbar />
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Maintenance Requests for Approval</h1>

        {loading ? (
          <p>Loading maintenance approvals...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : requests.length === 0 ? (
          <p>No maintenance requests pending your approval.</p>
        ) : (
          requests.map((req) => (
            <div
              key={req.request_id}
              className="border rounded-lg p-4 mb-4 shadow bg-white transition duration-200"
            >
              <p><strong>Request ID:</strong> {req.request_id}</p>
              <p><strong>Technician:</strong> {req.technician_name}</p>
              <p><strong>Ref Number:</strong> {req.maintenance_ref_number}</p>
              <p><strong>Department:</strong> {req.department_name}</p>
              <p><strong>Section:</strong> {req.section_name || '—'}</p> {/* 👈 NEW LINE */}
              <p><strong>Budget Month:</strong> {req.budget_impact_month}</p>
              <p><strong>Justification:</strong> {req.justification}</p>
              <p>
                <strong>Created At:</strong>{' '}
                {new Date(req.created_at).toLocaleString('en-GB', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </p>

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

              <textarea
                aria-label="Approval Comments"
                placeholder="Optional comments..."
                value={commentsMap[req.request_id] || ''}
                onChange={(e) =>
                  setCommentsMap((prev) => ({
                    ...prev,
                    [req.request_id]: e.target.value,
                  }))
                }
                className="w-full mt-2 p-2 border rounded"
              />

              <div className="mt-3 flex gap-2">
                <Button
                  onClick={() => handleApproval(req.request_id, 'Approved')}
                  isLoading={submittingId === req.request_id}
                  disabled={submittingId === req.request_id}
                  aria-label={`Approve request ${req.request_id}`}
                >
                  {submittingId === req.request_id ? 'Approving...' : 'Approve'}
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => handleApproval(req.request_id, 'Rejected')}
                  isLoading={submittingId === req.request_id}
                  disabled={submittingId === req.request_id}
                  aria-label={`Reject request ${req.request_id}`}
                >
                  {submittingId === req.request_id ? 'Rejecting...' : 'Reject'}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default MaintenanceApprovalsPage;
