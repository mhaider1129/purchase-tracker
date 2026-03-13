import React, { useEffect, useState } from 'react';
import { createGoodsReceipt, listGoodsReceipts, listOpenPosForReceipt } from '../api/procureToPay';

const ProcureToPayGoodsReceiptsPage = () => {
  const [rows, setRows] = useState([]);
  const [openPos, setOpenPos] = useState([]);
  const [filters, setFilters] = useState({ supplier: '', po_id: '' });

  const load = async () => {
    const [grRes, poRes] = await Promise.all([
      listGoodsReceipts({ supplier: filters.supplier || undefined, po_id: filters.po_id || undefined }),
      listOpenPosForReceipt(),
    ]);
    setRows(grRes?.data || []);
    setOpenPos(poRes?.data || []);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Goods Receipt PO</h1>
      <div className="bg-white p-4 rounded shadow grid md:grid-cols-3 gap-2">
        <input className="border rounded px-2 py-1" placeholder="Supplier" value={filters.supplier} onChange={(e) => setFilters((p) => ({ ...p, supplier: e.target.value }))} />
        <input className="border rounded px-2 py-1" placeholder="PO ID" value={filters.po_id} onChange={(e) => setFilters((p) => ({ ...p, po_id: e.target.value }))} />
        <button className="bg-blue-600 text-white rounded px-3 py-1" onClick={load}>Search</button>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Create GRPO from open PO</h2>
        <div className="flex flex-wrap gap-2">
          {openPos.slice(0, 10).map((po) => (
            <button
              key={po.id}
              className="border rounded px-2 py-1 text-sm"
              onClick={async () => {
                await createGoodsReceipt(po.request_id, { purchase_order_id: po.id, items: [] });
                await load();
              }}
            >
              {po.po_number} ({Number(po.received_qty)}/{Number(po.ordered_qty)})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="p-2 text-left">Receipt Number</th><th className="p-2 text-left">PO Number</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">Receipt Date</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Received By</th><th className="p-2">Actions</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="p-2">{row.receipt_number}</td><td className="p-2">{row.po_number || '-'}</td><td className="p-2">{row.supplier_name || '-'}</td><td className="p-2">{new Date(row.received_at).toLocaleDateString()}</td><td className="p-2">{row.status}</td><td className="p-2">{row.received_by}</td><td className="p-2">Open</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
};

export default ProcureToPayGoodsReceiptsPage;