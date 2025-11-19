// src/pages/requests/StockRequestForm.js

import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import { useNavigate } from 'react-router-dom';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';
import ProjectSelector from '../../components/projects/ProjectSelector';
import useCurrentUser from '../../hooks/useCurrentUser';

const createEmptyItem = (overrides = {}) => ({
  item_name: '',
  stock_item_id: '',
  brand: '',
  category: overrides.category ?? '',
  sub_category: overrides.sub_category ?? '',
  quantity: 1,
  available_quantity: '',
  attachments: [],
});

const StockRequestForm = () => {
  const [itemsList, setItemsList] = useState([]);
  const [selectedItems, setSelectedItems] = useState([createEmptyItem()]);
  const [itemSearchTerms, setItemSearchTerms] = useState(['']);
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [sectionId, setSectionId] = useState(null);
  const [projectId, setProjectId] = useState('');
  const { user, loading: userLoading, error: userError } = useCurrentUser();
  const [currentUser, setCurrentUser] = useState(null);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState('');
  const navigate = useNavigate();
  const categories = useMemo(
    () => Array.from(new Set(itemsList.map((it) => it.category))).filter(Boolean),
    [itemsList]
  );
  const subCategories = useMemo(() => {
    const scopedItems = category
      ? itemsList.filter((it) => it.category === category)
      : itemsList;
    return Array.from(new Set(scopedItems.map((it) => it.sub_category))).filter(Boolean);
  }, [category, itemsList]);

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
      setSelectedItems([createEmptyItem({ category: value })]);
      setItemSearchTerms(['']);
    } else {
      setSelectedItems((items) =>
        items.map((it) => ({ ...it, category: value, sub_category: '' }))
      );
    }
    setCategory(value);
    setSubCategory('');
  };

  const handleSubCategoryChange = (value) => {
    setSubCategory(value);
    setSelectedItems((items) => items.map((it) => ({ ...it, sub_category: value })));
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
    }
  }, [navigate]);

  useEffect(() => {
    if (user) {
      setSectionId(user.section_id);
      setCurrentUser(user);
    }
  }, [user]);

  useEffect(() => {
    const fetchItems = async () => {
      setItemsLoading(true);
      setItemsError('');
      try {
        const res = await api.get('/api/stock-items');
        setItemsList(res.data || []);
      } catch (err) {
        console.error('Failed to load stock items:', err);
        setItemsError(err?.response?.data?.message || 'Unable to load stock catalog');
      } finally {
        setItemsLoading(false);
      }
    };

    fetchItems();
  }, []);

  const handleItemChange = (index, field, value) => {
    setSelectedItems((prev) => {
      const updated = [...prev];
      const nextValue = field === 'quantity' ? parseInt(value || 0, 10) : value;
      updated[index] = { ...updated[index], [field]: nextValue };
      return updated;
    });
  };

  const handleSearchTermChange = (index, value) => {
    setItemSearchTerms((terms) => {
      const next = [...terms];
      next[index] = value;
      return next;
    });
  };

  const handleItemSelection = (index, stockItemId) => {
    setSelectedItems((prev) => {
      const updated = [...prev];
      const current = { ...updated[index] };
      if (!stockItemId) {
        updated[index] = {
          ...current,
          stock_item_id: '',
          item_name: '',
          brand: '',
          available_quantity: '',
        };
      } else {
        const matchedItem = itemsList.find((stock) => String(stock.id) === stockItemId);
        if (matchedItem) {
          updated[index] = {
            ...current,
            stock_item_id: matchedItem.id,
            item_name: matchedItem.name,
            brand: matchedItem.brand || '',
            available_quantity: matchedItem.available_quantity ?? '',
            category: matchedItem.category || current.category,
            sub_category: matchedItem.sub_category || current.sub_category,
          };
          if (!category && matchedItem.category) {
            setCategory(matchedItem.category);
          }
          if (!subCategory && matchedItem.sub_category) {
            setSubCategory(matchedItem.sub_category);
          }
        }
      }
      return updated;
    });

    setItemSearchTerms((terms) => {
      const next = [...terms];
      next[index] = '';
      return next;
    });
  };

  const handleItemFiles = (index, files) => {
    const updated = [...selectedItems];
    updated[index].attachments = Array.from(files);
    setSelectedItems(updated);
  };

  const addItem = () => {
    setSelectedItems((items) => [
      ...items,
      createEmptyItem({ category, sub_category: subCategory }),
    ]);
    setItemSearchTerms((terms) => [...terms, '']);
  };

  const removeItem = (index) => {
    if (!window.confirm('Remove this item?')) return;
    setSelectedItems((items) => items.filter((_, i) => i !== index));
    setItemSearchTerms((terms) => terms.filter((_, i) => i !== index));
  };

  const duplicateItem = (index) => {
    const clone = {
      ...selectedItems[index],
      attachments: [],
    };
    setSelectedItems((items) => {
      const next = [...items];
      next.splice(index + 1, 0, clone);
      return next;
    });
    setItemSearchTerms((terms) => {
      const next = [...terms];
      next.splice(index + 1, 0, selectedItems[index]?.item_name || '');
      return next;
    });
  };

  const itemsStats = useMemo(() => {
    const totalQuantity = selectedItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );
    const attachmentCount = selectedItems.reduce(
      (sum, item) => sum + (item.attachments?.length || 0),
      0,
    );
    return {
      totalQuantity,
      attachmentCount,
      count: selectedItems.length,
    };
  }, [selectedItems]);

  const scopedCatalog = useMemo(
    () =>
      itemsList.filter(
        (stock) =>
          (!category || stock.category === category) &&
          (!subCategory || stock.sub_category === subCategory)
      ),
    [itemsList, category, subCategory]
  );

  const catalogPreview = useMemo(() => scopedCatalog.slice(0, 5), [scopedCatalog]);

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
    formData.append('project_id', projectId);
    const itemsPayload = selectedItems.map(
      ({ attachments, category, sub_category, ...rest }) => rest
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

  if (userLoading) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-gray-600 text-center">Loading your profile...</div>
      </>
    );
  }

  if (userError) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-red-600 text-center">
          {userError || 'Unable to load your account'}
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">
          Stock Request Form
          <HelpTooltip text="Step 2: Provide details for your stock request." />
        </h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 mb-6">
          <p className="font-semibold mb-1">Need help preparing a stock request?</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Filter items by category to quickly narrow down catalog entries.</li>
            <li>
              Selecting a known catalog item will pre-fill its brand and available quantity for you.
            </li>
            <li>Use the project link when the request is tied to a specific initiative.</li>
          </ul>
        </div>

        {currentUser && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 border rounded-lg bg-white shadow-sm">
              <p className="text-xs uppercase text-gray-500">Requester</p>
              <p className="font-semibold text-gray-900">{currentUser.full_name}</p>
              <p className="text-sm text-gray-600">{currentUser.role_name}</p>
            </div>
            <div className="p-4 border rounded-lg bg-white shadow-sm">
              <p className="text-xs uppercase text-gray-500">Department</p>
              <p className="font-semibold text-gray-900">{currentUser.department_name}</p>
              <p className="text-sm text-gray-600">
                Section: {currentUser.section_name || 'Not assigned'}
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-white shadow-sm">
              <p className="text-xs uppercase text-gray-500">Summary</p>
              <p className="font-semibold text-gray-900">{itemsStats.count} items</p>
              <p className="text-sm text-gray-600">
                {itemsStats.totalQuantity} total units • {itemsStats.attachmentCount} attachments
              </p>
            </div>
          </div>
        )}

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

          <ProjectSelector
            value={projectId}
            onChange={setProjectId}
            disabled={isSubmitting}
            user={currentUser}
          />

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
            <label className="block font-semibold mb-1">Sub Category</label>
            <select
              value={subCategory}
              onChange={(e) => handleSubCategoryChange(e.target.value)}
              className="p-2 border rounded"
              disabled={isSubmitting || subCategories.length === 0}
            >
              <option value="">All Sub Categories</option>
              {subCategories.map((subCat) => (
                <option key={subCat} value={subCat}>
                  {subCat}
                </option>
              ))}
            </select>
          </div>

          {itemsError && (
            <p className="text-sm text-red-600" role="alert">
              {itemsError}
            </p>
          )}
          {itemsLoading && (
            <p className="text-sm text-gray-500">Loading stock catalog...</p>
          )}

          {!itemsLoading && catalogPreview.length > 0 && (
            <div className="border border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-700 bg-gray-50">
              <p className="font-semibold mb-2">Catalog preview</p>
              <ul className="space-y-1">
                {catalogPreview.map((stock) => (
                  <li key={stock.id} className="flex justify-between">
                    <span>{stock.name}</span>
                    <span className="text-gray-500">
                      {stock.available_quantity ?? '—'} in stock
                    </span>
                  </li>
                ))}
              </ul>
              {itemsList.length > catalogPreview.length && (
                <p className="text-xs text-gray-500 mt-2">
                  Showing {catalogPreview.length} of {itemsList.length} catalog entries.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block font-semibold mb-2">Select Items</label>
            {selectedItems.map((item, index) => {
              const searchTerm = itemSearchTerms[index] || '';
              const normalizedTerm = searchTerm.toLowerCase();
              let filteredOptions = scopedCatalog.filter((stock) => {
                const nameMatch = stock.name
                  .toLowerCase()
                  .includes(normalizedTerm);
                const brandMatch = (stock.brand || '')
                  .toLowerCase()
                  .includes(normalizedTerm);
                return nameMatch || brandMatch;
              });
              const hasSelectedOption = filteredOptions.some(
                (stock) => String(stock.id) === String(item.stock_item_id)
              );
              if (item.stock_item_id && !hasSelectedOption) {
                const matched = scopedCatalog.find(
                  (stock) => String(stock.id) === String(item.stock_item_id)
                );
                if (matched) {
                  filteredOptions = [matched, ...filteredOptions];
                }
              }
              return (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 mb-4 bg-white shadow-sm"
                >
                  <div className="flex justify-between items-center mb-3">
                    <p className="font-semibold">Item #{index + 1}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => duplicateItem(index)}
                        className="text-sm text-blue-600 hover:underline"
                        disabled={isSubmitting}
                      >
                        Duplicate
                      </button>
                      {selectedItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-sm text-red-600 hover:underline"
                          disabled={isSubmitting}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm text-gray-600 mb-1">Search catalog</label>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => handleSearchTermChange(index, e.target.value)}
                        className="w-full p-2 border rounded"
                        disabled={isSubmitting || itemsLoading}
                        placeholder="Type to filter items"
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm text-gray-600 mb-1">Item name</label>
                      <select
                        value={item.stock_item_id}
                        onChange={(e) => handleItemSelection(index, e.target.value)}
                        className="w-full p-2 border rounded"
                        required
                        disabled={isSubmitting || !scopedCatalog.length}
                      >
                        <option value="">Choose an item</option>
                        {filteredOptions.map((stock) => (
                          <option key={stock.id} value={stock.id}>
                            {stock.name}
                            {stock.brand ? ` • ${stock.brand}` : ''} (
                            {stock.available_quantity ?? '—'} in stock)
                          </option>
                        ))}
                      </select>
                      {!filteredOptions.length && scopedCatalog.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          No catalog items match "{searchTerm}".
                        </p>
                      )}
                      {!scopedCatalog.length && (
                        <p className="text-xs text-gray-500 mt-1">
                          No catalog items available for the selected filters.
                        </p>
                      )}
                    </div>
                    <div className="w-40">
                      <label className="block text-sm text-gray-600 mb-1">Brand</label>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={item.brand}
                        onChange={(e) => handleItemChange(index, 'brand', e.target.value)}
                        className="w-full p-2 border rounded"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-sm text-gray-600 mb-1">Available</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={item.available_quantity}
                        onChange={(e) =>
                          handleItemChange(index, 'available_quantity', e.target.value)
                        }
                        className="w-full p-2 border rounded"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-sm text-gray-600 mb-1">Requested</label>
                      <input
                        type="number"
                        min={1}
                        placeholder="0"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-full p-2 border rounded"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm text-gray-600 mb-1">Item attachments</label>
                      <input
                        type="file"
                        multiple
                        onChange={(e) => handleItemFiles(index, e.target.files)}
                        className="w-full p-2 border rounded"
                        disabled={isSubmitting}
                      />
                      {!!item.attachments?.length && (
                        <p className="text-xs text-gray-500 mt-1">
                          {item.attachments.length} file(s) selected
                        </p>
                      )}
                    </div>
                  </div>
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