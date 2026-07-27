import React, { useEffect, useState } from 'react';
import { searchApprovedProducts, searchGenericItems, searchSupplierCatalog } from '../../api/itemMaster';

const tabs = [
  { id: 'generic', label: 'Generic Items', help: 'Functional identity and inventory aggregation' },
  { id: 'products', label: 'Approved Products', help: 'Exact manufactured products and approvals' },
  { id: 'catalog', label: 'Supplier Catalog', help: 'Commercial offers, pricing and lead times' },
];

export default function ItemHierarchyWorkspace() {
  const [tab, setTab] = useState('generic');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const search = tab === 'generic' ? searchGenericItems : tab === 'products' ? searchApprovedProducts : searchSupplierCatalog;
        setResult(await search({ q: query, page: 1, page_size: 25 }));
      } catch (err) {
        if (!controller.signal.aborted) setError(err.response?.data?.message || 'Unable to load normalized item data. Has the migration been applied?');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, tab]);

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
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`rounded-lg border px-4 py-2 text-left transition ${tab === item.id ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 hover:border-slate-400'}`}>
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="block text-xs text-slate-500">{item.help}</span>
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="hierarchy-search">Search the selected level</label>
        <input id="hierarchy-search" className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === 'generic' ? 'Code, generic name or canonical description' : tab === 'products' ? 'Product, manufacturer, MPN or regulatory identifier' : 'Supplier, supplier item code or approved product'} />
        <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>{tab === 'generic' ? <><th className="p-3">Internal code</th><th className="p-3">Generic identity</th><th className="p-3">Classification</th><th className="p-3">Governance</th></> : tab === 'products' ? <><th className="p-3">Generic item</th><th className="p-3">Exact product</th><th className="p-3">Manufacturer / MPN</th><th className="p-3">Approval</th></> : <><th className="p-3">Supplier</th><th className="p-3">Approved product</th><th className="p-3">Commercial unit</th><th className="p-3">Price / lead time</th></>}</tr>
            </thead>
            <tbody>
              {result.data.map(row => <tr key={row.id} className="border-t border-slate-100">
                {tab === 'generic' ? <><td className="p-3 font-mono text-xs">{row.item_code}</td><td className="p-3"><strong>{row.generic_name}</strong><div className="max-w-xl text-xs text-slate-500">{row.canonical_description}</div></td><td className="p-3">{row.category}<div className="text-xs text-slate-500">{row.item_type} · {row.inventory_uom}</div></td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{row.lifecycle_status}</span><div className="mt-1 text-xs text-slate-500">{row.interchangeability_policy}</div></td></> : tab === 'products' ? <><td className="p-3"><span className="font-mono text-xs">{row.item_code}</span><div>{row.generic_name}</div></td><td className="p-3 font-medium">{row.product_name}</td><td className="p-3">{row.manufacturer}<div className="font-mono text-xs text-slate-500">{row.manufacturer_part_number}</div></td><td className="p-3">{row.approval_status}</td></> : <><td className="p-3 font-medium">{row.supplier_name}<div className="font-mono text-xs text-slate-500">{row.supplier_item_code}</div></td><td className="p-3">{row.product_name}<div className="text-xs text-slate-500">{row.manufacturer} · {row.generic_name}</div></td><td className="p-3">{row.purchasing_uom}<div className="text-xs text-slate-500">× {row.conversion_factor}</div></td><td className="p-3">{row.unit_price == null ? 'Not priced' : `${row.currency || ''} ${row.unit_price}`}<div className="text-xs text-slate-500">{row.lead_time_days == null ? 'Lead time unknown' : `${row.lead_time_days} days`}</div></td></>}
              </tr>)}
              {!loading && !result.data.length && <tr><td className="p-6 text-center text-slate-500" colSpan="4">No matching records.</td></tr>}
            </tbody>
          </table>
          {loading && <div className="border-t p-3 text-center text-sm text-slate-500">Searching…</div>}
          {error && <div className="border-t border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}
        </div>
      </div>
    </section>
  );
}