import React, { useEffect, useState } from 'react';
import { listInvoiceMatchingQueue, runInvoiceMatch } from '../api/procureToPay';

export default function ProcureToPayMatchingPage() {
  const [rows, setRows] = useState([]);

  const load = async () => {
    const res = await listInvoiceMatchingQueue();
    setRows(res?.data || []);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Invoice Matching Queue</h1>
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">Invoice Number</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">Match Status</th><th className="p-2 text-left">Variance Summary</th><th className="p-2 text-left">Exception Flag</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>
          {rows.map((row) => (
            <tr key={row.invoice_id} className="border-t">
              <td className="p-2">{row.invoice_number}</td>
              <td className="p-2">{row.supplier}</td>
              <td className="p-2">{row.match_status}</td>
              <td className="p-2">{(row.mismatch_reasons || []).join(', ') || '-'}</td>
              <td className="p-2">{row.match_status === 'EXCEPTION' ? 'Yes' : 'No'}</td>
              <td className="p-2"><button className="px-2 py-1 border rounded" onClick={async () => { await runInvoiceMatch(row.request_id, row.invoice_id, { policy: 'THREE_WAY' }); await load(); }}>Run Match</button></td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}