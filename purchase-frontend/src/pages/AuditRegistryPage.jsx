import React, { useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';

const statusColors = {
  COO_REVIEW_PENDING: 'bg-yellow-100 text-yellow-800',
  AUDIT_REVIEW_PENDING: 'bg-blue-100 text-blue-700',
  ACTION_REQUIRED: 'bg-red-100 text-red-700',
  REGISTERED: 'bg-indigo-100 text-indigo-700',
  CLOSED: 'bg-green-100 text-green-700',
};

const statusLabels = {
  COO_REVIEW_PENDING: 'Pending COO Approval',
  AUDIT_REVIEW_PENDING: 'Pending Audit Approval',
  ACTION_REQUIRED: 'Action Required',
  REGISTERED: 'Registered',
  CLOSED: 'Closed',
};

const workflowHintByStatus = {
  COO_REVIEW_PENDING: 'Waiting for COO approval before audit review.',
  AUDIT_REVIEW_PENDING: 'COO approved. Waiting for audit approval and registration.',
  ACTION_REQUIRED: 'Audit has listed requirements that must be fulfilled by requester.',
  REGISTERED: 'Amount registered on requester account. Awaiting settlement/closure.',
  CLOSED: 'Registry closed after obligations were fulfilled.',
};

export default function AuditRegistryPage() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({
    request_id: '',
    requester_type: 'INDIVIDUAL',
    account_name: '',
    notes: '',
    required_before_payment: '',
    required_after_payment: '',
    currency: 'USD',
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');

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

  const onFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const submitRegistryRequest = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const requestId = Number(form.request_id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      setSubmitError('Please provide a valid request id.');
      return;
    }

    try {
      setSubmitLoading(true);
      await axios.post(`/api/audit-registry/requests/${requestId}/entries`, {
        requester_type: form.requester_type,
        account_name: form.account_name || null,
        notes: form.notes || null,
        required_before_payment: form.required_before_payment || null,
        required_after_payment: form.required_after_payment || null,
        currency: form.currency || 'USD',
      });

      setForm({
        request_id: '',
        requester_type: 'INDIVIDUAL',
        account_name: '',
        notes: '',
        required_before_payment: '',
        required_after_payment: '',
        currency: 'USD',
      });
      await loadEntries();
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Failed to submit registry request.');
    } finally {
      setSubmitLoading(false);
    }
  };

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

      <form onSubmit={submitRegistryRequest} className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-lg font-semibold">Request Advance Finance Approval</h2>
        <p className="text-sm text-gray-600">
          Submit a digital request for advance spending before final invoices/receipts are available.
          It starts at COO review, then moves to Audit review.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-gray-700 mb-1">Request ID *</span>
            <input
              type="number"
              min="1"
              value={form.request_id}
              onChange={(e) => onFormChange('request_id', e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Existing procurement request id"
              required
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 mb-1">Requester Type</span>
            <select
              value={form.requester_type}
              onChange={(e) => onFormChange('requester_type', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="INDIVIDUAL">Individual</option>
              <option value="COMMITTEE">Committee</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 mb-1">Account / Cost Center</span>
            <input value={form.account_name} onChange={(e) => onFormChange('account_name', e.target.value)} className="w-full border rounded px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 mb-1">Currency</span>
            <input value={form.currency} onChange={(e) => onFormChange('currency', e.target.value.toUpperCase())} className="w-full border rounded px-3 py-2" maxLength={6} />
          </label>
        </div>

        <label className="text-sm block">
          <span className="block text-gray-700 mb-1">Business Justification</span>
          <textarea value={form.notes} onChange={(e) => onFormChange('notes', e.target.value)} className="w-full border rounded px-3 py-2" rows={3} placeholder="Purpose of advance payment and activity details" />
        </label>

        <label className="text-sm block">
          <span className="block text-gray-700 mb-1">Known Pre-payment Requirements</span>
          <textarea value={form.required_before_payment} onChange={(e) => onFormChange('required_before_payment', e.target.value)} className="w-full border rounded px-3 py-2" rows={2} placeholder="e.g., quotation, draft contract, proforma invoice" />
        </label>

        <label className="text-sm block">
          <span className="block text-gray-700 mb-1">Expected Post-payment Requirements</span>
          <textarea value={form.required_after_payment} onChange={(e) => onFormChange('required_after_payment', e.target.value)} className="w-full border rounded px-3 py-2" rows={2} placeholder="e.g., final invoice, receipt, GRN, PO" />
        </label>

        {submitError ? <p className="text-red-600 text-sm">{submitError}</p> : null}
        <div>
          <button type="submit" disabled={submitLoading} className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">
            {submitLoading ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>

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
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[row.audit_status] || 'bg-gray-100 text-gray-700'}`}>
                      {statusLabels[row.audit_status] || row.audit_status}
                    </span>
                    <div className="text-gray-500 text-xs mt-1">{workflowHintByStatus[row.audit_status] || '-'}</div>
                  </td>
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