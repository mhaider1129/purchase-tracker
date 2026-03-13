import React, { useEffect, useState } from 'react';
import { listAccountsPayable } from '../api/procureToPay';

export default function ProcureToPayAccountsPayablePage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ supplier: '', status: 'ALL', overdue: false });

  const load = async () => {
    const res = await listAccountsPayable({
      supplier: filters.supplier || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      overdue: filters.overdue ? 'true' : undefined,
    });
    setRows(res?.data || []);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Accounts Payable</h1>
      <div className="bg-white p-4 rounded shadow grid md:grid-cols-4 gap-2">
        <input className="border rounded px-2 py-1" placeholder="Supplier" value={filters.supplier} onChange={(e) => setFilters((p) => ({ ...p, supplier: e.target.value }))} />
        <select className="border rounded px-2 py-1" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}><option>ALL</option><option>OPEN</option><option>PARTIALLY_PAID</option><option>PAID</option></select>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters((p) => ({ ...p, overdue: e.target.checked }))} />Overdue only</label>
        <button className="bg-cyan-700 text-white rounded px-3 py-1" onClick={load}>Search</button>
      </div>
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">Payable Number</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">Invoice Number</th><th className="p-2 text-left">Due Date</th><th className="p-2 text-right">Open Balance</th><th className="p-2 text-left">Payment Status</th><th className="p-2 text-left">Aging Bucket</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id} className="border-t"><td className="p-2">AP-{row.id}</td><td className="p-2">{row.supplier_name}</td><td className="p-2">{row.invoice_number || row.supplier_invoice_id}</td><td className="p-2">{row.due_date}</td><td className="p-2 text-right">{Number(row.open_balance).toFixed(2)}</td><td className="p-2">{row.payable_status}</td><td className="p-2">{row.aging_bucket}</td><td className="p-2">Open</td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
}