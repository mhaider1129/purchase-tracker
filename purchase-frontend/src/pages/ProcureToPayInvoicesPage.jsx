import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getLifecycleDetail, submitInvoice, runInvoiceMatch } from '../api/procureToPay';

const ProcureToPayInvoicesPage = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [requestIdInput, setRequestIdInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [matches, setMatches] = useState([]);

  const [form, setForm] = useState({
    supplier: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    subtotal_amount: '',
    tax_amount: 0,
    extra_charges: 0,
    total_amount: '',
    currency: 'USD',
    po_equivalent_number: '',
    receipt_id: '',
    items: [],
  });

  const refresh = useCallback(async () => {
    if (!requestId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const payload = await getLifecycleDetail(requestId);
      const requestItems = payload?.request_items || [];

      setReceipts(payload?.receipts || []);
      setInvoices(payload?.invoices || []);
      setMatches(payload?.match_results || []);
      setForm((prev) => ({
        ...prev,
        receipt_id: payload?.receipts?.[0]?.id ? String(payload.receipts[0].id) : prev.receipt_id,
        items: requestItems.map((item) => ({
          requested_item_id: item.id,
          description: item.item_name,
          quantity: Number(item.quantity) || 0,
          unit_price: item.unit_cost ? Number(item.unit_cost) : 0,
          line_total: (Number(item.quantity) || 0) * (item.unit_cost ? Number(item.unit_cost) : 0),
        })),
      }));
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load invoice data');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const computedInvoiceTotal = useMemo(() => {
    return form.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
  }, [form.items]);

  const updateLine = (index, key, value) => {
    setForm((prev) => {
      const nextItems = [...prev.items];
      const current = { ...nextItems[index], [key]: value };
      current.line_total = (Number(current.quantity) || 0) * (Number(current.unit_price) || 0);
      nextItems[index] = current;
      return { ...prev, items: nextItems };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      const subtotal = form.subtotal_amount === '' ? computedInvoiceTotal : Number(form.subtotal_amount);
      const total = form.total_amount === ''
        ? subtotal + Number(form.tax_amount || 0) + Number(form.extra_charges || 0)
        : Number(form.total_amount);

      await submitInvoice(requestId, {
        supplier: form.supplier,
        invoice_number: form.invoice_number,
        invoice_date: form.invoice_date,
        subtotal_amount: subtotal,
        tax_amount: Number(form.tax_amount || 0),
        extra_charges: Number(form.extra_charges || 0),
        total_amount: total,
        currency: form.currency || 'USD',
        po_equivalent_number: form.po_equivalent_number || null,
        receipt_id: form.receipt_id ? Number(form.receipt_id) : null,
        items: form.items.map((item) => ({
          requested_item_id: item.requested_item_id,
          description: item.description,
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
          line_total: (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
        })),
      });

      setSuccess('Invoice submitted successfully.');
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit invoice');
    }
  };

  const handleRunMatch = async () => {
    setError('');
    setSuccess('');

    if (!invoices[0]) {
      setError('No invoice available to match.');
      return;
    }

    try {
      await runInvoiceMatch(requestId, invoices[0].id, { policy: 'THREE_WAY' });
      setSuccess('3-way invoice match completed.');
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to run invoice match');
    }
  };

  if (loading) {
    return <div className="p-6">Loading invoices...</div>;
  }

  if (!requestId) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Invoice Entry</h1>
        <div className="bg-white shadow rounded p-4 space-y-3">
          <p className="text-sm text-gray-600">Enter a request ID to open its supplier invoice input page.</p>
          <div className="flex gap-2">
            <input
              className="rounded border px-2 py-1"
              type="number"
              min="1"
              placeholder="Request ID"
              value={requestIdInput}
              onChange={(e) => setRequestIdInput(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-indigo-600 px-3 py-1 text-white"
              onClick={() => {
                if (Number(requestIdInput) > 0) {
                  navigate(`/requests/${Number(requestIdInput)}/procure-to-pay/invoices`);
                }
              }}
            >
              Open request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoice Entry · Request #{requestId}</h1>
        <Link to={`/requests/${requestId}/procure-to-pay`} className="text-blue-600 hover:underline">
          Back to lifecycle
        </Link>
      </div>

      {error && <div className="rounded bg-red-50 px-3 py-2 text-red-700">{error}</div>}
      {success && <div className="rounded bg-emerald-50 px-3 py-2 text-emerald-700">{success}</div>}

      <form className="bg-white shadow rounded p-4 space-y-3" onSubmit={handleSubmit}>
        <h2 className="font-semibold">Create Supplier Invoice</h2>

        <div className="grid md:grid-cols-2 gap-3">
          <input className="rounded border px-2 py-1" placeholder="Supplier" value={form.supplier} onChange={(e) => setForm((prev) => ({ ...prev, supplier: e.target.value }))} />
          <input className="rounded border px-2 py-1" placeholder="Invoice number" value={form.invoice_number} onChange={(e) => setForm((prev) => ({ ...prev, invoice_number: e.target.value }))} />
          <input className="rounded border px-2 py-1" type="date" value={form.invoice_date} onChange={(e) => setForm((prev) => ({ ...prev, invoice_date: e.target.value }))} />
          <select className="rounded border px-2 py-1" value={form.receipt_id} onChange={(e) => setForm((prev) => ({ ...prev, receipt_id: e.target.value }))}>
            <option value="">Linked receipt (optional)</option>
            {receipts.map((receipt) => <option key={receipt.id} value={receipt.id}>{receipt.receipt_number}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {form.items.map((item, index) => (
            <div key={item.requested_item_id || index} className="rounded border p-2">
              <input className="rounded border px-2 py-1 w-full" value={item.description} onChange={(e) => updateLine(index, 'description', e.target.value)} />
              <div className="grid md:grid-cols-3 gap-2 mt-2">
                <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)} placeholder="Quantity" />
                <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateLine(index, 'unit_price', e.target.value)} placeholder="Unit price" />
                <input className="rounded border px-2 py-1 bg-gray-50" type="number" value={item.line_total} readOnly placeholder="Line total" />
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-2">
          <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" placeholder="Subtotal" value={form.subtotal_amount} onChange={(e) => setForm((prev) => ({ ...prev, subtotal_amount: e.target.value }))} />
          <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" placeholder="Tax" value={form.tax_amount} onChange={(e) => setForm((prev) => ({ ...prev, tax_amount: e.target.value }))} />
          <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" placeholder="Extra charges" value={form.extra_charges} onChange={(e) => setForm((prev) => ({ ...prev, extra_charges: e.target.value }))} />
        </div>

        <p className="text-sm text-gray-600">Calculated line total: <strong>{computedInvoiceTotal.toFixed(2)}</strong></p>

        <div className="flex gap-2">
          <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded">Submit invoice</button>
          <button type="button" className="px-3 py-2 bg-purple-600 text-white rounded" onClick={handleRunMatch}>Run 3-way match</button>
        </div>
      </form>

      <div className="bg-white shadow rounded p-4">
        <h2 className="font-semibold mb-2">Submitted Invoices</h2>
        <ul className="text-sm list-disc ml-5 space-y-1">
          {invoices.map((invoice) => (
            <li key={invoice.id}>{invoice.invoice_number} · {invoice.total_amount} {invoice.currency} · {invoice.submitted_at ? new Date(invoice.submitted_at).toLocaleString() : 'N/A'}</li>
          ))}
        </ul>
        {invoices.length === 0 && <p className="text-sm text-gray-500">No invoices submitted yet.</p>}
      </div>

      <div className="bg-white shadow rounded p-4">
        <h2 className="font-semibold mb-2">Match Results</h2>
        <ul className="text-sm list-disc ml-5 space-y-1">
          {matches.map((match) => (
            <li key={match.id}>{match.match_status} · {match.match_policy}</li>
          ))}
        </ul>
        {matches.length === 0 && <p className="text-sm text-gray-500">No match results yet.</p>}
      </div>
    </div>
  );
};

export default ProcureToPayInvoicesPage;