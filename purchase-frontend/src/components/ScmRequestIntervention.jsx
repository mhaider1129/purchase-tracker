import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

export default function ScmRequestIntervention({ requestId, allowed, onRejected }) {
  const { t } = useTranslation();
  const tr = key => t(`scmIntervention.${key}`);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!allowed) return null;
  const submit = async event => {
    event.preventDefault();
    if (busy || !reason.trim() || reason.trim().length > 2000) return;
    setBusy(true); setError('');
    try {
      await api.post(`/requests/${requestId}/scm-rejection`, { reason: reason.trim() });
      setOpen(false); setReason('');
      await onRejected();
    } catch (e) { setError(e.response?.data?.message || tr('failed')); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" onClick={() => { setError(''); setOpen(true); }} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white">{tr('open')}</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="scm-intervention-title" className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 text-slate-900 shadow-xl">
        <h2 id="scm-intervention-title" className="text-xl font-bold">{tr('title')}</h2>
        <p>{tr('explanation')}</p>
        <label className="block">{tr('reason')}<textarea required maxLength={2000} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} className="mt-2 block w-full rounded border p-3" /></label>
        {error && <p role="alert" className="text-rose-700">{error}</p>}
        <div className="flex gap-3"><button type="submit" disabled={busy || !reason.trim()} className="rounded bg-rose-700 px-4 py-2 text-white disabled:opacity-40">{tr(busy ? 'saving' : 'confirm')}</button><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded border px-4 py-2">{tr('cancel')}</button></div>
      </form>
    </div>}
  </>;
}
