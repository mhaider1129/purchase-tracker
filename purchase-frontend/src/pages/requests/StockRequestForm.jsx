// src/pages/requests/StockRequestForm.js

import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import { useNavigate } from 'react-router-dom';

const StockRequestForm = () => {
  const [itemsList, setItemsList] = useState([]);
  const [selectedItems, setSelectedItems] = useState([{ item_name: '', quantity: 1, available_quantity: '' }]);
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [sectionId, setSectionId] = useState(null);
  const navigate = useNavigate();

  // ✅ Validate and restrict access based on role
  const getUserRoleFromToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload?.role?.toLowerCase() || '';
    } catch (error) {
      console.error('❌ Failed to decode token:', error);
      return '';
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('🔒 Please log in first.');
      navigate('/login');
      return;
    }

    const role = getUserRoleFromToken(token);
    if (!['warehouse_manager', 'warehouse_keeper'].includes(role)) {
      alert('🚫 Access Denied: Only warehouse users can submit stock requests.');
      navigate('/');
      return;
    }

    // ✅ Fetch user's section ID
    const fetchUserDetails = async () => {
      try {
        const res = await api.get('/api/users/me');
        setSectionId(res.data.section_id);
      } catch (err) {
        console.error('❌ Failed to fetch user details:', err);
        alert('Unable to load your section. Please try again.');
      }
    };

    fetchUserDetails();
  }, [navigate]);

  useEffect(() => {
    // Replace this with real API in production
    setItemsList([
      { id: 1, name: 'Syringe 5ml' },
      { id: 2, name: 'Gloves - Medium' },
      { id: 3, name: 'Face Mask N95' },
    ]);
  }, []);

  const handleItemChange = (index, field, value) => {
    const updated = [...selectedItems];
    updated[index][field] = field === 'quantity' ? parseInt(value, 10) : value;
    setSelectedItems(updated);
  };

  const addItem = () => {
    setSelectedItems([...selectedItems, { item_name: '', quantity: 1, available_quantity: '' }]);
  };

  const removeItem = (index) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!justification.trim()) {
      alert('⚠️ Justification is required.');
      return false;
    }

    const hasInvalidItem = selectedItems.some(
      (item) => !item.item_name.trim() || item.quantity < 1
    );

    if (hasInvalidItem) {
      alert('⚠️ Each item must have a name and valid quantity.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const formData = new FormData();
    formData.append('request_type', 'Stock');
    formData.append('justification', justification);
    formData.append('target_section_id', sectionId);
    formData.append('budget_impact_month', '');
    formData.append('items', JSON.stringify(selectedItems));
    attachments.forEach((file) => formData.append('attachments', file));

    try {
      setIsSubmitting(true);
      await api.post('/api/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate('/request-submitted');
      setAttachments([]);
    } catch (err) {
      console.error('❌ Submission error:', err);
      alert(err.response?.data?.message || '❌ Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Stock Request Form</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-semibold mb-1">Justification</label>
            <textarea
              className="w-full p-2 border rounded"
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why this stock request is needed..."
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">Select Items</label>
            {selectedItems.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2 items-center">
                <select
                  value={item.item_name}
                  onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                  className="flex-1 p-2 border rounded"
                  required
                  disabled={isSubmitting}
                >
                  <option value="">-- Select Item --</option>
                  {itemsList.map((stock) => (
                    <option key={stock.id} value={stock.name}>
                      {stock.name}
                    </option>
                  ))}
                </select>
                <input
  type="number"
  min={0}
  placeholder="Available"
  value={item.available_quantity}
  onChange={(e) => handleItemChange(index, 'available_quantity', e.target.value)}
  className="w-28 p-2 border rounded"
  disabled={isSubmitting}
/>

<input
  type="number"
  min={1}
  placeholder="Requested"
  value={item.quantity}
  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
  className="w-28 p-2 border rounded"
  required
  disabled={isSubmitting}
/>
                {selectedItems.length > 1 && (
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
              className="text-blue-600 font-semibold mt-2"
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

          <button
            type="submit"
            disabled={isSubmitting}
            className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </>
  );
};

export default StockRequestForm;