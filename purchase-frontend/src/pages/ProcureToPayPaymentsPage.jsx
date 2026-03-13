import React, { useEffect, useState } from 'react';
import { listAccountsPayable, listPayments, recordPayablePayment } from '../api/procureToPay';

export default function ProcureToPayPaymentsPage() {
  const [history, setHistory] = useState([]);
  const [duePayables, setDuePayables] = useState([]);
  const [amountById, setAmountById] = useState({});

  const load = async () => {
    const [payablesRes, paymentRes] = await Promise.all([listAccountsPayable({ status: 'OPEN' }), listPayments()]);
    setDuePayables(payablesRes?.data || []);
    setHistory(paymentRes?.data || []);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Payments</h1>
      <div className="bg-white rounded shadow p-4">
        <h2 className="font-semibold mb-2">Due Payables</h2>
        <div className="space-y-2">
          {duePayables.map((p) => (
            <div key={p.id} className="border rounded p-2 text-sm flex flex-wrap items-center gap-2">
              <span>AP-{p.id} · {p.supplier_name} · Open {Number(p.open_balance).toFixed(2)}</span>
              <input className="border rounded px-2 py-1" type="number" min="0" step="0.01" placeholder="Amount" value={amountById[p.id] || ''} onChange={(e) => setAmountById((prev) => ({ ...prev, [p.id]: e.target.value }))} />
              <button className="bg-emerald-700 text-white rounded px-2 py-1" onClick={async () => { await recordPayablePayment(p.id, { amount: Number(amountById[p.id] || 0), payment_method: 'bank_transfer' }); await load(); }}>Record Payment</button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">Payment Number</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">Payable / Invoice Reference</th><th className="p-2 text-left">Payment Date</th><th className="p-2 text-right">Amount</th><th className="p-2 text-left">Status</th><th className="p-2">Actions</th></tr></thead><tbody>
          {history.map((row) => <tr key={row.id} className="border-t"><td className="p-2">PAY-{row.id}</td><td className="p-2">{row.supplier_name || '-'}</td><td className="p-2">AP-{row.payable_id || '-'} / INV-{row.invoice_number || '-'}</td><td className="p-2">{row.paid_at ? new Date(row.paid_at).toLocaleDateString() : '-'}</td><td className="p-2 text-right">{Number(row.amount_paid || 0).toFixed(2)}</td><td className="p-2">{row.payment_status}</td><td className="p-2">Open</td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
}