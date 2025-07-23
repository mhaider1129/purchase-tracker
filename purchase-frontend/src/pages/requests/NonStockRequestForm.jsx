// src/pages/requests/NonStockRequestForm.jsx
import React, { useState } from 'react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import useCurrentUser from '../../hooks/useCurrentUser';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const NonStockRequestForm = () => {
  const [justification, setJustification] = useState('');
  const [items, setItems] = useState([getEmptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState([]);

  const { user, loading, error } = useCurrentUser();
  const targetDeptId = user?.department_id;
  const targetSectionId = user?.section_id;

  function getEmptyItem() {
    return { item_name: '', quantity: 1, intended_use: '', specs: '', attachments: [] };
  }

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = field === 'quantity' ? Number(value) || '' : value;
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

    if (!justification.trim()) {
      alert('❌ Justification is required.');
      return;
    }

    if (!targetDeptId) {
      alert('❌ Your account is missing department.');
      return;
    }

    const hasInvalidItem = items.some(
      (item) => !item.item_name.trim() || item.quantity < 1
    );
    if (hasInvalidItem) {
      alert('❌ Each item must have a valid name and quantity.');
      return;
    }

    const formData = new FormData();
    formData.append('request_type', 'Non-Stock');
    formData.append('justification', justification);
    formData.append('budget_impact_month', '');
    formData.append('target_department_id', targetDeptId);
    formData.append('target_section_id', targetSectionId || '');
    const itemsPayload = items.map(({ attachments, ...rest }) => rest);
    formData.append('items', JSON.stringify(itemsPayload));
    attachments.forEach((file) => formData.append('attachments', file));
    items.forEach((item, idx) => {
      (item.attachments || []).forEach((file) => {
        formData.append(`item_${idx}`, file);
      });
    });

    if (!window.confirm('Submit this non-stock request?')) return;

    try {
      setIsSubmitting(true);
      await api.post('/api/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('✅ Non-stock request submitted successfully!');
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
        <div className="p-6 text-gray-600 text-center">Loading user information...</div>
      </>
    );
  }

  if (error || !user) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-red-600 text-center">
          ❌ Unable to load user info. Please log in again or contact admin.
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">
          Non-Stock Request Form
          <HelpTooltip text="Step 2: Provide details for your non-stock request." />
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Department Display */}
          <div>
            <label className="block font-semibold mb-1">Your Department</label>
            <p className="p-2 border rounded bg-gray-100">{user.department_name}</p>
          </div>

          {/* Section Display */}
          <div>
            <label className="block font-semibold mb-1">Your Section</label>
            <p className="p-2 border rounded bg-gray-100">{user.section_name || 'N/A'}</p>
          </div>

          {/* Justification */}
          <div>
            <label className="block font-semibold mb-1">Justification</label>
            <textarea
              className="w-full p-2 border rounded"
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain the need for these non-stock items..."
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Items List */}
          <div>
            <label className="block font-semibold mb-2">Items</label>
            {items.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2 flex-wrap w-full">
                <input
                  type="text"
                  placeholder="Item Name"
                  aria-label={`Item ${index + 1} Name`}
                  value={item.item_name}
                  onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                  className="flex-1 p-2 border rounded"
                  required
                  disabled={isSubmitting}
                />
                <input
                  type="number"
                  min={1}
                  aria-label={`Item ${index + 1} Quantity`}
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  className="w-24 p-2 border rounded"
                  required
                  disabled={isSubmitting}
                />
                <input
                  type="text"
                  placeholder="Intended Use"
                  aria-label={`Item ${index + 1} Intended Use`}
                  value={item.intended_use}
                  onChange={(e) => handleItemChange(index, 'intended_use', e.target.value)}
                  className="flex-1 p-2 border rounded"
                  disabled={isSubmitting}
                />
                <input
                  type="text"
                  placeholder="Specs"
                  aria-label={`Item ${index + 1} Specs`}
                  value={item.specs}
                  onChange={(e) => handleItemChange(index, 'specs', e.target.value)}
                  className="flex-1 p-2 border rounded"
                  disabled={isSubmitting}
                />
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
                    className="text-red-600 text-lg"
                    disabled={isSubmitting}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="text-blue-600 mt-2 font-semibold"
              disabled={isSubmitting}
            >
              + Add Another Item
            </button>
          </div>

          {/* Attachments */}
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

          {/* Submit */}
          <div>
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

export default NonStockRequestForm;