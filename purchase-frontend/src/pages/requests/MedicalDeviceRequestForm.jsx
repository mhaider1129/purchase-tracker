// src/pages/requests/MedicalDeviceRequestForm.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import useCurrentUser from '../../hooks/useCurrentUser';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';
import ProjectSelector from '../../components/projects/ProjectSelector';

const MedicalDeviceRequestForm = () => {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();

  const [justification, setJustification] = useState('');
  const [items, setItems] = useState([getEmptyItem()]);
  const [itemErrors, setItemErrors] = useState([{}]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [requestAttachmentsError, setRequestAttachmentsError] = useState('');
  const [projectId, setProjectId] = useState('');

  const allowedExtensions = useMemo(
    () => ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.xlsx'],
    []
  );
  const MAX_ATTACHMENT_SIZE_MB = 20;
  const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
  const MAX_ITEMS_PER_REQUEST = 25;

  const allowedExtensionsDisplay = useMemo(
    () => allowedExtensions.join(', '),
    [allowedExtensions]
  );

  const purchaseTypeOptions = useMemo(
    () => ['First Time', 'Replacement', 'Addition'],
    []
  );

  const specGuidance = useMemo(
    () => [
      'Highlight key clinical requirements or performance specifications.',
      'Mention compatibility needs with existing hospital systems or accessories.',
      'Indicate regulatory certifications or approvals that are required.',
    ],
    []
  );

  const formatFileSize = useCallback((bytes) => {
    if (!Number.isFinite(bytes)) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    const decimals = size < 10 && unitIndex > 0 ? 1 : 0;
    return `${size.toFixed(decimals)} ${units[unitIndex]}`;
  }, []);

  const validateFiles = useCallback(
    (files) => {
      const errors = [];
      const validFiles = [];
      const allowedList = allowedExtensions.join(', ');

      files.forEach((file) => {
        const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
        if (!allowedExtensions.includes(ext)) {
          errors.push(
            `Unsupported file type: ${ext || 'unknown'}. Allowed: ${allowedList}.`
          );
          return;
        }

        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          errors.push(
            `${file.name} is too large. Maximum size is ${MAX_ATTACHMENT_SIZE_MB} MB.`
          );
          return;
        }

        validFiles.push(file);
      });

      return { validFiles, error: errors.join(' ') };
    },
    [allowedExtensions, MAX_ATTACHMENT_SIZE_BYTES, MAX_ATTACHMENT_SIZE_MB]
  );

  useEffect(() => {
    setItemErrors((prev) => {
      if (prev.length === items.length) return prev;
      const next = items.map((_, index) => prev[index] || {});
      return next;
    });
  }, [items]);

  const totalEstimatedCost = useMemo(
    () =>
      items.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const cost = Number(item.unit_cost) || 0;
        return sum + qty * cost;
      }, 0),
    [items]
  );

  const totalDeviceCount = useMemo(
    () =>
      items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [items]
  );

  const formattedTotalCost = useMemo(
    () =>
      totalEstimatedCost.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [totalEstimatedCost]
  );

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
    if (['quantity', 'unit_cost'].includes(field)) {
      const numericValue = value === '' ? '' : Number(value);
      updated[index][field] = Number.isNaN(numericValue) ? '' : numericValue;
    } else {
      updated[index][field] = value;
    }
    setItems(updated);

    setItemErrors((prev) => {
      const next = [...prev];
      const cleaned = { ...(next[index] || {}) };
      delete cleaned[field];
      next[index] = cleaned;
      return next;
    });
  };

  const handleItemFiles = (index, files) => {
    const incomingFiles = Array.from(files || []);
    const { validFiles, error } = validateFiles(incomingFiles);

    setItems((prevItems) => {
      const next = [...prevItems];
      const existing = next[index]?.attachments || [];
      next[index] = {
        ...next[index],
        attachments: [...existing, ...validFiles],
      };
      return next;
    });

    setItemErrors((prev) => {
      const next = [...prev];
      if (error) {
        next[index] = { ...next[index], attachments: error };
      } else {
        const cleaned = { ...(next[index] || {}) };
        delete cleaned.attachments;
        next[index] = cleaned;
      }
      return next;
    });
  };

  const handleRemoveItemAttachment = (itemIndex, attachmentIndex) => {
    let updatedAttachments = [];
    setItems((prevItems) => {
      const next = [...prevItems];
      const attachments = [...(next[itemIndex]?.attachments || [])];
      attachments.splice(attachmentIndex, 1);
      updatedAttachments = attachments;
      next[itemIndex] = {
        ...next[itemIndex],
        attachments,
      };
      return next;
    });

    setItemErrors((prev) => {
      const next = [...prev];
      const { error } = validateFiles(updatedAttachments);
      if (error) {
        next[itemIndex] = { ...next[itemIndex], attachments: error };
      } else {
        const cleaned = { ...(next[itemIndex] || {}) };
        delete cleaned.attachments;
        next[itemIndex] = cleaned;
      }
      return next;
    });
  };

  const handleRequestAttachments = (files) => {
    const incomingFiles = Array.from(files || []);
    const { validFiles, error } = validateFiles(incomingFiles);

    setAttachments((prev) => [...prev, ...validFiles]);
    setRequestAttachmentsError(error);
  };

  const handleRemoveRequestAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setRequestAttachmentsError('');
  };

  const addItem = () => {
    if (items.length >= MAX_ITEMS_PER_REQUEST) {
      alert(`You can only request up to ${MAX_ITEMS_PER_REQUEST} devices per submission.`);
      return;
    }
    setItems([...items, getEmptyItem()]);
    setItemErrors((prev) => [...prev, {}]);
  };
  const removeItem = (index) => {
    if (items.length === 1) return;
    if (!window.confirm('Remove this item?')) return;
    setItems(items.filter((_, i) => i !== index));
    setItemErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = items.map(() => ({}));
    let hasItemErrors = false;

    items.forEach((item, index) => {
      if (!item.item_name.trim()) {
        nextErrors[index].item_name = 'Item name is required.';
        hasItemErrors = true;
      }
      if (!item.purchase_type.trim()) {
        nextErrors[index].purchase_type = 'Select the purchase type.';
        hasItemErrors = true;
      }
      if (item.quantity === '' || Number(item.quantity) < 1) {
        nextErrors[index].quantity = 'Quantity must be at least 1.';
        hasItemErrors = true;
      }
      if (item.unit_cost === '' || Number(item.unit_cost) < 0) {
        nextErrors[index].unit_cost = 'Unit cost is required.';
        hasItemErrors = true;
      }

      const { error: attachmentError } = validateFiles(item.attachments || []);
      if (attachmentError) {
        nextErrors[index].attachments = attachmentError;
        hasItemErrors = true;
      }
    });

    setItemErrors(nextErrors);

    const { error: attachmentsError } = validateFiles(attachments);
    setRequestAttachmentsError(attachmentsError);

    if (!justification.trim()) {
      alert('❌ Justification is required.');
      return;
    }

    if (!user?.department_id) {
      alert('❌ Your department info is missing.');
      return;
    }

    if (hasItemErrors || attachmentsError) {
      alert('❌ Please resolve the highlighted errors before submitting.');
      return;
    }

    const formData = new FormData();
    formData.append('request_type', 'Medical Device');
    formData.append('justification', justification);
    formData.append('target_department_id', user.department_id);
    formData.append('target_section_id', user.section_id || '');
    formData.append('budget_impact_month', '');
    formData.append('project_id', projectId);
    const itemsPayload = items.map(({ attachments, ...rest }) => ({
      ...rest,
      quantity: Number(rest.quantity) || 0,
      unit_cost: Number(rest.unit_cost) || 0,
    }));
    formData.append('items', JSON.stringify(itemsPayload));
    attachments.forEach((file) => formData.append('attachments', file));
    items.forEach((item, idx) => {
      (item.attachments || []).forEach((file) => {
        formData.append(`item_${idx}`, file);
      });
    });

    setIsSubmitting(true);
    try {
      const res = await api.post('/api/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const state = buildRequestSubmissionState('Medical Device', res.data);
      navigate('/request-submitted', { state });
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
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-blue-900">Request overview</h2>
              <p className="text-sm text-blue-800">
                Track totals as you add devices and supporting information.
              </p>
            </div>
            <dl className="flex flex-wrap gap-6 text-blue-900">
              <div>
                <dt className="text-xs uppercase tracking-wide text-blue-700">Line items</dt>
                <dd className="text-xl font-bold">{items.length}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-blue-700">Total devices</dt>
                <dd className="text-xl font-bold">{totalDeviceCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-blue-700">Estimated total</dt>
                <dd className="text-xl font-bold">≈ {formattedTotalCost}</dd>
              </div>
            </dl>
          </div>

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
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why the medical device is needed, referencing patient or service impact..."
              required
              disabled={isSubmitting}
            />
          </div>

          <ProjectSelector
            value={projectId}
            onChange={setProjectId}
            disabled={isSubmitting}
            user={user}
          />

          {/* Items */}
          {items.map((item, index) => {
            const errors = itemErrors[index] || {};
            return (
              <div key={index} className="border p-4 rounded bg-gray-50 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Device {index + 1}
                  </h2>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="self-start text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      ✕ Remove Device
                    </button>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Device name<span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Portable ultrasound machine"
                      value={item.item_name}
                      onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                      className={`mt-1 w-full rounded border p-2 ${
                        errors.item_name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                      disabled={isSubmitting}
                    />
                    {errors.item_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.item_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Quantity<span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className={`mt-1 w-full rounded border p-2 ${
                        errors.quantity ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                      disabled={isSubmitting}
                    />
                    {errors.quantity && (
                      <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Unit cost<span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unit_cost}
                      onChange={(e) => handleItemChange(index, 'unit_cost', e.target.value)}
                      className={`mt-1 w-full rounded border p-2 ${
                        errors.unit_cost ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                      disabled={isSubmitting}
                    />
                    {errors.unit_cost && (
                      <p className="mt-1 text-sm text-red-600">{errors.unit_cost}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Intended use
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Describe the clinical or operational use for this device"
                      value={item.intended_use}
                      onChange={(e) => handleItemChange(index, 'intended_use', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 p-2"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      Technical specifications
                      <HelpTooltip text="Include the critical specs procurement should verify (e.g. modalities, power, accessories)." />
                    </label>
                    <textarea
                      rows={3}
                      placeholder="List key specifications and configuration requirements"
                      value={item.specs}
                      onChange={(e) => handleItemChange(index, 'specs', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 p-2"
                      disabled={isSubmitting}
                    />
                    {index === 0 && specGuidance.length > 0 && (
                      <div className="mt-2 rounded border border-blue-100 bg-blue-50 p-2 text-xs text-blue-900">
                        <p className="font-semibold">Specification tips</p>
                        <ul className="list-disc pl-4 space-y-1">
                          {specGuidance.map((tip) => (
                            <li key={tip}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Recommended brand / device info
                    </label>
                    <input
                      type="text"
                      placeholder="Optional brand, model, or vendor preference"
                      value={item.device_info}
                      onChange={(e) => handleItemChange(index, 'device_info', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 p-2"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Purchase type<span className="text-red-600">*</span>
                    </label>
                    <select
                      value={item.purchase_type}
                      onChange={(e) => handleItemChange(index, 'purchase_type', e.target.value)}
                      className={`mt-1 w-full rounded border p-2 ${
                        errors.purchase_type ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                      disabled={isSubmitting}
                    >
                      {purchaseTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {errors.purchase_type && (
                      <p className="mt-1 text-sm text-red-600">{errors.purchase_type}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Supporting documents
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      handleItemFiles(index, e.target.files);
                      e.target.value = '';
                    }}
                    className="mt-1 w-full rounded border border-gray-300 p-2"
                    disabled={isSubmitting}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Allowed: {allowedExtensionsDisplay}. Max size {MAX_ATTACHMENT_SIZE_MB} MB per file.
                  </p>
                  {errors.attachments && (
                    <p className="mt-1 text-sm text-red-600">{errors.attachments}</p>
                  )}
                  {(item.attachments || []).length > 0 && (
                    <ul className="mt-2 space-y-2 text-sm">
                      {item.attachments.map((file, fileIdx) => (
                        <li
                          key={`${file.name}-${fileIdx}`}
                          className="flex flex-col gap-1 rounded border border-gray-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                            <span className="font-medium text-gray-800">{file.name}</span>
                            <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemAttachment(index, fileIdx)}
                            className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                            disabled={isSubmitting}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}

          <div>
            <label className="block font-semibold mb-1">Request attachments</label>
            <input
              type="file"
              multiple
              onChange={(e) => {
                handleRequestAttachments(e.target.files);
                e.target.value = '';
              }}
              className="w-full rounded border border-gray-300 p-2"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              Attach quotes or approvals covering the entire request. Allowed: {allowedExtensionsDisplay}. Max {MAX_ATTACHMENT_SIZE_MB} MB per file.
            </p>
            {requestAttachmentsError && (
              <p className="mt-1 text-sm text-red-600">{requestAttachmentsError}</p>
            )}
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-2 text-sm">
                {attachments.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex flex-col gap-1 rounded border border-gray-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                      <span className="font-medium text-gray-800">{file.name}</span>
                      <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveRequestAttachment(index)}
                      className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <button
              type="button"
              onClick={addItem}
              className="text-blue-600 font-semibold disabled:opacity-50"
              disabled={isSubmitting}
            >
              + Add another device
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