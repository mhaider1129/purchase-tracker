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
import { useSuppliers } from '../hooks/useSuppliers';
import GuidedWorkflowPanel from '../components/GuidedWorkflowPanel';


const formatTimelineDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString('en-GB');
};

const buildTransactionTimeline = (payload = {}) => {
  const lifecycle = payload?.lifecycle || {};
  const approvals = payload?.approvals || [];
  const receipts = payload?.receipts || [];
  const invoices = payload?.invoices || [];
  const matches = payload?.match_results || [];
  const vouchers = payload?.vouchers || [];
  const payments = payload?.payments || [];

  const approvedApprovals = approvals.filter((entry) => String(entry.status || '').toLowerCase() === 'approved');
  const hodApproval = approvedApprovals.find((entry) => String(entry.role || '').toLowerCase().includes('hod'));
  const cmoApproval = approvedApprovals.find((entry) => String(entry.role || '').toLowerCase().includes('cmo'));

  const quotationCount = Number(payload?.request?.quotation_count || 0);
  const supplierSelected = payload?.request?.selected_supplier || invoices[0]?.supplier || payload?.request?.supplier_name;
  const partialReceipt = receipts.find((entry) => Number(entry.short_quantity || 0) > 0 || Number(entry.damaged_quantity || 0) > 0);
  const approvedPayments = payments.filter((entry) => ['approved', 'paid'].includes(String(entry.payment_status || '').toLowerCase()));

  return [
    { title: 'PR Created', at: lifecycle.created_at || payload?.request?.created_at, done: true },
    { title: 'Approved by HOD', at: hodApproval?.approved_at || hodApproval?.created_at, done: Boolean(hodApproval) },
    { title: 'Approved by CMO', at: cmoApproval?.approved_at || cmoApproval?.created_at, done: Boolean(cmoApproval) },
    { title: 'RFQ Issued', at: payload?.request?.rfq_issued_at || lifecycle.rfq_issued_at, done: Boolean(payload?.request?.rfq_issued_at || lifecycle.rfq_issued_at) },
    { title: `Quotations Received (${quotationCount || 0})`, at: payload?.request?.quotation_received_at || lifecycle.quotation_received_at, done: quotationCount > 0 },
    { title: 'Supplier Selected', detail: supplierSelected || null, at: payload?.request?.supplier_selected_at || lifecycle.supplier_selected_at, done: Boolean(supplierSelected) },
    { title: 'PO Issued', at: lifecycle.po_issued_at || payload?.request?.po_issued_at, done: Boolean(lifecycle.po_issued_at || payload?.request?.po_issued_at) },
    { title: 'Partial Delivery Received', at: partialReceipt?.received_at, done: Boolean(partialReceipt) },
    { title: 'Invoice Matched', at: matches[0]?.matched_at || matches[0]?.created_at, done: matches.some((entry) => String(entry.match_status || '').toLowerCase().includes('match')) },
    { title: 'Payment Approved', at: approvedPayments[0]?.approved_at || approvedPayments[0]?.paid_at || approvedPayments[0]?.created_at, done: approvedPayments.length > 0 || vouchers.length > 0 },
  ];
};

const ProcureToPayLifecyclePage = () => {
  const { requestId } = useParams();
  const hasRequestContext = Number.isInteger(Number(requestId)) && Number(requestId) > 0;
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [onboardingVersion, setOnboardingVersion] = useState(0);

  const [receiptForm, setReceiptForm] = useState({
    warehouse_id: '',
    warehouse_location: '',
    notes: '',
    discrepancy_notes: '',
    items: [],
  });

  const [invoiceForm, setInvoiceForm] = useState({
    supplier_id: '',
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

  const { suppliers, suppliersError } = useSuppliers();

  const selectedInvoiceSupplier = useMemo(
    () => suppliers.find((entry) => String(entry.id) === String(invoiceForm.supplier_id)),
    [suppliers, invoiceForm.supplier_id]
  );

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
      supplier_id: payload?.invoices?.[0]?.supplier_id ? String(payload.invoices[0].supplier_id) : '',
      supplier: payload?.invoices?.[0]?.supplier || prev.supplier || '',
      receipt_id: payload?.receipts?.[0]?.id ? String(payload.receipts[0].id) : '',
    }));
  }, [user?.warehouse_id]);

  const refresh = useCallback(async () => {
    if (!hasRequestContext) {
      setData(null);
      setLoading(false);
      return;
    }

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
  }, [requestId, hydrateFormsFromData, hasRequestContext]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const response = await api.get('/warehouses');
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
  const transactionTimeline = useMemo(() => buildTransactionTimeline(data), [data]);

  const autoCompletedOnboardingSteps = useMemo(() => {
    const invoices = data?.invoices || [];
    const payments = data?.payments || [];
    const financeState = String(data?.lifecycle?.finance_state || '').toLowerCase();

    return [
      availableReceipts.length > 0 ? 'goods_receipt' : null,
      invoices.length > 0 ? 'invoice_entry' : null,
      (payments.length > 0 || financeState.includes('paid')) ? 'match_and_pay' : null,
    ].filter(Boolean);
  }, [availableReceipts.length, data?.invoices, data?.lifecycle?.finance_state, data?.payments]);



  const unifiedChain = useMemo(() => {
    const links = data?.document_flow_links || [];
    const toType = (value) => String(value || '').toUpperCase();
    const uniqueById = (arr = []) => {
      const seen = new Set();
      return arr.filter((entry) => {
        const id = String(entry?.id || entry?.target_document_id || entry?.source_document_id || Math.random());
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    };

    const flowTargets = (types) => uniqueById(
      links.filter((link) => types.includes(toType(link.target_document_type)) || types.includes(toType(link.source_document_type)))
    );

    return {
      rfqs: flowTargets(['RFQ']),
      quotations: flowTargets(['QUOTATION', 'SUPPLIER_QUOTATION']),
      evaluations: flowTargets(['EVALUATION', 'SUPPLIER_EVALUATION']),
      purchaseOrders: uniqueById(data?.purchase_orders || []),
      grns: uniqueById(data?.receipts || []),
      invoices: uniqueById(data?.invoices || []),
      payments: uniqueById(data?.payments || []),
      supplierScore: flowTargets(['SUPPLIER_SCORE', 'SUPPLIER_EVALUATION']),
      contracts: flowTargets(['CONTRACT']),
      auditTimeline: [
        ...(data?.state_history || []).map((entry) => ({
          id: `state-${entry.id}`,
          at: entry.changed_at,
          label: `${entry.from_state || 'N/A'} → ${entry.to_state || 'N/A'}`,
          kind: 'Lifecycle',
        })),
        ...(data?.finance_actions || []).map((entry) => ({
          id: `finance-${entry.id}`,
          at: entry.created_at,
          label: entry.action_type,
          kind: 'Finance',
        })),
      ]
        .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
        .slice(0, 12),
    };
  }, [data]);

  const chainCards = [
    ['Linked RFQs', unifiedChain.rfqs],
    ['Linked Quotations', unifiedChain.quotations],
    ['Linked Evaluation', unifiedChain.evaluations],
    ['Linked PO', unifiedChain.purchaseOrders],
    ['Linked GRNs', unifiedChain.grns],
    ['Linked Invoices', unifiedChain.invoices],
    ['Linked Payments', unifiedChain.payments],
    ['Linked Supplier Score', unifiedChain.supplierScore],
    ['Linked Contract', unifiedChain.contracts],
  ];

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
      supplier_id: invoiceForm.supplier_id ? Number(invoiceForm.supplier_id) : undefined,
      supplier: selectedInvoiceSupplier?.name || invoiceForm.supplier,
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

  if (!hasRequestContext) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Procure-to-Pay Lifecycle</h1>
        <div className="rounded border bg-white p-4 space-y-2">
          <p className="text-sm text-gray-700">Open a specific request lifecycle from request pages, or start from the Procure-to-Pay dashboard.</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/procure-to-pay" className="rounded bg-violet-700 px-3 py-1 text-white">Go to Procure-to-Pay Dashboard</Link>
            <Link to="/open-requests" className="rounded border px-3 py-1">Open Requests</Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-6">Loading lifecycle...</div>;

  return (
    <div className="p-6 space-y-4">
      <GuidedWorkflowPanel
        key={onboardingVersion}
        title="First-run walkthrough: Procure-to-pay lifecycle"
        subtitle="Track each operational handoff from goods receipt through payment."
        storageKey="onboarding-procure-to-pay"
        onCompleteStep={() => setOnboardingVersion((v) => v + 1)}
        autoCompleteStepIds={autoCompletedOnboardingSteps}
        steps={[
          { id: 'goods_receipt', title: 'Capture goods receipt (GRPO)', tip: 'Record received, damaged, and short quantities accurately.' },
          { id: 'invoice_entry', title: 'Submit supplier invoice', tip: 'Use the same supplier and cross-reference PO-equivalent details.' },
          { id: 'match_and_pay', title: 'Run match and complete payment', tip: 'Verify ledger posting before marking invoices as paid.' },
        ]}
      />
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

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="bg-white shadow rounded p-4">
          <h2 className="font-semibold">Lifecycle Detail View</h2>
          <p>Procurement State: <strong>{data?.lifecycle?.procurement_state || 'N/A'}</strong></p>
          <p>Finance State: <strong>{data?.lifecycle?.finance_state || 'N/A'}</strong></p>
          <p>Assigned Warehouse: <strong>{data?.request?.supply_warehouse_name || 'Not assigned'}</strong></p>
        </div>

        <div className="bg-white shadow rounded p-4 space-y-3">
          <h2 className="font-semibold">Unified Procurement Transaction Chain</h2>
          <p className="text-sm text-gray-600">This request now behaves as one chain across Request → RFQ → Quotation → Evaluation → PO → GRN → Invoice → Payment → Supplier Score → Contract.</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {chainCards.map(([label, records]) => (
              <div key={label} className="rounded border p-3">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-lg font-semibold">{records.length}</p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-medium">Audit Timeline</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {unifiedChain.auditTimeline.map((entry) => (
                <li key={entry.id} className="rounded border px-2 py-1">
                  <span className="font-medium">[{entry.kind}]</span> {entry.label} · {new Date(entry.at).toLocaleString()}
                </li>
              ))}
            </ul>
            {unifiedChain.auditTimeline.length === 0 && <p className="text-sm text-gray-500">No audit timeline events linked yet.</p>}
          </div>
        </div>

        <div className="bg-white shadow rounded p-4">
          <h2 className="font-semibold">Transaction Timeline</h2>
          <p className="text-sm text-gray-600 mb-3">End-to-end workflow visibility for operations, audit, and executive reporting.</p>
          <ol className="space-y-3">
            {transactionTimeline.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`mt-1 h-3 w-3 rounded-full ${step.done ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  {index !== transactionTimeline.length - 1 && <span className="h-full w-px bg-gray-200" />}
                </div>
                <div className="pb-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  {step.detail && <p className="text-xs text-gray-600">{step.detail}</p>}
                  <p className="text-xs text-gray-500">{formatTimelineDate(step.at) || (step.done ? 'Completed (timestamp unavailable)' : 'Pending')}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
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


        <div className="bg-white shadow rounded p-4 space-y-2">
          <h3 className="font-semibold">Warehouse Inventory Linkage</h3>
          <p className="text-sm text-gray-600">Stock levels below are linked to this request's warehouse and requested items after goods receipt posting.</p>
          <ul className="text-sm list-disc ml-5">
            {(data?.linked_inventory || []).map((entry, index) => (
              <li key={`${entry.stock_item_id || entry.item_name}-${index}`}>
                {entry.item_name} · On hand: {Number(entry.quantity || 0).toFixed(2)} · Warehouse: {entry.warehouse_name || `#${entry.warehouse_id}`}
              </li>
            ))}
          </ul>
          {(!data?.linked_inventory || data.linked_inventory.length === 0) && (
            <p className="text-sm text-gray-500">No linked stock levels found yet for this request items.</p>
          )}
        </div>

        <form className="bg-white shadow rounded p-4 space-y-3" onSubmit={handleSubmitInvoice}>
          <h3 className="font-semibold">Invoice Entry</h3>
          {!canManageInvoices && <p className="text-sm text-amber-700">You have read-only access to this section.</p>}

          <div className="grid md:grid-cols-2 gap-3">
            <select className="rounded border px-2 py-1" value={invoiceForm.supplier_id} onChange={(e) => {
              const supplierId = e.target.value;
              const found = suppliers.find((entry) => String(entry.id) === supplierId);
              setInvoiceForm((prev) => ({ ...prev, supplier_id: supplierId, supplier: found?.name || '' }));
            }} disabled={!canManageInvoices}>
              <option value="">Select supplier from master list</option>
              {suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}
            </select>
            <input className="rounded border px-2 py-1" placeholder="Invoice number" value={invoiceForm.invoice_number} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, invoice_number: e.target.value }))} disabled={!canManageInvoices} />
            <input className="rounded border px-2 py-1" type="date" value={invoiceForm.invoice_date} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, invoice_date: e.target.value }))} disabled={!canManageInvoices} />
            <select className="rounded border px-2 py-1" value={invoiceForm.receipt_id} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, receipt_id: e.target.value }))} disabled={!canManageInvoices}>
              <option value="">Linked receipt (optional)</option>
              {availableReceipts.map((receipt) => <option value={receipt.id} key={receipt.id}>{receipt.receipt_number}</option>)}
            </select>
          </div>

          <input className="rounded border px-2 py-1 w-full" placeholder="Supplier (fallback if master list has no match)" value={invoiceForm.supplier} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, supplier: e.target.value, supplier_id: prev.supplier_id || '' }))} disabled={!canManageInvoices} />
          {suppliersError && <p className="text-sm text-amber-700">{suppliersError}</p>}

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
                {posting.posting_reference} · {posting.total_amount} {posting.currency} · {posting.posting_status}{posting.journal_entry_id ? ` · journal #${posting.journal_entry_id}` : ''}
              </li>
            ))}
          </ul>
          {(!data?.gl_postings || data.gl_postings.length === 0) && (
            <p className="text-sm text-gray-500">No GL postings yet.</p>
          )}
        </div>
      </div>

        <div className="bg-white shadow rounded p-4 space-y-2">
          <h3 className="font-semibold">Journal Entry Trace</h3>
          <p className="text-sm text-gray-600">Canonical accounting journals created by voucher/payment/adjustment/accrual actions.</p>
          <ul className="text-sm list-disc ml-5">
            {(data?.journal_entries || []).map((journal) => (
              <li key={journal.id}>
                {journal.journal_reference} · {journal.journal_type} · {journal.total_amount} {journal.currency} · {journal.entry_status}
              </li>
            ))}
          </ul>
          {(!data?.journal_entries || data.journal_entries.length === 0) && (
            <p className="text-sm text-gray-500">No journal entries yet.</p>
          )}
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