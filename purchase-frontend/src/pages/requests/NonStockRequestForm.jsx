// src/pages/requests/NonStockRequestForm.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import useCurrentUser from '../../hooks/useCurrentUser';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';
import ProjectSelector from '../../components/projects/ProjectSelector';

const NonStockRequestForm = () => {
  const { t } = useTranslation();
  const tr = useCallback(
    (key, options) => t(`nonStockRequestPage.${key}`, options),
    [t]
  );

  const [justification, setJustification] = useState('');
  const [items, setItems] = useState([getEmptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [projectId, setProjectId] = useState('');
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
  const MAX_ITEMS_PER_REQUEST = 50;

  const specTemplates = useMemo(
    () => [
      {
        id: 'general',
        label: tr('fields.specTemplateGeneral'),
        template: tr('fields.specTemplateGeneralBody'),
      },
      {
        id: 'it',
        label: tr('fields.specTemplateIT'),
        template: tr('fields.specTemplateITBody'),
      },
      {
        id: 'medical',
        label: tr('fields.specTemplateMedical'),
        template: tr('fields.specTemplateMedicalBody'),
      },
    ],
    [tr]
  );

  const specGuidanceItems = useMemo(() => {
    const raw = tr('fields.specsHelpList');
    if (!raw) return [];
    return raw
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }, [tr]);

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

  useEffect(() => {
    setItemErrors((prev) => {
      if (items.length === prev.length) return prev;
      const next = items.map((_, idx) => prev[idx] || {});
      return next;
    });
  }, [items]);

  const departmentLimitMessage = useMemo(
    () =>
      tr('errors.departmentLimit', {
        max: MAX_ITEMS_PER_REQUEST,
      }),
    [tr]
  );

  useEffect(() => {
    if (departmentLimitError) {
      setDepartmentLimitError(departmentLimitMessage);
    }
  }, [departmentLimitError, departmentLimitMessage]);

  const validateFiles = (files) => {
    const errors = [];
    const validFiles = [];
    const allowedList = allowedExtensions.join(', ');

    files.forEach((file) => {
      const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
      if (!allowedExtensions.includes(ext)) {
        errors.push(
          tr('errors.unsupportedFile', { ext, allowed: allowedList })
        );
        return;
      }

      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        errors.push(
          tr('errors.fileTooLarge', {
            name: file.name,
            max: MAX_ATTACHMENT_SIZE_MB,
          })
        );
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
    const { validFiles, error: attachmentError } = validateFiles(incomingFiles);

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
      next[index] = { ...next[index], attachments: attachmentError };
      return next;
    });
  };

  const handleRemoveItemAttachment = (itemIndex, attachmentIndex) => {
    setItems((prevItems) => {
      const next = [...prevItems];
      const attachments = [...(next[itemIndex]?.attachments || [])];
      attachments.splice(attachmentIndex, 1);
      next[itemIndex] = {
        ...next[itemIndex],
        attachments,
      };

      const { error: attachmentError } = validateFiles(attachments);
      setItemErrors((prevErrors) => {
        const nextErrors = [...prevErrors];
        const updatedErrors = { ...(nextErrors[itemIndex] || {}) };
        if (attachmentError) {
          updatedErrors.attachments = attachmentError;
        } else {
          delete updatedErrors.attachments;
        }
        nextErrors[itemIndex] = updatedErrors;
        return nextErrors;
      });

      return next;
    });
  };

  const addItem = () => {
    if (items.length >= MAX_ITEMS_PER_REQUEST) {
      setDepartmentLimitError(departmentLimitMessage);
      return;
    }
    setDepartmentLimitError('');
    setItems((prev) => [...prev, getEmptyItem()]);
  };

  const duplicateItem = (index) => {
    if (items.length >= MAX_ITEMS_PER_REQUEST) {
      setDepartmentLimitError(departmentLimitMessage);
      return;
    }

    setDepartmentLimitError('');
    setItems((prevItems) => {
      const next = [...prevItems];
      const source = next[index];
      const duplicate = {
        ...source,
        attachments: [],
      };
      next.splice(index + 1, 0, duplicate);
      return next;
    });
  };

  const removeItem = (index) => {
    if (items.length === 1) return;
    if (!window.confirm(tr('confirmRemoveItem'))) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
    setItemErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSpecTemplate = (index, templateText) => {
    if (!templateText) return;
    setItems((prevItems) => {
      const next = [...prevItems];
      const currentSpecs = next[index]?.specs || '';
      const appended = currentSpecs
        ? `${currentSpecs.trimEnd()}

${templateText}`
        : templateText;
      next[index] = { ...next[index], specs: appended };
      return next;
    });

    setItemErrors((prev) => {
      const next = [...prev];
      const cleaned = { ...(next[index] || {}) };
      delete cleaned.specs;
      next[index] = cleaned;
      return next;
    });
  };

  const handleRemoveRequestAttachment = (attachmentIndex) => {
    setAttachments((prev) => {
      const next = prev.filter((_, idx) => idx !== attachmentIndex);
      const { error } = validateFiles(next);
      setRequestAttachmentsError(error);
      return next;
    });
  };

  const handleAdditionalAttachments = (files) => {
    const incoming = Array.from(files || []);
    const { validFiles, error: attachmentsError } = validateFiles(incoming);
    setAttachments((prev) => [...prev, ...validFiles]);
    setRequestAttachmentsError(attachmentsError);
  };

  const validateItems = () => {
    let hasErrors = false;
    const nextErrors = items.map((item) => {
      const errs = {};
      if (!item.item_name.trim()) {
        errs.item_name = tr('errors.itemNameRequired');
      }
      if (!item.quantity || Number(item.quantity) < 1) {
        errs.quantity = tr('errors.quantityRequired');
      }
      if (!item.intended_use.trim()) {
        errs.intended_use = tr('errors.intendedUseRequired');
      }
      if (!item.specs.trim()) {
        errs.specs = tr('errors.specsRequired');
      }

      const { error: attachmentError } = validateFiles(item.attachments || []);
      if (attachmentError) {
        errs.attachments = attachmentError;
      }

      if (Object.keys(errs).length > 0) {
        hasErrors = true;
      }

      return errs;
    });

    setItemErrors(nextErrors);

    if (items.length > MAX_ITEMS_PER_REQUEST) {
      setDepartmentLimitError(departmentLimitMessage);
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
      alert(tr('alerts.justificationRequired'));
      return;
    }

    if (!targetDeptId) {
      alert(tr('alerts.departmentMissing'));
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
    formData.append('project_id', projectId || '');
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

    if (!window.confirm(tr('confirmSubmit'))) return;

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
      alert(err.response?.data?.message || tr('alerts.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-gray-600 text-center">{tr('loadingUser')}</div>
      </>
    );
  }

  if (error || !user) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-red-600 text-center">{tr('loadUserError')}</div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">
          {t('pageTitles.nonStockRequestForm')}
          <HelpTooltip text={tr('tooltips.stepTwo')} />
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-semibold mb-1">{tr('fields.departmentLabel')}</label>
            <p className="p-2 border rounded bg-gray-100">{user.department_name}</p>
          </div>

          <div>
            <label className="block font-semibold mb-1">{tr('fields.sectionLabel')}</label>
            <p className="p-2 border rounded bg-gray-100">{user.section_name || tr('fields.sectionFallback')}</p>
          </div>

          <div>
            <label className="block font-semibold mb-1">{tr('fields.justificationLabel')}</label>
            <textarea
              className="w-full p-2 border rounded"
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={tr('fields.justificationPlaceholder')}
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
            <label className="block font-semibold mb-2">{tr('fields.itemsLabel')}</label>
            <p className="text-sm text-gray-500 mb-2">
              {t('nonStockRequestPage.fields.itemsHint', { max: MAX_ITEMS_PER_REQUEST })}
            </p>
            {departmentLimitError && (
              <p className="text-sm text-red-600 mb-2">{departmentLimitError}</p>
            )}
            {specGuidanceItems.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 mb-4">
                <p className="font-semibold mb-2">{tr('fields.specsHelpTitle')}</p>
                <ul className="list-disc pl-5 space-y-1">
                  {specGuidanceItems.map((helpText, idx) => (
                    <li key={`${helpText}-${idx}`}>{helpText}</li>
                  ))}
                </ul>
                <p className="text-xs text-blue-800 mt-2">{tr('fields.specsHelpFooter')}</p>
              </div>
            )}
            {items.map((item, index) => (
              <div
                key={index}
                className="w-full border border-gray-200 rounded-lg p-4 mb-4 bg-white shadow-sm"
              >
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder={tr('fields.itemNamePlaceholder')}
                      aria-label={t('nonStockRequestPage.fields.itemNameAria', { index: index + 1 })}
                      value={item.item_name}
                      onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                      className="w-full p-2 border rounded"
                      required
                      disabled={isSubmitting}
                    />
                    {itemErrors[index]?.item_name && (
                      <p className="text-sm text-red-600 mt-1">{itemErrors[index].item_name}</p>
                    )}
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={tr('fields.unitCostPlaceholder')}
                      aria-label={t('nonStockRequestPage.fields.unitCostAria', { index: index + 1 })}
                      value={item.unit_cost}
                      onChange={(e) => handleItemChange(index, 'unit_cost', e.target.value)}
                      className="w-full p-2 border rounded"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <input
                      type="text"
                      placeholder={tr('fields.brandPlaceholder')}
                      aria-label={t('nonStockRequestPage.fields.brandAria', { index: index + 1 })}
                      value={item.brand}
                      onChange={(e) => handleItemChange(index, 'brand', e.target.value)}
                      className="w-full p-2 border rounded"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="w-40 min-w-[160px]">
                    <input
                      type="number"
                      min={0}
                      placeholder={tr('fields.availableQuantityPlaceholder')}
                      aria-label={t('nonStockRequestPage.fields.availableQuantityAria', { index: index + 1 })}
                      value={item.available_quantity}
                      onChange={(e) =>
                        handleItemChange(index, 'available_quantity', e.target.value)
                      }
                      className="w-full p-2 border rounded"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min={1}
                      aria-label={t('nonStockRequestPage.fields.quantityAria', { index: index + 1 })}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="w-full p-2 border rounded"
                      required
                      disabled={isSubmitting}
                    />
                    {itemErrors[index]?.quantity && (
                      <p className="text-sm text-red-600 mt-1">{itemErrors[index].quantity}</p>
                    )}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder={tr('fields.intendedUsePlaceholder')}
                      aria-label={t('nonStockRequestPage.fields.intendedUseAria', { index: index + 1 })}
                      value={item.intended_use}
                      onChange={(e) => handleItemChange(index, 'intended_use', e.target.value)}
                      className="w-full p-2 border rounded"
                      disabled={isSubmitting}
                    />
                    {itemErrors[index]?.intended_use && (
                      <p className="text-sm text-red-600 mt-1">{itemErrors[index].intended_use}</p>
                    )}
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder={tr('fields.specsPlaceholder')}
                        aria-label={t('nonStockRequestPage.fields.specsAria', { index: index + 1 })}
                        value={item.specs}
                        onChange={(e) => handleItemChange(index, 'specs', e.target.value)}
                        className="flex-1 p-2 border rounded"
                        disabled={isSubmitting}
                      />
                      <select
                        className="sm:w-48 p-2 border rounded bg-white"
                        onChange={(e) => {
                          const selectedTemplate = specTemplates.find(
                            (template) => template.id === e.target.value
                          );
                          if (selectedTemplate) {
                            handleSpecTemplate(index, selectedTemplate.template);
                          }
                          e.target.value = '';
                        }}
                        defaultValue=""
                        disabled={isSubmitting || specTemplates.length === 0}
                      >
                        <option value="">{tr('fields.specTemplatePlaceholder')}</option>
                        {specTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {itemErrors[index]?.specs && (
                      <p className="text-sm text-red-600 mt-1">{itemErrors[index].specs}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">{tr('fields.specTemplateHelp')}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      handleItemFiles(index, e.target.files);
                      e.target.value = '';
                    }}
                    className="p-1 border rounded"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('nonStockRequestPage.fields.itemAttachmentsHint', {
                      allowed: allowedExtensions.join(', '),
                      max: MAX_ATTACHMENT_SIZE_MB,
                    })}
                  </p>
                  {itemErrors[index]?.attachments && (
                    <p className="text-sm text-red-600 mt-1">{itemErrors[index].attachments}</p>
                  )}
                  {item.attachments?.length > 0 && (
                    <div className="mt-2 bg-gray-50 border rounded p-2 text-sm">
                      <p className="font-semibold text-gray-700">
                        {tr('fields.selectedItemAttachments')}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {item.attachments.map((file, fileIdx) => (
                          <li
                            key={`${file.name}-${fileIdx}`}
                            className="flex items-center gap-2"
                          >
                            <span className="flex-1 truncate">{file.name}</span>
                            <span className="text-gray-500 text-xs whitespace-nowrap">
                              {formatFileSize(file.size)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemAttachment(index, fileIdx)}
                              className="text-xs text-red-600 hover:underline"
                              disabled={isSubmitting}
                            >
                              {tr('buttons.removeAttachment')}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => duplicateItem(index)}
                    className="text-sm text-blue-600 hover:underline"
                    disabled={isSubmitting}
                  >
                    {tr('buttons.duplicateItem')}
                  </button>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-sm text-red-600 hover:underline"
                      disabled={isSubmitting}
                    >
                      {tr('buttons.removeItem')}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="text-blue-600 mt-2 font-semibold"
              disabled={isSubmitting}
            >
              {tr('buttons.addItem')}
            </button>
          </div>

          <div>
            <label className="block font-semibold mb-1">{tr('fields.additionalAttachmentsLabel')}</label>
            <input
              type="file"
              multiple
              onChange={(e) => {
                handleAdditionalAttachments(e.target.files);
                e.target.value = '';
              }}
              className="p-2 border rounded w-full"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500">
              {t('nonStockRequestPage.fields.additionalAttachmentsHint', {
                allowed: allowedExtensions.join(', '),
                max: MAX_ATTACHMENT_SIZE_MB,
              })}
            </p>
            {requestAttachmentsError && (
              <p className="text-sm text-red-600">{requestAttachmentsError}</p>
            )}
            {attachments.length > 0 && (
              <div className="mt-2 bg-gray-50 border rounded p-2 text-sm">
                <p className="font-semibold text-gray-700">
                  {tr('fields.selectedRequestAttachments')}
                </p>
                <ul className="mt-1 space-y-1">
                  {attachments.map((file, idx) => (
                    <li key={`${file.name}-${idx}`} className="flex items-center gap-2">
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-gray-500 text-xs whitespace-nowrap">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRequestAttachment(idx)}
                        className="text-xs text-red-600 hover:underline"
                        disabled={isSubmitting}
                      >
                        {tr('buttons.removeAttachment')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? tr('buttons.submitting') : tr('buttons.submit')}
              <HelpTooltip text={tr('tooltips.stepThree')} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default NonStockRequestForm;