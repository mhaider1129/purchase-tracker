import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getLifecycleDetail, createGoodsReceipt } from '../api/procureToPay';
import api from '../api/axios';

const ProcureToPayGoodsReceiptsPage = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [requestIdInput, setRequestIdInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requestItems, setRequestItems] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({
    warehouse_id: '',
    warehouse_location: '',
    notes: '',
    discrepancy_notes: '',
    items: [],
  });

  const hydrateForm = useCallback((payload) => {
    const items = payload?.request_items || [];
    const defaultWarehouseId = payload?.request?.supply_warehouse_id || '';

    setForm((prev) => ({
      ...prev,
      warehouse_id: String(defaultWarehouseId || prev.warehouse_id || ''),
      warehouse_location: payload?.request?.supply_warehouse_name || prev.warehouse_location || '',
      items: items.map((item) => ({
        requested_item_id: item.id,
        item_name: item.item_name,
        ordered_quantity: Number(item.quantity) || 0,
        received_quantity: Number(item.quantity) || 0,
        damaged_quantity: 0,
        short_quantity: 0,
        unit_price: item.unit_cost ? Number(item.unit_cost) : '',
        line_notes: '',
      })),
    }));

    setRequestItems(items);
    setReceipts(payload?.receipts || []);
  }, []);

  const refresh = useCallback(async () => {
    if (!requestId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const payload = await getLifecycleDetail(requestId);
      hydrateForm(payload);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load goods receipt data');
    } finally {
      setLoading(false);
    }
  }, [requestId, hydrateForm]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const response = await api.get('/api/warehouses');
        setWarehouses(response?.data?.data || response?.data || []);
      } catch (err) {
        console.warn('⚠️ Failed to load warehouses for goods receipts page', err);
      }
    };

    loadWarehouses();
  }, []);

  const updateLine = (index, key, value) => {
    setForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], [key]: value };
      return { ...prev, items: nextItems };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      const payload = {
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : null,
        warehouse_location: form.warehouse_location || null,
        notes: form.notes || null,
        discrepancy_notes: form.discrepancy_notes || null,
        items: form.items.map((item) => ({
          requested_item_id: item.requested_item_id,
          item_name: item.item_name,
          ordered_quantity: Number(item.ordered_quantity) || null,
          received_quantity: Number(item.received_quantity) || 0,
          damaged_quantity: Number(item.damaged_quantity) || 0,
          short_quantity: Number(item.short_quantity) || 0,
          unit_price: item.unit_price === '' ? null : Number(item.unit_price),
          line_notes: item.line_notes || null,
        })),
      };

      await createGoodsReceipt(requestId, payload);
      setSuccess('Goods receipt saved. Warehouse stock has been updated.');
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save goods receipt');
    }
  };

  if (loading) {
    return <div className="p-6">Loading goods receipts...</div>;
  }

  if (!requestId) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Goods Receipt Entry</h1>
        <div className="bg-white shadow rounded p-4 space-y-3">
          <p className="text-sm text-gray-600">Enter a request ID to open its goods receipt input page.</p>
          <div className="flex gap-2">
            <input
              className="rounded border px-2 py-1"
              type="number"
              min="1"
              placeholder="Request ID"
              value={requestIdInput}
              onChange={(e) => setRequestIdInput(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1 text-white"
              onClick={() => {
                if (Number(requestIdInput) > 0) {
                  navigate(`/requests/${Number(requestIdInput)}/procure-to-pay/receipts`);
                }
              }}
            >
              Open request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Goods Receipt Entry · Request #{requestId}</h1>
        <Link to={`/requests/${requestId}/procure-to-pay`} className="text-blue-600 hover:underline">
          Back to lifecycle
        </Link>
      </div>

      {error && <div className="rounded bg-red-50 px-3 py-2 text-red-700">{error}</div>}
      {success && <div className="rounded bg-emerald-50 px-3 py-2 text-emerald-700">{success}</div>}

      <form className="bg-white shadow rounded p-4 space-y-3" onSubmit={handleSubmit}>
        <h2 className="font-semibold">Create Goods Receipt</h2>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            Warehouse
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={form.warehouse_id}
              onChange={(e) => setForm((prev) => ({ ...prev, warehouse_id: e.target.value }))}
            >
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Warehouse location
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={form.warehouse_location}
              onChange={(e) => setForm((prev) => ({ ...prev, warehouse_location: e.target.value }))}
            />
          </label>
        </div>

        <div className="space-y-2">
          {form.items.map((item, index) => (
            <div key={item.requested_item_id || index} className="rounded border p-2">
              <p className="font-medium">{item.item_name}</p>
              <div className="grid md:grid-cols-5 gap-2 mt-2">
                <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" value={item.received_quantity} onChange={(e) => updateLine(index, 'received_quantity', e.target.value)} placeholder="Received" />
                <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" value={item.damaged_quantity} onChange={(e) => updateLine(index, 'damaged_quantity', e.target.value)} placeholder="Damaged" />
                <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" value={item.short_quantity} onChange={(e) => updateLine(index, 'short_quantity', e.target.value)} placeholder="Short" />
                <input className="rounded border px-2 py-1" type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateLine(index, 'unit_price', e.target.value)} placeholder="Unit price" />
                <input className="rounded border px-2 py-1" value={item.line_notes} onChange={(e) => updateLine(index, 'line_notes', e.target.value)} placeholder="Line notes" />
              </div>
            </div>
          ))}
        </div>

        <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Save goods receipt</button>
      </form>

      <div className="bg-white shadow rounded p-4">
        <h2 className="font-semibold mb-2">Receipt History</h2>
        <ul className="text-sm list-disc ml-5 space-y-1">
          {receipts.map((receipt) => (
            <li key={receipt.id}>{receipt.receipt_number} · {new Date(receipt.received_at).toLocaleString()}</li>
          ))}
        </ul>
        {receipts.length === 0 && <p className="text-sm text-gray-500">No receipts found for this request.</p>}
      </div>

      <div className="bg-white shadow rounded p-4">
        <h2 className="font-semibold mb-2">Request Items Reference</h2>
        <ul className="text-sm list-disc ml-5">
          {requestItems.map((item) => (
            <li key={item.id}>{item.item_name} · qty {item.quantity}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ProcureToPayGoodsReceiptsPage;