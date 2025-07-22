// src/components/ProcurementItemStatusPanel.jsx
import React, { useState, useEffect } from 'react';
import axios from '../api/axios';

const ProcurementItemStatusPanel = ({ item, onUpdate }) => {
  const [status, setStatus] = useState(item.procurement_status || '');
  const [comment, setComment] = useState(item.procurement_comment || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [updaterName, setUpdaterName] = useState('');
  const [unitCost, setUnitCost] = useState(item.unit_cost ?? '');
  // cost and quantity will now be saved together with the status
  // so we keep only a single saving/message state
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

  const handleSave = async () => {
    if (!status) {
      setMessage({ type: 'error', text: 'Please select a status.' });
      return;
    }

    if (!unitCost || isNaN(unitCost) || Number(unitCost) <= 0) {
      setMessage({ type: 'error', text: 'Enter valid cost.' });
      return;
    }

    if (purchasedQty === '' || isNaN(purchasedQty) || Number(purchasedQty) < 0) {
      setMessage({ type: 'error', text: 'Enter valid quantity.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await axios.put(`/api/requested-items/${item.id}/cost`, {
        unit_cost: Number(unitCost),
      });

      await axios.put(`/api/requested-items/${item.id}/purchased-quantity`, {
        purchased_quantity: Number(purchasedQty),
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
        <label className="block text-sm font-medium mb-1">Procurement Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
        >
          <option value="">-- Select Status --</option>
          <option value="pending">Pending</option>
          <option value="purchased">Purchased</option>
          <option value="completed">Completed</option>
          <option value="canceled">Canceled</option>
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
