// src/pages/requests/MedicalDeviceRequestForm.jsx
import React, { useState } from 'react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import useCurrentUser from '../../hooks/useCurrentUser';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const MedicalDeviceRequestForm = () => {
  const { user, loading } = useCurrentUser();

  const [justification, setJustification] = useState('');
  const [items, setItems] = useState([getEmptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState([]);

  function getEmptyItem() {
    return {
      item_name: '',
      quantity: 1,
      unit_cost: '',
      intended_use: '',
      specs: '',
      device_info: '',
      purchase_type: 'First Time',
      attachments: []
    };
  }

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] =
      ['quantity', 'unit_cost'].includes(field) ? Number(value) || '' : value;
    setItems(updated);
  };

  const handleItemFiles = (index, files) => {
    const updated = [...items];
    updated[index].attachments = Array.from(files);
    setItems(updated);
  };

  const addItem = () => setItems([...items, getEmptyItem()]);
  const removeItem = (index) => {
    if (items.length === 1) return;
    if (!window.confirm('Remove this item?')) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const hasInvalidItem = items.some(
      (item) =>
        !item.item_name.trim() ||
        item.quantity < 1 ||
        item.unit_cost === '' ||
        !item.purchase_type.trim()
    );

    if (!justification.trim()) {
      alert('❌ Justification is required.');
      return;
    }

    if (!user?.department_id) {
      alert('❌ Your department info is missing.');
      return;
    }

    if (hasInvalidItem) {
      alert('❌ Please fill all required fields for each item.');
      return;
    }

    const formData = new FormData();
    formData.append('request_type', 'Medical Device');
    formData.append('justification', justification);
    formData.append('target_department_id', user.department_id);
    formData.append('target_section_id', user.section_id || '');
    formData.append('budget_impact_month', '');
    const itemsPayload = items.map(({ attachments, ...rest }) => rest);
    formData.append('items', JSON.stringify(itemsPayload));
    attachments.forEach((file) => formData.append('attachments', file));
        items.forEach((item, idx) => {
      (item.attachments || []).forEach((file) => {
        formData.append(`item_${idx}`, file);
      });
    });

    setIsSubmitting(true);
    try {
      await api.post('/api/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('✅ Medical Device request submitted successfully!');
      setJustification('');
      setItems([getEmptyItem()]);
      setAttachments([]);
    } catch (err) {
      console.error('❌ Submission error:', err);
      alert(err.response?.data?.message || '❌ Failed to submit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="p-6">Loading form...</div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">
          Medical Device Request Form
          <HelpTooltip text="Step 2: Provide details for your medical device request." />
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Auto-Filled Department */}
          <div>
            <label className="block font-semibold mb-1">Your Department</label>
            <input
              type="text"
              value={user?.department_name || ''}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          {/* Auto-Filled Section */}
          <div>
            <label className="block font-semibold mb-1">Your Section</label>
            <input
              type="text"
              value={user?.section_name || ''}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          {/* Justification */}
          <div>
            <label className="block font-semibold mb-1">Justification</label>
            <textarea
              className="w-full p-2 border rounded"
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why the medical device is needed..."
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Items */}
          {items.map((item, index) => (
            <div key={index} className="border p-4 rounded bg-gray-50 space-y-3">
              <div className="flex flex-wrap gap-4">
                <input
                  type="text"
                  placeholder="Item Name"
                  value={item.item_name}
                  onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                  className="flex-1 p-2 border rounded"
                  required
                  disabled={isSubmitting}
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Quantity"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  className="w-32 p-2 border rounded"
                  required
                  disabled={isSubmitting}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Unit Cost"
                  value={item.unit_cost}
                  onChange={(e) => handleItemChange(index, 'unit_cost', e.target.value)}
                  className="w-32 p-2 border rounded"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <input
                type="text"
                placeholder="Intended Use"
                value={item.intended_use}
                onChange={(e) => handleItemChange(index, 'intended_use', e.target.value)}
                className="w-full p-2 border rounded"
                disabled={isSubmitting}
              />

              <input
                type="text"
                placeholder="Specs"
                value={item.specs}
                onChange={(e) => handleItemChange(index, 'specs', e.target.value)}
                className="w-full p-2 border rounded"
                disabled={isSubmitting}
              />

              <input
                type="text"
                placeholder="Recommended Brand / Device Info"
                value={item.device_info}
                onChange={(e) => handleItemChange(index, 'device_info', e.target.value)}
                className="w-full p-2 border rounded"
                disabled={isSubmitting}
              />

              <select
                value={item.purchase_type}
                onChange={(e) => handleItemChange(index, 'purchase_type', e.target.value)}
                className="w-full p-2 border rounded"
                required
                disabled={isSubmitting}
              >
                <option value="First Time">First Time</option>
                <option value="Replacement">Replacement</option>
                <option value="Addition">Addition</option>
              </select>
              <input
                type="file"
                multiple
                onChange={(e) => handleItemFiles(index, e.target.files)}
                className="p-1 border rounded"
                disabled={isSubmitting}
              />

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-red-600 font-semibold"
                  disabled={isSubmitting}
                >
                  ✕ Remove Item
                </button>
              )}
            </div>
          ))}

          {/* Actions */}
          <div>
            <label className="block font-semibold mb-1">Attachments</label>
            <input
              type="file"
              multiple
              onChange={(e) => setAttachments(Array.from(e.target.files))}
              className="p-2 border rounded w-full"
              disabled={isSubmitting}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <button
              type="button"
              onClick={addItem}
              className="text-blue-600 font-semibold"
              disabled={isSubmitting}
            >
              + Add Another Device
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
              <HelpTooltip text="Step 3: Submit the request for approval." />
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default MedicalDeviceRequestForm;
