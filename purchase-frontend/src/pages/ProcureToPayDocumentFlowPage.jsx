import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDocumentFlow } from '../api/procureToPay';

export default function ProcureToPayDocumentFlowPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [requestIdInput, setRequestIdInput] = useState(requestId || '');
  const [links, setLinks] = useState([]);

  useEffect(() => {
    if (!requestId) return;
    getDocumentFlow(requestId).then((res) => setLinks(res?.data || []));
  }, [requestId]);

  if (!requestId) {
    return (
      <div className="p-6 space-y-3">
        <h2 className="text-xl font-semibold">Document Flow</h2>
        <p className="text-sm text-gray-600">Enter a request ID to inspect its full document flow.</p>
        <div className="flex gap-2">
          <input className="border rounded px-2 py-1" value={requestIdInput} onChange={(e) => setRequestIdInput(e.target.value)} placeholder="Request ID" />
          <button className="px-3 py-1 bg-purple-700 text-white rounded" onClick={() => navigate(`/requests/${Number(requestIdInput)}/procure-to-pay/document-flow`)}>
            Open
          </button>
        </div>
      </div>
    );
  }

  return <div className="p-6 space-y-3"><Link className="text-blue-600" to={`/requests/${requestId}/procure-to-pay`}>← Back</Link><h2 className="text-xl font-semibold">Document Flow</h2><div className="bg-white rounded shadow p-3">{links.map((l)=><div key={l.id} className="text-sm border-b py-1">{l.source_document_type} #{l.source_document_id} → {l.target_document_type} #{l.target_document_id}</div>)}{links.length===0 && <p className="text-sm text-gray-500">No links yet.</p>}</div></div>;
}