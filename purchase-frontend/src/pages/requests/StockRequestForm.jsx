// src/pages/requests/StockRequestForm.js

import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import { useNavigate } from 'react-router-dom';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';

const StockRequestForm = () => {
  const [itemsList, setItemsList] = useState([]);
  const [selectedItems, setSelectedItems] = useState([
    {
      item_name: '',
      brand: '',
      category: '',
      quantity: 1,
      available_quantity: '',
      attachments: []
    }
  ]);
  const [category, setCategory] = useState('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [sectionId, setSectionId] = useState(null);
  const navigate = useNavigate();
  const categories = useMemo(
    () => Array.from(new Set(itemsList.map((it) => it.category))).filter(Boolean),
    [itemsList]
  );

  const hasSelectedData = useMemo(
    () =>
      selectedItems.some(
        (it) =>
          it.item_name ||
          it.brand ||
          it.available_quantity ||
          it.quantity !== 1 ||
          (it.attachments && it.attachments.length)
      ),
    [selectedItems]
  );

  const handleCategoryChange = (value) => {
    if (hasSelectedData) {
      const confirmChange = window.confirm(
        'Changing the category will remove all selected items. Continue?'
      );
      if (!confirmChange) {
        return;
      }
      setSelectedItems([
        {
          item_name: '',
          brand: '',
          category: value,
          quantity: 1,
          available_quantity: '',
          attachments: [],
        },
      ]);
    } else {
      setSelectedItems((items) =>
        items.map((it) => ({ ...it, category: value }))
      );
    }
    setCategory(value);
  };

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
    if (!['warehousemanager', 'warehouse_keeper'].includes(role)) {
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
    const fetchItems = async () => {
      try {
        const res = await api.get('/api/stock-items');
        setItemsList(res.data || []);
      } catch (err) {
        console.error('Failed to load stock items:', err);
      }
    };

    fetchItems();
  }, []);

  const handleItemChange = (index, field, value) => {
    const updated = [...selectedItems];
    updated[index][field] = field === 'quantity' ? parseInt(value, 10) : value;
    setSelectedItems(updated);
  };

  const handleItemFiles = (index, files) => {
    const updated = [...selectedItems];
    updated[index].attachments = Array.from(files);
    setSelectedItems(updated);
  };

  const addItem = () => {
    setSelectedItems([
      ...selectedItems,
      {
        item_name: '',
        brand: '',
        category,
        quantity: 1,
        available_quantity: '',
        attachments: []
      },
    ]);
  };

  const removeItem = (index) => {
    if (!window.confirm('Remove this item?')) return;
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
    const itemsPayload = selectedItems.map(
      ({ attachments, category, ...rest }) => rest
    );
    formData.append('items', JSON.stringify(itemsPayload));
    attachments.forEach((file) => formData.append('attachments', file));
    selectedItems.forEach((item, idx) => {
      (item.attachments || []).forEach((file) => {
        formData.append(`item_${idx}`, file);
      });
    });

    try {
      setIsSubmitting(true);
      const res = await api.post('/api/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const state = buildRequestSubmissionState('Stock', res.data);
      navigate('/request-submitted', { state });
    } catch (err) {
      console.error('❌ Submission error:', err);
      alert(
        err.response?.data?.message ||
          '❌ Failed to submit request. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">
          Stock Request Form
          <HelpTooltip text="Step 2: Provide details for your stock request." />
        </h1>

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
            <label className="block font-semibold mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="p-2 border rounded"
              disabled={isSubmitting}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-2">Select Items</label>
            {selectedItems.map((item, index) => {
              const filtered = itemsList.filter(
                (stock) =>
                  (!category || stock.category === category) &&
                  stock.name.toLowerCase().includes(item.item_name.toLowerCase())
              );
              return (
                <div key={index} className="flex gap-2 mb-2 items-center flex-wrap">
                  <input
                    type="text"
                    list={`items-${index}`}
                    value={item.item_name}
                    onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                    className="flex-1 p-2 border rounded"
                    required
                    disabled={isSubmitting}
                  />
                  <datalist id={`items-${index}`}>
                    {filtered.map((stock) => (
                      <option key={stock.id} value={stock.name} />
                    ))}
                  </datalist>
                <input
                  type="text"
                  placeholder="Brand (optional)"
                  value={item.brand}
                  onChange={(e) => handleItemChange(index, 'brand', e.target.value)}
                  className="w-36 p-2 border rounded"
                  disabled={isSubmitting}
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Available"
                  value={item.available_quantity}
                  onChange={(e) =>
                    handleItemChange(index, 'available_quantity', e.target.value)
                  }
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
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleItemFiles(index, e.target.files)}
                  className="p-1 border rounded"
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
            );
          })}
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
            <HelpTooltip text="Step 3: Submit the request for approval." />
          </button>
        </form>
      </div>
    </>
  );
};

export default StockRequestForm;