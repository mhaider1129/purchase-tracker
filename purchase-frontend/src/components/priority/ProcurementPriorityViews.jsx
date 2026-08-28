import React from 'react';
import PriorityTierBadge from './PriorityTierBadge';

const FACTORS = [
  ['Clinical / Operational Impact', 'impact', 25], ['SCM Assessment', 'scm_assessment', 20],
  ['Department Rank', 'department_rank', 15], ['Aging', 'aging', 10],
  ['Service Risk', 'service_risk', 10], ['Deadline', 'deadline', 8],
  ['Dependency', 'dependency', 5], ['Regulatory', 'regulatory', 4], ['Strategic', 'strategic', 3],
];
const valueFor = (breakdown, label, key) => breakdown?.[key] ?? breakdown?.[label] ?? breakdown?.[`${key}_score`] ?? null;

export function CurrentProcurementPriorities({ entries = [], status = 'ready' }) {
  return <section aria-labelledby="current-priorities-title" className="rounded-xl border bg-white p-4 shadow-sm">
    <h2 id="current-priorities-title" className="text-lg font-semibold">Current Procurement Priorities</h2>
    {status === 'loading' && <p className="mt-3 text-slate-600">Loading procurement priorities…</p>}
    {status === 'unavailable' && <p className="mt-3 text-slate-600">Procurement Priority is not configured yet.</p>}
    {status === 'error' && <p role="alert" className="mt-3 text-red-700">Unable to load procurement priorities.</p>}
    {status === 'ready' && !entries.length && <p className="mt-3 text-slate-600">No active procurement priorities.</p>}
    {status === 'ready' && entries.length > 0 && <ol className="mt-3 divide-y">{entries.slice(0, 5).map((entry, index) => <li key={`${entry.is_group ? 'group' : 'case'}-${entry.id || index}`} className="flex items-center gap-3 py-3">
      <strong className="w-8 text-slate-500">#{entry.institutional_rank ?? entry.institutionalRank}</strong>
      <span className="min-w-0 grow"><span className="block truncate font-medium">{entry.public_title || entry.publicTitle}</span><span className="text-xs text-slate-500">{entry.age != null ? `${entry.age} days · ` : ''}{entry.case_status || entry.status || ''}</span></span>
      <PriorityTierBadge tier={entry.tier} />
    </li>)}</ol>}
    <a href="/procurement-priorities" className="mt-3 inline-block font-medium text-blue-700">View All Priorities</a>
  </section>;
}

export function PriorityFactorBreakdown({ breakdown, score, tier }) {
  return <div><dl aria-label="Priority factor breakdown" className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-2 text-sm">
    {FACTORS.map(([label, key, maximum]) => { const value=valueFor(breakdown,label,key); return <React.Fragment key={key}><dt>{label}</dt><dd className="text-right tabular-nums">{value == null ? 'Not assessed' : `${value} / ${maximum}`}</dd></React.Fragment>; })}
    <dt className="border-t pt-2 font-bold">Total</dt><dd className="border-t pt-2 text-right font-bold tabular-nums">{score == null ? 'Not assessed' : `${score} / 100`}</dd>
  </dl><div className="mt-3 flex items-center gap-2 font-semibold">Tier <PriorityTierBadge tier={tier} /></div></div>;
}
export const FactorBreakdown = PriorityFactorBreakdown;

export function DepartmentPriorityQueue({ entries = [], canRank, onMove, onDragMove }) {
  return <section><h1 className="text-2xl font-bold">Department Priorities</h1>
    <p className="text-sm text-slate-600">Rank active requirements relative to other work in your department.</p>
    <div className="mt-4 overflow-x-auto"><table className="min-w-full border-separate border-spacing-y-2"><thead><tr className="text-left text-xs uppercase text-slate-500"><th>Department Rank</th><th>Request reference</th><th>Requirement</th><th>Age</th><th>Status</th><th>Institutional Tier</th>{canRank && <th>Order</th>}</tr></thead>
      <tbody>{entries.map((entry, index) => <tr key={entry.id} draggable={canRank} onDragStart={e=>e.dataTransfer.setData('text/plain', String(entry.id))} onDragOver={e=>canRank&&e.preventDefault()} onDrop={e=>{e.preventDefault();onDragMove?.(e.dataTransfer.getData('text/plain'),index)}} className="rounded border bg-white shadow-sm">
        <td className="p-3 font-bold">{index + 1}</td><td className="p-3">{entry.requestNumber}</td><td className="p-3">{entry.safeTitle}</td><td className="p-3">{entry.age == null ? '—' : `${entry.age} days`}</td><td className="p-3">{entry.stage}</td><td className="p-3"><PriorityTierBadge tier={entry.tier} /></td>
        {canRank && <td className="p-3 whitespace-nowrap"><button type="button" aria-label={`Move ${entry.safeTitle} up`} disabled={!index} onClick={() => onMove(entry.id, index - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Up</button> <button type="button" aria-label={`Move ${entry.safeTitle} down`} disabled={index === entries.length - 1} onClick={() => onMove(entry.id, index + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Down</button></td>}
      </tr>)}</tbody></table></div>
  </section>;
}

export function PriorityHistory({ entries = [] }) {
  return <section aria-labelledby="priority-history"><h3 id="priority-history" className="text-lg font-semibold">Priority History</h3>{!entries.length ? <p className="text-sm text-slate-500">No priority history available.</p> : <ol className="mt-2 space-y-3">{entries.map((item,index)=><li key={item.id||index} className="border-l-2 pl-3 text-sm"><time className="font-medium">{new Date(item.calculated_at || item.created_at).toLocaleString()}</time><p>{item.system_score ?? item.score ?? '—'} → {item.system_tier || item.tier || '—'} · Institutional rank {item.institutional_rank ?? '—'}</p><p className="text-slate-600">{item.trigger || item.trigger_type || item.reason || 'Priority recalculated'}{item.actor_name ? ` · ${item.actor_name}` : ''}</p></li>)}</ol>}</section>;
}

export function ScmPriorityManagement({ profile, canManage, onOverride }) {
  const [reason,setReason]=React.useState('');
  return <section><h1 className="text-xl font-semibold">SCM Priority Management</h1><p>System suggested rank: {profile.systemSuggestedRank} · Institutional rank: {profile.institutionalRank}</p><PriorityFactorBreakdown breakdown={profile.breakdown} score={profile.score} tier={profile.tier}/>{canManage&&<form onSubmit={e=>{e.preventDefault();if(reason.trim())onOverride(reason.trim())}}><label>Override reason<input aria-label="Override reason" required className="ml-2 border" value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={!reason.trim()}>Apply institutional rank override</button></form>}</section>;
}