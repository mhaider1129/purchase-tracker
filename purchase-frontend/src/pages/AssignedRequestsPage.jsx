// src/pages/AssignedRequestsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import ProcurementItemStatusPanel from '../components/ProcurementItemStatusPanel';
import Navbar from '../components/Navbar';
import ApprovalTimeline from '../components/ApprovalTimeline';
import useApprovalTimeline from '../hooks/useApprovalTimeline';

const createEmptyGroups = () => ({
  purchased: [],
  pending: [],
  notProcured: [],
  other: [],
});

const categorizeItems = (items = []) => {
  const groups = createEmptyGroups();

  items.forEach((item) => {
    const status = (item.procurement_status || '').toLowerCase();

    if (status === 'purchased' || status === 'completed') {
      groups.purchased.push(item);
    } else if (status === 'not_procured' || status === 'canceled') {
      groups.notProcured.push(item);
    } else if (status === 'pending' || !status) {
      groups.pending.push(item);
    } else {
      groups.other.push(item);
    }
  });

  return groups;
};

const computeSummaryFromItems = (items = []) => {
  const summary = {
    total_items: items.length,
    purchased_count: 0,
    pending_count: 0,
    not_procured_count: 0,
    calculated_total_cost: 0,
  };

  items.forEach((item) => {
    const status = (item.procurement_status || '').toLowerCase();

    if (status === 'purchased' || status === 'completed') {
      summary.purchased_count += 1;
    } else if (status === 'not_procured' || status === 'canceled') {
      summary.not_procured_count += 1;
    } else {
      summary.pending_count += 1;
    }

    const quantity = Number(item.purchased_quantity ?? item.quantity ?? 0);
    const unitCost = Number(item.unit_cost ?? 0);
    if (!Number.isNaN(quantity) && !Number.isNaN(unitCost)) {
      summary.calculated_total_cost += quantity * unitCost;
    }
  });

  summary.calculated_total_cost = Number(summary.calculated_total_cost.toFixed(2));
  return summary;
};

const formatAmount = (value) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return '—';
  }

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const summaryToneClasses = {
  default: 'bg-slate-100 text-slate-700 border border-slate-200',
  success: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border border-amber-200',
  danger: 'bg-rose-100 text-rose-700 border border-rose-200',
};

const SummaryBadge = ({ label, value, tone = 'default' }) => (
  <div
    className={`rounded-md px-3 py-2 text-sm flex flex-col ${
      summaryToneClasses[tone] || summaryToneClasses.default
    }`}
  >
    <span className="text-lg font-semibold">{value ?? 0}</span>
    <span className="text-[11px] uppercase tracking-wide">{label}</span>
  </div>
);

const ITEM_SECTION_CONFIG = [
  {
    key: 'purchased',
    title: 'Purchased Items',
    description: 'Items that have been successfully procured.',
    tone: 'success',
    empty: 'No items have been marked as purchased yet.',
  },
  {
    key: 'pending',
    title: 'Pending Purchase',
    description: 'Items still awaiting procurement action.',
    tone: 'warning',
    empty: 'No items are currently pending purchase.',
  },
  {
    key: 'notProcured',
    title: 'Unable to Procure',
    description: 'Items that could not be sourced or were canceled.',
    tone: 'danger',
    empty: 'No items are marked as unable to procure.',
  },
  {
    key: 'other',
    title: 'Other Updates',
    description: 'Items that have been updated with a different status.',
    tone: 'default',
    empty: 'There are no additional item updates.',
  },
];

const AssignedRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [items, setItems] = useState([]);
  const [groupedItems, setGroupedItems] = useState(() => createEmptyGroups());
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [requestCosts, setRequestCosts] = useState({});
  const [autoTotals, setAutoTotals] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);
  const {
    expandedApprovalsId,
    approvalsMap,
    loadingApprovalsId,
    toggleApprovals,
    resetApprovals,
  } = useApprovalTimeline();
  
  const fetchAssignedRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/requests/assigned');
      const fetched = res.data.data || [];
      setRequests(fetched);

      const costMap = {};
      const autoMap = {};
      fetched.forEach((req) => {
        const recordedCost = req.estimated_cost ?? '';
        const autoTotal = req.status_summary?.calculated_total_cost ?? null;
        autoMap[req.id] = autoTotal;

        if (recordedCost === '' && autoTotal !== null) {
          costMap[req.id] = autoTotal;
        } else {
          costMap[req.id] = recordedCost;
        }
      });

      setRequestCosts(costMap);
      resetApprovals();
      setAutoTotals(autoMap);
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
      const fetchedItems = res.data.items || [];
      setItems(fetchedItems);
      const groups = categorizeItems(fetchedItems);
      setGroupedItems(groups);

      const summary = computeSummaryFromItems(fetchedItems);
      setRequests((prev) =>
        prev.map((req) =>
          req.id === requestId ? { ...req, status_summary: summary } : req,
        ),
      );
      setAutoTotals((prev) => ({ ...prev, [requestId]: summary.calculated_total_cost }));
    } catch (err) {
      console.error(`❌ Error fetching items for request ${requestId}:`, err);
      alert('Failed to load request items');
      setGroupedItems(createEmptyGroups());
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
      setItems([]);
      setGroupedItems(createEmptyGroups());
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
    const rawValue = requestCosts[requestId];
    const cost = Number(rawValue);

    if (Number.isNaN(cost) || cost < 0) {
      alert('Enter valid total cost.');
      return;
    }

    try {
      await axios.put(`/api/requests/${requestId}/cost`, { estimated_cost: cost });
      alert('Total cost updated.');
      setRequests((prev) =>
        prev.map((req) =>
          req.id === requestId ? { ...req, estimated_cost: cost } : req,
        ),
      );
    } catch (err) {
      console.error('❌ Error updating cost:', err);
      alert('Failed to update total cost.');
    }
  };

  const handleGenerateDoc = async (requestId, type) => {
    try {
      const response = await axios.get(`/api/requests/${requestId}/rfx`, {
        params: { type },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/pdf',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${type.toUpperCase()}_${requestId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(`❌ Error generating ${type.toUpperCase()} document for request ${requestId}:`, err);
      alert('Failed to generate document.');
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    const storedPath = attachment.file_path || '';
    const filename = storedPath.split(/[\\/]/).pop();
    const downloadEndpoint =
      attachment.download_url || (filename ? `/api/attachments/download/${encodeURIComponent(filename)}` : null);

    if (!downloadEndpoint) {
      alert('Attachment file is missing.');
      return;
    }

    setDownloadingAttachmentId(attachment.id);
    try {
      const response = await axios.get(downloadEndpoint, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = attachment.file_name || filename || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(`❌ Error downloading attachment ${attachment.id}:`, err);
      alert('Failed to download attachment. Please try again.');
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  useEffect(() => {
    fetchAssignedRequests();
  }, [resetApprovals]);

  const toggleExpand = (requestId) => {
    const isExpanded = expandedRequestId === requestId;
    setExpandedRequestId(isExpanded ? null : requestId);
    if (isExpanded) {
      setItems([]);
      setGroupedItems(createEmptyGroups());
      setAttachments([]);
    } else {
      fetchItems(requestId);
      fetchAttachments(requestId);
    }
  };

  const canMarkCurrentRequestComplete = useMemo(() => {
    if (!items.length) return false;

    return items.every((item) => {
      const status = (item.procurement_status || '').toLowerCase();
      const qty = item.purchased_quantity;

      if (qty === null || qty === undefined) {
        return false;
      }

      if (status === 'purchased' || status === 'completed') {
        return Number(qty) > 0;
      }

      if (status === 'not_procured' || status === 'canceled') {
        return true;
      }

      return false;
    });
  }, [items]);
  
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
          requests.map((request) => {
            const summary = request.status_summary || {};
            const autoTotal = autoTotals[request.id] ?? summary.calculated_total_cost ?? null;
            return (
              <div key={request.id} className="mb-6 border rounded-lg p-5 bg-white shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm text-gray-500">
                      <strong className="text-gray-700">Request ID:</strong> {request.id}
                    </p>
                    <p className="text-sm text-gray-500">
                      <strong className="text-gray-700">Type:</strong> {request.request_type}
                    </p>
                    <p className="text-sm text-gray-500">
                      <strong className="text-gray-700">Project:</strong> {request.project_name || '—'}
                    </p>
                    <p className="text-sm text-gray-500">
                      <strong className="text-gray-700">Justification:</strong> {request.justification}
                    </p>
                    {request.requester_name && (
                      <p className="text-sm text-gray-500">
                        <strong className="text-gray-700">Requester:</strong> {request.requester_name} ({request.requester_role})
                      </p>
                    )}
                  </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => toggleExpand(request.id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    {expandedRequestId === request.id ? 'Hide Items' : 'View Items'}
                  </button>
                  <button
                    className="text-blue-600 underline"
                    onClick={() => toggleApprovals(request.id)}
                    disabled={loadingApprovalsId === request.id}
                  >
                    {expandedApprovalsId === request.id ? 'Hide Approvals' : 'View Approvals'}
                  </button>
                </div>
                </div>

              {expandedApprovalsId === request.id && (
                <div className="mt-4 border-t pt-2">
                  <ApprovalTimeline
                    approvals={approvalsMap[request.id]}
                    isLoading={loadingApprovalsId === request.id}
                  />
                </div>
              )}
              
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <SummaryBadge label="Total Items" value={summary.total_items ?? 0} />
                  <SummaryBadge label="Purchased" value={summary.purchased_count ?? 0} tone="success" />
                  <SummaryBadge label="Pending" value={summary.pending_count ?? 0} tone="warning" />
                  <SummaryBadge label="Not Procured" value={summary.not_procured_count ?? 0} tone="danger" />
                </div>

                {autoTotal !== null && (
                  <p className="mt-2 text-xs text-gray-500">
                    Auto-calculated total from items: <strong>{formatAmount(autoTotal)}</strong>
                  </p>
                )}

                {expandedRequestId === request.id && (
                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div className="flex-1">
                          <label className="block text-sm font-medium mb-1 text-slate-700">
                            Total Cost Recorded
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={requestCosts[request.id] ?? ''}
                            onChange={(e) => handleCostChange(request.id, e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
                          />
                          {autoTotal !== null && (
                            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                              <span>
                                Suggested total: <strong>{formatAmount(autoTotal)}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCostChange(request.id, autoTotal)}
                                className="text-blue-600 hover:text-blue-500"
                              >
                                Use suggested value
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleSaveTotalCost(request.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        >
                          Save Total Cost
                        </button>
                      </div>
                    </div>

                    {loadingItems ? (
                      <p className="text-gray-500">Loading items...</p>
                    ) : items.length === 0 ? (
                      <p className="text-gray-500">No items found for this request.</p>
                    ) : (
                      ITEM_SECTION_CONFIG.map(({ key, title, description, tone, empty }) => {
                        const sectionItems = groupedItems[key] || [];
                        if (key === 'other' && sectionItems.length === 0) {
                          return null;
                        }

                        return (
                          <div key={key} className="mt-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
                                <p className="text-sm text-gray-500">{description}</p>
                              </div>
                              <span
                                className={`text-xs font-medium px-3 py-1 rounded-full ${
                                  summaryToneClasses[tone] || summaryToneClasses.default
                                }`}
                              >
                                {sectionItems.length} item{sectionItems.length === 1 ? '' : 's'}
                              </span>
                            </div>
                            {sectionItems.length === 0 ? (
                              <p className="mt-3 text-sm text-gray-500 italic">{empty}</p>
                            ) : (
                              sectionItems.map((item, idx) => (
                                <ProcurementItemStatusPanel
                                  key={item.id || idx}
                                  item={item}
                                  onUpdate={() => fetchItems(request.id)}
                                />
                              ))
                            )}
                          </div>
                        );
                      })
                    )}

                    <div className="mt-6">
                      <h3 className="font-semibold mb-2">Attachments</h3>
                      {loadingAttachments ? (
                        <p className="text-gray-500">Loading attachments...</p>
                      ) : attachments.length === 0 ? (
                        <p className="text-gray-500">No attachments found.</p>
                      ) : (
                        <ul className="list-disc pl-5 text-blue-600">
                          {attachments.map((att) => {
                            const filename = att.file_name || att.file_path.split(/[\\/]/).pop();
                            return (
                              <li key={att.id}>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttachment(att)}
                                  className="underline text-left text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                  disabled={downloadingAttachmentId === att.id}
                                >
                                  {downloadingAttachmentId === att.id ? 'Downloading…' : filename}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="mt-6 border-t border-slate-200 pt-6">
                      <h3 className="font-semibold mb-3">Generate Document</h3>
                      <div className="flex flex-wrap gap-3">
                        {['rfp', 'rfi', 'rfq'].map((type) => (
                          <button
                            key={type}
                            onClick={() => handleGenerateDoc(request.id, type)}
                            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
                          >
                            {type.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6">
                      <button
                        onClick={() => handleMarkAsCompleted(request.id)}
                        className={`px-4 py-2 rounded text-white transition ${
                          canMarkCurrentRequestComplete
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gray-300 cursor-not-allowed'
                        }`}
                        disabled={!canMarkCurrentRequestComplete}
                      >
                        Mark Request as Completed
                      </button>
                      {!canMarkCurrentRequestComplete && items.length > 0 && (
                        <p className="mt-2 text-xs text-rose-600">
                          All items must be marked as purchased or unable to procure with recorded quantities before completing the request.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
};

export default AssignedRequestsPage;