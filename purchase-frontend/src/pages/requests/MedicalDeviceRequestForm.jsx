// src/pages/requests/MedicalDeviceRequestForm.jsx
import { useTranslation } from 'react-i18next';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, FileText, HeartPulse, Paperclip, Send } from 'lucide-react';
import './MedicalDeviceRequestForm.css';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import useCurrentUser from '../../hooks/useCurrentUser';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';
import ProjectSelector from '../../components/projects/ProjectSelector';
import AmountInput from '../../components/ui/AmountInput';
import UrgentRequestToggle from '../../components/requests/UrgentRequestToggle';

const MedicalDeviceRequestForm = () => {
  const { t } = useTranslation();
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();

  const [justification, setJustification] = useState('');
  const [items, setItems] = useState([getEmptyItem()]);
  const [itemErrors, setItemErrors] = useState([{}]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
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
      unit_cost: 0,
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
      alert(t('medicalDeviceRequestForm.alerts.maxItems', { max: MAX_ITEMS_PER_REQUEST }));
      return;
    }
    setItems([...items, getEmptyItem()]);
    setItemErrors((prev) => [...prev, {}]);
  };
  const removeItem = (index) => {
    if (items.length === 1) return;
    if (!window.confirm(t('medicalDeviceRequestForm.alerts.removeItem'))) return;
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
      alert(t('medicalDeviceRequestForm.alerts.justificationRequired'));
      return;
    }

    if (!user?.department_id) {
      alert(t('medicalDeviceRequestForm.alerts.missingDepartment'));
      return;
    }

    if (hasItemErrors || attachmentsError) {
      alert(t('medicalDeviceRequestForm.alerts.resolveErrors'));
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
    formData.append('is_urgent', isUrgent ? 'true' : 'false');
    attachments.forEach((file) => formData.append('attachments', file));
    items.forEach((item, idx) => {
      (item.attachments || []).forEach((file) => {
        formData.append(`item_${idx}`, file);
      });
    });

    setIsSubmitting(true);
    try {
      const res = await api.post('/requests', formData);
      const state = buildRequestSubmissionState('Medical Device', res.data);
      navigate('/request-submitted', { state });
    } catch (err) {
      console.error('❌ Submission error:', err);
      alert(err.response?.data?.message || t('medicalDeviceRequestForm.alerts.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
          <div className="p-6">{t('medicalDeviceRequestForm.loading')}</div>
      </>
    );
  }

  return (
    <>
      <main className="medical-device-page">
        <header className="mdr-header"><span className="mdr-eyebrow"><HeartPulse size={16} />{t('medicalDeviceRequestForm.layout.eyebrow')}</span>
        <h1 className="text-2xl font-bold mb-4">
          {t('medicalDeviceRequestForm.title')}
          <HelpTooltip text={t('medicalDeviceRequestForm.help')} />
        </h1><p>{t('medicalDeviceRequestForm.layout.subtitle')}</p></header>

        <form onSubmit={handleSubmit} className="mdr-form" aria-label={t('medicalDeviceRequestForm.title')}>
          <div className="mdr-overview" role="region" aria-label={t('medicalDeviceRequestForm.overview')}>
            <div>
              <h2 className="text-lg font-semibold mdr-muted">{t('medicalDeviceRequestForm.overview')}</h2>
              <p className="text-sm mdr-muted">
                {t('medicalDeviceRequestForm.overviewHelp')}
              </p>
            </div>
            <dl className="mdr-metrics">
              <div>
                <dt className="text-xs uppercase tracking-wide mdr-muted">{t('medicalDeviceRequestForm.lineItems')}</dt>
                <dd className="text-xl font-bold">{items.length}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide mdr-muted">{t('medicalDeviceRequestForm.totalDevices')}</dt>
                <dd className="text-xl font-bold">{totalDeviceCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide mdr-muted">{t('medicalDeviceRequestForm.estimatedTotal')}</dt>
                <dd className="text-xl font-bold">≈ {formattedTotalCost}</dd>
              </div>
            </dl>
          </div>

          <section className="mdr-panel">
          <header className="mdr-panel-heading"><span className="mdr-icon"><FileText size={20} /></span><div><h2>{t('medicalDeviceRequestForm.layout.requestDetails')}</h2><p>{t('medicalDeviceRequestForm.layout.requestDetailsHint')}</p></div></header>
          <div className="mdr-panel-body"><div className="mdr-context-grid">
          {/* Auto-Filled Department */}
          <div>
            <label className="block font-semibold mb-1">{t('medicalDeviceRequestForm.fields.department')}</label>
            <input
              type="text"
              value={user?.department_name || ''}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          {/* Auto-Filled Section */}
          <div>
            <label className="block font-semibold mb-1">{t('medicalDeviceRequestForm.fields.section')}</label>
            <input
              type="text"
              value={user?.section_name || ''}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          </div>
          {/* Justification */}
          <div>
            <label htmlFor="mdr-justification">{t('medicalDeviceRequestForm.fields.justification')}</label>
            <textarea
              id="mdr-justification"
              className="w-full p-2 border rounded"
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={t('medicalDeviceRequestForm.fields.justificationPlaceholder')}
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

          </div></section>
          <section className="mdr-devices">
          <div className="mdr-devices-heading"><span className="mdr-icon"><Activity size={20} /></span><div><h2>{t('medicalDeviceRequestForm.layout.deviceDetails')}</h2><p>{t('medicalDeviceRequestForm.layout.deviceDetailsHint')}</p></div></div>
          {/* Items */}
          {items.map((item, index) => {
            const errors = itemErrors[index] || {};
            return (
              <section key={index} className="mdr-device" aria-label={t('medicalDeviceRequestForm.layout.device', { index: index + 1 })}>
                <div className="mdr-device-heading">
                  <h2 className="text-lg font-semibold mdr-muted">
                    <span className="mdr-device-number">{index + 1}</span>{t('medicalDeviceRequestForm.layout.device', { index: index + 1 })}
                  </h2>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="self-start text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      {t('medicalDeviceRequestForm.removeDevice')}
                    </button>
                  )}
                </div>

                <div className="mdr-device-grid primary">
                  <div>
                    <label className="block text-sm font-medium mdr-muted" htmlFor={`mdr-${index}-name`}>
                      {t('medicalDeviceRequestForm.layout.deviceName')}<span className="text-red-600">*</span>
                    </label>
                    <input id={`mdr-${index}-name`} aria-invalid={Boolean(errors.item_name)} aria-describedby={errors.item_name ? `mdr-${index}-name-error` : undefined}
                      type="text"
                      placeholder={t('medicalDeviceRequestForm.fields.itemPlaceholder')}
                      value={item.item_name}
                      onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                      className={`mt-1 w-full rounded border p-2 ${
                        errors.item_name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                      disabled={isSubmitting}
                    />
                    {errors.item_name && (
                      <p id={`mdr-${index}-name-error`} role="alert" className="mt-1 text-sm text-red-600">{errors.item_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mdr-muted" htmlFor={`mdr-${index}-quantity`}>
                      {t('medicalDeviceRequestForm.layout.quantity')}<span className="text-red-600">*</span>
                    </label>
                    <input id={`mdr-${index}-quantity`} aria-invalid={Boolean(errors.quantity)} aria-describedby={errors.quantity ? `mdr-${index}-quantity-error` : undefined}
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
                      <p id={`mdr-${index}-quantity-error`} role="alert" className="mt-1 text-sm text-red-600">{errors.quantity}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mdr-muted" htmlFor={`mdr-${index}-cost`}>
                      {t('medicalDeviceRequestForm.layout.unitCost')}<span className="text-red-600">*</span>
                    </label>
                    <AmountInput id={`mdr-${index}-cost`} aria-invalid={Boolean(errors.unit_cost)} aria-describedby={errors.unit_cost ? `mdr-${index}-cost-error` : undefined}
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
                      <p id={`mdr-${index}-cost-error`} role="alert" className="mt-1 text-sm text-red-600">{errors.unit_cost}</p>
                    )}
                  </div>
                </div>

                <div className="mdr-device-grid">
                  <div>
                    <label className="block text-sm font-medium mdr-muted" htmlFor={`mdr-${index}-intended-use`}>
                      {t('medicalDeviceRequestForm.layout.intendedUse')}
                    </label>
                    <textarea id={`mdr-${index}-intended-use`}
                      rows={3}
                      placeholder={t('medicalDeviceRequestForm.fields.intendedUsePlaceholder')}
                      value={item.intended_use}
                      onChange={(e) => handleItemChange(index, 'intended_use', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 p-2"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mdr-muted" htmlFor={`mdr-${index}-specs`}>
                      {t('medicalDeviceRequestForm.layout.specifications')}
                      <HelpTooltip text={t('medicalDeviceRequestForm.specHelp')} />
                    </label>
                    <textarea id={`mdr-${index}-specs`}
                      rows={3}
                      placeholder={t('medicalDeviceRequestForm.fields.specsPlaceholder')}
                      value={item.specs}
                      onChange={(e) => handleItemChange(index, 'specs', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 p-2"
                      disabled={isSubmitting}
                    />
                    {index === 0 && specGuidance.length > 0 && (
                      <div className="mdr-spec-guidance">
                        <p className="font-semibold">{t('medicalDeviceRequestForm.fields.specTips')}</p>
                        <ul className="list-disc pl-4 space-y-1">
                          {specGuidance.map((tip, tipIndex) => (
                            <li key={tip}>{t(`medicalDeviceRequestForm.layout.specTip${tipIndex + 1}`, { defaultValue: tip })}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mdr-device-grid">
                  <div>
                    <label className="block text-sm font-medium mdr-muted" htmlFor={`mdr-${index}-device-info`}>
                      {t('medicalDeviceRequestForm.layout.deviceInfo')}
                    </label>
                    <input id={`mdr-${index}-device-info`}
                      type="text"
                      placeholder={t('medicalDeviceRequestForm.fields.deviceInfoPlaceholder')}
                      value={item.device_info}
                      onChange={(e) => handleItemChange(index, 'device_info', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 p-2"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mdr-muted" htmlFor={`mdr-${index}-purchase-type`}>
                      {t('medicalDeviceRequestForm.layout.purchaseType')}<span className="text-red-600">*</span>
                    </label>
                    <select id={`mdr-${index}-purchase-type`} aria-invalid={Boolean(errors.purchase_type)} aria-describedby={errors.purchase_type ? `mdr-${index}-purchase-type-error` : undefined}
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
                      <p id={`mdr-${index}-purchase-type-error`} role="alert" className="mt-1 text-sm text-red-600">{errors.purchase_type}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mdr-muted" htmlFor={`mdr-${index}-documents`}>
                    {t('medicalDeviceRequestForm.layout.supportingDocuments')}
                  </label>
                  <input id={`mdr-${index}-documents`}
                    type="file"
                    multiple
                    onChange={(e) => {
                      handleItemFiles(index, e.target.files);
                      e.target.value = '';
                    }}
                    className="mt-1 w-full rounded border border-gray-300 p-2"
                    disabled={isSubmitting}
                  />
                  <p className="mt-1 text-xs mdr-muted">
                    {t('medicalDeviceRequestForm.allowed', { types: allowedExtensionsDisplay, size: MAX_ATTACHMENT_SIZE_MB })}
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
                            <span className="font-medium mdr-muted">{file.name}</span>
                            <span className="text-xs mdr-muted">{formatFileSize(file.size)}</span>
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
              </section>
            );
          })}

            <button
              type="button"
              onClick={addItem}
              className="mdr-add-device"
              disabled={isSubmitting}
            >
              {t('medicalDeviceRequestForm.addDevice')}
            </button>
          </section>
          <section className="mdr-panel mdr-support">
          <header className="mdr-panel-heading"><span className="mdr-icon"><Paperclip size={20} /></span><div><h2>{t('medicalDeviceRequestForm.layout.supportingDetails')}</h2><p>{t('medicalDeviceRequestForm.layout.supportingDetailsHint')}</p></div></header>
          <div className="mdr-panel-body"><div>
            <label htmlFor="mdr-request-attachments">{t('medicalDeviceRequestForm.fields.attachments')}</label>
            <input
              id="mdr-request-attachments"
              type="file"
              multiple
              onChange={(e) => {
                handleRequestAttachments(e.target.files);
                e.target.value = '';
              }}
              className="w-full rounded border border-gray-300 p-2"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs mdr-muted">
              {t('medicalDeviceRequestForm.attachmentsHelp', { types: allowedExtensionsDisplay, size: MAX_ATTACHMENT_SIZE_MB })}
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
                      <span className="font-medium mdr-muted">{file.name}</span>
                      <span className="text-xs mdr-muted">{formatFileSize(file.size)}</span>
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

          <UrgentRequestToggle
            user={user}
            checked={isUrgent}
            onChange={setIsUrgent}
            disabled={isSubmitting}
          />

          </div></section>
          <div className="mdr-submit-footer"><p>{t('medicalDeviceRequestForm.layout.reviewHint')}</p>


            <button
              type="submit"
              disabled={isSubmitting}
              className={`mdr-submit ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Send size={17} />{isSubmitting ? t('medicalDeviceRequestForm.fields.submitting') : t('medicalDeviceRequestForm.fields.submit')}
              <HelpTooltip text={t('medicalDeviceRequestForm.submitHelp')} />
            </button>
          </div>
        </form>
      </main>
    </>
  );
};

export default MedicalDeviceRequestForm;