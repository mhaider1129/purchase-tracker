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

      const fetchedRequests = Array.isArray(res?.data?.data) ? [...res.data.data] : [];
      const urgentRequests = [];
      const nonUrgentRequests = [];

      fetchedRequests.forEach((req) => {
        if (req?.is_urgent) {
          urgentRequests.push(req);
        } else {
          nonUrgentRequests.push(req);
        }
      });

      setRequests([...urgentRequests, ...nonUrgentRequests]);
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
      if (!win) {
        alert('Please enable popups to print the request.');
        return;
      }

      const escapeHtml = (unsafe) => {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };

      const formatValue = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        return escapeHtml(value);
      };

      const formatDate = (value) => {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '—' : escapeHtml(date.toLocaleString());
      };

      const formatAmount = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return formatValue(value);
        return escapeHtml(
          numeric.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      };

      const now = escapeHtml(new Date().toLocaleString());
      const requesterName = request.requester_name
        ? `${request.requester_name}${request.requester_role ? ` (${request.requester_role})` : ''}`
        : request.temporary_requester_name;

      const detailFields = [
        { label: 'Request ID', value: request.id },
        { label: 'Status', value: request.status },
        { label: 'Request Type', value: request.request_type },
        { label: 'Request Domain', value: request.request_domain },
        { label: 'Created On', value: formatDate(request.created_at) },
        { label: 'Needed By', value: formatDate(request.needed_by) },
        { label: 'Estimated Cost', value: formatAmount(request.estimated_cost) },
        { label: 'Maintenance Ref #', value: request.maintenance_ref_number },
        { label: 'Project', value: request.project_name },
        { label: 'Department', value: request.department_name },
        { label: 'Section', value: request.section_name },
        { label: 'Requester', value: requesterName },
        {
          label: 'Assigned To',
          value: assigned_user
            ? `${assigned_user.name}${assigned_user.role ? ` (${assigned_user.role})` : ''}`
            : null,
        },
        { label: 'Print Count', value: print_count },
        { label: 'Last Updated', value: formatDate(request.updated_at) },
      ]
        .map(({ label, value }) => ({ label, value: formatValue(value) }))
        .filter(({ value }) => value && value !== '—');

      const detailGrid = detailFields
        .map(
          ({ label, value }) => `
            <div class="detail-item">
              <span class="detail-label">${escapeHtml(label)}</span>
              <span class="detail-value">${value}</span>
            </div>`
        )
        .join('');

      const totalCost = items.reduce((sum, item) => {
        const value = Number(item.total_cost);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0);

      const itemRows = items
        .map((item, index) => {
          const specsNote = item.specs ? `<div class="item-note"><strong>Specs:</strong> ${formatValue(item.specs)}</div>` : '';
          const approvalNote =
            item.approval_status || item.approval_comments
              ? `<div class="item-note"><strong>Approval:</strong> ${formatValue(item.approval_status)}${
                  item.approval_comments ? ` – ${formatValue(item.approval_comments)}` : ''
                }</div>`
              : '';

          return `
            <tr>
              <td>${index + 1}</td>
              <td>
                <div class="item-name">${formatValue(item.item_name)}</div>
                ${specsNote || approvalNote ? `<div class="item-notes">${specsNote}${approvalNote}</div>` : ''}
              </td>
              <td>${formatValue(item.brand)}</td>
              <td class="numeric">${formatValue(item.quantity)}</td>
              <td class="numeric">${formatValue(item.purchased_quantity)}</td>
              <td class="numeric">${formatAmount(item.unit_cost)}</td>
              <td class="numeric">${formatAmount(item.total_cost)}</td>
            </tr>`;
        })
        .join('');

      const justification = request.justification
        ? `<section class="section">
            <h2>Justification</h2>
            <p>${escapeHtml(request.justification).replace(/\n/g, '<br />')}</p>
          </section>`
        : '';

      const body = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Request ${escapeHtml(request.id)}</title>
            <style>
              :root {
                color-scheme: light;
              }
              @page {
                size: A4;
                margin: 20mm;
              }
              body {
                font-family: 'Segoe UI', Arial, sans-serif;
                color: #1f2937;
                margin: 0;
                padding: 32px;
                background: #f9fafb;
              }
              .page {
                background: #ffffff;
                border-radius: 12px;
                padding: 32px;
                box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
              }
              header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 24px;
                border-bottom: 3px solid #2563eb;
                padding-bottom: 16px;
                margin-bottom: 24px;
              }
              header h1 {
                margin: 0;
                font-size: 28px;
                color: #111827;
              }
              header p {
                margin: 4px 0 0;
                color: #4b5563;
              }
              .print-badge {
                background: #2563eb;
                color: #ffffff;
                padding: 8px 16px;
                border-radius: 999px;
                font-weight: 600;
                font-size: 14px;
                align-self: center;
              }
              .details-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 16px;
                margin-bottom: 24px;
              }
              .detail-item {
                background: #f3f4f6;
                border-radius: 10px;
                padding: 12px 16px;
                border: 1px solid #e5e7eb;
              }
              .detail-label {
                display: block;
                font-size: 12px;
                letter-spacing: 0.06em;
                color: #6b7280;
                text-transform: uppercase;
                margin-bottom: 4px;
              }
              .detail-value {
                font-weight: 600;
                font-size: 15px;
                color: #111827;
                word-break: break-word;
              }
              .section {
                margin-bottom: 24px;
              }
              .section h2 {
                font-size: 18px;
                margin-bottom: 12px;
                color: #1d4ed8;
                border-bottom: 1px solid #c7d2fe;
                padding-bottom: 6px;
              }
              .items-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 14px;
                background: #ffffff;
                overflow: hidden;
                border-radius: 12px;
                border: 1px solid #e5e7eb;
              }
              .items-table thead {
                background: linear-gradient(120deg, #1d4ed8, #2563eb);
                color: #ffffff;
              }
              .items-table th,
              .items-table td {
                padding: 12px;
                border-bottom: 1px solid #e5e7eb;
                vertical-align: top;
              }
              .items-table th {
                font-weight: 600;
                letter-spacing: 0.03em;
                text-transform: uppercase;
                font-size: 12px;
              }
              .items-table tbody tr:nth-child(even) {
                background: #f9fafb;
              }
              .item-name {
                font-weight: 600;
                color: #111827;
              }
              .item-notes {
                margin-top: 6px;
                color: #4b5563;
                font-size: 12px;
                display: flex;
                flex-direction: column;
                gap: 4px;
              }
              .item-note strong {
                color: #1f2937;
              }
              .numeric {
                text-align: right;
                white-space: nowrap;
              }
              .totals-row td {
                font-weight: 700;
                font-size: 15px;
                color: #111827;
                background: #eef2ff;
              }
              .signature-blocks {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 24px;
                margin-top: 32px;
              }
              .signature {
                border-top: 1px solid #9ca3af;
                padding-top: 12px;
                text-align: center;
                font-size: 12px;
                color: #6b7280;
              }
              footer {
                margin-top: 32px;
                font-size: 12px;
                color: #6b7280;
                text-align: right;
              }
              @media print {
                body {
                  padding: 0;
                  background: #ffffff;
                }
                .page {
                  box-shadow: none;
                  border-radius: 0;
                  padding: 0;
                }
                header {
                  margin-bottom: 16px;
                }
                .detail-item {
                  background: transparent;
                }
                .items-table {
                  border: 1px solid #d1d5db;
                }
                .items-table tbody tr:nth-child(even) {
                  background: #ffffff;
                }
              }
            </style>
          </head>
          <body>
            <div class="page">
              <header>
                <div>
                  <h1>Purchase Request Summary</h1>
                  <p>Generated on ${now}</p>
                </div>
                <span class="print-badge">Print Count: ${formatValue(print_count)}</span>
              </header>

              <section class="section">
                <h2>Request Details</h2>
                <div class="details-grid">
                  ${detailGrid}
                </div>
              </section>

              ${justification}

              <section class="section">
                <h2>Requested Items</h2>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      <th>Brand</th>
                      <th>Qty</th>
                      <th>Purchased Qty</th>
                      <th>Unit Cost</th>
                      <th>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemRows || '<tr><td colspan="7" style="text-align:center; padding: 24px;">No line items recorded.</td></tr>'}
                    <tr class="totals-row">
                      <td colspan="6">Grand Total</td>
                      <td class="numeric">${formatAmount(totalCost)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section class="signature-blocks">
                <div class="signature">Prepared By</div>
                <div class="signature">Reviewed By</div>
                <div class="signature">Approved By</div>
              </section>

              <footer>
                Request ID ${escapeHtml(request.id)} • ${now}
              </footer>
            </div>
          </body>
        </html>
      `;

      win.document.write(body);
      win.document.close();
      win.onload = () => {
        win.focus();
        win.print();
      };

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
            const isUrgent = Boolean(request?.is_urgent);
            const cardClasses = [
              'border rounded p-4 shadow bg-white transition',
              isUrgent ? 'border-red-300 ring-1 ring-red-200/70 bg-red-50/70' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div key={request.id} className={cardClasses}>
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-semibold text-gray-800">ID: {request.id}</p>
                      {isUrgent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
                          <span className="block h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                          Urgent
                        </span>
                      )}
                    </div>
                    <p><strong>Type:</strong> {request.request_type}</p>
                    <p>
                      <strong>Project:</strong> {request.project_name || '—'}
                    </p>
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
                    isUrgent={Boolean(request?.is_urgent)}
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