import React, { useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';

const statusColors = {
  PENDING_AUDIT: 'bg-yellow-100 text-yellow-800',
  ACTION_REQUIRED: 'bg-red-100 text-red-700',
  READY_FOR_FINANCE: 'bg-blue-100 text-blue-700',
  FINANCE_PROCESSING: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

export default function AuditRegistryPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEntries = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/audit-registry/my-requests');
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load audit registry entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, row) => {
        acc.issued += Number(row.finance_issued_amount || 0);
        acc.returned += Number(row.returned_amount || 0);
        acc.remaining += Number(row.remaining_amount || 0);
        return acc;
      },
      { issued: 0, returned: 0, remaining: 0 },
    );
  }, [entries]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Audit Registry</h1>
        <button onClick={loadEntries} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Refresh</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border rounded p-3 bg-white"><p className="text-sm text-gray-500">Issued</p><p className="text-xl font-semibold">{totals.issued.toFixed(2)}</p></div>
        <div className="border rounded p-3 bg-white"><p className="text-sm text-gray-500">Returned</p><p className="text-xl font-semibold">{totals.returned.toFixed(2)}</p></div>
        <div className="border rounded p-3 bg-white"><p className="text-sm text-gray-500">Remaining</p><p className="text-xl font-semibold">{totals.remaining.toFixed(2)}</p></div>
      </div>

      {loading ? <p>Loading...</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}

      {!loading && !entries.length ? <p className="text-gray-600">No audit registry entries yet.</p> : null}

      {!!entries.length && (
        <div className="overflow-x-auto bg-white border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="px-3 py-2">Request</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Required Before Payment</th>
                <th className="px-3 py-2">Required After Payment</th>
                <th className="px-3 py-2">Issued</th>
                <th className="px-3 py-2">Returned</th>
                <th className="px-3 py-2">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2">#{row.request_id}<div className="text-gray-500">{row.request_title || '-'}</div></td>
                  <td className="px-3 py-2">{row.requester_type}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[row.audit_status] || 'bg-gray-100 text-gray-700'}`}>{row.audit_status}</span></td>
                  <td className="px-3 py-2 whitespace-pre-wrap">{row.required_before_payment || '-'}</td>
                  <td className="px-3 py-2 whitespace-pre-wrap">{row.required_after_payment || '-'}</td>
                  <td className="px-3 py-2">{Number(row.finance_issued_amount || 0).toFixed(2)} {row.currency}</td>
                  <td className="px-3 py-2">{Number(row.returned_amount || 0).toFixed(2)} {row.currency}</td>
                  <td className="px-3 py-2 font-semibold">{Number(row.remaining_amount || 0).toFixed(2)} {row.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}