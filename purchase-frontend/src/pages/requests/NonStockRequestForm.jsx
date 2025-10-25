// src/pages/requests/NonStockRequestForm.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import useCurrentUser from '../../hooks/useCurrentUser';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';

const NonStockRequestForm = () => {
  const [justification, setJustification] = useState('');
  const [items, setItems] = useState([getEmptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [itemErrors, setItemErrors] = useState([{}]);
  const [requestAttachmentsError, setRequestAttachmentsError] = useState('');
  const [departmentLimitError, setDepartmentLimitError] = useState('');

  const { user, loading, error } = useCurrentUser();
  const targetDeptId = user?.department_id;
  const targetSectionId = user?.section_id;
  const navigate = useNavigate();

  const allowedExtensions = useMemo(
    () => ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.xlsx'],
    []
  );
  const MAX_ATTACHMENT_SIZE_MB = 20;
  const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
  const MAX_ITEMS_PER_REQUEST = 10;

  useEffect(() => {
    setItemErrors((prev) => {
      if (items.length === prev.length) return prev;
      const next = items.map((_, idx) => prev[idx] || {});
      return next;
    });
  }, [items]);

  function getEmptyItem() {
    return {
      item_name: '',
      quantity: 1,
      unit_cost: '',
      brand: '',
      available_quantity: '',
      intended_use: '',
      specs: '',
      attachments: [],
    };
  }

    const validateFiles = (files) => {
    const errors = [];
    const validFiles = [];

    files.forEach((file) => {
      const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
      if (!allowedExtensions.includes(ext)) {
        errors.push(`Unsupported file type (${ext}). Allowed: ${allowedExtensions.join(', ')}`);
        return;
      }

      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        errors.push(`${file.name} exceeds the ${MAX_ATTACHMENT_SIZE_MB}MB size limit.`);
        return;
      }

      validFiles.push(file);
    });

    return { validFiles, error: errors.join(' ') };
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    const numericFields = ['quantity', 'unit_cost', 'available_quantity'];
    if (numericFields.includes(field)) {
      const numberValue = value === '' ? '' : Number(value);
      updated[index][field] = Number.isNaN(numberValue) ? '' : numberValue;
    } else {
      updated[index][field] = value;
    }
    setItems(updated);
  
    setItemErrors((prev) => {
      const next = [...prev];
      const cleaned = { ...next[index] };
      delete cleaned[field];
      next[index] = cleaned;
      return next;
    });
  };

  const handleItemFiles = (index, files) => {
    const incomingFiles = Array.from(files || []);
    const { validFiles, error } = validateFiles(incomingFiles);

    const updated = [...items];
    updated[index].attachments = validFiles;
    setItems(updated);

    setItemErrors((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], attachments: error };
      return next;
    });
  };

  const addItem = () => {
    if (items.length >= MAX_ITEMS_PER_REQUEST) {
      setDepartmentLimitError(
        `Your department can request up to ${MAX_ITEMS_PER_REQUEST} items per submission. Please start a second request for additional needs.`
      );
      return;
    }
    setDepartmentLimitError('');
    setItems([...items, getEmptyItem()]);
  };

  const removeItem = (index) => {
    if (items.length === 1) return;
    if (!window.confirm('Remove this item?')) return;
    setItems(items.filter((_, i) => i !== index));
    setItemErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const validateItems = () => {
    let hasErrors = false;
    const nextErrors = items.map((item) => {
      const errs = {};
      if (!item.item_name.trim()) {
        errs.item_name = 'Item name is required.';
      }
      if (!item.quantity || Number(item.quantity) < 1) {
        errs.quantity = 'Quantity must be at least 1.';
      }
      if (!item.intended_use.trim()) {
        errs.intended_use = 'Intended use is needed so approvers understand the requirement.';
      }
      if (!item.specs.trim()) {
        errs.specs = 'Please include specifications or key requirements.';
      }

      const { error } = validateFiles(item.attachments || []);
      if (error) {
        errs.attachments = error;
      }

      if (Object.keys(errs).length > 0) {
        hasErrors = true;
      }

      return errs;
    });

    setItemErrors(nextErrors);

    if (items.length > MAX_ITEMS_PER_REQUEST) {
      setDepartmentLimitError(
        `Your department can request up to ${MAX_ITEMS_PER_REQUEST} items per submission. Please start a second request for additional needs.`
      );
      hasErrors = true;
    } else {
      setDepartmentLimitError('');
    }

    const { error: attachmentsError } = validateFiles(attachments);
    if (attachmentsError) {
      setRequestAttachmentsError(attachmentsError);
      hasErrors = true;
    } else {
      setRequestAttachmentsError('');
    }

    return !hasErrors;
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

    if (!validateItems()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const formData = new FormData();
    formData.append('request_type', 'Non-Stock');
    formData.append('justification', justification);
    formData.append('budget_impact_month', '');
    formData.append('target_department_id', targetDeptId);
    formData.append('target_section_id', targetSectionId || '');
    const itemsPayload = items.map(({ attachments: itemAttachments, ...rest }) => rest);
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
      const res = await api.post('/api/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const state = buildRequestSubmissionState('Non-Stock', res.data);
      navigate('/request-submitted', { state });
      setRequestAttachmentsError('');
      setItemErrors([{}]);
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
            <p className="text-sm text-gray-500 mb-2">
              Provide detailed specs and intended use for faster approvals. Your department can include up to {MAX_ITEMS_PER_REQUEST} line items per request.
            </p>
            {departmentLimitError && (
              <p className="text-sm text-red-600 mb-2">{departmentLimitError}</p>
            )}
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
                {itemErrors[index]?.item_name && (
                  <p className="text-sm text-red-600 w-full">{itemErrors[index].item_name}</p>
                )}
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Unit Cost"
                  aria-label={`Item ${index + 1} Unit Cost`}
                  value={item.unit_cost}
                  onChange={(e) => handleItemChange(index, 'unit_cost', e.target.value)}
                  className="w-32 p-2 border rounded"
                  required
                  disabled={isSubmitting}
                />
                <input
                  type="text"
                  placeholder="Brand (optional)"
                  aria-label={`Item ${index + 1} Brand`}
                  value={item.brand}
                  onChange={(e) => handleItemChange(index, 'brand', e.target.value)}
                  className="flex-1 p-2 border rounded"
                  disabled={isSubmitting}
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Available Qty (optional)"
                  aria-label={`Item ${index + 1} Available Quantity`}
                  value={item.available_quantity}
                  onChange={(e) =>
                    handleItemChange(index, 'available_quantity', e.target.value)
                  }
                  className="w-40 p-2 border rounded"
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
                {itemErrors[index]?.quantity && (
                  <p className="text-sm text-red-600 w-full">{itemErrors[index].quantity}</p>
                )}
                <input
                  type="text"
                  placeholder="Intended Use"
                  aria-label={`Item ${index + 1} Intended Use`}
                  value={item.intended_use}
                  onChange={(e) => handleItemChange(index, 'intended_use', e.target.value)}
                  className="flex-1 p-2 border rounded"
                  disabled={isSubmitting}
                />
                {itemErrors[index]?.intended_use && (
                  <p className="text-sm text-red-600 w-full">{itemErrors[index].intended_use}</p>
                )}
                <input
                  type="text"
                  placeholder="Specs"
                  aria-label={`Item ${index + 1} Specs`}
                  value={item.specs}
                  onChange={(e) => handleItemChange(index, 'specs', e.target.value)}
                  className="flex-1 p-2 border rounded"
                  disabled={isSubmitting}
                />
                {itemErrors[index]?.specs && (
                  <p className="text-sm text-red-600 w-full">{itemErrors[index].specs}</p>
                )}
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleItemFiles(index, e.target.files)}
                  className="p-1 border rounded"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500 w-full">
                  Accepted: {allowedExtensions.join(', ')} • Max {MAX_ATTACHMENT_SIZE_MB}MB per file
                </p>
                {itemErrors[index]?.attachments && (
                  <p className="text-sm text-red-600 w-full">{itemErrors[index].attachments}</p>
                )}
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
            <label className="block font-semibold mb-1">Additional Attachments</label>
            <input
              type="file"
              multiple
              onChange={(e) => {
                const incoming = Array.from(e.target.files || []);
                const { validFiles, error } = validateFiles(incoming);
                setAttachments(validFiles);
                setRequestAttachmentsError(error);
              }}
              className="p-2 border rounded w-full"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500">
              Accepted: {allowedExtensions.join(', ')} • Max {MAX_ATTACHMENT_SIZE_MB}MB per file
            </p>
            {requestAttachmentsError && (
              <p className="text-sm text-red-600">{requestAttachmentsError}</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end">
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