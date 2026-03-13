import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listAccountsPayable, recordPayablePayment } from '../api/procureToPay';

export default function ProcureToPayPaymentsPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [requestIdInput, setRequestIdInput] = useState(requestId || '');
  const [payables, setPayables] = useState([]);
  const [amountByPayable, setAmountByPayable] = useState({});
  const load = async () => {
    if (!requestId) return;
    const res = await listAccountsPayable();
    setPayables((res?.data || []).filter((x) => Number(x.request_id) === Number(requestId)));
  };
  useEffect(() => { load(); }, [requestId]);

  if (!requestId) {
    return (
      <div className="p-6 space-y-3">
        <h2 className="text-xl font-semibold">Payments</h2>
        <p className="text-sm text-gray-600">Enter a request ID to open payment allocations.</p>
        <div className="flex gap-2">
          <input className="border rounded px-2 py-1" value={requestIdInput} onChange={(e) => setRequestIdInput(e.target.value)} placeholder="Request ID" />
          <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => navigate(`/requests/${Number(requestIdInput)}/procure-to-pay/payments`)}>
            Open
          </button>
        </div>
      </div>
    );
  }

  return <div className="p-6 space-y-3"><Link className="text-blue-600" to={`/requests/${requestId}/procure-to-pay`}>← Back</Link><h2 className="text-xl font-semibold">Payments</h2><div className="bg-white rounded shadow p-3 space-y-2">{payables.map((p)=><div key={p.id} className="border rounded p-2 text-sm">Payable #{p.id} · Open {p.open_balance}<div className="mt-2 flex gap-2"><input className="border rounded px-2 py-1" type="number" min="0" step="0.01" value={amountByPayable[p.id] || ''} onChange={(e)=>setAmountByPayable((prev)=>({...prev,[p.id]:e.target.value}))} placeholder="Amount"/><button className="px-2 py-1 bg-green-600 text-white rounded" onClick={async()=>{await recordPayablePayment(p.id,{ amount:Number(amountByPayable[p.id]), payment_method:'bank_transfer' }); await load();}}>Record Payment</button></div></div>)}</div></div>;
}