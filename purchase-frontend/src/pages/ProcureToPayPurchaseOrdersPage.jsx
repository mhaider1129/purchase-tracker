import React, { useEffect, useState } from 'react';
import { createPurchaseOrder, listPurchaseOrders, listPoSourceRequests } from '../api/procureToPay';

const STATUSES = ['ALL', 'PO_DRAFT', 'PO_ISSUED', 'PO_PARTIAL', 'PO_CLOSED'];

const ProcureToPayPurchaseOrdersPage = () => {
  const [rows, setRows] = useState([]);
  const [sourceRequests, setSourceRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: 'ALL', supplier: '' });
  const [selectedRequestId, setSelectedRequestId] = useState('');

  const load = async (page = pagination.page) => {
    const params = {
      page,
      page_size: pagination.page_size,
      search: filters.search || undefined,
      supplier: filters.supplier || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
    };
    const [poRes, requestRes] = await Promise.all([listPurchaseOrders(params), listPoSourceRequests({ search: filters.search || undefined })]);
    setRows(poRes?.data || []);
    setPagination(poRes?.pagination || { page: 1, page_size: 20, total: 0 });
    setSourceRequests(requestRes?.data || []);
  };

  useEffect(() => { load(1); }, [filters.status]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Purchase Orders</h1>
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

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="p-2 text-left">PO Number</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">Linked Request</th><th className="p-2 text-left">Date</th><th className="p-2 text-left">Expected Delivery</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Total</th><th className="p-2 text-left">Actions</th></tr></thead>
          <tbody>
            {rows.map((po) => (
              <tr key={po.id} className="border-t">
                <td className="p-2">{po.po_number}</td><td className="p-2">{po.supplier_name || '-'}</td><td className="p-2">{po.request_id}</td><td className="p-2">{new Date(po.created_at).toLocaleDateString()}</td><td className="p-2">{po.expected_delivery_date || '-'}</td><td className="p-2">{po.status}</td><td className="p-2 text-right">{Number(po.total_amount || 0).toFixed(2)}</td><td className="p-2">Open</td>
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