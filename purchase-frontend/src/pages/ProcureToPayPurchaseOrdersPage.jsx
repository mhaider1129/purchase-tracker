import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createPurchaseOrder, listPurchaseOrders, listPoSourceRequests } from '../api/procureToPay';

const STATUSES = ['ALL', 'PO_DRAFT', 'PO_PENDING_APPROVAL', 'PO_ISSUED', 'PO_PARTIAL', 'PO_CLOSED'];

const formatAmount = (value) => Number(value || 0).toFixed(2);

const ProcureToPayPurchaseOrdersPage = () => {
  const { requestId } = useParams();
  const [rows, setRows] = useState([]);
  const [sourceRequests, setSourceRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: 'ALL', supplier: '' });
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [manualForm, setManualForm] = useState({ supplier_name: '', expected_delivery_date: '', terms: '' });

  const scopedRequestId = useMemo(() => {
    const parsed = Number(requestId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [requestId]);

  const load = async (page = pagination.page) => {
    const params = {
      page,
      page_size: pagination.page_size,
      search: filters.search || undefined,
      supplier: filters.supplier || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      request_id: scopedRequestId || undefined,
    };

    const requestsParams = {
      search: filters.search || undefined,
      request_id: scopedRequestId || undefined,
    };

    const [poRes, requestRes] = await Promise.all([
      listPurchaseOrders(params),
      listPoSourceRequests(requestsParams),
    ]);

    setRows(poRes?.data || []);
    setPagination(poRes?.pagination || { page: 1, page_size: 20, total: 0 });
    setSourceRequests(requestRes?.data || []);
  };

  useEffect(() => {
    load(1);
  }, [filters.status, scopedRequestId]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Purchase Orders</h1>
      {scopedRequestId && (
        <p className="text-sm text-gray-600">Showing purchase orders linked to Request #{scopedRequestId}.</p>
      )}

      <div className="bg-white p-4 rounded shadow grid md:grid-cols-4 gap-2">
        <input className="border rounded px-2 py-1" placeholder="Search PO / supplier / request" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
        <input className="border rounded px-2 py-1" placeholder="Supplier" value={filters.supplier} onChange={(e) => setFilters((p) => ({ ...p, supplier: e.target.value }))} />
        <select className="border rounded px-2 py-1" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <button className="bg-indigo-600 text-white rounded px-3 py-1" onClick={() => load(1)}>Search</button>
      </div>

      <div className="bg-white p-4 rounded shadow space-y-2">
        <h2 className="font-semibold">Create PO from approved request</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className="border rounded px-2 py-1" value={selectedRequestId} onChange={(e) => setSelectedRequestId(e.target.value)}>
            <option value="">Select approved request</option>
            {sourceRequests.map((r) => <option key={r.id} value={r.id}>Request #{r.id} · {r.request_type}</option>)}
          </select>
          <button
            className="bg-blue-600 text-white rounded px-3 py-1 disabled:bg-gray-300"
            disabled={!selectedRequestId}
            onClick={async () => {
              await createPurchaseOrder(Number(selectedRequestId), {});
              await load(1);
            }}
          >
            Create PO
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow space-y-3">
        <h2 className="font-semibold">Create standalone PO (without request)</h2>
        <p className="text-xs text-gray-600">Standalone POs are created as <strong>PO_PENDING_APPROVAL</strong> and follow the direct PO approval workflow.</p>
        <div className="grid sm:grid-cols-3 gap-2">
          <input
            className="border rounded px-2 py-1"
            placeholder="Supplier name"
            value={manualForm.supplier_name}
            onChange={(e) => setManualForm((prev) => ({ ...prev, supplier_name: e.target.value }))}
          />
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={manualForm.expected_delivery_date}
            onChange={(e) => setManualForm((prev) => ({ ...prev, expected_delivery_date: e.target.value }))}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Terms"
            value={manualForm.terms}
            onChange={(e) => setManualForm((prev) => ({ ...prev, terms: e.target.value }))}
          />
        </div>
        <button
          className="bg-emerald-600 text-white rounded px-3 py-1 disabled:bg-gray-300"
          disabled={!manualForm.supplier_name.trim()}
          onClick={async () => {
            await createPurchaseOrder(null, {
              supplier_name: manualForm.supplier_name.trim(),
              expected_delivery_date: manualForm.expected_delivery_date || null,
              terms: manualForm.terms || null,
              items: [],
            });
            setManualForm({ supplier_name: '', expected_delivery_date: '', terms: '' });
            await load(1);
          }}
        >
          Create standalone PO
        </button>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="p-2 text-left">PO Number</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">Linked Request</th><th className="p-2 text-left">Date</th><th className="p-2 text-left">Expected Delivery</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Total</th><th className="p-2 text-left">Items</th><th className="p-2 text-left">Actions</th></tr></thead>
          <tbody>
            {rows.map((po) => (
              <tr key={po.id} className="border-t align-top">
                <td className="p-2">{po.po_number}</td>
                <td className="p-2">{po.supplier_name || '-'}</td>
                <td className="p-2">{po.request_id || '-'}</td>
                <td className="p-2">{new Date(po.created_at).toLocaleDateString()}</td>
                <td className="p-2">{po.expected_delivery_date || '-'}</td>
                <td className="p-2">{po.status}</td>
                <td className="p-2 text-right">{formatAmount(po.total_amount)}</td>
                <td className="p-2 min-w-[240px]">
                  {Array.isArray(po.items) && po.items.length > 0 ? (
                    <ul className="space-y-1">
                      {po.items.map((item) => (
                        <li key={item.id} className="text-xs text-gray-700">
                          {item.item_name} · {item.quantity} × {formatAmount(item.unit_price)} = <span className="font-medium">{formatAmount(item.line_total)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-gray-500">No items</span>
                  )}
                </td>
                <td className="p-2">
                  {po.request_id ? (
                    <Link className="text-blue-600 underline" to={`/requests/${po.request_id}/procure-to-pay`}>Open lifecycle</Link>
                  ) : (
                    <span className="text-xs text-gray-500">Awaiting approval</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between text-sm">
        <span>Total: {pagination.total}</span>
        <div className="space-x-2">
          <button className="px-2 py-1 border rounded" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Prev</button>
          <button className="px-2 py-1 border rounded" disabled={(pagination.page * pagination.page_size) >= pagination.total} onClick={() => load(pagination.page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
};

export default ProcureToPayPurchaseOrdersPage;