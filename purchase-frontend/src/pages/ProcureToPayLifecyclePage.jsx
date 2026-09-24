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
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Landmark,
  PackageCheck,
  RefreshCw,
  SearchCheck,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';


const formatTimelineDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString('en-GB');
};

const formatState = (value, fallback = 'Not started') => String(value || fallback)
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const LIFECYCLE_STAGES = [
  { id: 'request', label: 'Request', hint: 'Approved demand', icon: ClipboardCheck },
  { id: 'order', label: 'Purchase order', hint: 'Supplier commitment', icon: ShoppingCart },
  { id: 'receipt', label: 'Goods receipt', hint: 'Delivery confirmed', icon: PackageCheck },
  { id: 'invoice', label: 'Invoice', hint: 'Supplier billing', icon: FileText },
  { id: 'match', label: '3-way match', hint: 'Controls validated', icon: SearchCheck },
  { id: 'pay', label: 'Payment', hint: 'Liability settled', icon: CircleDollarSign },
];

const getLifecycleStageState = (payload = {}) => {
  payload = payload || {};
  const hasMatch = (payload.match_results || []).some((entry) => {
    const status = String(entry.match_status || '').toLowerCase();
    return status.includes('match') && !status.includes('unmatch');
  });
  const hasPaid = (payload.payments || []).some((entry) => String(entry.payment_status || '').toLowerCase() === 'paid');
  const completed = [
    true,
    (payload.purchase_orders || []).length > 0,
    (payload.receipts || []).length > 0,
    (payload.invoices || []).length > 0,
    hasMatch,
    hasPaid,
  ];
  const firstIncomplete = completed.findIndex((value) => !value);
  const activeIndex = firstIncomplete === -1 ? completed.length - 1 : firstIncomplete;
  return {
    completed,
    activeIndex,
    completedCount: completed.filter(Boolean).length,
    progress: Math.round((completed.filter(Boolean).length / completed.length) * 100),
  };
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
  const lifecycleStageState = useMemo(() => getLifecycleStageState(data), [data]);

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
      return arr.filter((entry, index) => {
        const id = String(entry?.id || entry?.target_document_id || entry?.source_document_id || `${entry?.target_document_type || 'record'}-${index}`);
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

    quickActions(() => createGoodsReceipt(requestId, { ...payload, idempotency_key: crypto.randomUUID() }), 'Goods receipt created and warehouse inventory updated');
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
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-6 py-10 text-white sm:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">Operations control center</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Procure-to-Pay Lifecycle</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Follow every handoff from approved demand to supplier payment in one governed, auditable workspace.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/procure-to-pay" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-violet-900 shadow-sm transition hover:bg-violet-50">Open P2P dashboard <ArrowRight size={16} /></Link>
              <Link to="/open-requests" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20">Browse open requests</Link>
            </div>
          </div>
          <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
            {[
              [ShoppingCart, 'Order', 'Convert approved demand into a controlled supplier commitment.'],
              [PackageCheck, 'Receive & match', 'Capture delivery evidence and resolve invoice exceptions.'],
              [Landmark, 'Post & pay', 'Complete finance controls with a traceable settlement.'],
            ].map(([Icon, title, description]) => (
              <div key={title} className="bg-white p-6">
                <Icon className="text-violet-700" size={22} />
                <h2 className="mt-4 font-bold text-slate-900">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (loading) return <div className="p-6">Loading lifecycle...</div>;

  return (
    <main className="min-h-screen space-y-6 bg-slate-50 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 text-white shadow-xl shadow-slate-200">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-violet-200">
                <Link to="/procure-to-pay" className="hover:text-white">Procure-to-Pay</Link>
                <ChevronRight size={14} />
                <span>Request #{requestId}</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Procurement lifecycle</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">One connected record for operational handoffs, financial controls, and audit evidence.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
              <div className="relative h-12 w-12 rounded-full bg-white/10" style={{ background: `conic-gradient(#a78bfa ${lifecycleStageState.progress}%, rgba(255,255,255,.12) 0)` }}>
                <div className="absolute inset-1.5 flex items-center justify-center rounded-full bg-indigo-950 text-xs font-bold">{lifecycleStageState.progress}%</div>
              </div>
              <div>
                <p className="text-xs text-slate-300">Lifecycle progress</p>
                <p className="font-bold">{lifecycleStageState.completedCount} of {LIFECYCLE_STAGES.length} stages</p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Procure-to-pay progress">
            {LIFECYCLE_STAGES.map((stage, index) => {
              const Icon = stage.icon;
              const complete = lifecycleStageState.completed[index];
              const active = lifecycleStageState.activeIndex === index && !complete;
              return (
                <div key={stage.id} className={`relative rounded-2xl border p-3.5 ${complete ? 'border-emerald-400/30 bg-emerald-400/10' : active ? 'border-violet-300/60 bg-white/15' : 'border-white/10 bg-white/5'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${complete ? 'bg-emerald-400 text-slate-950' : active ? 'bg-violet-300 text-violet-950' : 'bg-white/10 text-slate-400'}`}>
                      {complete ? <Check size={17} strokeWidth={3} /> : <Icon size={17} />}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">0{index + 1}</span>
                  </div>
                  <p className="mt-3 text-sm font-bold">{stage.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{complete ? 'Complete' : active ? 'Current stage' : stage.hint}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
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
      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Lifecycle workspaces">
        {[
          ['PO', 'purchase-orders'], ['GRPO', 'receipts'], ['A/P Invoice', 'invoices'], ['Matching', 'matching'],
          ['Accounts Payable', 'accounts-payable'], ['Payments', 'payments'], ['Document Flow', 'document-flow'],
        ].map(([label, path]) => <Link key={path} to={`/requests/${requestId}/procure-to-pay/${path}`} className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-violet-50 hover:text-violet-800">{label}</Link>)}
      </nav>
      {error && <div className="rounded bg-red-50 px-3 py-2 text-red-700">{error}</div>}
      {success && <div className="rounded bg-emerald-50 px-3 py-2 text-emerald-700">{success}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [ShoppingCart, 'Procurement state', formatState(data?.lifecycle?.procurement_state), 'bg-violet-50 text-violet-700'],
          [Landmark, 'Finance state', formatState(data?.lifecycle?.finance_state), 'bg-emerald-50 text-emerald-700'],
          [Warehouse, 'Assigned warehouse', data?.request?.supply_warehouse_name || 'Not assigned', 'bg-blue-50 text-blue-700'],
          [FileCheck2, 'Linked documents', chainCards.reduce((sum, [, records]) => sum + records.length, 0), 'bg-amber-50 text-amber-700'],
        ].map(([Icon, label, value, tone]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon size={20} /></div>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-bold text-slate-900">Transaction timeline</h2><p className="mt-1 text-sm text-slate-500">Milestones and approval evidence</p></div>
            <button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><RefreshCw size={14} /> Refresh</button>
          </div>
          <ol className="mt-5 space-y-3">
            {transactionTimeline.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{step.done ? <Check size={13} strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-current" />}</span>
                  {index !== transactionTimeline.length - 1 && <span className="h-full w-px bg-slate-200" />}
                </div>
                <div className="pb-2"><p className="text-sm font-semibold text-slate-800">{step.title}</p>{step.detail && <p className="text-xs text-slate-600">{step.detail}</p>}<p className="text-xs text-slate-400">{formatTimelineDate(step.at) || (step.done ? 'Completed · timestamp unavailable' : 'Pending')}</p></div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
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
    </main>
  );
};

export default ProcureToPayLifecyclePage;