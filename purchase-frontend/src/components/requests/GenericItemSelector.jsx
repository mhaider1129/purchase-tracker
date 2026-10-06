import React, { useEffect, useState } from 'react';
import { getItemMasterReferences, searchGenericItems } from '../../api/itemMaster';

import { ITEM_TYPES } from '../../constants/itemTypes';

export default function GenericItemSelector({ value, onChange, disabled = false, allowPendingCreation = true }) {
  const [query, setQuery] = useState(value?.item_name || '');
  const [options, setOptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [referenceRevision, setReferenceRevision] = useState(0);

  useEffect(() => {
    if (!allowPendingCreation || value?.request_mode !== 'pending_item_creation') return undefined;
    let active = true;
    setReferenceError('');
    setCategoriesLoading(true);
    getItemMasterReferences()
      .then(result => {
        if (active) setCategories(result.categories || []);
      })
      .catch(() => {
        if (active) { setCategories([]); setReferenceError('Unable to load categories. Check Item Master view access and retry.'); }
      })
      .finally(() => { if (active) setCategoriesLoading(false); });
    return () => { active = false; };
  }, [allowPendingCreation, value?.request_mode, referenceRevision]);

  useEffect(() => {
    if (allowPendingCreation && value?.request_mode === 'pending_item_creation') return undefined;
    let active = true;
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const result = await searchGenericItems({ q: query.trim(), status: 'active', page_size: 10 });
        if (active) setOptions(result.data || []);
      } catch (_error) {
        if (active) {
          setOptions([]);
          setError('Unable to search Item Master. Please try again.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, value?.request_mode, allowPendingCreation]);

  if (allowPendingCreation && value?.request_mode === 'pending_item_creation') {
    return (
      <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
        <div className="flex justify-between">
          <strong className="text-sm text-amber-900">Pending Item Master review</strong>
          <button type="button" className="text-sm underline" disabled={disabled} onClick={() => onChange({ request_mode: 'generic_item', pending_item: null, item_name: '' })}>Search catalog</button>
        </div>
        <input disabled={disabled} aria-label="Proposed item name" className="w-full rounded border p-2" placeholder="Proposed generic name" value={value.pending_item?.proposed_name || ''} onChange={event => onChange({ item_name: event.target.value, pending_item: { ...value.pending_item, proposed_name: event.target.value } })} />
        <div className="grid grid-cols-2 gap-2">
          <select disabled={disabled} aria-label="Pending item type" className="rounded border p-2" value={value.pending_item?.item_type || ''} onChange={event => onChange({ pending_item: { ...value.pending_item, item_type: event.target.value } })}>
            <option value="">Select item type</option>
            {ITEM_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <select disabled={disabled} aria-label="Pending category" className="rounded border p-2" value={value.pending_item?.category || ''} onChange={event => onChange({ pending_item: { ...value.pending_item, category: event.target.value } })}>
            <option value="">Select category</option>
            {categories.map(category => <option key={category.id || category.name} value={category.name}>{category.name}</option>)}
          </select>
        </div>
        {referenceError && <p role="alert" className="text-sm text-red-700">{referenceError} <button type="button" disabled={disabled} className="underline" onClick={() => setReferenceRevision(value => value + 1)}>Retry category loading</button></p>}
        {categoriesLoading && <p role="status" className="text-sm text-slate-600">Loading categories…</p>}
        {!categoriesLoading && !referenceError && !categories.length && <p className="text-sm text-amber-800">No active categories are available. Ask an Item Master reference maintainer to add categories before submitting this referral.</p>}
        <textarea disabled={disabled} aria-label="Pending item justification" className="w-full rounded border p-2" placeholder="Why no catalog item is suitable" value={value.pending_item?.justification || ''} onChange={event => onChange({ restriction_justification: event.target.value, pending_item: { ...value.pending_item, justification: event.target.value } })} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input aria-label="Search active Generic Items" className="w-full rounded border p-2" placeholder="Search active Generic Items by code, name or description" value={query} disabled={disabled} onChange={event => { setQuery(event.target.value); setOptions([]); if (value?.generic_item_id) onChange({ request_mode: 'generic_item', generic_item_id: null, catalog_status: 'pending_mapping', canonical_description_snapshot: null }); }} />
      {loading && <p className="text-xs text-slate-500">Searching Item Master…</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <div className="max-h-52 overflow-auto rounded border bg-white">
        {options.map(item => (
          <button type="button" disabled={disabled} key={item.id} onClick={() => { setQuery(item.generic_name); onChange({ generic_item_id: item.id, item_name: item.generic_name, canonical_description_snapshot: item.canonical_description, unit_of_measure: item.inventory_uom, request_mode: 'generic_item', catalog_status: 'catalogued', pending_item: null }); }} className={`block w-full border-b p-2 text-left hover:bg-blue-50 ${Number(value?.generic_item_id) === Number(item.id) ? 'bg-blue-50' : ''}`}>
            <span className="font-mono text-xs text-blue-700">{item.item_code}</span> <strong>{item.generic_name}</strong>
            <span className="block text-xs text-slate-600">{item.canonical_description}</span>
            <span className="block text-xs text-slate-500">{item.category} · {item.inventory_uom} · {item.interchangeability_policy}</span>
          </button>
        ))}
      </div>
      {!loading && !error && options.length === 0 && <p className="text-sm text-slate-600">No active Generic Items found. Drafts and legacy items must be governed and activated in Item Master before selection.</p>}
      {value?.generic_item_id && <p className="text-xs font-semibold text-blue-700">Selected Generic Item #{value.generic_item_id}</p>}
      {allowPendingCreation && <button type="button" disabled={disabled} className="text-sm font-medium text-amber-700 underline" onClick={() => onChange({ generic_item_id: null, item_name: '', request_mode: 'pending_item_creation', catalog_status: 'pending_mapping', pending_item: { proposed_name: '', item_type: '', category: '', justification: '' } })}>Cannot find the item</button>}
    </div>
  );
}
