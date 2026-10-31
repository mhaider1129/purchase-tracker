import useUiTranslation from "../utils/useUiTranslation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDepartmentPriorityQueue, reorderDepartmentPriority } from '../api/procurementPriority';
import usePriorityQueueRefresh from '../hooks/usePriorityQueueRefresh';
import { DepartmentPriorityQueue } from '../components/priority/ProcurementPriorityViews';

const normalize = row => ({ id: row.request_id, requestId: row.request_id,
  requestNumber: row.request_reference || row.request_number || 'Procurement requirement',
  safeTitle: row.public_title || 'Procurement requirement', stage: row.case_status || '—',
  tier: row.system_tier, age: row.age, snapshot: row.snapshot, rank: row.department_rank });

export default function DepartmentPrioritiesPage() {
  const uiText = useUiTranslation();
  const [rows, setRows] = useState([]);
  const [original, setOriginal] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const editing = useRef(false);
  const dirty = useMemo(() => rows.map(row => row.id).join(',') !== original.map(row => row.id).join(','), [rows, original]);
  const needsSave = dirty || original.some(row => row.rank == null);
  editing.current = dirty || saving;
  const load = useCallback((quiet = false) => {
    if (!quiet) setState('loading');
    getDepartmentPriorityQueue().then(result => {
      if (quiet && editing.current) return;
      const next = (result.data || []).map(normalize);
      setRows(next); setOriginal(next); setState('ready'); setError('');
    }).catch(error => { if (quiet && editing.current) return; setState('error'); setError(error.response?.data?.message || 'Unable to load department priorities.'); });
  }, []);
  useEffect(() => { load(); }, [load]);
  usePriorityQueueRefresh(() => load(true), dirty || saving);
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const move = (id, to) => {
    if (saving) return;
    setSaved(false);
    setRows(old => {
      const next = [...old];
      const from = next.findIndex(row => String(row.id) === String(id));
      if (from < 0 || to < 0 || to >= next.length) return old;
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  };
  const save = async () => {
    if (!needsSave || saving) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const result = await reorderDepartmentPriority(rows.map(row => row.id), Object.fromEntries(original.map(row => [row.id, row.snapshot])));
      const next = (result.data || []).map(normalize);
      setRows(next); setOriginal(next); setSaved(true);
    } catch (error) {
      setError(error.response?.status === 409 ? 'The department queue changed. Reload the latest queue and review your order before saving.' : error.response?.data?.message || 'Unable to save priority order.');
    } finally { setSaving(false); }
  };
  return <main className="p-4 md:p-6">
    {error && <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-800">{error}<button disabled={saving} className="ml-3 underline" onClick={() => load()}>Reload latest queue</button></div>}
    {state === 'loading' ? <p>Loading department priorities…</p> : state === 'ready' && <>
      <p className="mb-3 text-sm text-slate-600">{rows.length} active requests. Completed and rejected requests are excluded. Move the most important request to the top, then save.</p>
      <DepartmentPriorityQueue entries={rows} canRank={!saving} onMove={move} onDragMove={move} />
      {!rows.length && <p className="mt-4">No active departmental priorities.</p>}
      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 border-t bg-white py-3">
        <button disabled={!needsSave || saving} onClick={save} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-40">{saving ? uiText("Saving…") : 'Save Changes'}</button>
        <button disabled={!dirty || saving} onClick={() => { setRows(original); setSaved(false); }} className="rounded border px-4 py-2 disabled:opacity-40">{uiText("Cancel")}</button>
        <button disabled={dirty || saving} onClick={() => load()} className="rounded border px-4 py-2 disabled:opacity-40">{uiText("Refresh")}</button>
        {dirty && <span className="text-sm text-amber-700">Unsaved changes</span>}
        {saved && <p role="status" className="text-emerald-700">Department priority order saved.</p>}
      </div>
    </>}
  </main>;
}
