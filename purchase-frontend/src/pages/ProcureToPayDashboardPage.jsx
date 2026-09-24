import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  PackageCheck,
  RefreshCw,
  SearchCheck,
  WalletCards,
} from 'lucide-react';
import { getProcureToPayDashboard } from '../api/procureToPay';

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const workflowStages = [
  { label: 'Source to order', description: 'Approved demand ready to convert', field: 'approved_requests_awaiting_po', to: '/procure-to-pay/purchase-orders', icon: ClipboardList, tone: 'indigo' },
  { label: 'Receive', description: 'Purchase orders awaiting goods', field: 'pos_awaiting_receipt', to: '/procure-to-pay/receipts', icon: PackageCheck, tone: 'blue' },
  { label: 'Invoice', description: 'Invoices ready for validation', field: 'invoices_pending_match', to: '/procure-to-pay/invoices', icon: FileText, tone: 'violet' },
  { label: 'Match', description: 'Exceptions needing resolution', field: 'invoices_in_exception', to: '/procure-to-pay/matching', icon: SearchCheck, tone: 'amber' },
  { label: 'Pay', description: 'Open items due today', field: 'open_payables_due_today', to: '/procure-to-pay/accounts-payable', icon: WalletCards, tone: 'emerald' },
];

const toneClasses = {
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
};

const MetricSkeleton = () => (
  <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
    <div className="mb-6 h-10 w-10 rounded-xl bg-slate-100" />
    <div className="h-3 w-2/3 rounded bg-slate-100" />
    <div className="mt-3 h-8 w-1/3 rounded bg-slate-200" />
  </div>
);

const ProcureToPayDashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getProcureToPayDashboard();
      setData(response?.data || {});
      setLastUpdated(new Date());
    } catch (_error) {
      setError('We could not load the latest procure-to-pay activity. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const attentionCount = useMemo(() => (
    Number(data?.invoices_in_exception || 0) + Number(data?.overdue_payables || 0)
  ), [data]);

  const formatValue = (value) => value == null ? '—' : numberFormatter.format(Number(value));

  return (
    <main className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl sm:px-8 sm:py-9">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-28 w-72 bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
              <FileCheck2 size={16} /> Operations command center
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Procure-to-Pay</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Monitor every handoff from approved demand through receipt, invoice matching, and payment.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right text-xs text-slate-400" aria-live="polite">
              <span className="block font-medium text-slate-200">Live operational snapshot</span>
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Connecting…'}
            </div>
            <button type="button" onClick={loadDashboard} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-60">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><AlertTriangle size={20} /><span>{error}</span></div>
          <button type="button" onClick={loadDashboard} className="self-start rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white sm:self-auto">Try again</button>
        </div>
      )}

      <section aria-labelledby="flow-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><h2 id="flow-heading" className="text-xl font-bold text-slate-900">Workflow pulse</h2><p className="mt-1 text-sm text-slate-500">Open workload at each stage of the buying cycle</p></div>
          <Link to="/procure-to-pay/lifecycle" className="hidden items-center gap-1 text-sm font-semibold text-violet-700 hover:text-violet-900 sm:inline-flex">Explore lifecycle <ArrowRight size={16} /></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {loading && !data ? Array.from({ length: 5 }, (_, index) => <MetricSkeleton key={index} />) : workflowStages.map(({ label, description, field, to, icon: Icon, tone }) => (
            <Link key={field} to={to} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500">
              <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${toneClasses[tone]}`}><Icon size={21} /></div>
              <p className="text-sm font-semibold text-slate-600">{label}</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{formatValue(data?.[field])}</p>
              <p className="mt-2 min-h-[40px] text-xs leading-5 text-slate-500">{description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-violet-700">View queue <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2" aria-labelledby="attention-heading">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id="attention-heading" className="text-lg font-bold text-slate-900">Needs attention</h2><p className="mt-1 text-sm text-slate-500">Prioritize exceptions that can delay settlement</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${attentionCount ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{loading ? 'Checking' : `${attentionCount} open`}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link to="/procure-to-pay/matching" className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">
              <div className="flex items-center gap-3"><span className="rounded-lg bg-amber-50 p-2 text-amber-700"><AlertTriangle size={19} /></span><div><p className="font-semibold text-slate-800">Match exceptions</p><p className="text-xs text-slate-500">Review invoice variances</p></div></div>
              <span className="text-xl font-bold text-slate-900">{formatValue(data?.invoices_in_exception)}</span>
            </Link>
            <Link to="/procure-to-pay/accounts-payable" className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">
              <div className="flex items-center gap-3"><span className="rounded-lg bg-red-50 p-2 text-red-700"><WalletCards size={19} /></span><div><p className="font-semibold text-slate-800">Overdue payables</p><p className="text-xs text-slate-500">Past their payment date</p></div></div>
              <span className="text-xl font-bold text-slate-900">{formatValue(data?.overdue_payables)}</span>
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-950 p-6 text-white shadow-sm" aria-labelledby="payments-heading">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300"><CheckCircle2 size={21} /></div>
          <h2 id="payments-heading" className="mt-5 text-sm font-semibold text-emerald-100">Payments posted this week</h2>
          <p className="mt-1 text-3xl font-bold tracking-tight">{formatValue(data?.payments_posted_this_week)}</p>
          <Link to="/procure-to-pay/payments" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-emerald-300 hover:text-white">View payment register <ArrowRight size={15} /></Link>
        </section>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-bold text-slate-900">Trace a transaction end to end</h2><p className="mt-1 text-sm text-slate-500">Connect requests, orders, receipts, invoices, and payments in one view.</p></div>
        <Link to="/procure-to-pay/document-flow" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700">Open document flow <ArrowRight size={16} /></Link>
      </section>
    </main>
  );
};

export default ProcureToPayDashboardPage;