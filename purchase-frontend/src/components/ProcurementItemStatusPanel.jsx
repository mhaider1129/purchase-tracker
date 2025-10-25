// src/components/ProcurementItemStatusPanel.jsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from '../api/axios';

const ProcurementItemStatusPanel = ({ item, onUpdate }) => {
  const [status, setStatus] = useState(item.procurement_status || '');
  const [comment, setComment] = useState(item.procurement_comment || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [updaterName, setUpdaterName] = useState('');
  const [unitCost, setUnitCost] = useState(item.unit_cost ?? '');
  const [purchasedQty, setPurchasedQty] = useState(
    item.purchased_quantity ?? item.quantity ?? ''
  );

  const updatedAt = item.procurement_updated_at
    ? new Date(item.procurement_updated_at).toLocaleString()
    : null;

  useEffect(() => {
    const fetchUpdater = async () => {
      if (item.procurement_updated_by) {
        try {
          const res = await axios.get(`/api/users/${item.procurement_updated_by}`);
          setUpdaterName(res.data.name || 'Unknown');
        } catch (err) {
          console.warn('⚠️ Could not fetch updater name:', err);
        }
      }
    };
    fetchUpdater();
  }, [item.procurement_updated_by]);
  
  useEffect(() => {
    setUnitCost(item.unit_cost ?? '');
  }, [item.unit_cost]);

  useEffect(() => {
    setPurchasedQty(item.purchased_quantity ?? item.quantity ?? '');
  }, [item.purchased_quantity, item.quantity]);

  useEffect(() => {
    setStatus(item.procurement_status || '');
    setComment(item.procurement_comment || '');
  }, [item.procurement_status, item.procurement_comment]);

  const totalCost = useMemo(() => {
    const qty = Number(purchasedQty || 0);
    const cost = Number(unitCost || 0);
    if (Number.isNaN(qty) || Number.isNaN(cost)) return 0;
    return Number((qty * cost).toFixed(2));
  }, [purchasedQty, unitCost]);

  const statusOptions = useMemo(
    () => [
      { value: 'pending', label: 'Pending Purchase' },
      { value: 'purchased', label: 'Purchased' },
      { value: 'not_procured', label: 'Not Procured' },
    ],
    []
  );

  const statusStyles = useMemo(
    () => ({
      pending: 'bg-amber-100 text-amber-700 border border-amber-200',
      purchased: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      not_procured: 'bg-rose-100 text-rose-700 border border-rose-200',
      completed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      canceled: 'bg-rose-100 text-rose-700 border border-rose-200',
    }),
    []
  );

  const handleSave = async () => {
    if (!status) {
      setMessage({ type: 'error', text: 'Please select a status.' });
      return;
    }

    const numericUnitCost = Number(unitCost);
    const numericQty = Number(purchasedQty);

    if (Number.isNaN(numericUnitCost) || numericUnitCost < 0) {
      setMessage({ type: 'error', text: 'Enter a valid unit cost (zero or above).' });
      return;
    }

    if (Number.isNaN(numericQty) || numericQty < 0) {
      setMessage({ type: 'error', text: 'Enter a valid purchased quantity (zero or above).' });
      return;
    }

    if (status === 'purchased') {
      if (numericUnitCost <= 0) {
        setMessage({ type: 'error', text: 'Purchased items require a unit cost greater than zero.' });
        return;
      }

      if (numericQty <= 0) {
        setMessage({ type: 'error', text: 'Purchased items require a purchased quantity greater than zero.' });
        return;
      }
    }

    setSaving(true);
    setMessage(null);

    try {
      await axios.put(`/api/requested-items/${item.id}/cost`, {
        unit_cost: numericUnitCost,
      });

      await axios.put(`/api/requested-items/${item.id}/purchased-quantity`, {
        purchased_quantity: numericQty,
      });

      await axios.put(`/api/requested-items/${item.id}/procurement-status`, {
        procurement_status: status,
        procurement_comment: comment,
      });

      setMessage({ type: 'success', text: '✅ Updated successfully.' });
      if (onUpdate) onUpdate(); // Notify parent to refresh data
    } catch (err) {
      console.error('❌ Update error:', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || '❌ Failed to update.',
      });
    } finally {
      setSaving(false);
    }
  };

  // removed individual save handlers for cost and quantity

  return (
    <div className="border rounded p-4 mb-4 shadow bg-white transition-all duration-200">
      <p className="text-sm">
        <strong>Item:</strong> {item.item_name}
      </p>
      {item.brand && (
        <p className="text-sm">
          <strong>Brand:</strong> {item.brand}
        </p>
      )}
      <p className="text-sm">
        <strong>Quantity:</strong> {item.quantity}
      </p>

      <div className="mt-3">
        <label className="block text-sm font-medium mb-1">Unit Cost</label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
        />
      </div>

      <div className="mt-3">
        <label className="block text-sm font-medium mb-1">Purchased Quantity</label>
        <input
          type="number"
          min={0}
          value={purchasedQty}
          onChange={(e) => setPurchasedQty(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
        />
      </div>
      
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">Procurement Status</label>
          {status && (
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                statusStyles[status] || 'bg-gray-100 text-gray-700 border border-gray-200'
              }`}
            >
              {status.replace('_', ' ')}
            </span>
          )}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1 border border-gray-300 rounded px-3 py-2 w-full text-sm"
        >
          <option value="">-- Select Status --</option>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <label className="block text-sm font-medium mb-1">Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="border border-gray-300 rounded px-3 py-2 w-full text-sm resize-none"
        />
      </div>

      <div className="mt-3 text-sm text-gray-600">
        <span className="font-medium">Line Total:</span>{' '}
        {Number.isNaN(totalCost)
          ? '—'
          : totalCost.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className={`mt-3 px-4 py-2 rounded text-white text-sm font-semibold transition ${
          saving ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>

      {message && (
        <div
          className={`mt-2 text-sm font-medium ${
            message.type === 'error' ? 'text-red-600' : 'text-green-600'
          }`}
        >
          {message.text}
        </div>
      )}

      {(updaterName || updatedAt) && (
        <div className="mt-3 text-xs text-gray-500 italic">
          Last updated by {updaterName || 'Unknown'} at {updatedAt || 'Unknown time'}
        </div>
      )}
    </div>
  );
};

export default ProcurementItemStatusPanel;
