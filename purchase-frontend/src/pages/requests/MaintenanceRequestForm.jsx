// src/pages/requests/MaintenanceRequestForm.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from '../../api/axios';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';
import ProjectSelector from '../../components/projects/ProjectSelector';
import useCurrentUser from '../../hooks/useCurrentUser';
import UrgentRequestToggle from '../../components/requests/UrgentRequestToggle';

const createEmptyItem = () => ({ item_name: '', quantity: 1, specs: '', attachments: [] });

const MaintenanceRequestForm = () => {
  const { t } = useTranslation();
  const tr = useCallback(
    (key, options) => t(`maintenanceRequestPage.${key}`, options),
    [t]
  );

  const [refNumber, setRefNumber] = useState('');
  const [justification, setJustification] = useState('');
  const [items, setItems] = useState(() => [createEmptyItem()]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [targetDeptId, setTargetDeptId] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [requesters, setRequesters] = useState([]);
  const [requestersLoaded, setRequestersLoaded] = useState(false);
  const [temporaryRequesterName, setTemporaryRequesterName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [formError, setFormError] = useState('');
  const [projectId, setProjectId] = useState('');
  const [stockItems, setStockItems] = useState([]);
  const { user: currentUser } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await axios.get('/departments');
        setDepartments(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch departments:', err);
        setFormError(tr('errors.loadDepartments'));
      }
    };
    fetchDepartments();

    const fetchStock = async () => {
      try {
        const res = await axios.get('/maintenance-stock');
        setStockItems(res.data || []);
      } catch (err) {
        console.error('Failed to load maintenance stock:', err);
      }
    };
    fetchStock();
  }, [tr]);

  useEffect(() => {
    const fetchSections = async () => {
      if (!targetDeptId) {
        setSections([]);
        return;
      }

      try {
        const res = await axios.get(`/departments/${targetDeptId}/sections`);
        setSections(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch sections:', err);
        setFormError(tr('errors.loadSections'));
        setSections([]);
      }
    };
    fetchSections();
  }, [targetDeptId, tr]);

  useEffect(() => {
    const fetchRequesters = async () => {
      setRequestersLoaded(false);
      setRequesters([]);

      if (!targetDeptId || (sections.length > 0 && !targetSectionId)) {
        return;
      }

      try {
        const sectionQuery = targetSectionId ? `?section_id=${targetSectionId}` : '';
        const res = await axios.get(`/departments/${targetDeptId}/requesters${sectionQuery}`);
        setRequesters(res.data || []);
      } catch (err) {
        console.error('❌ Failed to fetch requesters:', err);
        setRequesters([]);
      } finally {
        setRequestersLoaded(true);
      }
    };

    fetchRequesters();
  }, [sections.length, targetDeptId, targetSectionId]);

  const handleItemChange = useCallback((index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const handleItemFiles = useCallback((index, files) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        attachments: Array.from(files),
      };
      return updated;
    });
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, createEmptyItem()]);
  }, []);

  const removeItem = useCallback(
    (index) => {
      setItems((prev) => prev.filter((_, idx) => idx !== index));
    },
    []
  );

  const resetFormError = () => setFormError('');

  const validateItems = useCallback(() => {
    if (!items.length) {
      return tr('errors.addItem');
    }

    for (let i = 0; i < items.length; i += 1) {
      const { item_name: itemName, quantity } = items[i];
      if (!itemName.trim()) {
        return tr('errors.itemNameMissing', { number: i + 1 });
      }
      const parsedQuantity = Number(quantity);
      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        return tr('errors.itemQuantityInvalid', { number: i + 1 });
      }
    }

    return '';
  }, [items, tr]);

  const requesterLookupReady = Boolean(targetDeptId) && !(sections.length > 0 && !targetSectionId) && requestersLoaded;
  const requiresTemporaryRequesterName = requesterLookupReady && requesters.length === 0;

  const isFormValid = useMemo(() => {
    if (
      !refNumber.trim() ||
      !targetDeptId ||
      !justification.trim()
    ) {
      return false;
    }
    if (sections.length > 0 && !targetSectionId) {
      return false;
    }
    if (!requesterLookupReady) {
      return false;
    }
    if (requiresTemporaryRequesterName && !temporaryRequesterName.trim()) {
      return false;
    }
    return validateItems() === '';
  }, [justification, refNumber, requesterLookupReady, requiresTemporaryRequesterName, sections.length, targetDeptId, targetSectionId, temporaryRequesterName, validateItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationMessage = validateItems();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setSubmitting(true);
    try {
      resetFormError();
      const formData = new FormData();
      formData.append('request_type', 'Maintenance');
      formData.append('maintenance_ref_number', refNumber);
      formData.append('justification', justification);
      formData.append('target_department_id', targetDeptId);
      if (targetSectionId) {
        formData.append('target_section_id', targetSectionId);
      }
      if (requiresTemporaryRequesterName) {
        formData.append('temporary_requester_name', temporaryRequesterName.trim());
      }
      const itemsPayload = items.map(({ attachments: itemAttachments, ...rest }) => rest);
      formData.append('items', JSON.stringify(itemsPayload));
      formData.append('is_urgent', isUrgent ? 'true' : 'false');
      attachments.forEach((file) => formData.append('attachments', file));
      if (projectId) {
        formData.append('project_id', projectId);
      }
      items.forEach((item, idx) => {
        (item.attachments || []).forEach((file) => {
          formData.append(`item_${idx}`, file);
        });
      });

      const res = await axios.post('/requests', formData);
      const state = buildRequestSubmissionState('Maintenance', res.data);
      navigate('/request-submitted', { state });
    } catch (err) {
      console.error('❌ Failed to submit maintenance request:', err);
      setFormError(tr('errors.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (formError) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [formError]);

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">
          {t('pageTitles.maintenanceRequestForm')}
          <HelpTooltip text={tr('tooltips.stepTwo')} />
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {formError}
            </div>
          )}

          <input
            type="text"
            aria-label={tr('fields.referenceAria')}
            placeholder={tr('fields.referencePlaceholder')}
            value={refNumber}
            onChange={(e) => setRefNumber(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />

          <select
            aria-label={tr('fields.targetDepartmentAria')}
            value={targetDeptId}
            onChange={(e) => {
              setTargetDeptId(e.target.value);
              setTargetSectionId('');
            }}
            className="w-full border p-2 rounded"
            required
          >
            <option value="">{tr('fields.selectDepartment')}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          {sections.length > 0 && (
            <select
              aria-label={tr('fields.targetSectionAria')}
              value={targetSectionId}
              onChange={(e) => setTargetSectionId(e.target.value)}
              className="w-full border p-2 rounded"
              required
            >
              <option value="">{tr('fields.selectSection')}</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          )}

          <textarea
            aria-label={tr('fields.justificationAria')}
            placeholder={tr('fields.justificationPlaceholder')}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />

          <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            {requiresTemporaryRequesterName
              ? tr(
                  'fields.manualRequesterNotice',
                  'No active requester was found for the selected department/section. Enter the requester name below; requester approval will still be recorded automatically before the request goes to the HOD.'
                )
              : tr(
                  'fields.autoRequesterNotice',
                  'The system will assign this request to the active requester for the selected department/section and automatically record requester approval before sending it to the HOD.'
                )}
          </div>

          {requiresTemporaryRequesterName && (
            <input
              type="text"
              aria-label={tr('fields.temporaryRequesterNameAria', 'Requester name')}
              placeholder={tr('fields.temporaryRequesterNamePlaceholder', 'Requester name')}
              value={temporaryRequesterName}
              onChange={(e) => setTemporaryRequesterName(e.target.value)}
              className="w-full border p-2 rounded"
              required
            />
          )}

          <ProjectSelector
            value={projectId}
            onChange={setProjectId}
            disabled={submitting}
            user={currentUser}
          />

          {stockItems.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2">{tr('stock.heading')}</h4>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2 text-left">{tr('stock.item')}</th>
                    <th className="border p-2 text-left">{tr('stock.quantity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stockItems.map((s) => (
                    <tr key={s.id}>
                      <td className="border p-2">{s.item_name}</td>
                      <td className="border p-2">{s.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <h4 className="font-semibold mb-2">{tr('items.heading')}</h4>
            {items.map((item, idx) => (
              <div key={idx} className="border p-3 rounded mb-2 bg-gray-50">
                <input
                  type="text"
                  placeholder={tr('items.itemNamePlaceholder')}
                  aria-label={t('maintenanceRequestPage.items.nameAria', { index: idx + 1 })}
                  value={item.item_name}
                  onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                  className="w-full mb-2 border p-2 rounded"
                  required
                />
                <input
                  type="number"
                  placeholder={tr('items.quantityPlaceholder')}
                  aria-label={t('maintenanceRequestPage.items.quantityAria', { index: idx + 1 })}
                  value={item.quantity}
                  min={1}
                  onChange={(e) =>
                    handleItemChange(idx, 'quantity', e.target.value ? Number(e.target.value) : '')
                  }
                  className="w-full border p-2 rounded"
                  required
                />
                <input
                  type="text"
                  placeholder={tr('items.specsPlaceholder')}
                  aria-label={t('maintenanceRequestPage.items.specsAria', { index: idx + 1 })}
                  value={item.specs}
                  onChange={(e) => handleItemChange(idx, 'specs', e.target.value)}
                  className="w-full border p-2 rounded mt-1"
                />
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleItemFiles(idx, e.target.files)}
                  className="p-1 border rounded mt-1"
                />
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-2 text-red-600 hover:text-red-700"
                    onClick={() => removeItem(idx)}
                  >
                    {tr('items.remove')}
                  </Button>
                )}
              </div>
            ))}

            <Button
              type="button"
              onClick={addItem}
              variant="secondary"
              className="mt-2"
            >
              {tr('items.add')}
            </Button>
          </div>

          <div>
            <label className="block font-semibold mb-1">{tr('attachments.label')}</label>
            <input
              type="file"
              multiple
              onChange={(e) => setAttachments(Array.from(e.target.files))}
              className="p-2 border rounded w-full"
              disabled={submitting || !isFormValid}
            />
          </div>

          <UrgentRequestToggle
            user={currentUser}
            checked={isUrgent}
            onChange={setIsUrgent}
            disabled={submitting}
          />

          <Button
            type="submit"
            isLoading={submitting}
            fullWidth
            disabled={submitting}
          >
            <>
              {tr('submit.label')}
              <HelpTooltip text={tr('tooltips.stepThree')} />
            </>
          </Button>
        </form>
      </div>
    </>
  );
};

export default MaintenanceRequestForm;