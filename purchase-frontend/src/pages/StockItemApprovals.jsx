// src/pages/StockItemApprovals.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import {
  fetchStockItemRequests,
  updateStockItemRequestStatus,
} from '../api/stockItemRequests';

const statusMeta = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800 border border-amber-200',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-rose-100 text-rose-800 border border-rose-200',
    icon: XCircle,
  },
};

const StockItemApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);

  const pendingCount = useMemo(
    () => requests.filter((req) => (req.status ?? 'pending') === 'pending').length,
    [requests]
  );

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchStockItemRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('❌ Failed to load stock item requests:', err);
      setError(err.response?.data?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleStatusChange = async (id, status) => {
    const confirmMessage =
      status === 'approved'
        ? 'Approve this stock item request? An item will be created.'
        : 'Reject this stock item request?';

    if (!window.confirm(confirmMessage)) return;

    try {
      setActioningId(id);
      const updated = await updateStockItemRequestStatus(id, status);
      setRequests((prev) => prev.map((req) => (req.id === id ? updated : req)));
    } catch (err) {
      console.error('❌ Failed to update stock item request status:', err);
      alert(err.response?.data?.message || 'Failed to update status');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide">
              Stock Catalog Intake
            </p>
            <h1 className="text-3xl font-bold text-gray-900">SCM Stock Item Approvals</h1>
            <p className="text-gray-600 mt-1">
              Review warehouse submissions and approve or reject new stock items before they
              are added to the catalog.
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Pending</p>
            <p className="text-3xl font-bold text-blue-900">{pendingCount}</p>
            <p className="text-xs text-blue-700">awaiting your decision</p>
          </div>
        </header>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Incoming Requests</h2>
              <p className="text-sm text-gray-600">
                Approve to create the stock item automatically, or reject to send it back.
              </p>
            </div>
            <button
              type="button"
              onClick={loadRequests}
              className="px-3 py-2 text-sm font-semibold text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {error && <div className="p-4 text-sm text-red-700 bg-red-50 border-b border-red-100">{error}</div>}

          {loading ? (
            <div className="p-6 text-center text-gray-600">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="p-6 text-center text-gray-600">No stock item requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {requests.map((req) => {
                    const normalizedStatus = req.status ?? 'pending';
                    const meta = statusMeta[normalizedStatus] ?? statusMeta.pending;
                    const Icon = meta.icon;
                    return (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{req.name}</div>
                          <p className="text-xs text-gray-600">Requested by #{req.requested_by}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{req.unit || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-line max-w-md">
                          {req.description || 'No description provided.'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {req.inserted_at
                            ? new Date(req.inserted_at).toLocaleString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.className}`}>
                            <Icon size={14} /> {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(req.id, 'rejected')}
                            className="px-3 py-1.5 text-sm font-semibold text-rose-700 border border-rose-200 rounded hover:bg-rose-50 disabled:opacity-50"
                            disabled={actioningId === req.id || normalizedStatus !== 'pending'}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(req.id, 'approved')}
                            className="px-3 py-1.5 text-sm font-semibold text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-50 disabled:opacity-50"
                            disabled={actioningId === req.id || normalizedStatus !== 'pending'}
                          >
                            Approve
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export default StockItemApprovals;