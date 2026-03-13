import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getLifecycleDetail, runInvoiceMatch, approveOverride } from '../api/procureToPay';

export default function ProcureToPayMatchingPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [requestIdInput, setRequestIdInput] = useState(requestId || '');
  const [data, setData] = useState(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    if (!requestId) return;
    setData(await getLifecycleDetail(requestId));
  };

  useEffect(() => { load(); }, [requestId]);

  if (!requestId) {
    return (
      <div className="p-6 space-y-3">
        <h2 className="text-xl font-semibold">Invoice Matching</h2>
        <p className="text-sm text-gray-600">Enter a request ID to open matching review.</p>
        <div className="flex gap-2">
          <input className="border rounded px-2 py-1" value={requestIdInput} onChange={(e) => setRequestIdInput(e.target.value)} placeholder="Request ID" />
          <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={() => navigate(`/requests/${Number(requestIdInput)}/procure-to-pay/matching`)}>
            Open
          </button>
        </div>
      </div>
    );
  }

  const latestInvoice = data?.invoices?.[0];
  const latestMatch = data?.match_results?.[0];

  return <div className="p-6 space-y-3"><Link className="text-blue-600" to={`/requests/${requestId}/procure-to-pay`}>← Back</Link><h2 className="text-xl font-semibold">Invoice Matching</h2><button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={async()=>{await runInvoiceMatch(requestId, latestInvoice?.id, { policy: 'THREE_WAY' }); await load();}} disabled={!latestInvoice}>Run 3-way match</button>{latestMatch && <div className="bg-white p-3 rounded shadow text-sm">Status: {latestMatch.match_status}<br/>Reasons: {(latestMatch.mismatch_reasons || []).join(', ') || 'None'}</div>}<div className="bg-white p-3 rounded shadow space-y-2"><input className="border rounded px-2 py-1 w-full" placeholder="Override reason" value={reason} onChange={(e)=>setReason(e.target.value)} /><button className="px-3 py-1 bg-amber-600 text-white rounded" disabled={!latestMatch?.id || !reason} onClick={async()=>{await approveOverride(requestId, latestMatch.id, { reason }); setReason(''); await load();}}>Approve Override</button></div></div>;
}