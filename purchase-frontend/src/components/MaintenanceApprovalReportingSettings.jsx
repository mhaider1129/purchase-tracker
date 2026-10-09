import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { approvalTargetDays } from '../utils/approvalAging';

export default function MaintenanceApprovalReportingSettings() {
  const { t } = useTranslation();
  const tr = (key) => t(`maintenanceApprovalReporting.${key}`);
  const [policy, setPolicy] = useState(null);
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api.get('/maintenance-approval-reporting-policy').then(({ data }) => {
      if (active) { setPolicy(data); setDays(data.overdue_target_days ?? ''); }
    }).catch(() => { if (active) setError(t('maintenanceApprovalReporting.loadError')); });
    return () => { active = false; };
  }, [t]);
  const valid = days === '' || approvalTargetDays(days) != null;
  const save = async (event) => {
    event.preventDefault();
    if (!valid || busy || !reason.trim()) return;
    setBusy(true); setError(''); setSuccess(false);
    try {
      const { data } = await api.put('/maintenance-approval-reporting-policy', { overdue_target_days: days === '' ? null : Number(days), reason: reason.trim() });
      setPolicy(data); setDays(data.overdue_target_days ?? ''); setReason(''); setSuccess(true);
    } catch (e) { setError(e.response?.data?.message || tr('saveError')); }
    finally { setBusy(false); }
  };
  return <section className="max-w-3xl space-y-4 rounded-xl border bg-white p-6">
    <h2 className="text-xl font-bold">{tr('heading')}</h2>
    <p className="text-sm text-slate-600">{tr('help')}</p>
    {error && <p role="alert">{error}</p>}
    {success && <p role="status">{tr('saved')}</p>}
    {!policy && !error && <p>{tr('loading')}</p>}
    {policy && <form onSubmit={save} className="space-y-4">
      {!policy.configured && <p role="alert">{tr('migration')}</p>}
      <label className="block">{tr('target')}<input type="number" min="1" max="365" step="1" value={days} disabled={!policy.configured || busy} onChange={(e) => setDays(e.target.value)} className="ml-3 rounded border p-2" /></label>
      <label className="block">{tr('reason')}<textarea required maxLength={2000} value={reason} disabled={!policy.configured || busy} onChange={(e) => setReason(e.target.value)} className="mt-2 block w-full rounded border p-3" /></label>
      <button disabled={!policy.configured || busy || !valid || !reason.trim()} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-40">{tr(busy ? 'saving' : 'save')}</button>
      <p className="text-sm text-slate-500">{tr('lastReason')}: {policy.reason || '—'}</p>
    </form>}
  </section>;
}
