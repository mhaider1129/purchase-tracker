import ItemHierarchyCreateForm from './ItemHierarchyCreateForm';
import { hasPermission } from '../../utils/permissions';
import { transitionGenericItem } from '../../api/itemMaster';
import api from '../../api/axios';
import React, { useEffect, useState } from 'react';
import { createItemMasterReference, deactivateItemMasterReference, searchApprovedProducts, searchGenericItems, searchItemMasterReferences, searchSupplierCatalog } from '../../api/itemMaster';

const tabs = [
  { id: 'generic', label: 'Generic Items', help: 'Functional identity and inventory aggregation' },
  { id: 'products', label: 'Approved Products', help: 'Exact manufactured products and approvals' },
  { id: 'catalog', label: 'Supplier Catalog', help: 'Commercial offers, pricing and lead times' },
  { id: 'uom', label: 'Reference data', help: 'Categories, manufacturers and UOMs' },
];

export default function ItemHierarchyWorkspace({ canMaintainReferences = false, user }) {
  const [creating, setCreating] = useState(false);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [referenceType, setReferenceType] = useState('uom');
  const nextLifecycle = {draft:['review','item-master.edit'],review:['validation','item-master.validate'],validation:['approval','item-master.validate'],approval:['active','item-master.approve'],active:['retired','item-master.retire']};
  const run = async (work) => { setBusy(true); setError(''); try { await work(); setRevision(value=>value+1); } catch(e) { setError(e.response?.data?.message || 'Unable to update governed data.'); } finally { setBusy(false); } };
  const [tab, setTab] = useState('generic');
  const canCreate = hasPermission(user, {generic:'item-master.create',products:'item-master.products',catalog:'item-master.suppliers'}[tab]);

  const [query, setQuery] = useState('');
  const [result, setResult] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referenceForm, setReferenceForm] = useState({ code: '', name: '' });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        if (tab === 'uom') {
          const data = await searchItemMasterReferences(referenceType, { q: query });
          if (!controller.signal.aborted) setResult({ data, total: data.length });
        } else {
          const search = tab === 'generic' ? searchGenericItems : tab === 'products' ? searchApprovedProducts : searchSupplierCatalog;
          const data = await search({ q: query, page, page_size: 25 });
          if (!controller.signal.aborted) setResult(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err.response?.data?.message || 'Unable to load normalized item data. Has the migration been applied?');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, tab, revision, page, referenceType]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Normalized item hierarchy">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-blue-950 px-5 py-5 text-white">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Master data foundation</div>
            <h2 className="mt-1 text-xl font-semibold">One item identity. Approved products. Governed suppliers.</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">Search each hierarchy level independently. Supplier and price data never changes the generic item used by requests, inventory and reporting.</p>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-right">
            <div className="text-xs text-slate-300">Matching records</div>
            <div className="text-2xl font-semibold">{result.total || 0}</div>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap gap-2" role="tablist">
          {tabs.map(item => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => { setTab(item.id); setPage(1); setCreating(false); setNotice(''); }} className={`rounded-lg border px-4 py-2 text-left transition ${tab === item.id ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 hover:border-slate-400'}`}>
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="block text-xs text-slate-500">{item.help}</span>
            </button>
          ))}
        </div>
        {tab !== 'uom' && <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Generic draft → review → validation → approval → active → Product approval → supplier offers</p>{canCreate ? <button type="button" onClick={() => setCreating(value => !value)} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">Create {tab === 'generic' ? 'Generic Item' : tab === 'products' ? 'Product' : 'Supplier offer'}</button> : <p className="text-xs text-slate-500">Creation requires {tab === 'generic' ? 'item-master.create' : tab === 'products' ? 'item-master.products' : 'item-master.suppliers'} permission.</p>}</div>}
        {notice && <p role="status" className="mt-3 rounded bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        {creating && <ItemHierarchyCreateForm canMaintainReferences={canMaintainReferences} level={tab} onClose={() => setCreating(false)} onSaved={async created => { setCreating(false); setQuery(''); setPage(1); setRevision(value=>value+1); setNotice(created.duplicate_candidates?.length ? 'Created draft with duplicate candidates. A steward must resolve those before activation.' : 'Governed record created. Complete the applicable lifecycle or approval before request selection.'); }} />}
        {tab === 'uom' && <label className="mt-4 block text-sm font-medium">Reference type<select className="ml-3 rounded border p-2" value={referenceType} onChange={event => setReferenceType(event.target.value)}><option value="uom">UOMs</option><option value="categories">Categories</option><option value="manufacturers">Manufacturers</option></select></label>}
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="hierarchy-search">Search the selected level</label>
        <input id="hierarchy-search" className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder={tab === 'generic' ? 'Code, generic name or canonical description' : tab === 'products' ? 'Product, manufacturer, MPN or regulatory identifier' : 'Supplier, supplier item code or approved product'} />
        {tab === 'uom' && canMaintainReferences && <form className="mt-3 flex flex-wrap gap-2" onSubmit={async event => { event.preventDefault(); await run(async () => { await createItemMasterReference(referenceType, referenceForm); setReferenceForm({ code: '', name: '' }); }); }}>
          <input aria-label="Reference code" required={referenceType === 'uom'} className="rounded border px-3 py-2" placeholder="Code (e.g. EA)" value={referenceForm.code} onChange={event => setReferenceForm({ ...referenceForm, code: event.target.value })} />
          <input aria-label="Reference name" required className="rounded border px-3 py-2" placeholder="Name" value={referenceForm.name} onChange={event => setReferenceForm({ ...referenceForm, name: event.target.value })} />
          <button className="rounded bg-blue-700 px-4 py-2 text-white" type="submit">Add reference</button>
        </form>}
        <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>{tab === 'generic' ? <><th className="p-3">Internal code</th><th className="p-3">Generic identity</th><th className="p-3">Classification</th><th className="p-3">Governance</th></> : tab === 'products' ? <><th className="p-3">Generic item</th><th className="p-3">Exact product</th><th className="p-3">Product packaging</th><th className="p-3">Approval</th></> : tab === 'uom' ? <><th className="p-3">Code</th><th className="p-3">Name</th><th className="p-3">Base-UOM flag</th><th className="p-3">Active status</th></> : <><th className="p-3">Supplier</th><th className="p-3">Approved product</th><th className="p-3">Supplier packaging</th><th className="p-3">Price / lead time</th></>}</tr>
            </thead>
            <tbody>
              {result.data.map(row => <tr key={row.id} className="border-t border-slate-100">
                {tab === 'generic' ? <><td className="p-3 font-mono text-xs">{row.item_code}</td><td className="p-3"><strong>{row.generic_name}</strong><div className="max-w-xl text-xs text-slate-500">{row.canonical_description}</div></td><td className="p-3">{row.category}<div className="text-xs text-slate-500">{row.item_type} · {row.inventory_uom}</div></td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{row.lifecycle_status}</span><div className="mt-1 text-xs text-slate-500">{row.interchangeability_policy}</div>{nextLifecycle[row.lifecycle_status] && hasPermission(user, nextLifecycle[row.lifecycle_status][1]) && <button type="button" disabled={busy} className="mt-2 rounded border px-2 py-1 text-xs font-semibold text-blue-700" onClick={() => run(() => transitionGenericItem(row.id,nextLifecycle[row.lifecycle_status][0]))}>Move to {nextLifecycle[row.lifecycle_status][0]}</button>}</td></> : tab === 'products' ? <><td className="p-3"><span className="font-mono text-xs">{row.item_code}</span><div>{row.generic_name}</div></td><td className="p-3 font-medium">{row.product_name}<div className="text-xs text-slate-500">{row.manufacturer} · {row.manufacturer_part_number}</div></td><td className="p-3">Product UOM: {row.product_uom}<div className="text-xs text-slate-500">1 {row.product_uom} = {row.package_quantity} Generic base units</div></td><td className="p-3">{row.approval_status}{['draft','pending'].includes(row.approval_status) && hasPermission(user,'item-master.products.approve') && <button type="button" disabled={busy} className="ml-2 rounded border px-2 py-1 text-blue-700" onClick={() => run(() => api.post(`/item-master/foundation/products/${row.id}/approve`))}>Approve Product</button>}</td></> : tab === 'uom' ? <><td className="p-3 font-mono">{row.uom_code || row.category_code || '—'}</td><td className="p-3">{row.uom_name || row.category_name || row.manufacturer_name}</td><td className="p-3">{row.is_base_uom ? 'Yes' : 'No'}</td><td className="p-3">{row.is_active ? 'Active' : 'Inactive'}{canMaintainReferences && row.is_active && <button className="ml-2 text-red-700 underline" type="button" onClick={async () => { await run(() => deactivateItemMasterReference(referenceType, row.id)); }}>Deactivate</button>}</td></> : <><td className="p-3 font-medium">{row.supplier_name}<div className="font-mono text-xs text-slate-500">{row.supplier_item_code}</div></td><td className="p-3">{row.product_name}<div className="text-xs text-slate-500">{row.manufacturer} · {row.generic_name}</div></td><td className="p-3">Purchasing UOM: {row.purchasing_uom}<div className="text-xs text-slate-500">1 {row.purchasing_uom} = {row.conversion_factor} {row.product_uom} = {row.derived_inventory_conversion_factor || 'conversion required'} {row.inventory_uom}</div><div className="text-xs text-slate-500">MOQ {row.minimum_order_quantity} · multiple {row.order_multiple}</div></td><td className="p-3">{row.unit_price == null ? 'Not priced' : `${row.currency || ''} ${row.unit_price}`}<div className="text-xs text-slate-500">{row.lead_time_days == null ? 'Lead time unknown' : `${row.lead_time_days} days`}</div></td></>}
              </tr>)}
              {!loading && !result.data.length && <tr><td className="p-6 text-center text-slate-500" colSpan="4">No matching records. Create a governed record or try another search.</td></tr>}
            </tbody>
          </table>
          {tab !== 'uom' && <div className="flex items-center justify-between border-t p-3 text-sm"><button type="button" disabled={loading || page<=1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} · {result.total || 0} matching records</span><button type="button" disabled={loading || page*25 >= result.total} onClick={()=>setPage(value=>value+1)}>Next</button></div>}
          {loading && <div className="border-t p-3 text-center text-sm text-slate-500">Searching…</div>}
          {error && <div className="border-t border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}
        </div>
      </div>
    </section>
  );
}