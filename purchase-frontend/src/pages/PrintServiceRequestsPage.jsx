import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import useCurrentUser from '../hooks/useCurrentUser';

const STATUS_LABELS = {
  submitted: 'Submitted',
  accepted: 'Accepted by IT',
  completed: 'Ready to claim',
  claimed: 'Claimed',
  cancelled: 'Cancelled',
};

const normalize = (value) => String(value || '').trim().toLowerCase();
const isLinkedItDepartmentUser = (user, settings) => {
  const linkedDepartmentId = Number(settings?.department_id);
  if (Number.isInteger(linkedDepartmentId) && linkedDepartmentId > 0) {
    return Number(user?.department_id) === linkedDepartmentId;
  }

  return normalize(user?.department_name).includes('it');
};

const PrintServiceRequestsPage = () => {
  const { user } = useCurrentUser();
  const [myRequests, setMyRequests] = useState([]);
  const [queueRequests, setQueueRequests] = useState([]);
  const [queueSettings, setQueueSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ form_name: '', quantity: 1, notes: '' });

  const canManageQueue = useMemo(() => isLinkedItDepartmentUser(user, queueSettings), [queueSettings, user]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [myResponse, settingsResponse] = await Promise.all([
        api.get('/print-service-requests/my'),
        api.get('/print-service-requests/settings'),
      ]);
      setMyRequests(myResponse.data?.requests || []);
      const settings = settingsResponse.data?.settings || null;
      setQueueSettings(settings);

      if (isLinkedItDepartmentUser(user, settings)) {
        const queueResponse = await api.get('/print-service-requests/queue');
        setQueueRequests(queueResponse.data?.requests || []);
      } else {
        setQueueRequests([]);
      }
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Failed to load print service requests.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const submitRequest = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      await api.post('/print-service-requests', {
        form_name: form.form_name,
        quantity: Number(form.quantity),
        notes: form.notes,
      });
      setForm({ form_name: '', quantity: 1, notes: '' });
      setMessage('Print service request submitted to the IT Department.');
      await loadRequests();
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Failed to submit print service request.');
    }
  };

  const updateStatus = async (requestId, status) => {
    setMessage('');
    try {
      await api.patch(`/print-service-requests/${requestId}/status`, { status });
      await loadRequests();
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Failed to update print service request.');
    }
  };

  const renderRequestTable = (requests, mode) => (
    <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Log/Form</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Requester</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {requests.length === 0 ? (
            <tr><td className="px-4 py-4 text-gray-500" colSpan="7">No print service requests found.</td></tr>
          ) : requests.map((request) => (
            <tr key={`${mode}-${request.id}`}>
              <td className="px-4 py-3 font-medium">#{request.id}</td>
              <td className="px-4 py-3">
                <div className="font-semibold text-gray-900">{request.form_name}</div>
                {request.notes && <div className="mt-1 text-gray-500">{request.notes}</div>}
              </td>
              <td className="px-4 py-3">{request.quantity}</td>
              <td className="px-4 py-3">{request.requester_name || '—'}<div className="text-xs text-gray-500">{request.requester_department || ''}</div></td>
              <td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{STATUS_LABELS[request.status] || request.status}</span></td>
              <td className="px-4 py-3 text-gray-600">{request.updated_at ? new Date(request.updated_at).toLocaleString() : '—'}</td>
              <td className="space-x-2 px-4 py-3">
                {mode === 'queue' && request.status === 'submitted' && <button onClick={() => updateStatus(request.id, 'accepted')} className="rounded bg-blue-600 px-3 py-1 text-white">Accept</button>}
                {mode === 'queue' && request.status === 'accepted' && <button onClick={() => updateStatus(request.id, 'completed')} className="rounded bg-green-600 px-3 py-1 text-white">Complete</button>}
                {request.status === 'completed' && <button onClick={() => updateStatus(request.id, 'claimed')} className="rounded bg-purple-600 px-3 py-1 text-white">Mark claimed</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">IT Print Service Requests</h1>
        <p className="mt-1 text-gray-600">Request printing for a specific log or form. This workflow is handled by IT and does not create purchase requests or approval steps.</p>
      </div>

      {message && <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800">{message}</div>}

      <form onSubmit={submitRequest} className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Submit a print request</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="md:col-span-2">Log/Form name
            <input value={form.form_name} onChange={(event) => setForm((prev) => ({ ...prev, form_name: event.target.value }))} required className="mt-1 w-full rounded border p-2" placeholder="e.g. Daily temperature log" />
          </label>
          <label>Quantity
            <input type="number" min="1" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} required className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="md:col-span-3">Notes / specifications
            <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows="3" className="mt-1 w-full rounded border p-2" placeholder="Optional printing instructions" />
          </label>
        </div>
        <button type="submit" className="mt-4 rounded bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700">Submit to IT</button>
      </form>

      {canManageQueue && <section className="space-y-3"><h2 className="text-xl font-semibold">IT Department Queue</h2><p className="text-sm text-gray-600">Accessible to users assigned to {queueSettings?.department_name || 'the linked IT department'}.</p>{loading ? <p>Loading...</p> : renderRequestTable(queueRequests, 'queue')}</section>}
      <section className="space-y-3"><h2 className="text-xl font-semibold">My Print Requests</h2>{loading ? <p>Loading...</p> : renderRequestTable(myRequests, 'my')}</section>
    </div>
  );
};

export default PrintServiceRequestsPage;