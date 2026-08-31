import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { searchGenericItems } from '../api/itemMaster';
import { listMappings, mappingAction, mappingCoverage, proposeMapping } from '../api/stockItemMappings';
import { useAuth } from '../hooks/useAuth';
import { hasAnyPermission } from '../utils/permissions';

const FILTERS = ['category', 'subcategory', 'uom', 'manufacturer', 'mapping_status', 'identity_source', 'confidence_min', 'confidence_max', 'import_batch', 'parser_version', 'positive_stock_balance', 'transaction_history'];

export function isBulkApprovalSafe(rows, user) {
  return rows.length > 0
    && hasAnyPermission(user, ['item-master.stock-map.bulk'])
    && new Set(rows.map(row => `${row.generic_item_id}:${row.approved_product_id || ''}`)).size === 1
    && rows.every(row => !(row.hard_exclusions || []).length && !row.required_attributes_unresolved && !row.stale)
    && new Set(rows.map(row => row.parser_version)).size === 1;
}

function MappingDialog({ row, onClose, onMapped }) {
  const [query, setQuery] = useState(row.stock_item_name || '');
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('Manual mapping by steward');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const result = await searchGenericItems({ q: query.trim(), status: 'active', page_size: 10 });
        if (active) setOptions(result.data || []);
      } catch (_error) {
        if (active) setError('Unable to search Item Master. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  const submit = async event => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await proposeMapping({ stock_item_id: row.stock_item_id, generic_item_id: selected.id, reason: reason.trim() });
      await onMapped();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create the mapping proposal.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="mapping-dialog-title" className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="mapping-dialog-title" className="text-xl font-semibold">Map stock item</h2>
            <p className="mt-1 text-sm text-slate-600"><strong>{row.stock_item_name}</strong> · Stock item #{row.stock_item_id}</p>
          </div>
          <button type="button" aria-label="Close mapping dialog" className="rounded px-2 text-2xl text-slate-500 hover:bg-slate-100" onClick={onClose}>×</button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">
            Find the matching Generic Item
            <input autoFocus className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" value={query} onChange={event => { setQuery(event.target.value); setSelected(null); }} placeholder="Search by item code, name or description" />
          </label>
          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200" aria-label="Generic Item search results">
            {loading && <p className="p-3 text-sm text-slate-500">Searching Item Master…</p>}
            {!loading && options.length === 0 && <p className="p-3 text-sm text-slate-500">No active Generic Items found. Try a shorter search.</p>}
            {!loading && options.map(item => (
              <button key={item.id} type="button" className={`block w-full border-b p-3 text-left last:border-b-0 hover:bg-blue-50 ${selected?.id === item.id ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : ''}`} onClick={() => setSelected(item)}>
                <span className="font-mono text-xs text-blue-700">{item.item_code}</span> <strong>{item.generic_name}</strong>
                <span className="block text-xs text-slate-600">{item.canonical_description}</span>
                <span className="block text-xs text-slate-500">{[item.category, item.inventory_uom].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Mapping note
            <textarea className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" rows="2" value={reason} onChange={event => setReason(event.target.value)} />
          </label>
          {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <p className="text-xs text-slate-500">This creates a proposal. Review and approve it from the Actions column to apply the mapping.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-lg border px-4 py-2" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={!selected || saving} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">{saving ? 'Creating…' : 'Create mapping proposal'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function StockItemMappingWorkspace() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({});
  const [rows, setRows] = useState([]);
  const [coverage, setCoverage] = useState({});
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);
  const [mappingRow, setMappingRow] = useState(null);
  const canOverride = hasAnyPermission(user, ['item-master.stock-map.override']);
  const load = useCallback(async () => {
    try {
      setError('');
      const [data, counts] = await Promise.all([listMappings(filters), mappingCoverage()]);
      setRows(data.data || []);
      setCoverage(counts);
    } catch (requestError) {
      setError(requestError.response?.data?.code === 'database_capability_unavailable' ? 'Mapping capability is not available in this environment.' : 'Unable to load mapping workspace.');
    }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  const bulkSafe = useMemo(() => isBulkApprovalSafe(rows.filter(row => selected.includes(row.id)), user), [rows, selected, user]);
  const act = async (row, action) => {
    await mappingAction(row.id, action, { stock_item_id: row.stock_item_id, expected_version: row.version, reason: `Steward ${action}` });
    load();
  };
  const mapped = async () => { setMappingRow(null); await load(); };

  return <main className="p-6 space-y-5">
    <header><h1 className="text-2xl font-bold">Stock Item Mapping Steward Workspace</h1><p className="text-sm text-gray-600">Coverage, queue, candidates, import provenance and immutable mapping history.</p></header>
    {error && <div role="alert" className="rounded bg-amber-100 p-3">{error}</div>}
    <section className="grid grid-cols-3 gap-3">{['total', 'mapped', 'unmapped'].map(key => <div key={key} className="rounded border p-3"><b>{key.replace('_', ' ')}</b><div>{coverage[key] ?? '—'}</div></div>)}</section>
    <section className="grid grid-cols-2 md:grid-cols-4 gap-2">{FILTERS.map(name => <label key={name} className="text-xs">{name.replaceAll('_', ' ')}<input className="w-full border rounded p-1" value={filters[name] || ''} onChange={event => setFilters(value => ({ ...value, [name]: event.target.value, page: 1 }))} /></label>)}</section>
    <div className="flex gap-2"><button disabled={!bulkSafe} className="border rounded px-3 py-1 disabled:opacity-40">Bulk approve</button><span className="text-xs text-gray-500">Bulk approval requires one safe target, one parser template, resolved attributes, fresh versions and bulk permission.</span></div>
    <div className="overflow-auto"><table className="min-w-full text-sm"><thead><tr>{['', 'Stock item', 'Source attributes', 'Target attributes', 'Status', 'Confidence', 'Parser', 'Actions'].map(label => <th className="border p-2" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id ? `mapping-${row.id}` : `stock-${row.stock_item_id}`}><td className="border p-2">{row.id && <input type="checkbox" aria-label={`Select mapping ${row.id}`} checked={selected.includes(row.id)} onChange={() => setSelected(value => value.includes(row.id) ? value.filter(id => id !== row.id) : [...value, row.id])} />}</td><td className="border p-2"><div className="font-medium">{row.stock_item_name || `Stock item #${row.stock_item_id}`}</div><div className="text-xs text-gray-500">#{row.stock_item_id}</div></td><td className="border p-2"><pre>{JSON.stringify(row.source_attributes || {}, null, 1)}</pre></td><td className="border p-2"><pre>{JSON.stringify(row.target_attributes || { generic_item_id: row.generic_item_id, approved_product_id: row.approved_product_id }, null, 1)}</pre></td><td className="border p-2">{row.mapping_status}</td><td className="border p-2">{row.confidence ?? '—'}</td><td className="border p-2">{row.parser_version || '—'}</td><td className="border p-2 space-x-1">{!row.id ? <button type="button" className="rounded bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700" onClick={() => setMappingRow(row)}>Map item</button> : <>{row.mapping_status === 'proposed' && <button onClick={() => act(row, 'review')}>Review</button>}{row.mapping_status === 'review_required' && <><button onClick={() => act(row, 'approve')}>Approve</button><button onClick={() => act(row, 'reject')}>Reject</button></>}<button onClick={() => act(row, 'mark-duplicate')}>Duplicate</button><button onClick={() => act(row, 'mark-obsolete')}>Obsolete</button><button onClick={() => act(row, 'exclude')}>Exclude</button>{canOverride && row.mapping_status === 'approved' && <span> Supersede / Rollback available in detail</span>}</>}</td></tr>)}</tbody></table></div>
    <section><h2 className="font-semibold">Import batches, invalid rows, candidate comparison and audit history</h2><p className="text-sm text-gray-600">Select a mapping or import batch to inspect source fragments, hard conflicts, prior decisions and audit events.</p></section>
    {mappingRow && <MappingDialog row={mappingRow} onClose={() => setMappingRow(null)} onMapped={mapped} />}
  </main>;
}