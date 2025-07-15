// src/pages/requests/NonStockRequestForm.jsx
import React, { useState } from 'react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import useCurrentUser from '../../hooks/useCurrentUser';

const NonStockRequestForm = () => {
  const [justification, setJustification] = useState('');
  const [items, setItems] = useState([getEmptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, loading, error } = useCurrentUser();
  const targetDeptId = user?.department_id;
  const targetSectionId = user?.section_id;

  function getEmptyItem() {
    return { item_name: '', quantity: 1, intended_use: '' };
  }

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = field === 'quantity' ? Number(value) || '' : value;
    setItems(updated);
  };

  const addItem = () => setItems([...items, getEmptyItem()]);
  const removeItem = (index) => {
    if (items.length === 1) return;
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

    const payload = {
      request_type: 'Non-Stock',
      justification,
      budget_impact_month: null,
      target_department_id: targetDeptId,
      target_section_id: targetSectionId,
      items,
    };

    try {
      setIsSubmitting(true);
      await api.post('/api/requests', payload);
      alert('✅ Non-stock request submitted successfully!');
      setJustification('');
      setItems([getEmptyItem()]);
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
        <h1 className="text-2xl font-bold mb-4">Non-Stock Request Form</h1>

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
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default NonStockRequestForm;