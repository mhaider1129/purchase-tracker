import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import useCurrentUser from '../../hooks/useCurrentUser';
import ProjectSelector from '../../components/projects/ProjectSelector';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_MB = 10;

const ITRequestForm = () => {
  const { user, loading, error } = useCurrentUser();
  const [justification, setJustification] = useState('');
  const [items, setItems] = useState([getEmptyItem()]);
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [preferredDeliveryDate, setPreferredDeliveryDate] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [deploymentLocation, setDeploymentLocation] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  function getEmptyItem() {
    return { item_name: '', quantity: 1, specs: '', unit_cost: '' };
  }

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    if (field === 'quantity') {
      if (value === '') {
        updated[index][field] = '';
      } else {
        const numeric = Math.max(1, Math.floor(Number(value)) || 1);
        updated[index][field] = numeric;
      }
    } else if (field === 'unit_cost') {
      updated[index][field] = value;
    } else {
      updated[index][field] = value;
    }
    setItems(updated);
  };

  const addItem = () => setItems([...items, getEmptyItem()]);
  const removeItem = (index) => {
    if (items.length === 1) return;
    if (!window.confirm('Remove this item?')) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const duplicateItem = (index) => {
    setItems((prev) => {
      const next = [...prev];
      const cloned = { ...next[index] };
      next.splice(index + 1, 0, cloned);
      return next;
    });
  };

  const totalQuantity = useMemo(
    () =>
      items.reduce((sum, item) => {
        const qty = Number(item.quantity);
        return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
      }, 0),
    [items]
  );

  const estimatedTotalCost = useMemo(
    () =>
      items.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const unit = Number(item.unit_cost) || 0;
        return sum + qty * unit;
      }, 0),
    [items]
  );

  const filledItemCount = useMemo(
    () => items.filter((item) => item.item_name.trim()).length,
    [items]
  );

  const handleAttachmentChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    let nextError = '';
    const nextAttachments = [...attachments];

    files.forEach((file) => {
      if (nextAttachments.length >= MAX_ATTACHMENTS) {
        nextError = `You can upload up to ${MAX_ATTACHMENTS} attachments.`;
        return;
      }

      const sizeInMb = file.size / (1024 * 1024);
      if (sizeInMb > MAX_ATTACHMENT_SIZE_MB) {
        nextError = `Each attachment must be ${MAX_ATTACHMENT_SIZE_MB}MB or smaller.`;
        return;
      }

      const alreadyAdded = nextAttachments.some(
        (existing) => existing.name === file.name && existing.size === file.size
      );
      if (!alreadyAdded) {
        nextAttachments.push(file);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setAttachments(nextAttachments);
    setAttachmentError(nextError);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setAttachmentError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = {};

    if (!justification.trim()) {
      nextErrors.justification = 'Justification is required.';
    }

    if (!user?.department_id) {
      alert('❌ Your account is missing department.');
      return;
    }

    const hasInvalidItem = items.some(
      (item) => !item.item_name.trim() || Number(item.quantity) < 1
    );
    if (hasInvalidItem) {
      nextErrors.items = 'Each item must have a valid name and quantity.';
    }

    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      return;
    }

    setFormErrors({});

    const formData = new FormData();
    formData.append('request_type', 'IT Item');
    const metadataLines = [
      `Priority: ${priority}`,
      preferredDeliveryDate ? `Preferred Delivery: ${preferredDeliveryDate}` : null,
      deploymentLocation ? `Deployment Location: ${deploymentLocation}` : null,
      additionalNotes ? `Additional Notes: ${additionalNotes}` : null,
    ].filter(Boolean);
    const composedJustification = metadataLines.length
      ? `${justification.trim()}\n\n--- Additional Details ---\n${metadataLines.join('\n')}`
      : justification.trim();
    formData.append('justification', composedJustification);
    formData.append('target_department_id', user.department_id);
    formData.append('target_section_id', user.section_id || '');
    formData.append('budget_impact_month', '');
    formData.append('items', JSON.stringify(items));
    formData.append('project_id', projectId || '');
    formData.append('preferred_delivery_date', preferredDeliveryDate || '');
    formData.append('priority', priority);
    formData.append('deployment_location', deploymentLocation);
    formData.append('additional_notes', additionalNotes);
    attachments.forEach((f) => formData.append('attachments', f));

    try {
      setIsSubmitting(true);
      const res = await api.post('/api/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const state = buildRequestSubmissionState('IT Item', res.data);
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
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">IT Item Request Form</h1>
          <HelpTooltip text="Provide justification and detailed specs for the IT items you need." />
        </div>

        <section className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2 text-blue-800">Request Overview</h2>
          <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-blue-900">Items prepared</dt>
              <dd className="font-semibold text-blue-900">
                {filledItemCount}/{items.length}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-blue-900">Total quantity</dt>
              <dd className="font-semibold text-blue-900">{totalQuantity}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-blue-900">Estimated cost</dt>
              <dd className="font-semibold text-blue-900">
                IQD{estimatedTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-blue-900">Priority</dt>
              <dd className="font-semibold text-blue-900">{priority}</dd>
            </div>
          </dl>
        </section>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Requester Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Your Department</label>
                <p className="p-2 border rounded bg-gray-100">{user.department_name}</p>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Your Section</label>
                <p className="p-2 border rounded bg-gray-100">{user.section_name || 'N/A'}</p>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Priority</label>
                <select
                  className="w-full p-2 border rounded"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Preferred Delivery Date</label>
                <input
                  type="date"
                  className="w-full p-2 border rounded"
                  value={preferredDeliveryDate}
                  onChange={(e) => setPreferredDeliveryDate(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-gray-700">Deployment Location (optional)</label>
              <input
                type="text"
                className="w-full p-2 border rounded"
                placeholder="Specify where the IT items will be used"
                value={deploymentLocation}
                onChange={(e) => setDeploymentLocation(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Justification</h2>
            <div>
              <label className="block font-semibold mb-1 text-gray-700" htmlFor="justification">
                Business Justification
              </label>
              <textarea
                id="justification"
                className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-400 ${
                  formErrors.justification ? 'border-red-500' : 'border-gray-300'
                }`}
                rows={4}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explain why these IT items are needed..."
                required
                disabled={isSubmitting}
              />
              <div className="mt-1 flex justify-between text-sm text-gray-500">
                <span>{justification.length} characters</span>
                {formErrors.justification && (
                  <span className="text-red-600">{formErrors.justification}</span>
                )}
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-gray-700" htmlFor="additional-notes">
                Additional Context (optional)
              </label>
              <textarea
                id="additional-notes"
                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-200 border-gray-300"
                rows={3}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Share vendor preferences, asset tags to be replaced, or any other notes"
                disabled={isSubmitting}
              />
            </div>
          </section>

          <ProjectSelector
            value={projectId}
            onChange={setProjectId}
            disabled={isSubmitting}
            user={user}
          />

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-800">Items</h2>
              <span className="text-sm text-gray-500">Provide as much detail as possible for each item.</span>
            </div>
            {formErrors.items && (
              <p className="text-sm text-red-600">{formErrors.items}</p>
            )}
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={`${index}-${item.item_name}`}
                  className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="font-semibold text-gray-700">Item {index + 1}</span>
                      {item.item_name && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{item.item_name}</span>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => duplicateItem(index)}
                        className="text-sm text-blue-600 hover:underline disabled:text-blue-300"
                        disabled={isSubmitting}
                      >
                        Duplicate
                      </button>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-sm text-red-600 hover:underline disabled:text-red-300"
                          disabled={isSubmitting}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-gray-700">Item Name</label>
                      <input
                        type="text"
                        placeholder={'e.g., 14" Laptop'}
                        value={item.item_name}
                        onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-300"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-gray-700">Quantity</label>
                      <input
                        type="number"
                        min={1}
                        placeholder="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-300"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-gray-700">Estimated Unit Cost (IQD)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="e.g., 45000"
                        value={item.unit_cost}
                        onChange={(e) => handleItemChange(index, 'unit_cost', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-300"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-gray-700">Specs / Notes</label>
                      <input
                        type="text"
                        placeholder="Processor, RAM, storage, accessories, etc."
                        value={item.specs}
                        onChange={(e) => handleItemChange(index, 'specs', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-300"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addItem}
                className="text-blue-600 font-semibold hover:underline disabled:text-blue-300"
                disabled={isSubmitting}
              >
                + Add Another Item
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">Attachments</h2>
            <p className="text-sm text-gray-500">
              Attach supporting documents such as quotations or screenshots. Accepted up to {MAX_ATTACHMENTS} files, {MAX_ATTACHMENT_SIZE_MB}MB each.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleAttachmentChange}
              className="p-2 border border-dashed border-gray-400 rounded w-full text-sm"
              disabled={isSubmitting}
            />
            {attachmentError && <p className="text-sm text-red-600">{attachmentError}</p>}
            {attachments.length > 0 && (
              <ul className="space-y-2 text-sm">
                {attachments.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-sm text-red-600 hover:underline disabled:text-red-300"
                      disabled={isSubmitting}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold shadow-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed`}
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