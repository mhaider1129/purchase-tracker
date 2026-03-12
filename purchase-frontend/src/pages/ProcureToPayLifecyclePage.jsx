import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getLifecycleDetail,
  createGoodsReceipt,
  submitInvoice,
  runInvoiceMatch,
  createApVoucher,
  verifyFinanceRecord,
  postToInternalLedger,
  markPaymentPending,
  markPaid,
} from '../api/procureToPay';

const ProcureToPayLifecyclePage = () => {
  const { requestId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getLifecycleDetail(requestId);
      setData(response);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load lifecycle data');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const quickActions = async (action) => {
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || 'Action failed');
    }
  };

  if (loading) return <div className="p-6">Loading lifecycle...</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Procurement Lifecycle · Request #{requestId}</h1>
      {error && <div className="text-red-600">{error}</div>}

      <div className="bg-white shadow rounded p-4">
        <h2 className="font-semibold">Lifecycle Detail View</h2>
        <p>Procurement State: <strong>{data?.lifecycle?.procurement_state || 'N/A'}</strong></p>
        <p>Finance State: <strong>{data?.lifecycle?.finance_state || 'N/A'}</strong></p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white shadow rounded p-4 space-y-2">
          <h3 className="font-semibold">Goods Receipt Entry</h3>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => quickActions(() => createGoodsReceipt(requestId, {
            warehouse_location: 'Main Warehouse',
            items: [{ item_name: 'Sample Item', received_quantity: 1 }]
          }))}>Create Sample Receipt</button>
          <ul className="text-sm list-disc ml-5">
            {(data?.receipts || []).map((r) => <li key={r.id}>{r.receipt_number} · {r.received_at}</li>)}
          </ul>
        </div>

        <div className="bg-white shadow rounded p-4 space-y-2">
          <h3 className="font-semibold">Invoice Entry + Match Result View</h3>
          <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={() => quickActions(() => submitInvoice(requestId, {
            supplier: 'Sample Supplier',
            invoice_number: `INV-${Date.now()}`,
            invoice_date: new Date().toISOString().slice(0, 10),
            subtotal_amount: 10,
            total_amount: 10,
            items: [{ description: 'Sample Item', quantity: 1, unit_price: 10, line_total: 10 }]
          }))}>Submit Sample Invoice</button>
          {!!data?.invoices?.[0] && (
            <button className="px-3 py-1 bg-purple-600 text-white rounded ml-2" onClick={() => quickActions(() => runInvoiceMatch(requestId, data.invoices[0].id, { policy: 'THREE_WAY' }))}>Run Match</button>
          )}
          <ul className="text-sm list-disc ml-5">
            {(data?.match_results || []).map((m) => <li key={m.id}>{m.match_status}</li>)}
          </ul>
        </div>
      </div>

      <div className="bg-white shadow rounded p-4 space-y-2">
        <h3 className="font-semibold">Finance Review / Voucher Section</h3>
        <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => quickActions(() => verifyFinanceRecord(requestId))}>Verify Finance</button>
        <button className="px-3 py-1 bg-emerald-700 text-white rounded ml-2" onClick={() => quickActions(() => createApVoucher(requestId, {
          total_amount: 10,
          lines: [{ description: 'Liability', debit_amount: 0, credit_amount: 10 }]
        }))}>Create Voucher</button>
        {!!data?.vouchers?.[0] && <button className="px-3 py-1 bg-slate-700 text-white rounded ml-2" onClick={() => quickActions(() => postToInternalLedger(requestId, { ap_voucher_id: data.vouchers[0].id, liability_recognized_amount: data.vouchers[0].total_amount }))}>Post Ledger</button>}
      </div>

      <div className="bg-white shadow rounded p-4 space-y-2">
        <h3 className="font-semibold">Payment Status Section</h3>
        {!!data?.vouchers?.[0] && <button className="px-3 py-1 bg-orange-600 text-white rounded" onClick={() => quickActions(() => markPaymentPending(requestId, { ap_voucher_id: data.vouchers[0].id }))}>Mark Payment Pending</button>}
        {!!data?.payments?.[0] && <button className="px-3 py-1 bg-teal-700 text-white rounded ml-2" onClick={() => quickActions(() => markPaid(requestId, data.payments[0].id, { amount_paid: data.vouchers?.[0]?.total_amount || 0 }))}>Mark Paid</button>}
        <ul className="text-sm list-disc ml-5">
          {(data?.payments || []).map((p) => <li key={p.id}>{p.payment_status} · {p.amount_paid}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default ProcureToPayLifecyclePage;