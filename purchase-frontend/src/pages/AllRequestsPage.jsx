// src/pages/AllRequestsPage.jsx
import React, { useCallback, useEffect, useState } from 'react';
import axios from '../api/axios';
import AssignRequestPanel from '../components/AssignRequestPanel';
import Navbar from '../components/Navbar';
import { printRequest } from '../api/requests';
import ApprovalTimeline from '../components/ApprovalTimeline';
import useApprovalTimeline from '../hooks/useApprovalTimeline';

// Map roles returned by the API to human friendly step labels
const STEP_LABELS = {
  HOD: 'HOD Approval',
  CMO: 'CMO Approval',
  SCM: 'SCM Approval',
  COO: 'COO Approval',
  CEO: 'CEO Approval',
  CFO: 'CFO Approval',
  WarehouseManager: 'Warehouse Manager Approval',
  WarehouseKeeper: 'Warehouse Keeper Approval',
  ProcurementSupervisor: 'Procurement Supervisor Action',
  ProcurementSpecialist: 'Procurement Specialist Action',
};

// Helper to derive a readable current step string for a request
const getCurrentStep = (req) => {
  if (req.status === 'Rejected') return 'Rejected';
  if (req.status?.toLowerCase() === 'completed') return 'Completed';
  if (req.status === 'Approved' && !req.current_approver_role) return 'Approved';
  if (req.current_approver_role) {
    return STEP_LABELS[req.current_approver_role] || `${req.current_approver_role} Approval`;
  }
  return 'Submitted';
};

// Map the current step to a colorful badge
const getStepColor = (step) => {
  switch (step) {
    case 'Rejected':
      return 'bg-red-100 text-red-800';
    case 'Completed':
    case 'Approved':
      return 'bg-green-100 text-green-800';
    case 'Submitted':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-blue-100 text-blue-800';
  }
};

const AllRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [expandedAssignId, setExpandedAssignId] = useState(null);
  const [expandedItemsId, setExpandedItemsId] = useState(null);
  const [itemsMap, setItemsMap] = useState({});
  const [loadingItemsId, setLoadingItemsId] = useState(null);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('');
  const [requestType, setRequestType] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingExport, setLoadingExport] = useState(false);
  const [filtersChanged, setFiltersChanged] = useState(false);
  const limit = 10;
  const {
    expandedApprovalsId,
    approvalsMap,
    loadingApprovalsId,
    toggleApprovals,
    resetApprovals,
  } = useApprovalTimeline();

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

  const fetchRequests = useCallback(async () => {
    try {
      const res = await axios.get('/api/requests', {
        params: {
          filter,
          sort,
          request_type: requestType,
          search,
          from_date: fromDate,
          to_date: toDate,
          status,
          department_id: department,
          page,
          limit,
        },
      });

      setRequests(res?.data?.data || []);
      resetApprovals();
      const total = res?.data?.total || 0;
      setTotalPages(Math.ceil(total / limit));
    } catch (err) {
      console.error(err);
      alert('❌ Failed to fetch requests.');
    }
  }, [department, filter, fromDate, page, requestType, resetApprovals, search, sort, status, toDate]);

  useEffect(() => {
    if (filtersChanged) {
      fetchRequests();
      setFiltersChanged(false);
    }
  }, [fetchRequests, filtersChanged]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const applyFilters = () => {
    setPage(1);
    setFiltersChanged(true);
  };

  const toggleItems = async (requestId) => {
    if (expandedItemsId === requestId) {
      setExpandedItemsId(null);
      return;
    }
    if (!itemsMap[requestId]) {
      try {
        setLoadingItemsId(requestId);
        const res = await axios.get(`/api/requests/${requestId}/items`);
        setItemsMap((prev) => ({ ...prev, [requestId]: res.data.items || [] }));
      } catch (err) {
        console.error(`❌ Failed to load items for request ${requestId}:`, err);
        alert('Failed to load items');
      } finally {
        setLoadingItemsId(null);
      }
    }
    setExpandedItemsId(requestId);
  };

  const handleExport = async (type) => {
    setLoadingExport(true);
    try {
      const res = await axios.get(`/api/requests/export/${type}`, {
        params: {
          filter,
          sort,
          request_type: requestType,
          search,
          from_date: fromDate,
          to_date: toDate,
          status,
          department_id: department,
        },
        responseType: 'blob',
      });

      const blob = new Blob([res.data], {
        type: type === 'csv' ? 'text/csv' : 'application/pdf',
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `purchase_requests_${dateStr}.${type}`;

      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`❌ Failed to export ${type.toUpperCase()}:`, err);
      alert(`❌ Failed to export ${type.toUpperCase()}`);
    } finally {
      setLoadingExport(false);
    }
  };

  const handlePrint = async (requestId) => {
    try {
      const data = await printRequest(requestId);
      const { request, items, assigned_user, message, print_count } = data;

      const win = window.open('', '_blank');
      const rows = items
        .map(
          (item) => `
              <tr>
                <td>${item.item_name}</td>
                <td>${item.brand || ''}</td>
                <td>${item.quantity || ''}</td>
                <td>${item.unit_cost || ''}</td>
                <td>${item.total_cost || ''}</td>
              </tr>`
        )
        .join('');

      win.document.write(`
        <html>
          <head>
            <title>Request ${request.id}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { text-align: center; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background: #f5f5f5; }
            </style>
          </head>
          <body>
            <h1>Request #${request.id}</h1>
            <p><strong>Print count:</strong> ${print_count}</p>
            <p><strong>Type:</strong> ${request.request_type}</p>
            <p><strong>Justification:</strong> ${request.justification}</p>
            ${
              assigned_user
                ? `<p><strong>Assigned To:</strong> ${assigned_user.name} (${assigned_user.role})</p>`
                : ''
            }
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Brand</th>
                  <th>Qty</th>
                  <th>Unit Cost</th>
                  <th>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </body>
        </html>
      `);

      win.document.close();
      win.focus();
      win.print();
      alert(message);
    } catch (err) {
      console.error('❌ Failed to print request:', err);
      alert('❌ Failed to print request.');
    }
  };

  return (
    <>
      <Navbar />
      <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">All Purchase Requests</h1>

      <div className="flex flex-wrap gap-4 mb-4">
        <select className="border p-2 rounded" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All Requests</option>
          <option value="unassigned">Unassigned Only</option>
        </select>

        <select className="border p-2 rounded" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="">Newest First</option>
          <option value="assigned">Sort by Assigned</option>
        </select>

        <select className="border p-2 rounded" value={requestType} onChange={(e) => setRequestType(e.target.value)}>
          <option value="">All Types</option>
          <option value="Stock">Stock</option>
          <option value="Non-Stock">Non-Stock</option>
          <option value="Medical Device">Medical Device</option>
          <option value="Medication">Medication</option>
          <option value="IT Item">IT Item</option>
        </select>

        <input
          type="text"
          className="border p-2 rounded"
          placeholder="Search keyword"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <input
          type="date"
          className="border p-2 rounded"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />

        <input
          type="date"
          className="border p-2 rounded"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />

                <select className="border p-2 rounded" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="completed">Completed</option>
        </select>

        <select className="border p-2 rounded" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((dep) => (
            <option key={dep.id} value={dep.id}>
              {dep.name}
            </option>
          ))}
        </select>

        <button
          onClick={applyFilters}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Apply
        </button>

        <button
          onClick={() => handleExport('csv')}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          disabled={loadingExport}
        >
          {loadingExport ? 'Exporting...' : 'Export CSV'}
        </button>

        <button
          onClick={() => handleExport('pdf')}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          disabled={loadingExport}
        >
          {loadingExport ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>

      {requests.length === 0 ? (
        <p>No requests found.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const step = getCurrentStep(request);
            return (
            <div key={request.id} className="border rounded p-4 shadow bg-white">
              <div className="flex justify-between items-center">
                <div>
                  <p><strong>ID:</strong> {request.id}</p>
                  <p><strong>Type:</strong> {request.request_type}</p>
                  <p><strong>Justification:</strong> {request.justification}</p>
                  <p>
                    <strong>Assigned To:</strong>{' '}
                    {request.assigned_user_name
                      ? `${request.assigned_user_name} (${request.assigned_user_role})`
                      : 'Not Assigned'}
                  </p>
                  <p>
                    <strong>Current Step:</strong>{' '}
                    <span className={`px-2 py-1 rounded ${getStepColor(step)}`}>
                      {step}
                    </span>
                    {request.current_approver_role && request.current_approval_level && (
                      <> (Level {request.current_approval_level})</>
                    )}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                    onClick={() => handlePrint(request.id)}
                  >
                    Print
                  </button>
                  <button
                    className="text-blue-600 underline"
                    onClick={() => toggleItems(request.id)}
                    disabled={loadingItemsId === request.id}
                  >
                    {expandedItemsId === request.id ? 'Hide Items' : 'View Items'}
                  </button>
                  <button
                    className="text-blue-600 underline"
                    onClick={() => toggleApprovals(request.id)}
                    disabled={loadingApprovalsId === request.id}
                  >
                    {expandedApprovalsId === request.id ? 'Hide Approvals' : 'View Approvals'}
                  </button>
                  {request.status === 'Approved' && (
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                      onClick={() =>
                        setExpandedAssignId(
                          expandedAssignId === request.id ? null : request.id
                        )
                      }
                    >
                      {expandedAssignId === request.id
                        ? 'Hide'
                        : request.assigned_user_name
                        ? 'Reassign'
                        : 'Assign'}
                    </button>
                  )}
                </div>
              </div>

              {expandedAssignId === request.id && (
                <AssignRequestPanel
                  requestId={request.id}
                  currentAssignee={request.assigned_user_name}
                  onSuccess={fetchRequests}
                />
              )}

              {expandedItemsId === request.id && (
                <div className="mt-4 border-t pt-2">
                  <h3 className="font-semibold mb-2">Requested Items</h3>
                  {loadingItemsId === request.id ? (
                    <p className="text-gray-500">Loading items...</p>
                  ) : itemsMap[request.id]?.length > 0 ? (
                    <table className="w-full text-sm border">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border p-1">Item</th>
                          <th className="border p-1">Brand</th>
                          <th className="border p-1">Qty</th>
                          <th className="border p-1">Unit Cost</th>
                          <th className="border p-1">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsMap[request.id].map((item, idx) => (
                          <tr key={idx}>
                            <td className="border p-1">{item.item_name}</td>
                            <td className="border p-1">{item.brand || '—'}</td>
                            <td className="border p-1">{item.quantity}</td>
                            <td className="border p-1">{item.unit_cost}</td>
                            <td className="border p-1">{item.total_cost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-gray-500">No items found.</p>
                  )}
                </div>
              )}

              {expandedApprovalsId === request.id && (
                <div className="mt-4 border-t pt-2">
                  <ApprovalTimeline
                    approvals={approvalsMap[request.id]}
                    isLoading={loadingApprovalsId === request.id}
                  />
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
            disabled={page === 1}
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          >
            Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
            disabled={page === totalPages}
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          >
            Next
          </button>
        </div>
      )}
     </div>
    </>
  );
};

export default AllRequestsPage;