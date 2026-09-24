import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import { ArrowRight, Clock3, GitCommitHorizontal, RefreshCw, Route, TimerReset } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import AnalyticsPageHeader from '../components/analytics/AnalyticsPageHeader';
import { AnalyticsError, AnalyticsLoading, EmptyChart } from '../components/analytics/AnalyticsStates';

const formatDays = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}d` : 'N/A';
const compact = value => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));

const KpiCard = ({ title, value, helper, icon: Icon, tone = 'blue' }) => {
  const tones = { blue: 'bg-blue-50 text-blue-700', violet: 'bg-violet-50 text-violet-700', emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700' };
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`inline-flex rounded-xl p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></span><p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p><p className="mt-1 text-3xl font-bold text-slate-950">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p></article>;
};

const LifecycleAnalytics = () => {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [refreshKey, setRefreshKey] = useState(0);
  const fetchData = useCallback(async () => { void refreshKey; setLoading(true); setError(''); try { const res = await axios.get('/dashboard/lifecycle'); setData(res.data); } catch (err) { console.error('❌ Failed to load lifecycle analytics:', err); setError('Lifecycle data is currently unavailable.'); } finally { setLoading(false); } }, [refreshKey]);
  useEffect(() => { fetchData(); }, [fetchData]);
  const stages = useMemo(() => (data?.stage_durations || []).map(x => ({ ...x, avg_days: Number(x.avg_days || 0), label: `Level ${x.stage}` })), [data]);
  const categories = useMemo(() => (data?.spend_by_category || []).map(x => ({ ...x, total_cost: Number(x.total_cost || 0) })).sort((a,b)=>b.total_cost-a.total_cost).slice(0,8), [data]);
  const bottleneck = data?.bottleneck_stage;
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <AnalyticsPageHeader eyebrow="Process intelligence" title="Lifecycle Analytics" description="Trace procurement velocity from request creation through final approval and the first governed purchase order." icon={Route} meta={["PR → approval", "PR → purchase order", "Stage-level bottlenecks"]} actions={<button type="button" onClick={()=>setRefreshKey(x=>x+1)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-blue-50"><RefreshCw className="h-4 w-4"/> Refresh</button>}/>
    {error ? <AnalyticsError message={error} onRetry={()=>setRefreshKey(x=>x+1)}/> : loading ? <AnalyticsLoading label="Tracing lifecycle performance…"/> : <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Lifecycle key performance indicators">
        <KpiCard title="PR to final approval" value={formatDays(data?.avg_pr_to_final_approval_days ?? data?.avg_approval_time_days)} helper="Request created to final approval timestamp" icon={Clock3}/>
        <KpiCard title="Average approval time" value={formatDays(data?.avg_approval_time_days)} helper="Comparable approval KPI for existing reports" icon={TimerReset} tone="violet"/>
        <KpiCard title="PR to purchase order" value={formatDays(data?.avg_pr_to_po_cycle_days)} helper="Request created to first governed PO" icon={ArrowRight} tone="emerald"/>
        <KpiCard title="Bottleneck stage" value={bottleneck ? `Level ${bottleneck.stage}` : 'N/A'} helper={bottleneck ? `${formatDays(bottleneck.avg_days)} average duration` : 'No stage timing is available'} icon={GitCommitHorizontal} tone="amber"/>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Stage duration</h2><p className="mb-5 text-sm text-slate-500">Average elapsed days at each approval level.</p>{stages.length ? <ResponsiveContainer width="100%" height={320}><BarChart data={stages} margin={{left:0,right:8}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/><XAxis dataKey="label" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} unit="d"/><Tooltip formatter={value=>[formatDays(value),'Average duration']}/><Bar dataKey="avg_days" fill="#7c3aed" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer> : <EmptyChart label="No stage timing data"/>}</article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Spend by category</h2><p className="mb-5 text-sm text-slate-500">Largest categories by recorded procurement value.</p>{categories.length ? <ResponsiveContainer width="100%" height={320}><BarChart data={categories} layout="vertical" margin={{left:10,right:28}}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/><XAxis type="number" axisLine={false} tickLine={false} tickFormatter={compact}/><YAxis type="category" dataKey="category" width={110} axisLine={false} tickLine={false}/><Tooltip formatter={value=>[Number(value).toLocaleString(),'Total spend']}/><Bar dataKey="total_cost" fill="#059669" radius={[0,7,7,0]}/></BarChart></ResponsiveContainer> : <EmptyChart label="No category spend data"/>}</article>
      </section>
      <aside className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><Clock3 className="mt-0.5 h-5 w-5 shrink-0"/><p><strong>How timing works:</strong> PR-to-PO updates when the first governed purchase order is created. Stages without authoritative timestamps are excluded rather than treated as zero.</p></aside>
    </>}
  </main>;
};
export default LifecycleAnalytics;