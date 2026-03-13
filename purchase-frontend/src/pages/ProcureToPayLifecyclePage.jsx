import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { hasAnyPermission } from '../utils/permissions';

const ProcureToPayLifecyclePage = () => {
  const { requestId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [receiptForm, setReceiptForm] = useState({
    warehouse_id: '',
    warehouse_location: '',
    notes: '',
    discrepancy_notes: '',
    items: [],
  });

  const [invoiceForm, setInvoiceForm] = useState({
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

  const canManageReceipts = hasAnyPermission(user, ['procure-to-pay.receipts.manage', 'warehouse.manage-supply']);
  const canManageInvoices = hasAnyPermission(user, ['procure-to-pay.invoices.manage']);
  const canRunMatch = hasAnyPermission(user, ['procure-to-pay.match.manage']);

  const hydrateFormsFromData = useCallback((payload) => {
    const requestItems = payload?.request_items || [];
    const defaultWarehouseId = payload?.request?.supply_warehouse_id || user?.warehouse_id || '';

    setReceiptForm((prev) => ({
      ...prev,
      warehouse_id: String(defaultWarehouseId || prev.warehouse_id || ''),
      warehouse_location: payload?.request?.supply_warehouse_name || prev.warehouse_location || '',
      items: requestItems.map((item) => ({
        requested_item_id: item.id,
        item_name: item.item_name,
        ordered_quantity: Number(item.quantity) || 0,
        received_quantity: Number(item.quantity) || 0,
        damaged_quantity: 0,
        short_quantity: 0,
        unit_price: item.unit_cost ? Number(item.unit_cost) : '',
        line_notes: '',
      })),
    }));

    setInvoiceForm((prev) => ({
      ...prev,
      items: requestItems.map((item) => ({
        requested_item_id: item.id,
        description: item.item_name,
        quantity: Number(item.quantity) || 0,
        unit_price: item.unit_cost ? Number(item.unit_cost) : 0,
        line_total: (Number(item.quantity) || 0) * (item.unit_cost ? Number(item.unit_cost) : 0),
      })),
      receipt_id: payload?.receipts?.[0]?.id ? String(payload.receipts[0].id) : '',
    }));
  }, [user?.warehouse_id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getLifecycleDetail(requestId);
      setData(response);
      hydrateFormsFromData(response);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load lifecycle data');
    } finally {
      setLoading(false);
    }
  }, [requestId, hydrateFormsFromData]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const response = await api.get('/api/warehouses');
        setWarehouses(response?.data?.data || response?.data || []);
      } catch (err) {
        console.warn('⚠️ Failed to load warehouses for procure-to-pay form', err);
      }
    };

    loadWarehouses();
  }, []);

  const quickActions = async (action, successMessage = 'Action completed successfully') => {
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(successMessage);
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || 'Action failed');
    }
  };

  const availableReceipts = data?.receipts || [];

  const computedInvoiceTotal = useMemo(() => {
    return (invoiceForm.items || []).reduce((sum, item) => {
      return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
    }, 0);
  }, [invoiceForm.items]);

  const updateReceiptLine = (index, key, value) => {
    setReceiptForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], [key]: value };
      return { ...prev, items: nextItems };
    });
  };

  const updateInvoiceLine = (index, key, value) => {
    setInvoiceForm((prev) => {
      const nextItems = [...prev.items];
      const current = { ...nextItems[index], [key]: value };
      const quantity = Number(current.quantity) || 0;
      const unitPrice = Number(current.unit_price) || 0;
      current.line_total = quantity * unitPrice;
      nextItems[index] = current;
      return { ...prev, items: nextItems };
    });
  };

  const handleSubmitReceipt = (event) => {
    event.preventDefault();

    const payload = {
      warehouse_id: receiptForm.warehouse_id ? Number(receiptForm.warehouse_id) : null,
      warehouse_location: receiptForm.warehouse_location || null,
      notes: receiptForm.notes || null,
      discrepancy_notes: receiptForm.discrepancy_notes || null,
      items: receiptForm.items.map((item) => ({
        requested_item_id: item.requested_item_id,
        item_name: item.item_name,
        ordered_quantity: Number(item.ordered_quantity) || null,
        received_quantity: Number(item.received_quantity) || 0,
        damaged_quantity: Number(item.damaged_quantity) || 0,
        short_quantity: Number(item.short_quantity) || 0,
        unit_price: item.unit_price === '' ? null : Number(item.unit_price),
        line_notes: item.line_notes || null,
      })),
    };

    quickActions(() => createGoodsReceipt(requestId, payload), 'Goods receipt created and warehouse inventory updated');
  };

  const handleSubmitInvoice = (event) => {
    event.preventDefault();

    const subtotal = invoiceForm.subtotal_amount === '' ? computedInvoiceTotal : Number(invoiceForm.subtotal_amount);
    const total = invoiceForm.total_amount === ''
      ? subtotal + Number(invoiceForm.tax_amount || 0) + Number(invoiceForm.extra_charges || 0)
      : Number(invoiceForm.total_amount);

    const payload = {
      supplier: invoiceForm.supplier,
      invoice_number: invoiceForm.invoice_number,
      invoice_date: invoiceForm.invoice_date,
      subtotal_amount: subtotal,
      tax_amount: Number(invoiceForm.tax_amount || 0),
      extra_charges: Number(invoiceForm.extra_charges || 0),
      total_amount: total,
      currency: invoiceForm.currency || 'USD',
      po_equivalent_number: invoiceForm.po_equivalent_number || null,
      receipt_id: invoiceForm.receipt_id ? Number(invoiceForm.receipt_id) : null,
      items: (invoiceForm.items || []).map((item) => ({
        requested_item_id: item.requested_item_id,
        description: item.description,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        line_total: (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
      })),
    };

    quickActions(() => submitInvoice(requestId, payload), 'Invoice submitted successfully');
  };

  if (loading) return <div className="p-6">Loading lifecycle...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Procurement Lifecycle · Request #{requestId}</h1>
        <div className="flex flex-wrap gap-2">
          <Link to={`/requests/${requestId}/procure-to-pay/purchase-orders`} className="rounded bg-slate-700 px-3 py-1 text-white">PO</Link>
          <Link to={`/requests/${requestId}/procure-to-pay/receipts`} className="rounded bg-blue-600 px-3 py-1 text-white">GRPO</Link>
          <Link to={`/requests/${requestId}/procure-to-pay/invoices`} className="rounded bg-indigo-600 px-3 py-1 text-white">A/P Invoice</Link>
          <Link to={`/requests/${requestId}/procure-to-pay/matching`} className="rounded bg-amber-600 px-3 py-1 text-white">Matching</Link>
          <Link to={`/requests/${requestId}/procure-to-pay/accounts-payable`} className="rounded bg-cyan-700 px-3 py-1 text-white">Accounts Payable</Link>
          <Link to={`/requests/${requestId}/procure-to-pay/payments`} className="rounded bg-emerald-700 px-3 py-1 text-white">Payments</Link>
          <Link to={`/requests/${requestId}/procure-to-pay/document-flow`} className="rounded bg-purple-700 px-3 py-1 text-white">Document Flow</Link>
        </div>
      </div>
      {error && <div className="rounded bg-red-50 px-3 py-2 text-red-700">{error}</div>}
      {success && <div className="rounded bg-emerald-50 px-3 py-2 text-emerald-700">{success}</div>}

      <div className="bg-white shadow rounded p-4">
        <h2 className="font-semibold">Lifecycle Detail View</h2>
        <p>Procurement State: <strong>{data?.lifecycle?.procurement_state || 'N/A'}</strong></p>
        <p>Finance State: <strong>{data?.lifecycle?.finance_state || 'N/A'}</strong></p>
        <p>Assigned Warehouse: <strong>{data?.request?.supply_warehouse_name || 'Not assigned'}</strong></p>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <form className="bg-white shadow rounded p-4 space-y-3" onSubmit={handleSubmitReceipt}>
          <h3 className="font-semibold">Goods Receipt Entry (updates warehouse stock)</h3>
          {!canManageReceipts && <p className="text-sm text-amber-700">You have read-only access to this section.</p>}

          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm">
              Warehouse
              <select
                className="mt-1 w-full rounded border px-2 py-1"
                value={receiptForm.warehouse_id}
                onChange={(e) => setReceiptForm((prev) => ({ ...prev, warehouse_id: e.target.value }))}
                disabled={!canManageReceipts}
              >
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Warehouse location
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={receiptForm.warehouse_location}
                onChange={(e) => setReceiptForm((prev) => ({ ...prev, warehouse_location: e.target.value }))}
                disabled={!canManageReceipts}
              />
            </label>
          </div>

          <div className="space-y-2">
            {(receiptForm.items || []).map((item, index) => (
              <div key={item.requested_item_id || index} className="rounded border p-2">
                <p className="font-medium">{item.item_name}</p>
                <div className="grid md:grid-cols-4 gap-2 mt-2">
                  <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" value={item.received_quantity} onChange={(e) => updateReceiptLine(index, 'received_quantity', e.target.value)} disabled={!canManageReceipts} placeholder="Received" />
                  <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" value={item.damaged_quantity} onChange={(e) => updateReceiptLine(index, 'damaged_quantity', e.target.value)} disabled={!canManageReceipts} placeholder="Damaged" />
                  <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" value={item.short_quantity} onChange={(e) => updateReceiptLine(index, 'short_quantity', e.target.value)} disabled={!canManageReceipts} placeholder="Short" />
                  <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateReceiptLine(index, 'unit_price', e.target.value)} disabled={!canManageReceipts} placeholder="Unit price" />
                </div>
              </div>
            ))}
          </div>

          <button className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50" type="submit" disabled={!canManageReceipts}>Save Goods Receipt</button>

          <ul className="text-sm list-disc ml-5">
            {availableReceipts.map((receipt) => <li key={receipt.id}>{receipt.receipt_number} · {new Date(receipt.received_at).toLocaleString()}</li>)}
          </ul>
        </form>

        <form className="bg-white shadow rounded p-4 space-y-3" onSubmit={handleSubmitInvoice}>
          <h3 className="font-semibold">Invoice Entry</h3>
          {!canManageInvoices && <p className="text-sm text-amber-700">You have read-only access to this section.</p>}

          <div className="grid md:grid-cols-2 gap-3">
            <input className="rounded border px-2 py-1" placeholder="Supplier" value={invoiceForm.supplier} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, supplier: e.target.value }))} disabled={!canManageInvoices} />
            <input className="rounded border px-2 py-1" placeholder="Invoice number" value={invoiceForm.invoice_number} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, invoice_number: e.target.value }))} disabled={!canManageInvoices} />
            <input className="rounded border px-2 py-1" type="date" value={invoiceForm.invoice_date} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, invoice_date: e.target.value }))} disabled={!canManageInvoices} />
            <select className="rounded border px-2 py-1" value={invoiceForm.receipt_id} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, receipt_id: e.target.value }))} disabled={!canManageInvoices}>
              <option value="">Linked receipt (optional)</option>
              {availableReceipts.map((receipt) => <option value={receipt.id} key={receipt.id}>{receipt.receipt_number}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            {(invoiceForm.items || []).map((item, index) => (
              <div key={item.requested_item_id || index} className="rounded border p-2">
                <input className="rounded border px-2 py-1 w-full" value={item.description} onChange={(e) => updateInvoiceLine(index, 'description', e.target.value)} disabled={!canManageInvoices} />
                <div className="grid md:grid-cols-3 gap-2 mt-2">
                  <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateInvoiceLine(index, 'quantity', e.target.value)} disabled={!canManageInvoices} placeholder="Qty" />
                  <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateInvoiceLine(index, 'unit_price', e.target.value)} disabled={!canManageInvoices} placeholder="Unit price" />
                  <input className="rounded border px-2 py-1 bg-gray-50" type="number" value={item.line_total} readOnly placeholder="Line total" />
                </div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-2">
            <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" placeholder="Subtotal" value={invoiceForm.subtotal_amount} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, subtotal_amount: e.target.value }))} disabled={!canManageInvoices} />
            <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" placeholder="Tax" value={invoiceForm.tax_amount} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, tax_amount: e.target.value }))} disabled={!canManageInvoices} />
            <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" placeholder="Extra charges" value={invoiceForm.extra_charges} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, extra_charges: e.target.value }))} disabled={!canManageInvoices} />
          </div>

          <p className="text-sm text-gray-600">Calculated total from lines: <strong>{computedInvoiceTotal.toFixed(2)}</strong></p>

          <button className="px-3 py-2 bg-indigo-600 text-white rounded disabled:opacity-50" type="submit" disabled={!canManageInvoices}>Submit Invoice</button>

          {canRunMatch && !!data?.invoices?.[0] && (
            <button
              type="button"
              className="px-3 py-2 bg-purple-600 text-white rounded ml-2"
              onClick={() => quickActions(() => runInvoiceMatch(requestId, data.invoices[0].id, { policy: 'THREE_WAY' }), 'Invoice matching executed')}
            >
              Run 3-Way Match (latest invoice)
            </button>
          )}

          <ul className="text-sm list-disc ml-5">
            {(data?.match_results || []).map((match) => <li key={match.id}>{match.match_status}</li>)}
          </ul>
        </form>
      </div>


      <div className="grid xl:grid-cols-2 gap-4">
        <div className="bg-white shadow rounded p-4 space-y-2">
          <h3 className="font-semibold">Budget & Commitment Control</h3>
          <p className="text-sm text-gray-600">Tracks reservation/encumbrance/actual spend visibility for this request.</p>
          <ul className="text-sm list-disc ml-5">
            {(data?.commitments || []).map((entry) => (
              <li key={entry.id}>
                <span className="font-medium">{entry.stage}</span> · {entry.amount} {entry.currency} · {entry.source_type || 'manual'}
              </li>
            ))}
          </ul>
          {(!data?.commitments || data.commitments.length === 0) && (
            <p className="text-sm text-gray-500">No commitments recorded yet.</p>
          )}
        </div>

        <div className="bg-white shadow rounded p-4 space-y-2">
          <h3 className="font-semibold">GL Posting Trace</h3>
          <p className="text-sm text-gray-600">ERP financial posting references generated from supplier invoice events.</p>
          <ul className="text-sm list-disc ml-5">
            {(data?.gl_postings || []).map((posting) => (
              <li key={posting.id}>
                {posting.posting_reference} · {posting.total_amount} {posting.currency} · {posting.posting_status}
              </li>
            ))}
          </ul>
          {(!data?.gl_postings || data.gl_postings.length === 0) && (
            <p className="text-sm text-gray-500">No GL postings yet.</p>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded p-4 space-y-2">
        <h3 className="font-semibold">Finance Review / Voucher Section</h3>
        <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => quickActions(() => verifyFinanceRecord(requestId))}>Verify Finance</button>
        <button className="px-3 py-1 bg-emerald-700 text-white rounded ml-2" onClick={() => quickActions(() => createApVoucher(requestId, {
          total_amount: data?.invoices?.[0]?.total_amount || computedInvoiceTotal,
          lines: [{ description: 'Liability', debit_amount: 0, credit_amount: data?.invoices?.[0]?.total_amount || computedInvoiceTotal }],
        }))}>Create Voucher</button>
        {!!data?.vouchers?.[0] && <button className="px-3 py-1 bg-slate-700 text-white rounded ml-2" onClick={() => quickActions(() => postToInternalLedger(requestId, { ap_voucher_id: data.vouchers[0].id, liability_recognized_amount: data.vouchers[0].total_amount }))}>Post Ledger</button>}
      </div>

      <div className="bg-white shadow rounded p-4 space-y-2">
        <h3 className="font-semibold">Payment Status Section</h3>
        {!!data?.vouchers?.[0] && <button className="px-3 py-1 bg-orange-600 text-white rounded" onClick={() => quickActions(() => markPaymentPending(requestId, { ap_voucher_id: data.vouchers[0].id }))}>Mark Payment Pending</button>}
        {!!data?.payments?.[0] && <button className="px-3 py-1 bg-teal-700 text-white rounded ml-2" onClick={() => quickActions(() => markPaid(requestId, data.payments[0].id, { amount_paid: data.vouchers?.[0]?.total_amount || 0 }))}>Mark Paid</button>}
        <ul className="text-sm list-disc ml-5">
          {(data?.payments || []).map((payment) => <li key={payment.id}>{payment.payment_status} · {payment.amount_paid}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default ProcureToPayLifecyclePage;