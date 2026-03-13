import React, { useEffect, useState } from 'react';
import { listApInvoices, submitInvoice } from '../api/procureToPay';

const ProcureToPayInvoicesPage = () => {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ search: '', supplier: '', status: 'ALL' });
  const [form, setForm] = useState({ request_id: '', supplier: '', invoice_number: '', invoice_date: new Date().toISOString().slice(0, 10), subtotal_amount: '' });

  const load = async () => {
    const res = await listApInvoices({
      search: filters.search || undefined,
      supplier: filters.supplier || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
    });
    setRows(res?.data || []);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">A/P Invoices</h1>
      <div className="bg-white p-4 rounded shadow grid md:grid-cols-4 gap-2">
        <input className="border rounded px-2 py-1" placeholder="Search invoice" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
        <input className="border rounded px-2 py-1" placeholder="Supplier" value={filters.supplier} onChange={(e) => setFilters((p) => ({ ...p, supplier: e.target.value }))} />
        <select className="border rounded px-2 py-1" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}><option>ALL</option><option>SUBMITTED</option><option>PENDING_MATCH</option><option>EXCEPTION</option></select>
        <button className="bg-indigo-600 text-white rounded px-3 py-1" onClick={load}>Search</button>
      </div>

      <div className="bg-white p-4 rounded shadow space-y-2">
        <h2 className="font-semibold">Create invoice</h2>
        <div className="grid md:grid-cols-5 gap-2">
          <input className="border rounded px-2 py-1" placeholder="Request ID" value={form.request_id} onChange={(e) => setForm((p) => ({ ...p, request_id: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Supplier" value={form.supplier} onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Invoice Number" value={form.invoice_number} onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))} />
          <input className="border rounded px-2 py-1" type="date" value={form.invoice_date} onChange={(e) => setForm((p) => ({ ...p, invoice_date: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Amount" value={form.subtotal_amount} onChange={(e) => setForm((p) => ({ ...p, subtotal_amount: e.target.value }))} />
        </div>
        <button className="bg-blue-600 text-white rounded px-3 py-1" onClick={async () => {
          await submitInvoice(Number(form.request_id), {
            supplier: form.supplier,
            invoice_number: form.invoice_number,
            invoice_date: form.invoice_date,
            subtotal_amount: Number(form.subtotal_amount),
            total_amount: Number(form.subtotal_amount),
            items: [],
          });
          await load();
        }}>Create</button>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">Invoice Number</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">PO/GRPO Ref</th><th className="p-2 text-left">Invoice Date</th><th className="p-2 text-left">Due Date</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Amount</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id} className="border-t"><td className="p-2">{row.invoice_number}</td><td className="p-2">{row.supplier}</td><td className="p-2">{row.po_number || row.receipt_number || '-'}</td><td className="p-2">{row.invoice_date}</td><td className="p-2">{row.due_date || '-'}</td><td className="p-2">{row.status}</td><td className="p-2 text-right">{Number(row.total_amount).toFixed(2)}</td><td className="p-2">Open</td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
};

export default ProcureToPayInvoicesPage;