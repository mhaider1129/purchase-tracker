import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getLifecycleDetail, listAccountsPayable, postPayableFromInvoice } from '../api/procureToPay';

export default function ProcureToPayAccountsPayablePage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [requestIdInput, setRequestIdInput] = useState(requestId || '');
  const [lifecycle, setLifecycle] = useState(null);
  const [payables, setPayables] = useState([]);

  const load = async () => {
    if (!requestId) return;
    const [l, p] = await Promise.all([getLifecycleDetail(requestId), listAccountsPayable()]);
    setLifecycle(l);
    setPayables((p?.data || []).filter((x) => Number(x.request_id) === Number(requestId)));
  };

  useEffect(() => { load(); }, [requestId]);

  if (!requestId) {
    return (
      <div className="p-6 space-y-3">
        <h2 className="text-xl font-semibold">Accounts Payable</h2>
        <p className="text-sm text-gray-600">Enter a request ID to open AP details.</p>
        <div className="flex gap-2">
          <input className="border rounded px-2 py-1" value={requestIdInput} onChange={(e) => setRequestIdInput(e.target.value)} placeholder="Request ID" />
          <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={() => navigate(`/requests/${Number(requestIdInput)}/procure-to-pay/accounts-payable`)}>
            Open
          </button>
        </div>
      </div>
    );
  }

  const latestInvoice = lifecycle?.invoices?.[0];
  return <div className="p-6 space-y-3"><Link className="text-blue-600" to={`/requests/${requestId}/procure-to-pay`}>← Back</Link><h2 className="text-xl font-semibold">Accounts Payable</h2><button className="px-3 py-1 bg-indigo-600 text-white rounded" disabled={!latestInvoice} onClick={async()=>{await postPayableFromInvoice(latestInvoice.id); await load();}}>Post Latest Invoice to AP</button><div className="bg-white rounded shadow p-3">{payables.map((p)=><div className="text-sm border-b py-1" key={p.id}>Invoice #{p.supplier_invoice_id} · Open: {p.open_balance} · {p.payable_status}</div>)}</div></div>;
}