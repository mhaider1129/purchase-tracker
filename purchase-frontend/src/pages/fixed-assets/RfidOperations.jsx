import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Radio, RefreshCw, Search, Wifi, X } from 'lucide-react';
import { fixedAssetsApi as api } from '../../api/fixedAssets';
import { hasPermission } from '../../utils/permissions';

const humanize = (value) => String(value ?? '—').toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
const dateTime = (value) => value ? new Date(value).toLocaleString() : '—';
const Field = ({ label, children }) => <label className="text-sm font-medium text-slate-700">{label}{children}</label>;
const control = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100';

function Status({ value }) {
  const positive = ['ONLINE', 'ACTIVE', 'AUTHORIZED', 'PROCESSED', 'RESOLVED', 'ENABLED'].includes(String(value).toUpperCase());
  const negative = ['OFFLINE', 'FAILED', 'UNAUTHORIZED', 'OPEN'].includes(String(value).toUpperCase());
  const colors = positive ? 'bg-emerald-100 text-emerald-800' : negative ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800';
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${colors}`}>{humanize(value)}</span>;
}

function Empty({ children }) { return <div className="rounded-xl border border-dashed p-10 text-center text-slate-500">{children}</div>; }

const definitions = {
  events: {
    title: 'RFID event monitor', description: 'Review interpreted business events without exposing protected raw reader payloads.', icon: Radio,
    columns: [['first_seen_at', 'Observed', dateTime], ['epc', 'EPC'], ['event_type', 'Event'], ['direction', 'Direction'], ['authorization_status', 'Authorization', (v) => <Status value={v}/>], ['confidence_score', 'Confidence'], ['status', 'Status', (v) => <Status value={v}/>]],
    filters: [['epc', 'EPC'], ['eventType', 'Event type', ['ASSET_SEEN', 'LOCATION_VERIFIED', 'PORTAL_ENTRY', 'PORTAL_EXIT', 'AUTHORIZED_MOVEMENT', 'UNAUTHORIZED_MOVEMENT', 'UNKNOWN_TAG']], ['direction', 'Direction', ['ENTERING', 'EXITING', 'UNKNOWN']], ['authorizationStatus', 'Authorization', ['AUTHORIZED', 'UNAUTHORIZED', 'NOT_APPLICABLE', 'UNKNOWN']]],
  },
  readers: {
    title: 'RFID readers', description: 'Monitor reader health and register institute-owned reader infrastructure.', icon: Wifi,
    columns: [['code', 'Code'], ['name', 'Name'], ['reader_type', 'Type', humanize], ['status', 'Status', (v) => <Status value={v}/>], ['last_seen_at', 'Last seen', dateTime], ['location_id', 'Location'], ['is_active', 'Active', (v) => <Status value={v ? 'ACTIVE' : 'DISABLED'}/>]], filters: [],
  },
  portals: {
    title: 'RFID portals', description: 'Define monitored boundaries and the direction of travel between governed locations.', icon: Radio,
    columns: [['code', 'Code'], ['name', 'Name'], ['portal_type', 'Type', humanize], ['location_id', 'Location'], ['from_location_id', 'From'], ['to_location_id', 'To'], ['enabled', 'Status', (v) => <Status value={v ? 'ENABLED' : 'DISABLED'}/>]], filters: [],
  },
  exceptions: {
    title: 'RFID exceptions', description: 'Triage, acknowledge, and resolve RFID observations that require human review.', icon: AlertTriangle,
    columns: [['detected_at', 'Detected', dateTime], ['exception_type', 'Exception', humanize], ['severity', 'Severity', (v) => <Status value={v}/>], ['asset_id', 'Asset'], ['rfid_business_event_id', 'Event'], ['status', 'Status', (v) => <Status value={v}/>]],
    filters: [['status', 'Status', ['OPEN', 'ACKNOWLEDGED', 'RESOLVED']], ['asset', 'Asset ID']],
  },
};

function Filters({ definition, values, onChange }) {
  if (!definition.filters.length) return null;
  return <div className="grid gap-3 border-t bg-slate-50 p-4 md:grid-cols-4">{definition.filters.map(([key, label, options]) => <Field key={key} label={label}>{options ? <select aria-label={label} className={control} value={values[key] || ''} onChange={(e) => onChange(key, e.target.value)}><option value="">All</option>{options.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select> : <div className="relative"><Search className="absolute left-3 top-3.5 text-slate-400" size={16}/><input aria-label={label} className={`${control} pl-9`} value={values[key] || ''} onChange={(e) => onChange(key, e.target.value)} /></div>}</Field>)}</div>;
}

function CreateInfrastructure({ resource, onClose, onCreated }) {
  const [form, setForm] = useState(resource === 'readers' ? { readerType: 'FIXED', status: 'OFFLINE', isActive: true } : { portalType: 'DOORWAY', enabled: true });
  const [locations, setLocations] = useState([]); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { api.locations({ active: true }).then(setLocations).catch(() => setLocations([])); }, []);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value || null }));
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(''); try { await api.createInfrastructure(resource, form); onCreated(); } catch (e) { setError(e.response?.data?.message || e.message); } finally { setSaving(false); } };
  const location = (key, label) => <Field label={label}><select aria-label={label} className={control} value={form[key] || ''} onChange={(e) => set(key, e.target.value)}><option value="">Not assigned</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.display_path || item.name}</option>)}</select></Field>;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label={`Add RFID ${resource === 'readers' ? 'reader' : 'portal'}`}><form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">Add RFID {resource === 'readers' ? 'reader' : 'portal'}</h2><p className="text-sm text-slate-500">Fields marked * are required.</p></div><button type="button" onClick={onClose} aria-label="Close"><X/></button></div><div className="grid gap-4 md:grid-cols-2"><Field label="Code *"><input required className={control} value={form.code || ''} onChange={(e) => set('code', e.target.value)}/></Field><Field label="Name *"><input required className={control} value={form.name || ''} onChange={(e) => set('name', e.target.value)}/></Field>{resource === 'readers' ? <><Field label="Reader type *"><select className={control} value={form.readerType} onChange={(e) => set('readerType', e.target.value)}><option value="FIXED">Fixed</option><option value="HANDHELD">Handheld</option></select></Field><Field label="Device identifier *"><input required className={control} value={form.deviceIdentifier || ''} onChange={(e) => set('deviceIdentifier', e.target.value)}/></Field><Field label="Manufacturer"><input className={control} value={form.manufacturer || ''} onChange={(e) => set('manufacturer', e.target.value)}/></Field><Field label="Model"><input className={control} value={form.model || ''} onChange={(e) => set('model', e.target.value)}/></Field>{location('locationId', 'Location')}</> : <><Field label="Portal type *"><input required className={control} value={form.portalType || ''} onChange={(e) => set('portalType', e.target.value)}/></Field>{location('locationId', 'Portal location')}{location('fromLocationId', 'From location')}{location('toLocationId', 'To location')}</>}</div>{error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" className="rounded-lg border px-4 py-2" onClick={onClose}>Cancel</button><button disabled={saving} className="rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button></div></form></div>;
}

function ExceptionActions({ row, onChanged }) {
  const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const act = async (status) => { setBusy(true); setError(''); try { await api.exception(row.id, { status, resolutionNotes: notes }); onChanged(); } catch (e) { setError(e.response?.data?.message || e.message); } finally { setBusy(false); } };
  if (row.status === 'RESOLVED') return <span className="text-xs text-slate-500">Complete</span>;
  return <div className="min-w-52 space-y-2">{row.status === 'OPEN' && <button disabled={busy} className="mr-2 rounded border px-2 py-1 text-xs font-semibold" onClick={() => act('ACKNOWLEDGED')}>Acknowledge</button>}<input aria-label={`Resolution notes for exception ${row.id}`} className="w-full rounded border p-1.5 text-xs" placeholder="Resolution notes" value={notes} onChange={(e) => setNotes(e.target.value)}/><button disabled={busy || !notes.trim()} className="rounded bg-emerald-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40" onClick={() => act('RESOLVED')}><CheckCircle2 className="mr-1 inline" size={13}/>Resolve</button>{error && <p role="alert" className="text-xs text-rose-700">{error}</p>}</div>;
}

export default function RfidOperations({ resource, user }) {
  const definition = definitions[resource]; const [result, setResult] = useState({ data: [], pagination: { page: 1, pages: 0 } }); const [filters, setFilters] = useState({ page: 1 }); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [creating, setCreating] = useState(false);
  const load = useCallback(() => { setLoading(true); setError(''); api.rfid(resource, filters).then(setResult).catch((e) => setError(e.response?.data?.message || e.message)).finally(() => setLoading(false)); }, [resource, filters]);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);
  if (!definition) return <Empty>Unsupported RFID resource.</Empty>;
  const canManageInfrastructure = hasPermission(user, 'rfid.manage-infrastructure'); const canManageExceptions = hasPermission(user, 'rfid.manage-exceptions'); const Icon = definition.icon;
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><header className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="flex items-start gap-3"><span className="rounded-xl bg-cyan-50 p-3 text-cyan-700"><Icon/></span><div><h2 className="text-xl font-bold text-slate-900">{definition.title}</h2><p className="mt-1 text-sm text-slate-500">{definition.description}</p></div></div><div className="flex gap-2"><button aria-label="Refresh records" onClick={load} className="rounded-lg border p-2.5 text-slate-600"><RefreshCw size={18}/></button>{['readers', 'portals'].includes(resource) && canManageInfrastructure && <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 font-semibold text-white"><Plus size={18}/>Add {resource === 'readers' ? 'reader' : 'portal'}</button>}</div></header><Filters definition={definition} values={filters} onChange={updateFilter}/>{error ? <div className="p-5"><Empty>{error}</Empty></div> : loading ? <div className="p-5"><Empty>Loading {resource}…</Empty></div> : !result.data.length ? <div className="p-5"><Empty>No {resource} match the current filters.</Empty></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{definition.columns.map(([, label]) => <th className="whitespace-nowrap bg-slate-100 p-3 text-xs uppercase tracking-wide text-slate-600" key={label}>{label}</th>)}{resource === 'exceptions' && canManageExceptions && <th className="bg-slate-100 p-3">Actions</th>}</tr></thead><tbody>{result.data.map((row) => <tr className="border-t align-top hover:bg-slate-50" key={row.id}>{definition.columns.map(([key,, format]) => <td className="whitespace-nowrap p-3" key={key}>{format ? format(row[key]) : String(row[key] ?? '—')}</td>)}{resource === 'exceptions' && canManageExceptions && <td className="p-3"><ExceptionActions row={row} onChanged={load}/></td>}</tr>)}</tbody></table></div>}<footer className="flex items-center justify-between border-t bg-slate-50 px-5 py-3 text-sm"><span>{result.pagination?.total ?? result.data.length} record{(result.pagination?.total ?? result.data.length) === 1 ? '' : 's'}</span><div className="flex items-center gap-3"><button className="rounded border bg-white px-3 py-1.5 disabled:opacity-40" disabled={(result.pagination?.page || 1) <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>Previous</button><span>Page {result.pagination?.page || 1} of {result.pagination?.pages || 1}</span><button className="rounded border bg-white px-3 py-1.5 disabled:opacity-40" disabled={(result.pagination?.page || 1) >= (result.pagination?.pages || 1)} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Next</button></div></footer>{creating && <CreateInfrastructure resource={resource} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }}/>}</section>;
}