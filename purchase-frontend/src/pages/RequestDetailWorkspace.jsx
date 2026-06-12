import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';

const tabs = ['Overview', 'Items', 'Approvals', 'Procurement', 'Timeline', 'Documents', 'Linked Records', 'Communication', 'Audit'];
const noteTypes = ['internal_note', 'department_follow_up', 'supplier_follow_up', 'clarification', 'finance_note', 'warehouse_note'];
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

const statusClasses = {
  approved: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-emerald-100 text-emerald-800',
  purchased: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  submitted: 'bg-blue-100 text-blue-800',
  assigned: 'bg-indigo-100 text-indigo-800',
  rejected: 'bg-rose-100 text-rose-800',
  partially_procured: 'bg-purple-100 text-purple-800',
  'partially procured': 'bg-purple-100 text-purple-800',
};

const timelineStyles = {
  request: 'bg-blue-500',
  approval: 'bg-emerald-500',
  assignment: 'bg-indigo-500',
  procurement: 'bg-purple-500',
  rfq: 'bg-cyan-500',
  quotation: 'bg-sky-500',
  po: 'bg-orange-500',
  grn: 'bg-lime-500',
  inspection: 'bg-teal-500',
  invoice: 'bg-pink-500',
  payment: 'bg-green-500',
  attachment: 'bg-slate-500',
  audit: 'bg-red-500',
  communication: 'bg-yellow-500',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

const formatMoney = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const StatusBadge = ({ children }) => {
  const text = children || 'Unknown';
  const key = String(text).trim().toLowerCase();
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[key] || 'bg-slate-100 text-slate-700'}`}>{text}</span>;
};

const Card = ({ title, value, helper }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
  </div>
);

const EmptyState = ({ children = 'No records available.' }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{children}</div>
);

const ModalShell = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-slate-500 hover:bg-slate-100">✕</button>
      </div>
      {children}
    </div>
  </div>
);

const RequestDetailWorkspace = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');
  const [workspace, setWorkspace] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [procurementModalOpen, setProcurementModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [procurementForm, setProcurementForm] = useState({ item_id: '', event_quantity: '', unit_cost: '', supplier_id: '', procurement_date: new Date().toISOString().slice(0, 10), procurement_note: '' });
  const [noteForm, setNoteForm] = useState({ note_type: 'internal_note', note: '' });

  const fetchWorkspace = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const response = await api.get(`/requests/${requestId}/full-details`);
      setWorkspace(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to load request workspace.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchWorkspace(false);
  }, [fetchWorkspace]);

  useEffect(() => {
    api.get('/suppliers').then((res) => setSuppliers(Array.isArray(res.data) ? res.data : res.data?.suppliers || [])).catch(() => setSuppliers([]));
  }, []);

  const request = workspace?.request || EMPTY_OBJECT;
  const items = workspace?.items || EMPTY_ARRAY;
  const approvals = workspace?.approvals || EMPTY_ARRAY;
  const procurementEvents = workspace?.procurement_events || EMPTY_ARRAY;
  const linkedRecords = workspace?.linked_records || EMPTY_OBJECT;
  const attachments = workspace?.attachments || EMPTY_ARRAY;
  const notes = workspace?.communication_notes || EMPTY_ARRAY;
  const auditLogs = workspace?.audit_logs || EMPTY_ARRAY;
  const timeline = workspace?.timeline || EMPTY_ARRAY;
  const actions = new Set(workspace?.available_actions || EMPTY_ARRAY);

  const summary = useMemo(() => {
    const totalItems = items.length;
    const fullyProcured = items.filter((item) => Number(item.remaining_quantity || 0) <= 0 && Number(item.requested_quantity || 0) > 0).length;
    const partiallyProcured = items.filter((item) => Number(item.purchased_quantity || 0) > 0 && Number(item.remaining_quantity || 0) > 0).length;
    const remainingQuantity = items.reduce((sum, item) => sum + Number(item.remaining_quantity || 0), 0);
    const pendingApprovals = approvals.filter((approval) => String(approval.status || '').toLowerCase() === 'pending').length;
    return { totalItems, fullyProcured, partiallyProcured, remainingQuantity, pendingApprovals, attachmentsCount: attachments.length };
  }, [items, approvals, attachments]);

  const groupedProcurementEvents = useMemo(() => procurementEvents.reduce((acc, event) => {
    const key = event.requested_item_id || 'unknown';
    acc[key] = acc[key] || { item_name: event.item_name || 'Unknown item', events: [] };
    acc[key].events.push(event);
    return acc;
  }, {}), [procurementEvents]);

  const groupedAttachments = useMemo(() => attachments.reduce((acc, attachment) => {
    const key = attachment.source_type || 'request';
    acc[key] = acc[key] || [];
    acc[key].push(attachment);
    return acc;
  }, {}), [attachments]);

  const openProcurementModal = (item) => {
    setProcurementForm((prev) => ({ ...prev, item_id: item?.item_id || item?.id || '', event_quantity: '', unit_cost: item?.unit_cost || '', supplier_id: item?.supplier_id || '', procurement_note: '' }));
    setProcurementModalOpen(true);
  };

  const selectedProcurementItem = items.find((item) => String(item.item_id || item.id) === String(procurementForm.item_id));

  const submitProcurementEvent = async (event) => {
    event.preventDefault();
    if (!selectedProcurementItem) return;
    setSubmitting(true);
    try {
      await api.post(`/requests/${requestId}/items/${selectedProcurementItem.item_id || selectedProcurementItem.id}/procurement-events`, {
        event_quantity: Number(procurementForm.event_quantity),
        unit_cost: procurementForm.unit_cost === '' ? null : Number(procurementForm.unit_cost),
        supplier_id: procurementForm.supplier_id || null,
        procurement_date: procurementForm.procurement_date,
        procurement_note: procurementForm.procurement_note,
      });
      setProcurementModalOpen(false);
      await fetchWorkspace(true);
      setActiveTab('Procurement');
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to save procurement entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitNote = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const noteText = noteTarget ? `[${noteTarget.item_name}] ${noteForm.note}` : noteForm.note;
      await api.post(`/requests/${requestId}/notes`, { note_type: noteForm.note_type, note: noteText });
      setNoteModalOpen(false);
      setNoteTarget(null);
      setNoteForm({ note_type: 'internal_note', note: '' });
      await fetchWorkspace(true);
      setActiveTab('Communication');
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to add note.');
    } finally {
      setSubmitting(false);
    }
  };

  const printWorkspace = () => window.print();

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-7xl animate-pulse rounded-2xl bg-white p-8 text-slate-500 shadow">Loading request workspace…</div></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow">
          <h1 className="text-2xl font-bold text-rose-700">Unable to open request</h1>
          <p className="mt-3 text-slate-600">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => navigate(-1)} className="rounded-lg border px-4 py-2">Go back</button>
            <button onClick={() => fetchWorkspace(false)} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10 print:bg-white">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur print:static">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:text-slate-900 print:hidden">← Back</button>
                <h1 className="text-2xl font-black text-slate-900">Request #{request.request_number || request.request_id}</h1>
                <StatusBadge>{request.request_status}</StatusBadge>
                <StatusBadge>{request.approval_status}</StatusBadge>
                <StatusBadge>{request.procurement_status}</StatusBadge>
                {request.emergency_flag ? <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Emergency</span> : null}
                {request.priority ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">{request.priority}</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                <span>{request.department_name || 'No department'}{request.section_name ? ` / ${request.section_name}` : ''}</span>
                <span>Requester: {request.requester_name || '—'}</span>
                <span>Created: {formatDate(request.created_at)}</span>
                <span>Assigned: {request.assigned_to_name || 'Unassigned'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              {actions.has('register_procurement_entry') ? <button onClick={() => openProcurementModal(items[0])} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">Register Procurement</button> : null}
              {actions.has('add_note') ? <button onClick={() => setNoteModalOpen(true)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Add Note</button> : null}
              {actions.has('export_pdf') ? <button onClick={printWorkspace} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100">Print / PDF</button> : null}
              <button onClick={() => fetchWorkspace(true)} disabled={refreshing} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">{refreshing ? 'Refreshing…' : 'Refresh'}</button>
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto print:hidden">
            {tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{tab}</button>)}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'Overview' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <Card title="Total items" value={summary.totalItems} />
              <Card title="Fully procured" value={summary.fullyProcured} />
              <Card title="Partially procured" value={summary.partiallyProcured} />
              <Card title="Remaining qty" value={summary.remainingQuantity} />
              <Card title="Pending approvals" value={summary.pendingApprovals} />
              <Card title="Attachments" value={summary.attachmentsCount} />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
                <h2 className="text-lg font-bold text-slate-900">Request summary</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div><dt className="text-xs uppercase text-slate-500">Justification</dt><dd className="mt-1 text-slate-800">{request.justification || '—'}</dd></div>
                  <div><dt className="text-xs uppercase text-slate-500">Intended use</dt><dd className="mt-1 text-slate-800">{request.intended_use || '—'}</dd></div>
                  <div><dt className="text-xs uppercase text-slate-500">Estimated cost</dt><dd className="mt-1 text-slate-800">{formatMoney(request.estimated_cost)}</dd></div>
                  <div><dt className="text-xs uppercase text-slate-500">Required delivery</dt><dd className="mt-1 text-slate-800">{formatDate(request.required_delivery_date)}</dd></div>
                </dl>
              </section>
              <section className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Current work state</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <p><span className="font-semibold text-slate-600">Bottleneck:</span> {request.current_bottleneck || '—'}</p>
                  <p><span className="font-semibold text-slate-600">Next action:</span> {request.next_required_action || '—'}</p>
                  <p><span className="font-semibold text-slate-600">Updated:</span> {formatDateTime(request.updated_at)}</p>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'Items' && (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Purchased</th><th className="px-4 py-3">Remaining</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Latest unit cost</th><th className="px-4 py-3 print:hidden">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => <tr key={item.item_id || item.id} className="align-top"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{item.item_name}</p><p className="text-xs text-slate-500">{item.brand || item.category || ''}</p></td><td className="px-4 py-3">{item.requested_quantity}</td><td className="px-4 py-3">{item.purchased_quantity}</td><td className="px-4 py-3">{item.remaining_quantity}</td><td className="px-4 py-3"><StatusBadge>{item.procurement_status}</StatusBadge></td><td className="px-4 py-3">{item.supplier_name || '—'}</td><td className="px-4 py-3">{formatMoney(item.unit_cost)}</td><td className="px-4 py-3 print:hidden"><div className="flex flex-wrap gap-2">{actions.has('register_procurement_entry') ? <button onClick={() => openProcurementModal(item)} className="rounded bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">Register</button> : null}<button onClick={() => { setHistoryItem(item); setActiveTab('Procurement'); }} className="rounded bg-slate-100 px-3 py-1 text-xs font-semibold">History</button>{actions.has('add_note') ? <button onClick={() => { setNoteTarget(item); setNoteModalOpen(true); }} className="rounded bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Add Note</button> : null}{actions.has('mark_item_unable_to_procure') ? <button className="rounded bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700" disabled title="Use existing procurement status workflow if configured">Unable</button> : null}</div></td></tr>)}
                  {items.length === 0 ? <tr><td colSpan="8" className="p-6"><EmptyState>No requested items found.</EmptyState></td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'Approvals' && (
          <section className="space-y-4">
            {approvals.map((approval) => <div key={approval.approval_id} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-500">Level {approval.approval_level}</p><h3 className="text-lg font-bold text-slate-900">{approval.approver_name || 'Unassigned approver'} <span className="text-sm font-normal text-slate-500">{approval.approver_role}</span></h3></div><StatusBadge>{approval.status}</StatusBadge></div><p className="mt-3 text-sm text-slate-600">{approval.comments || 'No comments.'}</p><p className="mt-2 text-xs text-slate-500">{approval.is_active ? 'Active step • ' : ''}Approved at: {formatDateTime(approval.approved_at)} • Waiting hours: {approval.waiting_time_hours || 0}</p></div>)}
            {approvals.length === 0 ? <EmptyState>No approvals found.</EmptyState> : null}
          </section>
        )}

        {activeTab === 'Procurement' && (
          <section className="space-y-4">
            {actions.has('register_procurement_entry') ? <button onClick={() => openProcurementModal(historyItem || items[0])} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white print:hidden">Register Procurement Entry</button> : null}
            {Object.entries(groupedProcurementEvents).filter(([itemId]) => !historyItem || String(historyItem.item_id || historyItem.id) === String(itemId)).map(([itemId, group]) => <div key={itemId} className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="text-lg font-bold text-slate-900">{group.item_name}</h3><div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Qty</th><th className="py-2 pr-4">Previous</th><th className="py-2 pr-4">New</th><th className="py-2 pr-4">Remaining</th><th className="py-2 pr-4">Unit cost</th><th className="py-2 pr-4">Supplier</th><th className="py-2 pr-4">Note</th></tr></thead><tbody>{group.events.map((event) => <tr key={event.event_id} className="border-t"><td className="py-2 pr-4">{formatDate(event.procurement_date || event.created_at)}</td><td className="py-2 pr-4">{event.event_quantity}</td><td className="py-2 pr-4">{event.previous_purchased_quantity}</td><td className="py-2 pr-4">{event.new_purchased_quantity}</td><td className="py-2 pr-4">{event.remaining_quantity}</td><td className="py-2 pr-4">{formatMoney(event.unit_cost)}</td><td className="py-2 pr-4">{event.supplier_name || '—'}</td><td className="py-2 pr-4">{event.note || '—'}</td></tr>)}</tbody></table></div></div>)}
            {historyItem ? <button onClick={() => setHistoryItem(null)} className="text-sm font-semibold text-blue-700 print:hidden">Show all procurement history</button> : null}
            {procurementEvents.length === 0 ? <EmptyState>No procurement events yet.</EmptyState> : null}
          </section>
        )}

        {activeTab === 'Timeline' && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="relative border-l-2 border-slate-200 pl-6">
              {timeline.map((event) => <div key={event.id} className="relative mb-6 last:mb-0"><span className={`absolute -left-[33px] top-1 h-4 w-4 rounded-full ring-4 ring-white ${timelineStyles[event.event_type] || 'bg-slate-400'}`} /><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold text-slate-900">{event.title}</h3><p className="text-sm text-slate-600">{event.description}</p><p className="mt-1 text-xs text-slate-500">{event.actor_name || 'System'} • {formatDateTime(event.event_time)}</p></div><StatusBadge>{event.status || event.event_type}</StatusBadge></div></div>)}
            </div>
            {timeline.length === 0 ? <EmptyState>No timeline events found.</EmptyState> : null}
          </section>
        )}

        {activeTab === 'Documents' && (
          <section className="space-y-4">
            {['request', 'item', 'rfq', 'quotation', 'po', 'grn', 'invoice', 'inspection', 'contract'].map((group) => <div key={group} className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-bold capitalize text-slate-900">{group} documents</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{(groupedAttachments[group] || []).map((attachment) => <a key={attachment.id} href={attachment.file_path} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50"><p className="font-semibold text-blue-700">{attachment.file_name}</p><p className="text-xs text-slate-500">Uploaded by {attachment.uploaded_by_name || '—'} • {formatDateTime(attachment.uploaded_at)}</p></a>)}</div>{(groupedAttachments[group] || []).length === 0 ? <p className="mt-2 text-sm text-slate-400">No files.</p> : null}</div>)}
          </section>
        )}

        {activeTab === 'Linked Records' && (
          <section className="grid gap-4 lg:grid-cols-2">
            {Object.entries({ RFQs: linkedRecords.rfqs || [], Quotations: linkedRecords.quotations || [], POs: linkedRecords.purchase_orders || [], GRNs: linkedRecords.grns || [], Inspections: linkedRecords.inspections || [], Invoices: linkedRecords.invoices || [], Contracts: linkedRecords.contracts || [], Payments: linkedRecords.payments || [] }).map(([label, records]) => <div key={label} className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-900">{label}</h3><div className="mt-3 space-y-3">{records.map((record) => <div key={`${label}-${record.id}`} className="rounded-xl border border-slate-200 p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{record.title || record.po_number || record.invoice_number || record.receipt_number || record.reference_number || `Record #${record.id}`}</p><p className="text-xs text-slate-500">{record.status || record.acceptance_status || record.supplier_name || record.vendor || record.supplier || '—'}</p></div><Link to={`/requests/${requestId}/procure-to-pay`} className="text-xs font-semibold text-blue-700 print:hidden">Open</Link></div></div>)}{records.length === 0 ? <p className="text-sm text-slate-400">No linked records.</p> : null}</div></div>)}
          </section>
        )}

        {activeTab === 'Communication' && (
          <section className="space-y-4">
            {actions.has('add_note') ? <button onClick={() => setNoteModalOpen(true)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white print:hidden">Add Note</button> : null}
            {notes.map((note) => <div key={note.log_id || note.note_id} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold text-slate-900">{note.action || note.note_type}</h3><span className="text-xs text-slate-500">{formatDateTime(note.created_at)}</span></div><p className="mt-2 text-sm text-slate-700">{note.comments || '—'}</p><p className="mt-2 text-xs text-slate-500">By {note.actor_name || 'System'} • {note.note_type}</p></div>)}
            {notes.length === 0 ? <EmptyState>No notes or request logs yet.</EmptyState> : null}
          </section>
        )}

        {activeTab === 'Audit' && (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-100 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Description</th></tr></thead><tbody className="divide-y divide-slate-100">{auditLogs.map((audit) => <tr key={audit.id}><td className="px-4 py-3">{formatDateTime(audit.created_at)}</td><td className="px-4 py-3">{audit.actor_name || 'System'}</td><td className="px-4 py-3">{audit.action || '—'}</td><td className="px-4 py-3">{audit.target_type || 'request'} #{audit.target_id || requestId}</td><td className="px-4 py-3">{audit.description || JSON.stringify(audit.details || {})}</td></tr>)}{auditLogs.length === 0 ? <tr><td colSpan="5" className="p-6"><EmptyState>No audit records found.</EmptyState></td></tr> : null}</tbody></table></div>
          </section>
        )}
      </main>

      {procurementModalOpen && (
        <ModalShell title="Register Procurement Entry" onClose={() => setProcurementModalOpen(false)}>
          <form onSubmit={submitProcurementEvent} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Item<select value={procurementForm.item_id} onChange={(event) => setProcurementForm((prev) => ({ ...prev, item_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2" required>{items.map((item) => <option key={item.item_id || item.id} value={item.item_id || item.id}>{item.item_name}</option>)}</select></label>
            {selectedProcurementItem ? <div className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3"><span>Requested: <b>{selectedProcurementItem.requested_quantity}</b></span><span>Purchased: <b>{selectedProcurementItem.purchased_quantity}</b></span><span>Remaining: <b>{selectedProcurementItem.remaining_quantity}</b></span></div> : null}
            <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">Event quantity<input type="number" min="1" max={selectedProcurementItem?.remaining_quantity || undefined} value={procurementForm.event_quantity} onChange={(event) => setProcurementForm((prev) => ({ ...prev, event_quantity: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2" required /></label><label className="block text-sm font-semibold text-slate-700">Unit cost<input type="number" min="0" step="0.01" value={procurementForm.unit_cost} onChange={(event) => setProcurementForm((prev) => ({ ...prev, unit_cost: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label><label className="block text-sm font-semibold text-slate-700">Supplier<select value={procurementForm.supplier_id} onChange={(event) => setProcurementForm((prev) => ({ ...prev, supplier_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2"><option value="">No supplier selected</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label className="block text-sm font-semibold text-slate-700">Procurement date<input type="date" value={procurementForm.procurement_date} onChange={(event) => setProcurementForm((prev) => ({ ...prev, procurement_date: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label></div>
            <label className="block text-sm font-semibold text-slate-700">Note<textarea value={procurementForm.procurement_note} onChange={(event) => setProcurementForm((prev) => ({ ...prev, procurement_note: event.target.value }))} className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 p-2" /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setProcurementModalOpen(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={submitting} className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{submitting ? 'Saving…' : 'Save entry'}</button></div>
          </form>
        </ModalShell>
      )}

      {noteModalOpen && (
        <ModalShell title={noteTarget ? `Add Note for ${noteTarget.item_name}` : 'Add Request Note'} onClose={() => { setNoteModalOpen(false); setNoteTarget(null); }}>
          <form onSubmit={submitNote} className="space-y-4"><label className="block text-sm font-semibold text-slate-700">Note type<select value={noteForm.note_type} onChange={(event) => setNoteForm((prev) => ({ ...prev, note_type: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2">{noteTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label><label className="block text-sm font-semibold text-slate-700">Note<textarea value={noteForm.note} onChange={(event) => setNoteForm((prev) => ({ ...prev, note: event.target.value }))} className="mt-1 min-h-32 w-full rounded-lg border border-slate-300 p-2" required /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setNoteModalOpen(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={submitting} className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white disabled:opacity-50">{submitting ? 'Saving…' : 'Add note'}</button></div></form>
        </ModalShell>
      )}
    </div>
  );
};

export default RequestDetailWorkspace;