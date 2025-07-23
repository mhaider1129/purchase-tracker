import React, { useState } from 'react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import useCurrentUser from '../../hooks/useCurrentUser';

const ITRequestForm = () => {
  const { user, loading, error } = useCurrentUser();
  const [justification, setJustification] = useState('');
  const [items, setItems] = useState([getEmptyItem()]);
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function getEmptyItem() {
    return { item_name: '', quantity: 1, specs: '' };
  }

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = field === 'quantity' ? Number(value) || '' : value;
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

    if (!user?.department_id) {
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
    formData.append('request_type', 'IT Item');
    formData.append('justification', justification);
    formData.append('target_department_id', user.department_id);
    formData.append('target_section_id', user.section_id || '');
    formData.append('budget_impact_month', '');
    formData.append('items', JSON.stringify(items));
    attachments.forEach((f) => formData.append('attachments', f));

    try {
      setIsSubmitting(true);
      await api.post('/api/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('✅ IT item request submitted successfully!');
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

  if (error || !user) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-red-600 text-center">
          ❌ Unable to load user info. Please log in again.
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">IT Item Request Form</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-semibold mb-1">Your Department</label>
            <p className="p-2 border rounded bg-gray-100">{user.department_name}</p>
          </div>
          <div>
            <label className="block font-semibold mb-1">Your Section</label>
            <p className="p-2 border rounded bg-gray-100">{user.section_name || 'N/A'}</p>
          </div>
          <div>
            <label className="block font-semibold mb-1">Justification</label>
            <textarea
              className="w-full p-2 border rounded"
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why these IT items are needed..."
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block font-semibold mb-2">Items</label>
            {items.map((item, index) => (
              <div key={index} className="flex flex-wrap gap-2 mb-2 w-full">
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
                  className="w-24 p-2 border rounded"
                  required
                  disabled={isSubmitting}
                />
                <input
                  type="text"
                  placeholder="Specs"
                  value={item.specs}
                  onChange={(e) => handleItemChange(index, 'specs', e.target.value)}
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

export default ITRequestForm;