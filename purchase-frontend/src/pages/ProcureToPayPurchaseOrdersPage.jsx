import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  createPurchaseOrder,
  issuePurchaseOrder,
  listPurchaseOrders,
  listPoSourceRequests,
  submitPurchaseOrderForApproval,
} from '../api/procureToPay';

const STATUSES = ['ALL', 'PO_DRAFT', 'PO_PENDING_APPROVAL', 'PO_APPROVED', 'PO_ISSUED', 'PO_PARTIAL', 'PO_DELIVERED', 'PO_CLOSED', 'PO_CANCELLED'];

const EMPTY_PO_FORM = {
  supplier_name: '',
  expected_delivery_date: '',
  delivery_location: '',
  budget_cost_center: '',
  tax_terms: '',
  payment_terms: '',
  terms: '',
  supplier_contact_email: '',
};

const formatAmount = (value) => Number(value || 0).toFixed(2);

const ProcureToPayPurchaseOrdersPage = () => {
  const { requestId } = useParams();
  const [rows, setRows] = useState([]);
  const [sourceRequests, setSourceRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: 'ALL', supplier: '' });
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [requestForm, setRequestForm] = useState(EMPTY_PO_FORM);
  const [manualForm, setManualForm] = useState(EMPTY_PO_FORM);
  const [busyPoId, setBusyPoId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const scopedRequestId = useMemo(() => {
    const parsed = Number(requestId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [requestId]);

  const load = useCallback(async (page = pagination.page) => {
    const params = {
      page,
      page_size: pagination.page_size,
      search: filters.search || undefined,
      supplier: filters.supplier || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      request_id: scopedRequestId || undefined,
    };

    const requestsParams = {
      search: filters.search || undefined,
      request_id: scopedRequestId || undefined,
    };

    const [poRes, requestRes] = await Promise.all([
      listPurchaseOrders(params),
      listPoSourceRequests(requestsParams),
    ]);

    setRows(poRes?.data || []);
    setPagination(poRes?.pagination || { page: 1, page_size: 20, total: 0 });
    setSourceRequests(requestRes?.data || []);
  }, [filters.search, filters.status, filters.supplier, pagination.page, pagination.page_size, scopedRequestId]);

  useEffect(() => {
    load(1);
  }, [load]);

  const validateForm = (form) => {
    const missing = [];
    if (!form.expected_delivery_date) missing.push('delivery date');
    if (!form.delivery_location.trim()) missing.push('delivery location');
    if (!form.budget_cost_center.trim()) missing.push('budget / cost center');
    if (!form.tax_terms.trim()) missing.push('tax terms');
    if (!form.payment_terms.trim()) missing.push('payment terms');
    return missing;
  };

  const handleMutation = async (action, successMessage) => {
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(successMessage);
      await load(1);
    } catch (err) {
      setError(err?.response?.data?.message || 'Action failed');
    }
  };

  const renderRowActions = (po) => {
    const actions = [];

    if (po.status === 'PO_PENDING_APPROVAL') {
      actions.push(
        <button
          key="approve"
          className="rounded bg-emerald-600 px-2 py-1 text-white"
          disabled={busyPoId === po.id}
          onClick={async () => {
            setBusyPoId(po.id);
            await handleMutation(() => approvePurchaseOrder(po.id), `Purchase order ${po.po_number} approved.`);
            setBusyPoId(null);
          }}
        >
          Approve
        </button>
      );
    }

    if (['PO_APPROVED', 'PO_DRAFT'].includes(po.status)) {
      actions.push(
        <button
          key="submit"
          className="rounded border px-2 py-1"
          disabled={busyPoId === po.id}
          onClick={async () => {
            setBusyPoId(po.id);
            await handleMutation(() => submitPurchaseOrderForApproval(po.id), `Purchase order ${po.po_number} submitted for approval.`);
            setBusyPoId(null);
          }}
        >
          Submit
        </button>
      );
    }

    if (['PO_APPROVED', 'PO_ISSUED'].includes(po.status)) {
      actions.push(
        <button
          key="issue"
          className="rounded bg-indigo-600 px-2 py-1 text-white"
          disabled={busyPoId === po.id || po.status === 'PO_ISSUED'}
          onClick={async () => {
            setBusyPoId(po.id);
            await handleMutation(() => issuePurchaseOrder(po.id, { supplier_contact_email: po.supplier_contact_email || null }), `Purchase order ${po.po_number} issued to supplier.`);
            setBusyPoId(null);
          }}
        >
          Issue
        </button>
      );
    }

    if (['PO_DELIVERED', 'PO_PARTIAL'].includes(po.status)) {
      actions.push(
        <button
          key="close"
          className="rounded bg-slate-700 px-2 py-1 text-white"
          disabled={busyPoId === po.id}
          onClick={async () => {
            setBusyPoId(po.id);
            await handleMutation(() => closePurchaseOrder(po.id, {}), `Purchase order ${po.po_number} closed.`);
            setBusyPoId(null);
          }}
        >
          Close
        </button>
      );
    }

    if (!['PO_CLOSED', 'PO_CANCELLED'].includes(po.status)) {
      actions.push(
        <button
          key="cancel"
          className="rounded border border-red-300 px-2 py-1 text-red-700"
          disabled={busyPoId === po.id}
          onClick={async () => {
            const reason = window.prompt(`Provide a cancellation reason for ${po.po_number}:`);
            if (!reason) return;
            setBusyPoId(po.id);
            await handleMutation(() => cancelPurchaseOrder(po.id, { reason }), `Purchase order ${po.po_number} cancelled.`);
            setBusyPoId(null);
          }}
        >
          Cancel
        </button>
      );
    }

    if (po.request_id) {
      actions.push(
        <Link key="lifecycle" className="text-blue-600 underline" to={`/requests/${po.request_id}/procure-to-pay`}>
          Open lifecycle
        </Link>
      );
    }

    return <div className="flex flex-wrap gap-2">{actions}</div>;
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Purchase Orders</h1>
      {scopedRequestId && (
        <p className="text-sm text-gray-600">Showing purchase orders linked to Request #{scopedRequestId}.</p>
      )}
      {error && <div className="rounded bg-red-50 px-3 py-2 text-red-700">{error}</div>}
      {success && <div className="rounded bg-emerald-50 px-3 py-2 text-emerald-700">{success}</div>}

      <div className="bg-white p-4 rounded shadow grid md:grid-cols-4 gap-2">
        <input className="border rounded px-2 py-1" placeholder="Search PO / supplier / request" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
        <input className="border rounded px-2 py-1" placeholder="Supplier" value={filters.supplier} onChange={(e) => setFilters((p) => ({ ...p, supplier: e.target.value }))} />
        <select className="border rounded px-2 py-1" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <button className="bg-indigo-600 text-white rounded px-3 py-1" onClick={() => load(1)}>Search</button>
      </div>

      <div className="bg-white p-4 rounded shadow space-y-3">
        <h2 className="font-semibold">Create PO from approved request</h2>
        <div className="grid md:grid-cols-3 gap-2">
          <select className="border rounded px-2 py-1" value={selectedRequestId} onChange={(e) => setSelectedRequestId(e.target.value)}>
            <option value="">Select approved request</option>
            {sourceRequests.map((r) => <option key={r.id} value={r.id}>Request #{r.id} · {r.request_type}</option>)}
          </select>
          <input className="border rounded px-2 py-1" type="date" value={requestForm.expected_delivery_date} onChange={(e) => setRequestForm((prev) => ({ ...prev, expected_delivery_date: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Delivery location" value={requestForm.delivery_location} onChange={(e) => setRequestForm((prev) => ({ ...prev, delivery_location: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Budget / cost center" value={requestForm.budget_cost_center} onChange={(e) => setRequestForm((prev) => ({ ...prev, budget_cost_center: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Tax terms" value={requestForm.tax_terms} onChange={(e) => setRequestForm((prev) => ({ ...prev, tax_terms: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Payment terms" value={requestForm.payment_terms} onChange={(e) => setRequestForm((prev) => ({ ...prev, payment_terms: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Supplier dispatch email (optional)" value={requestForm.supplier_contact_email} onChange={(e) => setRequestForm((prev) => ({ ...prev, supplier_contact_email: e.target.value }))} />
        </div>
        <button
          className="bg-blue-600 text-white rounded px-3 py-1 disabled:bg-gray-300"
          disabled={!selectedRequestId}
          onClick={async () => {
            const missing = validateForm(requestForm);
            if (missing.length > 0) {
              setError(`Complete the following fields before creating the PO: ${missing.join(', ')}.`);
              return;
            }
            await handleMutation(
              () => createPurchaseOrder(Number(selectedRequestId), requestForm),
              `Purchase order created from Request #${selectedRequestId}.`
            );
            setRequestForm(EMPTY_PO_FORM);
            setSelectedRequestId('');
          }}
        >
          Create PO
        </button>
      </div>

      <div className="bg-white p-4 rounded shadow space-y-3">
        <h2 className="font-semibold">Create standalone PO</h2>
        <p className="text-xs text-gray-600">Standalone POs can be submitted for approval, approved, issued, cancelled, and closed from this screen.</p>
        <div className="grid sm:grid-cols-4 gap-2">
          <input className="border rounded px-2 py-1" placeholder="Supplier name" value={manualForm.supplier_name} onChange={(e) => setManualForm((prev) => ({ ...prev, supplier_name: e.target.value }))} />
          <input className="border rounded px-2 py-1" type="date" value={manualForm.expected_delivery_date} onChange={(e) => setManualForm((prev) => ({ ...prev, expected_delivery_date: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Delivery location" value={manualForm.delivery_location} onChange={(e) => setManualForm((prev) => ({ ...prev, delivery_location: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Budget / cost center" value={manualForm.budget_cost_center} onChange={(e) => setManualForm((prev) => ({ ...prev, budget_cost_center: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Tax terms" value={manualForm.tax_terms} onChange={(e) => setManualForm((prev) => ({ ...prev, tax_terms: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Payment terms" value={manualForm.payment_terms} onChange={(e) => setManualForm((prev) => ({ ...prev, payment_terms: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="General terms" value={manualForm.terms} onChange={(e) => setManualForm((prev) => ({ ...prev, terms: e.target.value }))} />
          <input className="border rounded px-2 py-1" placeholder="Supplier dispatch email (optional)" value={manualForm.supplier_contact_email} onChange={(e) => setManualForm((prev) => ({ ...prev, supplier_contact_email: e.target.value }))} />
        </div>
        <button
          className="bg-emerald-600 text-white rounded px-3 py-1 disabled:bg-gray-300"
          disabled={!manualForm.supplier_name.trim()}
          onClick={async () => {
            const missing = validateForm(manualForm);
            if (missing.length > 0) {
              setError(`Complete the following fields before creating the PO: ${missing.join(', ')}.`);
              return;
            }
            await handleMutation(() => createPurchaseOrder(null, { ...manualForm, items: [] }), 'Standalone purchase order created.');
            setManualForm(EMPTY_PO_FORM);
          }}
        >
          Create standalone PO
        </button>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="p-2 text-left">PO Number</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">Business Status</th><th className="p-2 text-left">System Code</th><th className="p-2 text-left">Linked Request</th><th className="p-2 text-left">Delivery / Budget</th><th className="p-2 text-left">Date</th><th className="p-2 text-right">Total</th><th className="p-2 text-left">Items</th><th className="p-2 text-left">Actions</th></tr></thead>
          <tbody>
            {rows.map((po) => (
              <tr key={po.id} className="border-t align-top">
                <td className="p-2">{po.po_number}</td>
                <td className="p-2">
                  <div>{po.supplier_name || '-'}</div>
                  <div className="text-xs text-gray-500">{po.contract_reference || 'No contract ref'}</div>
                </td>
                <td className="p-2">{po.business_status || '-'}</td>
                <td className="p-2">{po.system_status_code || po.status}</td>
                <td className="p-2">{po.request_id || '-'}</td>
                <td className="p-2 text-xs text-gray-700">
                  <div>{po.delivery_location || '-'}</div>
                  <div>{po.budget_cost_center || '-'}</div>
                </td>
                <td className="p-2">{new Date(po.created_at).toLocaleDateString()}</td>
                <td className="p-2 text-right">{formatAmount(po.total_amount)}</td>
                <td className="p-2 min-w-[240px]">
                  {Array.isArray(po.items) && po.items.length > 0 ? (
                    <ul className="space-y-1">
                      {po.items.map((item) => (
                        <li key={item.id} className="text-xs text-gray-700">
                          {item.item_name} · {item.quantity} × {formatAmount(item.unit_price)} = <span className="font-medium">{formatAmount(item.line_total)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-gray-500">No items</span>
                  )}
                </td>
                <td className="p-2 min-w-[240px]">{renderRowActions(po)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between text-sm">
        <span>Total: {pagination.total}</span>
        <div className="space-x-2">
          <button className="px-2 py-1 border rounded" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Prev</button>
          <button className="px-2 py-1 border rounded" disabled={(pagination.page * pagination.page_size) >= pagination.total} onClick={() => load(pagination.page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
};

export default ProcureToPayPurchaseOrdersPage;