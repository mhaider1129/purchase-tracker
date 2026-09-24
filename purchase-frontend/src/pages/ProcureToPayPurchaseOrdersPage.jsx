import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock3, FilePlus2, PackageCheck, RefreshCw, Search, ShoppingCart } from 'lucide-react';
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  createPurchaseOrder,
  issuePurchaseOrder,
  listPurchaseOrders,
  listPoSourceRequests,
  submitPurchaseOrderForApproval,
} from '../api/procureToPay';
import PaginationControls from '../components/ui/PaginationControls';
import { useAuth } from '../hooks/useAuth';

const STATUSES = ['ALL', 'PO_DRAFT', 'PO_PENDING_APPROVAL', 'PO_APPROVED', 'PO_ISSUED', 'PO_PARTIAL', 'PO_DELIVERED', 'PO_CLOSED', 'PO_CANCELLED'];

const STATUS_LABELS = {
  ALL: 'All statuses',
  PO_DRAFT: 'Draft',
  PO_PENDING_APPROVAL: 'Pending Approval',
  PO_APPROVED: 'Approved',
  PO_ISSUED: 'Issued / Sent to Supplier',
  PO_PARTIAL: 'Partially Received',
  PO_DELIVERED: 'Fully Received - Awaiting Close',
  PO_CLOSED: 'Closed',
  PO_CANCELLED: 'Cancelled',
};

const SOURCE_TYPES = [{ value: 'PURCHASE_REQUEST', label: 'Approved purchase request award' }];

const STATUS_STYLES = {
  PO_DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  PO_PENDING_APPROVAL: 'bg-amber-50 text-amber-800 ring-amber-200',
  PO_APPROVED: 'bg-blue-50 text-blue-700 ring-blue-200',
  PO_ISSUED: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  PO_PARTIAL: 'bg-violet-50 text-violet-700 ring-violet-200',
  PO_DELIVERED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PO_CLOSED: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  PO_CANCELLED: 'bg-red-50 text-red-700 ring-red-200',
};

const WORKSPACE_TABS = ['Overview', 'Items', 'Receipts / GRNs', 'Invoices', 'Documents', 'Communication', 'Timeline', 'Audit'];

const EMPTY_PO_FORM = {
  supplier_name: '',
  expected_delivery_date: '',
  delivery_location: '',
  budget_cost_center: '',
  tax_terms: '',
  payment_terms: '',
  terms: '',
  supplier_contact_email: '',
  source_document_type: 'PURCHASE_REQUEST',
  source_document_id: '',
  standalone_reason: '',
  currency: 'USD',
  shipping_terms: '',
  supplier_contact_person: '',
  po_notes: '',
  approval_route: '',
};

const EMPTY_MANUAL_ITEM = { requested_item_id: null, item_name: '', quantity: '1', uom: '', unit_price: '0' };

const formatAmount = (value) => Number(value || 0).toFixed(2);

const ProcureToPayPurchaseOrdersPage = () => {
  const { requestId } = useParams();
  const [rows, setRows] = useState([]);
  const [sourceRequests, setSourceRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: 'ALL', supplier: '' });
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [manualForm, setManualForm] = useState(EMPTY_PO_FORM);
  const [manualItems, setManualItems] = useState([EMPTY_MANUAL_ITEM]);
  const [activeTab, setActiveTab] = useState('Overview');
  const [busyPoId, setBusyPoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const billingEntity = user?.institute_name || user?.institute || user?.instituteName || user?.organization_name || user?.department_name || '';

  const scopedRequestId = useMemo(() => {
    const parsed = Number(requestId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [requestId]);

  const buildItemsFromSourceRequest = useCallback((sourceRequest) => {
    const remainingItems = Array.isArray(sourceRequest?.remaining_items) ? sourceRequest.remaining_items : [];
    const supplierId = remainingItems[0]?.supplier_id;
    const items = remainingItems
      .filter((item) => !supplierId || item.supplier_id === supplierId)
      .map((item) => ({
        award_id: item.award_id || null,
        supplier_id: item.supplier_id || null,
        requested_item_id: item.requested_item_id || null,
        item_name: item.item_name || '',
        quantity: String(item.remaining_quantity ?? item.quantity ?? ''),
        uom: item.uom || '',
        unit_price: String(item.unit_price ?? 0),
      }))
      .filter((item) => item.item_name && Number(item.quantity) > 0);

    return items.length > 0 ? items : [EMPTY_MANUAL_ITEM];
  }, []);

  const applySourceRequestToPoItems = useCallback((requestIdValue, requests = sourceRequests) => {
    const sourceRequest = requests.find((request) => String(request.id) === String(requestIdValue));
    if (sourceRequest) {
      setManualItems(buildItemsFromSourceRequest(sourceRequest));
      const firstAward = sourceRequest.remaining_items?.[0];
      if (firstAward?.supplier_name) {
        setManualForm((prev) => ({ ...prev, supplier_name: firstAward.supplier_name, currency: firstAward.currency || prev.currency }));
      }
    }
  }, [buildItemsFromSourceRequest, sourceRequests]);

  const load = useCallback(async (page = pagination.page) => {
    const params = {
      page,
      page_size: pagination.page_size,
      search: filters.search || undefined,
      supplier: filters.supplier || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      request_id: scopedRequestId || undefined,
    };

    const requestsParams = {
      search: filters.search || undefined,
      request_id: scopedRequestId || undefined,
    };

    setLoading(true);
    setError('');
    try {
      const [poRes, requestRes] = await Promise.all([
        listPurchaseOrders(params),
        listPoSourceRequests(requestsParams),
      ]);

      const nextSourceRequests = requestRes?.data || [];
      setRows(poRes?.data || []);
      setPagination(poRes?.pagination || { page: 1, page_size: 20, total: 0 });
      setSourceRequests(nextSourceRequests);
    } catch (err) {
      setError(err?.response?.data?.message || 'We could not load purchase orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.status, filters.supplier, pagination.page, pagination.page_size, scopedRequestId]);

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    if (isCreating && manualForm.source_document_type === 'PURCHASE_REQUEST' && selectedRequestId) {
      applySourceRequestToPoItems(selectedRequestId);
    }
  }, [applySourceRequestToPoItems, isCreating, manualForm.source_document_type, selectedRequestId, sourceRequests]);

  useEffect(() => {
    if (scopedRequestId && isCreating) {
      setSelectedRequestId(String(scopedRequestId));
      setManualForm((prev) => ({ ...prev, source_document_type: 'PURCHASE_REQUEST', source_document_id: String(scopedRequestId) }));
      applySourceRequestToPoItems(scopedRequestId);
    }
  }, [applySourceRequestToPoItems, isCreating, scopedRequestId]);

  const validateForm = (form, options = {}) => {
    const missing = [];
    if (options.requireSupplier && !form.supplier_name.trim()) missing.push('supplier / vendor');
    if (options.requireStandaloneReason && !form.standalone_reason.trim()) missing.push('standalone justification');
    if (!form.expected_delivery_date) missing.push('delivery date');
    if (form.source_document_type === 'PURCHASE_REQUEST' && !selectedRequestId) missing.push('linked purchase request');
    if (!form.delivery_location.trim()) missing.push('delivery location');
    if (!billingEntity.trim()) missing.push('billing entity / institute from your user profile');
    if (!form.tax_terms.trim()) missing.push('tax terms');
    if (!form.payment_terms.trim()) missing.push('payment terms');
    if (!String(form.shipping_terms || '').trim()) missing.push('shipping / freight terms');
    return missing;
  };

  const normalizedManualItems = manualItems
    .map((item) => ({
      award_id: item.award_id || null,
      supplier_id: item.supplier_id || null,
      requested_item_id: item.requested_item_id || null,
      item_name: item.item_name.trim(),
      quantity: Number(item.quantity) || 0,
      uom: item.uom.trim(),
      unit_price: Number(item.unit_price) || 0,
    }))
    .filter((item) => item.item_name && item.quantity > 0);

  const manualItemsTotal = normalizedManualItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const pageMetrics = useMemo(() => ({
    value: rows.reduce((sum, po) => sum + Number(po.total_amount || 0), 0),
    awaitingApproval: rows.filter((po) => po.status === 'PO_PENDING_APPROVAL').length,
    receiving: rows.filter((po) => ['PO_ISSUED', 'PO_PARTIAL'].includes(po.status)).length,
    completed: rows.filter((po) => ['PO_DELIVERED', 'PO_CLOSED'].includes(po.status)).length,
  }), [rows]);

  const selectedAwardSupplierId = normalizedManualItems.find((item) => item.award_id)?.supplier_id;
  const awardItemsForPo = manualForm.source_document_type === 'PURCHASE_REQUEST'
    ? normalizedManualItems.filter((item) => !selectedAwardSupplierId || item.supplier_id === selectedAwardSupplierId)
    : normalizedManualItems;

  const resetCreateWorkspace = () => {
    setManualForm(EMPTY_PO_FORM);
    setManualItems([EMPTY_MANUAL_ITEM]);
    setSelectedRequestId(scopedRequestId ? String(scopedRequestId) : '');
    setIsCreating(false);
  };

  const openCreateWorkspace = () => {
    setError('');
    setSuccess('');
    setSelectedRequestId(scopedRequestId ? String(scopedRequestId) : '');
    setManualForm((prev) => ({
      ...prev,
      source_document_type: scopedRequestId ? 'PURCHASE_REQUEST' : prev.source_document_type,
      source_document_id: scopedRequestId ? String(scopedRequestId) : prev.source_document_id,
    }));
    if (scopedRequestId) {
      applySourceRequestToPoItems(scopedRequestId);
    }
    setIsCreating(true);
  };

  const handleMutation = async (action, successMessage) => {
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(successMessage);
      await load(1);
      return true;
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Action failed');
      return false;
    }
  };

  const renderRowActions = (po) => {
    const actions = [];

    if (po.status === 'PO_PENDING_APPROVAL') {
      actions.push(
        <button
          key="approve"
          className="rounded bg-emerald-600 px-2 py-1 text-white"
          disabled={busyPoId === po.id}
          onClick={async () => {
            setBusyPoId(po.id);
            await handleMutation(() => approvePurchaseOrder(po.id), `Purchase order ${po.po_number} approved.`);
            setBusyPoId(null);
          }}
        >
          Approve
        </button>
      );
    }

    if (['PO_APPROVED', 'PO_DRAFT'].includes(po.status)) {
      actions.push(
        <button
          key="submit"
          className="rounded border px-2 py-1"
          disabled={busyPoId === po.id}
          onClick={async () => {
            setBusyPoId(po.id);
            await handleMutation(() => submitPurchaseOrderForApproval(po.id), `Purchase order ${po.po_number} submitted for approval.`);
            setBusyPoId(null);
          }}
        >
          Submit
        </button>
      );
    }

    if (['PO_APPROVED', 'PO_ISSUED'].includes(po.status)) {
      actions.push(
        <button
          key="issue"
          className="rounded bg-indigo-600 px-2 py-1 text-white"
          disabled={busyPoId === po.id || po.status === 'PO_ISSUED'}
          onClick={async () => {
            setBusyPoId(po.id);
            await handleMutation(() => issuePurchaseOrder(po.id, { supplier_contact_email: po.supplier_contact_email || null }), `Purchase order ${po.po_number} issued to supplier.`);
            setBusyPoId(null);
          }}
        >
          Issue
        </button>
      );
    }

    if (['PO_DELIVERED', 'PO_PARTIAL'].includes(po.status)) {
      actions.push(
        <button
          key="close"
          className="rounded bg-slate-700 px-2 py-1 text-white"
          disabled={busyPoId === po.id}
          onClick={async () => {
            setBusyPoId(po.id);
            await handleMutation(() => closePurchaseOrder(po.id, {}), `Purchase order ${po.po_number} closed.`);
            setBusyPoId(null);
          }}
        >
          Close
        </button>
      );
    }

    if (!['PO_CLOSED', 'PO_CANCELLED'].includes(po.status)) {
      actions.push(
        <button
          key="cancel"
          className="rounded border border-red-300 px-2 py-1 text-red-700"
          disabled={busyPoId === po.id}
          onClick={async () => {
            const reason = window.prompt(`Provide a cancellation reason for ${po.po_number}:`);
            if (!reason) return;
            setBusyPoId(po.id);
            await handleMutation(() => cancelPurchaseOrder(po.id, { reason }), `Purchase order ${po.po_number} cancelled.`);
            setBusyPoId(null);
          }}
        >
          Cancel
        </button>
      );
    }

    if (po.request_id) {
      actions.push(
        <Link key="lifecycle" className="text-blue-600 underline" to={`/requests/${po.request_id}/procure-to-pay`}>
          Open lifecycle
        </Link>
      );
    }

    return <div className="flex flex-wrap gap-2">{actions}</div>;
  };

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl sm:px-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300"><ShoppingCart size={16} /> Source to order</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Purchase Orders</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Turn approved supplier awards into controlled orders, then follow approval, issue, and receipt progress in one workspace.</p>
            {scopedRequestId && <p className="mt-2 text-sm font-medium text-indigo-200">Filtered to purchase request #{scopedRequestId}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => load(1)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20 disabled:opacity-60">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button type="button" onClick={openCreateWorkspace} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold shadow-lg hover:bg-indigo-400">
              <FilePlus2 size={17} /> Create PO
            </button>
          </div>
        </div>
      </section>

      {error && <div role="alert" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800"><AlertTriangle size={19} />{error}</div>}
      {success && <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800"><CheckCircle2 size={19} />{success}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Purchase order summary">
        {[
          { label: 'Visible order value', value: `${formatAmount(pageMetrics.value)} ${rows[0]?.currency || ''}`, helper: 'Current results page', icon: ShoppingCart, tone: 'text-indigo-700 bg-indigo-50' },
          { label: 'Awaiting approval', value: pageMetrics.awaitingApproval, helper: 'Needs an approval decision', icon: Clock3, tone: 'text-amber-700 bg-amber-50' },
          { label: 'In receiving', value: pageMetrics.receiving, helper: 'Issued or partially received', icon: PackageCheck, tone: 'text-violet-700 bg-violet-50' },
          { label: 'Delivered / closed', value: pageMetrics.completed, helper: 'Fulfilled on this page', icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
        ].map(({ label, value, helper, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`mb-4 inline-flex rounded-xl p-2.5 ${tone}`}><Icon size={20} /></div>
            <p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{helper}</p>
          </article>
        ))}
      </section>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[2fr_1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); load(1); }}>
        <label className="relative"><span className="sr-only">Search purchase orders</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3" placeholder="Search PO number, supplier, or request" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} /></label>
        <input aria-label="Filter by supplier" className="rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Supplier" value={filters.supplier} onChange={(e) => setFilters((p) => ({ ...p, supplier: e.target.value }))} />
        <select aria-label="Filter by status" className="rounded-xl border border-slate-300 px-3 py-2.5" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
          {STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>)}
        </select>
        <button type="submit" className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700">Apply filters</button>
      </form>

      {!isCreating ? (
        <div className="bg-white p-4 rounded shadow flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">PO workspace</h2>
            <p className="text-sm text-gray-600">Review open POs, search/filter the register, and start a new PO in a dedicated workstation.</p>
          </div>
          <button className="bg-blue-600 text-white rounded px-4 py-2" onClick={openCreateWorkspace}>Create new PO</button>
        </div>
      ) : (
        <div className="bg-white p-4 rounded shadow space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="font-semibold">Create PO workstation</h2>
              <p className="text-xs text-gray-600">Create a governed PO from an approved supplier award. Billing entity is applied automatically from your user institute.</p>
            </div>
            <button type="button" className="rounded border px-3 py-1 text-sm" onClick={resetCreateWorkspace}>Back to PO list</button>
          </div>
          <div className="grid sm:grid-cols-4 gap-2">
            <select className="border rounded px-2 py-1" value={manualForm.source_document_type} onChange={(e) => {
              const sourceType = e.target.value;
              setManualForm((prev) => ({ ...prev, source_document_type: sourceType, source_document_id: sourceType === 'PURCHASE_REQUEST' ? selectedRequestId : prev.source_document_id }));
              if (sourceType === 'PURCHASE_REQUEST' && selectedRequestId) applySourceRequestToPoItems(selectedRequestId);
              if (sourceType !== 'PURCHASE_REQUEST') {
                setSelectedRequestId('');
                setManualItems([EMPTY_MANUAL_ITEM]);
              }
            }}>
              {SOURCE_TYPES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
            </select>
            {manualForm.source_document_type === 'PURCHASE_REQUEST' ? (
              <select className="border rounded px-2 py-1" value={selectedRequestId} onChange={(e) => {
                setSelectedRequestId(e.target.value);
                setManualForm((prev) => ({ ...prev, source_document_id: e.target.value }));
                applySourceRequestToPoItems(e.target.value);
              }} disabled={Boolean(scopedRequestId)}>
                <option value="">Select approved request</option>
                {sourceRequests.map((r) => <option key={r.id} value={r.id}>Request #{r.id} · {r.request_type} · {(r.remaining_items || []).length} remaining lines</option>)}
              </select>
            ) : (
              <input className="border rounded px-2 py-1" placeholder="Source reference / contract no." value={manualForm.source_document_id} onChange={(e) => setManualForm((prev) => ({ ...prev, source_document_id: e.target.value }))} />
            )}
            <input className="border rounded px-2 py-1" placeholder="Supplier / vendor" value={manualForm.supplier_name} onChange={(e) => setManualForm((prev) => ({ ...prev, supplier_name: e.target.value }))} />
            <input className="border rounded px-2 py-1" placeholder="Supplier contact person" value={manualForm.supplier_contact_person} onChange={(e) => setManualForm((prev) => ({ ...prev, supplier_contact_person: e.target.value }))} />
            <input className="border rounded px-2 py-1" type="date" value={manualForm.expected_delivery_date} onChange={(e) => setManualForm((prev) => ({ ...prev, expected_delivery_date: e.target.value }))} />
            <input className="border rounded px-2 py-1" placeholder="Delivery location" value={manualForm.delivery_location} onChange={(e) => setManualForm((prev) => ({ ...prev, delivery_location: e.target.value }))} />
            <input className="border rounded px-2 py-1" placeholder="Currency" value={manualForm.currency} onChange={(e) => setManualForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} />
            <input className="border rounded px-2 py-1" placeholder="Tax / discount terms" value={manualForm.tax_terms} onChange={(e) => setManualForm((prev) => ({ ...prev, tax_terms: e.target.value }))} />
            <input className="border rounded px-2 py-1" placeholder="Payment due terms" value={manualForm.payment_terms} onChange={(e) => setManualForm((prev) => ({ ...prev, payment_terms: e.target.value }))} />
            <input className="border rounded px-2 py-1" placeholder="Incoterms / freight terms" value={manualForm.shipping_terms} onChange={(e) => setManualForm((prev) => ({ ...prev, shipping_terms: e.target.value }))} />
            <input className="border rounded px-2 py-1" placeholder="Supplier email" value={manualForm.supplier_contact_email} onChange={(e) => setManualForm((prev) => ({ ...prev, supplier_contact_email: e.target.value }))} />
            {manualForm.source_document_type === 'MANUAL_PO' && (
              <input className="border rounded px-2 py-1" placeholder="Standalone reason / justification" value={manualForm.standalone_reason} onChange={(e) => setManualForm((prev) => ({ ...prev, standalone_reason: e.target.value }))} />
            )}
            <input className="border rounded px-2 py-1 sm:col-span-2" placeholder="PO notes / terms & conditions" value={manualForm.po_notes} onChange={(e) => setManualForm((prev) => ({ ...prev, po_notes: e.target.value }))} />
          </div>
          <div className="rounded border p-3 space-y-2">
            <div className="flex items-center justify-between"><h3 className="font-medium">PO items</h3><span className="text-xs text-gray-600">Total: {formatAmount(manualItemsTotal)}</span></div>
            {manualForm.source_document_type === 'PURCHASE_REQUEST' && <p className="text-xs text-gray-500">Items are auto-filled from the selected purchase request with only quantities not already assigned to another non-cancelled PO. Delete lines that will be procured from a different supplier.</p>}
            {manualItems.map((item, index) => (
              <div key={index} className="grid sm:grid-cols-6 gap-2">
                <input className="border rounded px-2 py-1 sm:col-span-2" placeholder="Item description" value={item.item_name} onChange={(e) => setManualItems((prev) => prev.map((row, i) => (i === index ? { ...row, item_name: e.target.value } : row)))} />
                <input className="border rounded px-2 py-1" placeholder="Qty" type="number" min="0" value={item.quantity} onChange={(e) => setManualItems((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: e.target.value } : row)))} />
                <input className="border rounded px-2 py-1" placeholder="UOM" value={item.uom} onChange={(e) => setManualItems((prev) => prev.map((row, i) => (i === index ? { ...row, uom: e.target.value } : row)))} />
                <input className="border rounded px-2 py-1" placeholder="Unit price" type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => setManualItems((prev) => prev.map((row, i) => (i === index ? { ...row, unit_price: e.target.value } : row)))} />
                <button type="button" className="rounded border border-red-300 px-2 py-1 text-sm text-red-700" onClick={() => setManualItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [EMPTY_MANUAL_ITEM]))}>Delete</button>
              </div>
            ))}
            <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => setManualItems((prev) => [...prev, EMPTY_MANUAL_ITEM])}>Add item</button>
          </div>
          <button
            className="bg-emerald-600 text-white rounded px-3 py-1 disabled:bg-gray-300"
            disabled={!manualForm.supplier_name.trim()}
            onClick={async () => {
              const missing = validateForm(manualForm, { requireSupplier: true, requireStandaloneReason: manualForm.source_document_type === 'MANUAL_PO' });
              if (normalizedManualItems.length === 0) missing.push('at least one PO item');
              if (missing.length > 0) {
                setError(`Complete the following fields before creating the PO: ${missing.join(', ')}.`);
                return;
              }
              const requestIdForPo = manualForm.source_document_type === 'PURCHASE_REQUEST' ? Number(selectedRequestId) : null;
              const created = await handleMutation(() => createPurchaseOrder(requestIdForPo, {
                ...manualForm,
                budget_cost_center: billingEntity,
                terms: [manualForm.terms, manualForm.shipping_terms && `Freight: ${manualForm.shipping_terms}`, manualForm.standalone_reason && `Justification: ${manualForm.standalone_reason}`, manualForm.po_notes && `Notes: ${manualForm.po_notes}`].filter(Boolean).join('\n'),
                awards: awardItemsForPo.map((item) => ({ award_id: item.award_id, quantity: item.quantity })),
              }), 'Purchase order created.');
              if (created) resetCreateWorkspace();
            }}
          >
            Create PO
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-900">Order register</h2>
          <p className="mt-1 text-sm text-slate-500">{pagination.total} purchase order{pagination.total === 1 ? '' : 's'} match the current view.</p>
        </div>
        <div className="p-3">
        <div className="mb-3 flex flex-wrap gap-2 border-b pb-2">
          {WORKSPACE_TABS.map((tab) => (
            <button key={tab} type="button" className={`rounded px-3 py-1 text-sm ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>
        <p className="mb-3 text-xs text-gray-600">{activeTab === 'Overview' ? 'Open PO list, search/filter, source links, approval, receiving, invoice, communication, and manual close controls.' : `${activeTab} workspace foundation is ready for linked PO records and future detail panels.`}</p>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="p-2 text-left">PO Number</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">Business Status</th><th className="p-2 text-left">System Code</th><th className="p-2 text-left">Source</th><th className="p-2 text-left">Delivery / Budget</th><th className="p-2 text-left">Date</th><th className="p-2 text-right">Total</th><th className="p-2 text-left">Items</th><th className="p-2 text-left">Actions</th></tr></thead>
          <tbody>
            {!loading && rows.map((po) => (
              <tr key={po.id} className="border-t align-top transition hover:bg-slate-50/80">
                <td className="p-2"><span className="font-semibold text-slate-900">{po.po_number}</span></td>
                <td className="p-2">
                  <div>{po.supplier_name || '-'}</div>
                  <div className="text-xs text-gray-500">{po.contract_reference || 'No contract ref'}</div>
                </td>
                <td className="p-2"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[po.status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>{STATUS_LABELS[po.status] || po.business_status || '-'}</span></td>
                <td className="p-2 font-mono text-xs text-slate-500">{po.system_status_code || po.status}</td>
                <td className="p-2 text-xs"><div>{po.source_document_type || (po.request_id ? 'PURCHASE_REQUEST' : 'MANUAL_PO')}</div><div>{po.request_id ? `PR #${po.request_id}` : po.source_document_id || '-'}</div></td>
                <td className="p-2 text-xs text-gray-700">
                  <div>{po.delivery_location || '-'}</div>
                  <div>{po.budget_cost_center || '-'}</div>
                </td>
                <td className="p-2">{new Date(po.created_at).toLocaleDateString()}</td>
                <td className="p-2 text-right">{formatAmount(po.total_amount)}</td>
                <td className="p-2 min-w-[240px]">
                  {Array.isArray(po.items) && po.items.length > 0 ? (
                    <ul className="space-y-1">
                      {po.items.map((item) => (
                        <li key={item.id} className="text-xs text-gray-700">
                          {item.item_name} · Ordered {item.quantity} · Received {item.received_quantity || 0} · Remaining {Math.max(Number(item.quantity || 0) - Number(item.received_quantity || 0), 0)} · {formatAmount(item.unit_price)} = <span className="font-medium">{formatAmount(item.line_total)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-gray-500">No items</span>
                  )}
                </td>
                <td className="p-2 min-w-[240px]">{renderRowActions(po)}</td>
              </tr>
            ))}
            {loading && Array.from({ length: 4 }).map((_, index) => <tr key={`loading-${index}`} className="border-t"><td colSpan="10" className="p-3"><div className="h-10 animate-pulse rounded-lg bg-slate-100" /></td></tr>)}
            {!loading && rows.length === 0 && <tr><td colSpan="10" className="px-6 py-16 text-center"><ShoppingCart className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">No purchase orders found</p><p className="mt-1 text-sm text-slate-500">Adjust the filters or create an order from an approved supplier award.</p></td></tr>}
          </tbody>
        </table>
        </div>
        </div>
      </section>

      <div className="flex flex-col items-center justify-between gap-3 text-sm md:flex-row">
        <span>Total: {pagination.total}</span>
        <PaginationControls
          currentPage={pagination.page}
          totalPages={Math.ceil(pagination.total / pagination.page_size)}
          onPageChange={load}
          summary={`Page ${pagination.page} of ${Math.ceil(pagination.total / pagination.page_size)}`}
        />
      </div>
    </main>
  );
};

export default ProcureToPayPurchaseOrdersPage;