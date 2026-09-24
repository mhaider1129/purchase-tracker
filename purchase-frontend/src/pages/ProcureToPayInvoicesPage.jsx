import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AmountInput from '../components/ui/AmountInput';
import { listApInvoices, submitInvoice } from '../api/procureToPay';
import { createSupplier } from '../api/suppliers';
import { useSuppliers } from '../hooks/useSuppliers';

const EMPTY_SUPPLIER_FORM = { name: '', contact_email: '', contact_phone: '' };
const EMPTY_FILTERS = { search: '', supplier: '', status: 'ALL', date_from: '', date_to: '' };
const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'MATCH_PENDING', label: 'Match pending' },
  { value: 'MATCH_EXCEPTION', label: 'Exception' },
  { value: 'MATCH_VERIFIED', label: 'Matched' },
];

const STATUS_STYLES = {
  MATCH_VERIFIED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  MATCH_EXCEPTION: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  MATCH_PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  SUBMITTED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
};

const prettyStatus = (status) => String(status || 'SUBMITTED').replace(/^AP_INVOICE_/, '').replaceAll('_', ' ');
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};
const formatMoney = (value, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(Number(value) || 0);
  } catch (_error) {
    return `${currency || ''} ${(Number(value) || 0).toFixed(2)}`.trim();
  }
};

const ProcureToPayInvoicesPage = () => {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, page_size: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    request_id: '', supplier_id: '', supplier: '', invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10), subtotal_amount: '',
  });
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [error, setError] = useState('');

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listApInvoices({
        search: appliedFilters.search || undefined,
        supplier: appliedFilters.supplier || undefined,
        status: appliedFilters.status === 'ALL' ? undefined : appliedFilters.status,
        date_from: appliedFilters.date_from || undefined,
        date_to: appliedFilters.date_to || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setRows(res?.data || []);
      setPagination(res?.pagination || { total: res?.data?.length || 0, page, page_size: PAGE_SIZE });
    } catch (err) {
      setError(err?.response?.data?.message || 'We could not load the invoice register. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  const { suppliers, reloadSuppliers, suppliersError } = useSuppliers();
  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const selectedSupplier = suppliers.find((entry) => Number(entry.id) === Number(form.supplier_id));
  const totalPages = Math.max(Math.ceil(Number(pagination.total || 0) / PAGE_SIZE), 1);
  const summary = useMemo(() => ({
    total: pagination.total || rows.length,
    pending: rows.filter((row) => ['SUBMITTED', 'MATCH_PENDING'].includes(row.status)).length,
    exceptions: rows.filter((row) => row.status === 'MATCH_EXCEPTION').length,
    matched: rows.filter((row) => row.status === 'MATCH_VERIFIED').length,
  }), [pagination.total, rows]);

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const onCreateInvoice = async (event) => {
    event.preventDefault();
    if (!form.request_id || !form.supplier_id || !form.invoice_number.trim() || !form.subtotal_amount) {
      setError('Request, supplier, invoice number, and amount are required.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await submitInvoice(Number(form.request_id), {
        supplier_id: Number(form.supplier_id), supplier: selectedSupplier?.name || form.supplier,
        invoice_number: form.invoice_number.trim(), invoice_date: form.invoice_date,
        subtotal_amount: Number(form.subtotal_amount), total_amount: Number(form.subtotal_amount), items: [],
      });
      setForm((prev) => ({ ...prev, request_id: '', invoice_number: '', subtotal_amount: '' }));
      setShowCreateForm(false);
      setPage(1);
      await loadInvoices();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create invoice.');
    } finally {
      setSaving(false);
    }
  };

  const onCreateSupplier = async () => {
    if (!supplierForm.name.trim()) return;
    try {
      setSaving(true);
      setError('');
      const created = await createSupplier(supplierForm);
      await reloadSuppliers();
      setForm((prev) => ({ ...prev, supplier_id: String(created.id), supplier: created.name }));
      setSupplierForm(EMPTY_SUPPLIER_FORM);
      setShowSupplierForm(false);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create supplier.');
    } finally {
      setSaving(false);
    }
  };

  const cards = [
    { label: 'Total invoices', value: summary.total, icon: FileText, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Awaiting match', value: summary.pending, icon: Clock3, tone: 'bg-amber-50 text-amber-700', note: 'on this page' },
    { label: 'Exceptions', value: summary.exceptions, icon: AlertCircle, tone: 'bg-rose-50 text-rose-700', note: 'need attention' },
    { label: 'Matched', value: summary.matched, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700', note: 'on this page' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-indigo-600">Procure to pay</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">A/P Invoices</h1>
            <p className="mt-1 text-sm text-slate-500">Review supplier invoices, monitor matching, and resolve exceptions.</p>
          </div>
          <button type="button" onClick={() => setShowCreateForm(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
            <Plus size={18} /> New invoice
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon, tone, note }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>{note ? <p className="mt-1 text-xs text-slate-400">{note}</p> : null}</div>
                <span className={`rounded-lg p-2.5 ${tone}`}><Icon size={20} /></span>
              </div>
            </div>
          ))}
        </section>

        {error || suppliersError ? (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 shrink-0" size={18} /><span>{error || suppliersError}</span>
          </div>
        ) : null}

        <form onSubmit={applyFilters} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_180px_160px_160px_auto]">
            <label className="relative"><span className="sr-only">Search invoices</span><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Invoice number or supplier" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} /></label>
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="Supplier" value={filters.supplier} onChange={(e) => setFilters((p) => ({ ...p, supplier: e.target.value }))} />
            <select aria-label="Invoice status" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <input aria-label="From date" title="From date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={filters.date_from} onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value }))} />
            <input aria-label="To date" title="To date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={filters.date_to} onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))} />
            <div className="flex gap-2"><button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"><SlidersHorizontal size={16} /> Apply</button><button type="button" onClick={clearFilters} title="Clear filters" className="rounded-lg border border-slate-300 px-3 text-slate-500 hover:bg-slate-50"><X size={17} /></button></div>
          </div>
        </form>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div><h2 className="font-semibold text-slate-900">Invoice register</h2><p className="text-xs text-slate-500">{pagination.total} invoice{Number(pagination.total) === 1 ? '' : 's'} found</p></div>
            <button type="button" onClick={loadInvoices} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">Invoice</th><th className="px-5 py-3 font-semibold">Supplier</th><th className="px-5 py-3 font-semibold">PO / GRN</th><th className="px-5 py-3 font-semibold">Invoice date</th><th className="px-5 py-3 font-semibold">Due date</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Amount</th><th className="px-5 py-3 text-right font-semibold">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan="8" className="px-5 py-16 text-center text-slate-500"><RefreshCw size={24} className="mx-auto mb-2 animate-spin text-indigo-500" />Loading invoices…</td></tr> : null}
                {!loading && rows.length === 0 ? <tr><td colSpan="8" className="px-5 py-16 text-center"><FileText size={34} className="mx-auto mb-3 text-slate-300" /><p className="font-medium text-slate-700">No invoices found</p><p className="mt-1 text-sm text-slate-400">Try changing the filters or create a new invoice.</p></td></tr> : null}
                {!loading && rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-4"><p className="font-semibold text-slate-900">{row.invoice_number || `Invoice #${row.id}`}</p><p className="mt-0.5 text-xs text-slate-400">Request #{row.request_id || '—'}</p></td>
                    <td className="px-5 py-4 font-medium text-slate-700">{row.supplier || '—'}</td>
                    <td className="px-5 py-4"><p className="text-slate-700">{row.po_number || '—'}</p>{row.receipt_number ? <p className="text-xs text-slate-400">GRN {row.receipt_number}</p> : null}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(row.invoice_date)}</td><td className="px-5 py-4 text-slate-600">{formatDate(row.due_date)}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${STATUS_STYLES[row.status] || 'bg-slate-100 text-slate-700 ring-slate-500/20'}`}>{prettyStatus(row.status).toLowerCase()}</span></td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">{formatMoney(row.total_amount, row.currency)}</td>
                    <td className="px-5 py-4 text-right">{row.request_id ? <Link to={`/requests/${row.request_id}/procure-to-pay`} className="font-semibold text-indigo-600 hover:text-indigo-800">View details</Link> : <span className="text-slate-400">Unavailable</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
            <span>Page {page} of {totalPages}</span><div className="flex gap-2"><button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={17} /></button><button type="button" aria-label="Next page" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={17} /></button></div>
          </div>
        </section>
      </div>

      {showCreateForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreateForm(false); }}>
          <form onSubmit={onCreateInvoice} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div><h2 className="text-xl font-bold text-slate-900">Create A/P invoice</h2><p className="mt-1 text-sm text-slate-500">Record a supplier invoice against a purchase request.</p></div><button type="button" aria-label="Close" onClick={() => setShowCreateForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Request ID <span className="text-rose-500">*</span><input required inputMode="numeric" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" placeholder="e.g. 1042" value={form.request_id} onChange={(e) => setForm((p) => ({ ...p, request_id: e.target.value }))} /></label>
              <label className="text-sm font-medium text-slate-700">Supplier <span className="text-rose-500">*</span><select required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" value={form.supplier_id} onChange={(e) => { const supplierId = e.target.value; const found = suppliers.find((entry) => String(entry.id) === supplierId); setForm((p) => ({ ...p, supplier_id: supplierId, supplier: found?.name || '' })); }}><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Invoice number <span className="text-rose-500">*</span><input required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" placeholder="e.g. INV-2026-0148" value={form.invoice_number} onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))} /></label>
              <label className="text-sm font-medium text-slate-700">Invoice date <span className="text-rose-500">*</span><input required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" type="date" value={form.invoice_date} onChange={(e) => setForm((p) => ({ ...p, invoice_date: e.target.value }))} /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Invoice amount <span className="text-rose-500">*</span><AmountInput required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" placeholder="0.00" value={form.subtotal_amount} onChange={(e) => setForm((p) => ({ ...p, subtotal_amount: e.target.value }))} /></label>
              <div className="sm:col-span-2"><button type="button" onClick={() => setShowSupplierForm((value) => !value)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">{showSupplierForm ? 'Cancel supplier creation' : '+ Supplier not listed? Create one'}</button></div>
              {showSupplierForm ? <div className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 sm:col-span-2"><p className="text-sm font-semibold text-slate-800">Quick-create supplier</p><div className="grid gap-3 sm:grid-cols-3"><input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Supplier name *" value={supplierForm.name} onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))} /><input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="email" placeholder="Email" value={supplierForm.contact_email} onChange={(e) => setSupplierForm((p) => ({ ...p, contact_email: e.target.value }))} /><input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Phone" value={supplierForm.contact_phone} onChange={(e) => setSupplierForm((p) => ({ ...p, contact_phone: e.target.value }))} /></div><button type="button" disabled={!supplierForm.name.trim() || saving} onClick={onCreateSupplier} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Save supplier</button></div> : null}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create invoice'}</button></div>
          </form>
        </div>
      ) : null}
    </div>
  );
};

export default ProcureToPayInvoicesPage;