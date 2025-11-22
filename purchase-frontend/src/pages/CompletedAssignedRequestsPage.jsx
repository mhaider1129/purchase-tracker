// src/pages/CompletedAssignedRequestsPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import Navbar from '../components/Navbar';
import RequestAttachmentsSection from '../components/RequestAttachmentsSection';
import useRequestAttachments from '../hooks/useRequestAttachments';
import { printRequest } from '../api/requests';

const CompletedAssignedRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [expandedAttachmentsId, setExpandedAttachmentsId] = useState(null);
  const [itemsCache, setItemsCache] = useState({});
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const {
    attachmentsMap,
    attachmentLoadingMap,
    attachmentErrorMap,
    downloadingAttachmentId,
    loadAttachmentsForRequest,
    handleDownloadAttachment,
    resetAttachments,
  } = useRequestAttachments();

  const fetchCompleted = useCallback(async () => {
    setLoading(true);
    try {
      resetAttachments();
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
  }, [resetAttachments, search]);

  const toggleItems = async (requestId) => {
    if (expandedRequestId === requestId) {
      setExpandedRequestId(null);
      if (expandedAttachmentsId === requestId) {
        setExpandedAttachmentsId(null);
      }
      return;
    }

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

  const toggleAttachments = async (requestId) => {
    if (expandedAttachmentsId === requestId) {
      setExpandedAttachmentsId(null);
      return;
    }

    await loadAttachmentsForRequest(requestId);
    setExpandedAttachmentsId(requestId);
  };

  useEffect(() => {
    fetchCompleted();
  }, [fetchCompleted]);

  const requestTypeOptions = useMemo(() => {
    const types = new Set();
    requests.forEach((req) => {
      if (req.request_type) {
        types.add(req.request_type);
      }
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const now = new Date();

    return requests.filter((req) => {
      if (typeFilter !== 'all' && req.request_type !== typeFilter) {
        return false;
      }

      if (dateFilter !== 'all') {
        const completedAt = new Date(req.completed_at);
        if (Number.isNaN(completedAt.getTime())) {
          return false;
        }

        const diffInDays = (now - completedAt) / (1000 * 60 * 60 * 24);

        if (dateFilter === '7' && diffInDays > 7) {
          return false;
        }

        if (dateFilter === '30' && diffInDays > 30) {
          return false;
        }

        if (dateFilter === '90' && diffInDays > 90) {
          return false;
        }
      }

      return true;
    });
  }, [requests, typeFilter, dateFilter]);

  const typeBreakdown = useMemo(() => {
    return filteredRequests.reduce((acc, req) => {
      const type = req.request_type || 'Other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }, [filteredRequests]);

  const formatDateTime = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setDateFilter('all');
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

  const renderLoadingState = () => (
    <div className="space-y-4">
      {[...Array(3)].map((_, idx) => (
        <div
          key={idx}
          className="bg-white shadow rounded-lg p-4 border border-gray-100 animate-pulse"
        >
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Navbar />
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">My Completed Requests</h1>
          <p className="text-gray-600">
            Review the purchases you have completed, apply quick filters, and dive into the
            fulfillment details for each request.
          </p>
        </div>

        <section className="bg-white shadow-sm border border-gray-100 rounded-lg p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Find a specific request</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700">Search</span>
              <input
                type="search"
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search by requester, justification, or ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700">Request type</span>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All types</option>
                {requestTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700">Completion date</span>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">Any time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>

            <div className="flex items-end">

              <button
                type="button"
                className="w-full inline-flex justify-center items-center gap-2 border border-gray-300 text-gray-700 rounded-md px-3 py-2 hover:bg-gray-100"
                onClick={handleResetFilters}
              >
                Reset filters
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="bg-white border border-blue-100 rounded-lg p-5 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-blue-600 font-semibold">Completed</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{filteredRequests.length}</p>
            <p className="text-sm text-gray-500 mt-1">
              Requests that match your current filters.
            </p>
          </div>

          <div className="bg-white border border-gray-100 rounded-lg p-5 shadow-sm md:col-span-2">
            <p className="text-sm font-semibold text-gray-700">Breakdown by request type</p>
            {Object.keys(typeBreakdown).length === 0 ? (
              <p className="text-sm text-gray-500 mt-2">No data available for the selected filters.</p>
            ) : (
              <ul className="flex flex-wrap gap-2 mt-3">
                {Object.entries(typeBreakdown).map(([type, count]) => (
                  <li
                    key={type}
                    className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-3 py-1 text-sm"
                  >
                    <span className="font-medium">{type}</span>
                    <span className="text-xs bg-white border border-blue-200 rounded-full px-2 py-0.5">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {loading ? (
          renderLoadingState()
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-lg p-8 text-center text-gray-500 shadow-sm">
            <p className="text-lg font-medium text-gray-700">No completed requests found.</p>
            <p className="mt-2 text-sm text-gray-500">
              Try adjusting your search or filter selections to see more results.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((req) => {
              const isUrgent = Boolean(req?.is_urgent);
              const articleClasses = [
                'bg-white border border-gray-100 rounded-lg shadow-sm p-5 transition hover:border-blue-200',
                isUrgent ? 'border-red-300 hover:border-red-300 ring-1 ring-red-200/70 bg-red-50/70' : '',
              ]
                .filter(Boolean)
                .join(' ');
                return (
                  <article
                    key={req.id}
                    className={articleClasses}
                  >
                    <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-xl font-semibold text-gray-900">Request #{req.id}</h3>
                          {req.request_type && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-sm font-medium">
                              {req.request_type}
                            </span>
                          )}
                          {isUrgent && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
                              <span className="block h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Completed {formatDateTime(req.completed_at)}
                        </p>
                      </div>
                      <div className="text-sm text-gray-500">
                        <p>
                          <span className="font-medium text-gray-700">Submitted by:</span>{' '}
                          {req.requester_name}
                          {req.requester_role && <span className="text-gray-400"> • {req.requester_role}</span>}
                        </p>
                      </div>
                    </header>

                    {req.justification && (
                      <p className="mt-4 text-gray-700">
                        <span className="font-medium text-gray-900">Justification:</span> {req.justification}
                      </p>
                    )}

                    <footer className="mt-4">
                      <button
                        type="button"
                        onClick={() => toggleItems(req.id)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        <span>{expandedRequestId === req.id ? 'Hide Items' : 'View Items'}</span>
                        <span aria-hidden="true">{expandedRequestId === req.id ? '▲' : '▼'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleAttachments(req.id)}
                        className="ml-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                        disabled={Boolean(attachmentLoadingMap[req.id])}
                      >
                        <span>
                          {expandedAttachmentsId === req.id ? 'Hide Attachments' : 'View Attachments'}
                        </span>
                        <span aria-hidden="true">{expandedAttachmentsId === req.id ? '▲' : '▼'}</span>
                      </button>

                      {expandedRequestId === req.id && (
                        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                          {itemsCache[req.id]?.length > 0 ? (
                            itemsCache[req.id].map((item) => (
                              <div
                                key={item.id}
                                className="rounded-md border border-gray-100 bg-gray-50 p-3"
                              >
                                <p className="text-sm font-semibold text-gray-800">
                                  {item.item_name}
                                  {item.brand && <span className="text-gray-500"> ({item.brand})</span>}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  <span className="font-medium text-gray-700">Requested:</span> {item.quantity}
                                  <span className="mx-2 text-gray-400">•</span>
                                  <span className="font-medium text-gray-700">Purchased:</span>{' '}
                                  {item.purchased_quantity ?? '—'}
                                  <span className="mx-2 text-gray-400">•</span>
                                  <span className="font-medium text-gray-700">Status:</span> {item.procurement_status || '—'}
                                </p>
                                {item.procurement_comment && (
                                  <p className="text-sm text-gray-500 italic mt-2">{item.procurement_comment}</p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500">No items found.</p>
                          )}
                        </div>
                      )}

                      {expandedAttachmentsId === req.id && (
                        <div className="mt-4 border-t border-gray-100 pt-4">
                          <RequestAttachmentsSection
                            attachments={attachmentsMap[req.id] || []}
                            isLoading={Boolean(attachmentLoadingMap[req.id])}
                            error={attachmentErrorMap[req.id]}
                            onDownload={handleDownloadAttachment}
                            downloadingAttachmentId={downloadingAttachmentId}
                            onRetry={() => loadAttachmentsForRequest(req.id, { force: true })}
                          />
                        </div>
                      )}
                    </footer>
                  </article>
                );
              })}
          </div>
        )}
      </div>
    </>
  );
};

export default CompletedAssignedRequestsPage;
