import React, { useEffect, useState } from 'react';
import { listDocumentFlow } from '../api/procureToPay';

export default function ProcureToPayDocumentFlowPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');

  const load = async () => {
    const res = await listDocumentFlow({ search: search || undefined });
    setRows(res?.data || []);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Document Flow</h1>
      <div className="bg-white p-4 rounded shadow flex gap-2">
        <input className="border rounded px-2 py-1 w-full" placeholder="Search request/PO/invoice/supplier/payment reference" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="bg-purple-700 text-white rounded px-3 py-1" onClick={load}>Search</button>
      </div>
      <div className="bg-white rounded shadow p-3 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="border rounded p-2 text-sm">
            <div>{row.source_document_type} #{row.source_document_id} → {row.target_document_type} #{row.target_document_id}</div>
            <div className="text-gray-500">Request #{row.request_id} · {row.po_number || row.invoice_number || row.payment_reference || row.supplier_name || '-'}</div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-gray-500">No document chain results.</p>}
      </div>
    </div>
  );
}