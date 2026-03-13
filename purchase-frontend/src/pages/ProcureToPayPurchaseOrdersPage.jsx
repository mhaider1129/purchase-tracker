import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createPurchaseOrder, listPurchaseOrders } from '../api/procureToPay';

const ProcureToPayPurchaseOrdersPage = () => {
  const { requestId: routeRequestId } = useParams();
  const navigate = useNavigate();
  const [requestIdInput, setRequestIdInput] = useState(routeRequestId || '');
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ supplier_name: '', expected_delivery_date: '', terms: '' });
  const [message, setMessage] = useState('');

  const load = async (requestId = routeRequestId) => {
    const res = await listPurchaseOrders(requestId ? Number(requestId) : null);
    setOrders(res?.data || []);
  };

  useEffect(() => { load(); }, [routeRequestId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    await createPurchaseOrder(Number(routeRequestId), form);
    setMessage('Purchase order issued successfully.');
    await load(routeRequestId);
  };

  if (!routeRequestId) {
    return <div className="p-6 space-y-3"><h2 className="text-xl font-semibold">Purchase Orders</h2><input className="border rounded px-2 py-1" value={requestIdInput} onChange={(e) => setRequestIdInput(e.target.value)} placeholder="Request ID" /><button className="ml-2 px-3 py-1 bg-blue-600 text-white rounded" onClick={() => navigate(`/requests/${Number(requestIdInput)}/procure-to-pay/purchase-orders`)}>Open Request PO Workspace</button></div>;
  }

  return (
    <div className="p-6 space-y-4">
      <Link to={`/requests/${routeRequestId}/procure-to-pay`} className="text-blue-600">← Back to lifecycle</Link>
      <h2 className="text-xl font-semibold">Purchase Orders · Request #{routeRequestId}</h2>
      {message && <p className="text-green-700">{message}</p>}
      <form onSubmit={handleCreate} className="bg-white p-4 rounded shadow space-y-2">
        <input className="w-full border rounded px-2 py-1" value={form.supplier_name} onChange={(e) => setForm((p) => ({ ...p, supplier_name: e.target.value }))} placeholder="Supplier name" required />
        <input className="w-full border rounded px-2 py-1" type="date" value={form.expected_delivery_date} onChange={(e) => setForm((p) => ({ ...p, expected_delivery_date: e.target.value }))} />
        <input className="w-full border rounded px-2 py-1" value={form.terms} onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))} placeholder="Terms" />
        <button className="px-3 py-2 bg-indigo-600 text-white rounded" type="submit">Issue PO</button>
      </form>
      <div className="bg-white p-4 rounded shadow"><h3 className="font-medium mb-2">Issued Purchase Orders</h3>{orders.map((po) => <div key={po.id} className="text-sm border-b py-1">{po.po_number} · {po.supplier_name || 'N/A'} · {po.status}</div>)}</div>
    </div>
  );
};

export default ProcureToPayPurchaseOrdersPage;