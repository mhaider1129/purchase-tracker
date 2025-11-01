import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import useCurrentUser from '../../hooks/useCurrentUser';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';
import ProjectSelector from '../../components/projects/ProjectSelector';

const MedicationRequestForm = () => {
  const [justification, setJustification] = useState('');
  const [items, setItems] = useState([{ item_name: '', dosage: '', quantity: 1 }]);
  const [itemErrors, setItemErrors] = useState([{}]);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsError, setAttachmentsError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectId, setProjectId] = useState('');

  const { user, loading, error } = useCurrentUser();
  const targetDeptId = user?.department_id;
  const targetSectionId = user?.section_id;
  const isScm = useMemo(() => (user?.role || '').toLowerCase() === 'scm', [user?.role]);
  const navigate = useNavigate();

  const MAX_ATTACHMENT_SIZE_MB = 10;
  const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
  const allowedExtensions = useMemo(
    () => ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.xlsx'],
    []
  );

  useEffect(() => {
    setItemErrors((prev) => {
      if (prev.length === items.length) return prev;
      return items.map((_, index) => prev[index] || {});
    });
  }, [items]);

  const medicationSummary = useMemo(() => {
    const totalQuantity = items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );
    const uniqueNames = new Set(
      items
        .map((item) => item.item_name.trim().toLowerCase())
        .filter(Boolean)
    );
    const missingDosage = items.some((item) => !item.dosage.trim());

    return {
      totalQuantity,
      uniqueCount: uniqueNames.size,
      itemCount: items.length,
      missingDosage,
    };
  }, [items]);

  const validateItemField = (field, value) => {
    if (field === 'item_name' && !value.trim()) {
      return 'Medication name is required.';
    }
    if (field === 'dosage' && !value.trim()) {
      return 'Please specify a dosage.';
    }
    if (field === 'quantity') {
      const qty = Number(value);
      if (!Number.isInteger(qty) || qty < 1) {
        return 'Quantity must be a whole number greater than 0.';
      }
    }
    return '';
  };

  const validateItem = (item) =>
    Object.fromEntries(
      ['item_name', 'dosage', 'quantity']
        .map((field) => {
          const error = validateItemField(field, item[field]);
          return error ? [field, error] : null;
        })
        .filter(Boolean)
    );

  const validateAttachmentList = (files) => {
    const errors = [];
    const validFiles = [];
    const allowedList = allowedExtensions.join(', ');

    files.forEach((file) => {
      const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
      if (!allowedExtensions.includes(ext)) {
        errors.push(`Unsupported file type ${ext}. Allowed: ${allowedList}`);
        return;
      }

      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        errors.push(
          `${file.name} exceeds ${MAX_ATTACHMENT_SIZE_MB}MB. Please upload a smaller file.`
        );
        return;
      }

      validFiles.push(file);
    });

    return { validFiles, error: errors.join(' ') };
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = field === 'quantity' ? Number(value) || '' : value;
    setItems(updated);

    setItemErrors((prev) => {
      const next = [...prev];
      const existing = { ...(next[index] || {}) };
      const errorMessage = validateItemField(field, updated[index][field]);
      if (errorMessage) {
        existing[field] = errorMessage;
      } else {
        delete existing[field];
      }
      next[index] = existing;
      return next;
    });
  };

  const addItem = () => {
    setItems([...items, { item_name: '', dosage: '', quantity: 1 }]);
    setItemErrors((prev) => [...prev, {}]);
  };

  const duplicateItem = (index) => {
    setItems((prevItems) => {
      const next = [...prevItems];
      const duplicate = { ...next[index] };
      next.splice(index + 1, 0, duplicate);
      return next;
    });
    setItemErrors((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, { ...next[index] });
      return next;
    });
  };

  const removeItem = (index) => {
    if (items.length === 1) return;
    if (!window.confirm('Remove this item?')) return;
    setItems(items.filter((_, i) => i !== index));
    setItemErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAttachmentChange = (fileList) => {
    const files = Array.from(fileList || []);
    const { validFiles, error } = validateAttachmentList(files);
    setAttachments(validFiles);
    setAttachmentsError(error);
  };

  const handleRemoveAttachment = (attachmentIndex) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== attachmentIndex));
    setAttachmentsError('');
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

    const itemValidationResults = items.map((item) => validateItem(item));
    const hasInvalidItem = itemValidationResults.some(
      (result) => Object.keys(result).length > 0
    );
    if (hasInvalidItem) {
      setItemErrors(itemValidationResults);
      alert('❌ Each item must include a medication name, dosage, and valid quantity.');
      return;
    }

    if (attachmentsError) {
      alert('❌ Please resolve attachment issues before submitting.');
      return;
    }

    const formData = new FormData();
    formData.append('request_type', 'Medication');
    formData.append('justification', justification);
    formData.append('budget_impact_month', '');
    formData.append('target_department_id', targetDeptId);
    formData.append('target_section_id', targetSectionId || '');
    formData.append('items', JSON.stringify(items));
    formData.append('project_id', projectId);
    attachments.forEach((file) => formData.append('attachments', file));

    try {
      setIsSubmitting(true);
      const res = await api.post('/api/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const state = buildRequestSubmissionState('Medication', res.data);
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

  if (!user.can_request_medication && !isScm) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-red-600 text-center">
          ❌ You are not authorized to submit medication requests.
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">
          Medication Request Form
          <HelpTooltip text="Provide medication details for your request." />
        </h1>

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
              placeholder="Explain the need for these medications..."
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
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block font-semibold">Medications</label>
              <span className="text-sm text-gray-500">
                {medicationSummary.itemCount} listed · Total quantity {medicationSummary.totalQuantity}
              </span>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900 mb-4">
              <p className="font-semibold">Quick summary</p>
              <p>
                {medicationSummary.uniqueCount} unique medication
                {medicationSummary.uniqueCount === 1 ? '' : 's'} requested.
              </p>
              <p
                className={
                  medicationSummary.missingDosage
                    ? 'text-red-700 font-medium'
                    : 'text-blue-900'
                }
              >
                {medicationSummary.missingDosage
                  ? 'At least one entry is missing a dosage specification.'
                  : 'All medications include dosage details.'}
              </p>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-700">
                      Medication {index + 1}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => duplicateItem(index)}
                        className="text-blue-600 hover:underline disabled:text-gray-400"
                        disabled={isSubmitting}
                      >
                        Duplicate
                      </button>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:underline disabled:text-gray-400"
                          disabled={isSubmitting}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <input
                        type="text"
                        placeholder="Medication Name"
                        aria-label={`Item ${index + 1} Name`}
                        value={item.item_name}
                        onChange={(e) =>
                          handleItemChange(index, 'item_name', e.target.value)
                        }
                        className={`w-full p-2 border rounded ${
                          itemErrors[index]?.item_name ? 'border-red-400' : ''
                        }`}
                        required
                        disabled={isSubmitting}
                      />
                      {itemErrors[index]?.item_name && (
                        <p className="mt-1 text-sm text-red-600">
                          {itemErrors[index].item_name}
                        </p>
                      )}
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <input
                        type="text"
                        placeholder="Dosage"
                        aria-label={`Item ${index + 1} Dosage`}
                        value={item.dosage}
                        onChange={(e) =>
                          handleItemChange(index, 'dosage', e.target.value)
                        }
                        className={`w-full p-2 border rounded ${
                          itemErrors[index]?.dosage ? 'border-red-400' : ''
                        }`}
                        disabled={isSubmitting}
                      />
                      {itemErrors[index]?.dosage && (
                        <p className="mt-1 text-sm text-red-600">
                          {itemErrors[index].dosage}
                        </p>
                      )}
                    </div>
                    <div className="w-full sm:w-32">
                      <input
                        type="number"
                        min={1}
                        aria-label={`Item ${index + 1} Quantity`}
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(index, 'quantity', e.target.value)
                        }
                        className={`w-full p-2 border rounded ${
                          itemErrors[index]?.quantity ? 'border-red-400' : ''
                        }`}
                        required
                        disabled={isSubmitting}
                      />
                      {itemErrors[index]?.quantity && (
                        <p className="mt-1 text-sm text-red-600">
                          {itemErrors[index].quantity}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="text-blue-600 mt-3 font-semibold hover:underline disabled:text-gray-400"
              disabled={isSubmitting}
            >
              + Add Another Medication
            </button>
          </div>
          <div>
            <label className="block font-semibold mb-1">
              Attachments
              <HelpTooltip text="Upload supporting documents (max 10MB each)." />
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => handleAttachmentChange(e.target.files)}
              className="p-2 border rounded w-full"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-sm text-gray-500">
              Accepted formats: {allowedExtensions.join(', ')}
            </p>
            {attachmentsError && (
              <p className="mt-1 text-sm text-red-600">{attachmentsError}</p>
            )}
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {attachments.map((file, index) => (
                  <li
                    key={file.name + index}
                    className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2"
                  >
                    <span className="truncate pr-3">{file.name}</span>
                    <button
                      type="button"
                      className="text-red-600 hover:underline disabled:text-gray-400"
                      onClick={() => handleRemoveAttachment(index)}
                      disabled={isSubmitting}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
              <HelpTooltip text="Submit the request for approval." />
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default MedicationRequestForm;