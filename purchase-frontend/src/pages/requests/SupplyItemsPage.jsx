import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import useWarehouses from '../../hooks/useWarehouses';
import useWarehouseStockItems from '../../hooks/useWarehouseStockItems';

const SupplyItemsPage = () => {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [items, setItems] = useState([]);
  const [suppliedMap, setSuppliedMap] = useState({});
  const [qtyMap, setQtyMap] = useState({});
  const [batchSelectionMap, setBatchSelectionMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { warehouses, loading: warehousesLoading } = useWarehouses();

  const supplyWarehouseId = request?.supply_warehouse_id;
  const {
    items: warehouseItems,
    loading: warehouseItemsLoading,
  } = useWarehouseStockItems(supplyWarehouseId);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const supplyListRes = await api.get('/api/warehouse-supply');
        const supplyRequest = (supplyListRes.data || []).find((req) => req.id === Number(id));

        if (!supplyRequest) {
          setRequest(null);
          setItems([]);
          setError('Request not found or no longer available for this warehouse.');
          return;
        }

        setRequest(supplyRequest);
        const requestItems = supplyRequest.items || [];
        setItems(requestItems);
        const supplied = {};
        if (supplyRequest?.items) {
          supplyRequest.items.forEach((item) => {
            supplied[item.id] = Number(item.supplied_quantity || 0);
          });
        }
        setSuppliedMap(supplied);

        const defaultQuantities = {};
        requestItems.forEach((item) => {
          const outstanding = Math.max(Number(item.quantity || 0) - (supplied[item.id] || 0), 0);
          defaultQuantities[item.id] = outstanding;
        });
        setQtyMap(defaultQuantities);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load supply request.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleChange = (itemId, value) => {
    const parsed = Number(value);
    setQtyMap((prev) => ({ ...prev, [itemId]: Number.isNaN(parsed) ? 0 : parsed }));
  };

  const formatExpiry = (value) => {
    if (!value) return 'No expiry';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const handleSave = async () => {
    if (!window.confirm('Save supplied quantities?')) return;

    const payload = {
      items: items
        .map((it) => ({
          item_id: it.id,
          supplied_quantity: Number(qtyMap[it.id]) || 0,
          ...(batchSelectionMap[it.id] || {}),
        }))
        .filter((entry) => entry.supplied_quantity > 0),
    };

    if (payload.items.length === 0) {
      alert('Enter at least one quantity to supply.');
      return;
    }

    try {
      setSaving(true);
      await api.post(`/api/warehouse-supply/${id}/items`, payload);
      alert('Supplied quantities saved');
    } catch (err) {
      console.error('Save failed:', err);
      alert(err.response?.data?.message || 'Failed to save quantities');
    } finally {
      setSaving(false);
    }
  };

  const supplyWarehouseName = useMemo(() => {
    if (!supplyWarehouseId) return '—';
    const match = warehouses.find((wh) => wh.id === supplyWarehouseId);
    return match?.name || `Warehouse #${supplyWarehouseId}`;
  }, [supplyWarehouseId, warehouses]);

  const batchOptionsByItem = useMemo(() => {
    const map = {};
    items.forEach((requestItem) => {
      const options = warehouseItems
        .filter((stockRow) => stockRow.item_name?.toLowerCase() === requestItem.item_name?.toLowerCase() && Number(stockRow.quantity || 0) > 0)
        .map((stockRow) => ({
          batch_id: stockRow.batch_id,
          lot_number: stockRow.lot_number || '',
          expiry_date: stockRow.expiry_date || '',
          quantity: Number(stockRow.quantity || 0),
        }));
      map[requestItem.id] = options;
    });
    return map;
  }, [items, warehouseItems]);

  const availableMap = useMemo(() => {
    const map = {};
    warehouseItems.forEach((item) => {
      map[item.stock_item_id] = Number(item.quantity || 0);
      const key = item.item_name?.toLowerCase();
      if (key) map[key] = Number(item.quantity || 0);
    });
    return map;
  }, [warehouseItems]);


  const handleBatchSelectionChange = (itemId, optionIndex) => {
    const options = batchOptionsByItem[itemId] || [];
    const selected = options[Number(optionIndex)] || null;
    setBatchSelectionMap((prev) => ({
      ...prev,
      [itemId]: selected
        ? {
            batch_id: selected.batch_id,
            lot_number: selected.lot_number || null,
            expiry_date: selected.expiry_date || null,
          }
        : {},
    }));
  };

  if (loading) {
    return (
      <>
          <div className="mx-auto max-w-3xl p-6">
          <p className="text-gray-700">Loading supply request…</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
          <div className="mx-auto max-w-3xl p-6">
          <p className="text-red-600">{error}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-4xl p-6 space-y-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-gray-500">Request ID #{id}</p>
          <h1 className="text-2xl font-bold text-gray-900">Warehouse supply fulfillment</h1>
          <div className="flex flex-wrap gap-3 text-sm text-gray-700">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
              Fulfilling warehouse: {warehousesLoading ? 'Loading…' : supplyWarehouseName}
            </span>
            {(request?.department_name || request?.section_name) && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                Department: {request.department_name || '—'}
                {request.section_name ? ` · Section ${request.section_name}` : ''}
              </span>
            )}
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
              Status: {request?.status || 'Pending'}
            </span>
          </div>
        </header>

        <div className="rounded border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-900">Items to supply</h2>
            <p className="text-sm text-gray-600">
              Enter the quantities you are supplying now. Outstanding values are prefilled based on
              what has already been supplied.
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {items.map((it) => {
              const alreadySupplied = suppliedMap[it.id] || 0;
              const outstanding = Math.max(Number(it.quantity || 0) - alreadySupplied, 0);
              const availableByName = availableMap[it.item_name?.toLowerCase()] ?? null;
              const quantityValue = qtyMap[it.id] ?? 0;
              const exceedsOutstanding = quantityValue > outstanding;
              const exceedsAvailable =
                availableByName !== null && quantityValue > Number(availableByName || 0);

              return (
                <div key={it.id} className="grid gap-3 px-4 py-3 md:grid-cols-12 md:items-center">
                  <div className="md:col-span-4">
                    <p className="font-medium text-gray-900">{it.item_name}</p>
                    <p className="text-xs text-gray-500">Requested: {it.quantity}</p>
                  </div>
                  <div className="md:col-span-3 space-y-1 text-sm text-gray-700">
                    <p>Supplied so far: {alreadySupplied}</p>
                    <p className="text-amber-700">Outstanding: {outstanding}</p>
                    {availableByName !== null && (
                      <p className="text-gray-600">Available in warehouse: {availableByName}</p>
                    )}
                    <label className="mt-2 block text-xs font-medium text-gray-700">Batch/Lot to supply</label>
                    <select
                      className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
                      value={(batchOptionsByItem[it.id] || []).findIndex((opt) => opt.batch_id === batchSelectionMap[it.id]?.batch_id && (opt.lot_number || '') === (batchSelectionMap[it.id]?.lot_number || '') && (opt.expiry_date || '') === (batchSelectionMap[it.id]?.expiry_date || ''))}
                      onChange={(e) => handleBatchSelectionChange(it.id, e.target.value)}
                    >
                      <option value={-1}>Select batch/lot</option>
                      {(batchOptionsByItem[it.id] || []).map((opt, index) => (
                        <option key={`${opt.batch_id || 'none'}-${opt.lot_number || 'none'}-${opt.expiry_date || 'none'}-${index}`} value={index}>
                          Lot: {opt.lot_number || '—'} · Exp: {formatExpiry(opt.expiry_date)} · Avail: {opt.quantity}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-sm font-medium text-gray-700" htmlFor={`supply-${it.id}`}>
                      Supply now
                    </label>
                    <input
                      id={`supply-${it.id}`}
                      type="number"
                      min={0}
                      value={quantityValue}
                      onChange={(e) => handleChange(it.id, e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    {(exceedsOutstanding || exceedsAvailable) && (
                      <p className="mt-1 text-xs text-red-600">
                        {exceedsOutstanding
                          ? 'Cannot supply more than the outstanding quantity.'
                          : 'Cannot supply more than the available warehouse balance.'}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2 text-right md:text-left">
                    <button
                      type="button"
                      onClick={() => handleChange(it.id, outstanding)}
                      className="rounded border border-blue-200 px-3 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      Fill outstanding
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={saving || warehouseItemsLoading}
            className={`rounded bg-blue-600 px-4 py-2 text-white shadow ${
              saving || warehouseItemsLoading ? 'cursor-not-allowed opacity-60' : 'hover:bg-blue-700'
            }`}
          >
            {saving ? 'Saving…' : 'Save supplied quantities'}
          </button>
        </div>
      </div>
    </>
  );
};

export default SupplyItemsPage;