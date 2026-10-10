import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

export default function ApprovalReminderPanel({ requestId, approvals, allowed, pending = true }) {
  const { t } = useTranslation();
  const tr = (key) => t(`approvalReminders.${key}`);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  if (!allowed) return null;
  const approvalId = approvals?.some((row) => String(row.approval_id) === String(selected)) ? selected : approvals?.[0]?.approval_id;
  const load = async () => {
    setBusy(true); setError('');
    try { const { data } = await api.get(`/approvals/request/${requestId}/reminder-history`); setHistory(data); }
    catch (e) { setError(e.response?.data?.message || tr('failed')); }
    finally { setBusy(false); }
  };
  const send = async () => {
    if (!window.confirm(tr('confirm'))) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api.post(`/approvals/request/${requestId}/remind-current`, approvalId ? { approval_id: Number(approvalId) } : {});
      setMessage(tr('accepted'));
    } catch (e) { setError(e.response?.data?.message || tr('failed')); }
    finally { setBusy(false); }
  };
  return <div className="mt-2 space-y-2 text-sm">
    {approvals?.length > 1 && <label>{tr('recipient')}<select value={approvalId} onChange={(e) => setSelected(e.target.value)} disabled={busy} className="max-w-full rounded border p-1">
      {approvals.map((row) => <option key={row.approval_id} value={row.approval_id}>{row.approver_name || tr('unavailable')} · {row.approver_role} · {row.approval_level}</option>)}
    </select></label>}
    <button type="button" onClick={send} disabled={busy || !pending || (Array.isArray(approvals) && approvals.length === 0)} className="rounded bg-amber-600 px-3 py-2 text-white disabled:opacity-40">{tr(busy ? 'busy' : 'send')}</button>
    <button type="button" onClick={load} disabled={busy} className="ml-2 text-blue-700 underline">{tr('history')}</button>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {history && <div className="max-h-64 overflow-auto rounded border p-2">
      <button type="button" onClick={() => setHistory(null)}>{tr('close')}</button>
      {history.length === 0 && <p>{tr('empty')}</p>}
      {history.map((row) => <p key={row.id} className="border-t py-2">{new Date(row.attempted_at).toLocaleString()} · {row.recipient_name || tr('unavailable')} · {row.actor_name || tr('automatic')} · {tr(row.status)}{row.detail && ` · ${row.detail}`}</p>)}
    </div>}
  </div>;
}
