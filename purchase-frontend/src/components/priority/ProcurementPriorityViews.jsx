import React from 'react';
import PriorityTierBadge from './PriorityTierBadge';

export function CurrentProcurementPriorities({ entries = [], onViewAll }) {
  return <section aria-labelledby="current-priorities-title" className="rounded-xl border bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between"><h2 id="current-priorities-title" className="font-semibold">Current Procurement Priorities</h2>
      {onViewAll && <button onClick={onViewAll} className="text-sm text-blue-700">View institutional queue</button>}</div>
    <ol className="mt-3 space-y-2">{entries.map(entry => <li key={entry.id} className="flex justify-between gap-3">
      <span>{entry.institutionalRank}. {entry.publicTitle}</span><PriorityTierBadge tier={entry.tier} />
    </li>)}</ol>
  </section>;
}

export function FactorBreakdown({ breakdown, score, tier }) {
  return <dl aria-label="Priority factor breakdown" className="grid grid-cols-2 gap-2 text-sm">
    {Object.entries(breakdown || {}).map(([label, value]) => <React.Fragment key={label}><dt>{label}</dt><dd className="text-right">{value}</dd></React.Fragment>)}
    <dt className="font-semibold">Total</dt><dd className="text-right font-semibold">{score} <PriorityTierBadge tier={tier} /></dd>
  </dl>;
}

export function DepartmentPriorityQueue({ entries = [], canRank, onMove }) {
  return <section><h1 className="text-xl font-semibold">Department Priority Queue</h1>
    <p className="text-sm text-slate-600">Rank active requirements relative to other work in your department.</p>
    <ol>{entries.map((entry, index) => <li key={entry.id} className="my-2 flex items-center gap-2 rounded border p-3">
      <strong>{index + 1}</strong><span className="grow">{entry.requestNumber} · {entry.safeTitle} · {entry.stage}</span><PriorityTierBadge tier={entry.tier} />
      {canRank && <><button aria-label={`Move ${entry.safeTitle} up`} disabled={!index} onClick={() => onMove(entry.id, index - 1)}>↑</button>
        <button aria-label={`Move ${entry.safeTitle} down`} disabled={index === entries.length - 1} onClick={() => onMove(entry.id, index + 1)}>↓</button></>}
    </li>)}</ol>
  </section>;
}

export function ScmPriorityManagement({ profile, canManage, onOverride }) {
  const [reason, setReason] = React.useState('');
  return <section><h1 className="text-xl font-semibold">SCM Priority Management</h1>
    <p>System suggested rank: {profile.systemSuggestedRank} · Institutional rank: {profile.institutionalRank}</p>
    <FactorBreakdown breakdown={profile.breakdown} score={profile.score} tier={profile.tier} />
    {canManage && <form onSubmit={event => { event.preventDefault(); if (reason.trim()) onOverride(reason.trim()); }}>
      <label className="block">Override reason<input aria-label="Override reason" required value={reason} onChange={e => setReason(e.target.value)} className="ml-2 border" /></label>
      <button disabled={!reason.trim()} className="mt-2 rounded bg-blue-700 px-3 py-2 text-white">Apply institutional rank override</button>
    </form>}
  </section>;
}