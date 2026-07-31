import React, { useEffect, useState } from 'react';
import { getItemMasterReferences, searchGenericItems } from '../../api/itemMaster';

const ITEM_TYPES = [
  { value: 'medication', label: 'Medication' },
  { value: 'medical_supply', label: 'Medical supply' },
  { value: 'medical_device', label: 'Medical device' },
  { value: 'laboratory_item', label: 'Laboratory item' },
  { value: 'maintenance_spare_part', label: 'Maintenance spare part' },
  { value: 'it_item', label: 'IT item' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'general_item', label: 'General item' },
];

export default function GenericItemSelector({ value, onChange, disabled = false }) {
  const [query, setQuery] = useState(value?.item_name || '');
  const [options, setOptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getItemMasterReferences()
      .then(result => {
        if (active) setCategories(result.categories || []);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (value?.request_mode === 'pending_item_creation') return undefined;
    let active = true;
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
  }, [query, value?.request_mode]);

  if (value?.request_mode === 'pending_item_creation') {
    return (
      <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
        <div className="flex justify-between">
          <strong className="text-sm text-amber-900">Pending Item Master review</strong>
          <button type="button" className="text-sm underline" onClick={() => onChange({ request_mode: 'generic_item', pending_item: null, item_name: '' })}>Search catalog</button>
        </div>
        <input aria-label="Proposed item name" className="w-full rounded border p-2" placeholder="Proposed generic name" value={value.pending_item?.proposed_name || ''} onChange={event => onChange({ item_name: event.target.value, pending_item: { ...value.pending_item, proposed_name: event.target.value } })} />
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Pending item type" className="rounded border p-2" value={value.pending_item?.item_type || ''} onChange={event => onChange({ pending_item: { ...value.pending_item, item_type: event.target.value } })}>
            <option value="">Select item type</option>
            {ITEM_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <select aria-label="Pending category" className="rounded border p-2" value={value.pending_item?.category || ''} onChange={event => onChange({ pending_item: { ...value.pending_item, category: event.target.value } })}>
            <option value="">Select category</option>
            {categories.map(category => <option key={category.id || category.name} value={category.name}>{category.name}</option>)}
          </select>
        </div>
        <textarea aria-label="Pending item justification" className="w-full rounded border p-2" placeholder="Why no catalog item is suitable" value={value.pending_item?.justification || ''} onChange={event => onChange({ restriction_justification: event.target.value, pending_item: { ...value.pending_item, justification: event.target.value } })} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input aria-label="Search active Generic Items" className="w-full rounded border p-2" placeholder="Search active Generic Items by code, name or description" value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} />
      {loading && <p className="text-xs text-slate-500">Searching Item Master…</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <div className="max-h-52 overflow-auto rounded border bg-white">
        {options.map(item => (
          <button type="button" key={item.id} onClick={() => { setQuery(item.generic_name); onChange({ generic_item_id: item.id, item_name: item.generic_name, canonical_description_snapshot: item.canonical_description, unit_of_measure: item.inventory_uom, request_mode: 'generic_item', catalog_status: 'catalogued', pending_item: null }); }} className={`block w-full border-b p-2 text-left hover:bg-blue-50 ${Number(value?.generic_item_id) === Number(item.id) ? 'bg-blue-50' : ''}`}>
            <span className="font-mono text-xs text-blue-700">{item.item_code}</span> <strong>{item.generic_name}</strong>
            <span className="block text-xs text-slate-600">{item.canonical_description}</span>
            <span className="block text-xs text-slate-500">{item.category} · {item.inventory_uom} · {item.interchangeability_policy}</span>
          </button>
        ))}
      </div>
      <button type="button" className="text-sm font-medium text-amber-700 underline" onClick={() => onChange({ generic_item_id: null, item_name: '', request_mode: 'pending_item_creation', catalog_status: 'pending_mapping', pending_item: { proposed_name: '', item_type: '', category: '', justification: '' } })}>Cannot find the item</button>
    </div>
  );
}