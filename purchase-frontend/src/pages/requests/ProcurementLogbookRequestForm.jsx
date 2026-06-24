import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import useCurrentUser from '../../hooks/useCurrentUser';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';
import UrgentRequestToggle from '../../components/requests/UrgentRequestToggle';

const MAX_ATTACHMENT_SIZE_MB = 500;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

const ProcurementLogbookRequestForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading, error } = useCurrentUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [formFile, setFormFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [form, setForm] = useState({
    orientation: 'portrait',
    numberOfPages: 1,
    pageDirection: 'left_to_right',
    serialNumbering: 'auto',
    numberingStart: 1,
    printSided: 'single_sided',
    ncr: false,
    tearOffPages: false,
    logbookName: '',
    otherDetails: '',
  });

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFileChange = (e) => {
    const nextFile = e.target.files?.[0] || null;

    if (nextFile && nextFile.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setFormFile(null);
      setFileError(t('procurementLogbookRequestForm.alerts.fileTooLarge', { size: MAX_ATTACHMENT_SIZE_MB }));
      e.target.value = '';
      return;
    }

    setFileError('');
    setFormFile(nextFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.department_id) return alert(t('procurementLogbookRequestForm.alerts.departmentRequired'));
    if (!formFile) return alert(fileError || t('procurementLogbookRequestForm.alerts.uploadRequired'));
    if (!form.logbookName.trim()) return alert(t('procurementLogbookRequestForm.alerts.nameRequired'));

    const specs = [
      `Logbook name: ${form.logbookName.trim()}`,
      `Orientation: ${form.orientation}`,
      `Number of pages: ${form.numberOfPages}`,
      `Page direction: ${form.pageDirection}`,
      `Serial numbering: ${form.serialNumbering}`,
      form.serialNumbering === 'auto' ? `Numbering starts from: ${form.numberingStart}` : null,
      `Printing mode: ${form.printSided}`,
      `NCR: ${form.ncr ? 'Yes' : 'No'}`,
      `Tear-off pages: ${form.tearOffPages ? 'Yes' : 'No'}`,
      form.otherDetails ? `Other details: ${form.otherDetails}` : null,
    ].filter(Boolean).join('\n');

    const payload = new FormData();
    payload.append('request_type', 'Non-Stock');
    payload.append('justification', 'Request to print logbook from approved source document.');
    payload.append('budget_impact_month', '');
    payload.append('project_id', '');
    payload.append('target_department_id', user.department_id);
    payload.append('target_section_id', user.section_id || '');
    payload.append('items', JSON.stringify([{ item_name: 'Logbook Printing', quantity: 1, specs }]));
    payload.append('is_urgent', isUrgent ? 'true' : 'false');
    payload.append('attachments', formFile);

    try {
      setIsSubmitting(true);
      const response = await api.post('/requests', payload);
      const state = buildRequestSubmissionState('Bulk Logbook Procurement', { ...response.data, request_type: 'Printing Logbook' });
      navigate('/request-submitted', { state });
    } catch (submitError) {
      console.error(submitError);
      const status = submitError?.response?.status;
      const serverMessage = submitError?.response?.data?.message;
      if (status === 413) {
        alert(serverMessage || t('procurementLogbookRequestForm.alerts.uploadTooLarge', { size: MAX_ATTACHMENT_SIZE_MB }));
      } else {
        alert(serverMessage || t('procurementLogbookRequestForm.alerts.submitFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-600">{t('procurementLogbookRequestForm.loading')}</div>;
  if (error || !user) return <div className="p-6 text-center text-red-600">{t('procurementLogbookRequestForm.loadUserFailed')}</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">{t('procurementLogbookRequestForm.title')}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-1">{t('procurementLogbookRequestForm.fields.approvedForm')}</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,image/*,.heic,.heif"
            onChange={handleFileChange}
            className="w-full border rounded p-2"
            required
          />
          <p className="mt-1 text-sm text-gray-500">{t('procurementLogbookRequestForm.fields.maxFileSize', { size: MAX_ATTACHMENT_SIZE_MB })}</p>
          {fileError && <p className="mt-1 text-sm text-red-600">{fileError}</p>}
        </div>

        <div>
          <label className="block font-semibold mb-1">{t('procurementLogbookRequestForm.fields.logbookName')}</label>
          <input
            type="text"
            className="w-full border rounded p-2"
            value={form.logbookName}
            onChange={(e) => onChange('logbookName', e.target.value)}
            placeholder={t('procurementLogbookRequestForm.fields.logbookPlaceholder')}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">{t('procurementLogbookRequestForm.fields.orientation')}
            <select className="w-full border rounded p-2" value={form.orientation} onChange={(e) => onChange('orientation', e.target.value)}>
              <option value="portrait">{t('procurementLogbookRequestForm.fields.portrait')}</option>
              <option value="landscape">{t('procurementLogbookRequestForm.fields.landscape')}</option>
            </select>
          </label>

          <label className="block">{t('procurementLogbookRequestForm.fields.pages')}
            <input type="number" min="1" className="w-full border rounded p-2" value={form.numberOfPages} onChange={(e) => onChange('numberOfPages', Number(e.target.value) || 1)} required />
          </label>

          <label className="block">{t('procurementLogbookRequestForm.fields.direction')}
            <select className="w-full border rounded p-2" value={form.pageDirection} onChange={(e) => onChange('pageDirection', e.target.value)}>
              <option value="left_to_right">{t('procurementLogbookRequestForm.fields.ltr')}</option>
              <option value="right_to_left">{t('procurementLogbookRequestForm.fields.rtl')}</option>
            </select>
          </label>

          <label className="block">{t('procurementLogbookRequestForm.fields.serial')}
            <select className="w-full border rounded p-2" value={form.serialNumbering} onChange={(e) => onChange('serialNumbering', e.target.value)}>
              <option value="auto">{t('procurementLogbookRequestForm.fields.auto')}</option>
              <option value="none">{t('procurementLogbookRequestForm.fields.none')}</option>
            </select>
          </label>

          {form.serialNumbering === 'auto' && (
            <label className="block">{t('procurementLogbookRequestForm.fields.startFrom')}
              <input type="number" min="1" className="w-full border rounded p-2" value={form.numberingStart} onChange={(e) => onChange('numberingStart', Number(e.target.value) || 1)} />
            </label>
          )}

          <label className="block">{t('procurementLogbookRequestForm.fields.printingType')}
            <select className="w-full border rounded p-2" value={form.printSided} onChange={(e) => onChange('printSided', e.target.value)}>
              <option value="single_sided">{t('procurementLogbookRequestForm.fields.single')}</option>
              <option value="double_sided">{t('procurementLogbookRequestForm.fields.double')}</option>
            </select>
          </label>
        </div>

        <div className="flex gap-6">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.ncr} onChange={(e) => onChange('ncr', e.target.checked)} /> {t('procurementLogbookRequestForm.fields.ncr')}
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.tearOffPages} onChange={(e) => onChange('tearOffPages', e.target.checked)} /> {t('procurementLogbookRequestForm.fields.tearOff')}
          </label>
        </div>

        <div>
          <label className="block font-semibold mb-1">{t('procurementLogbookRequestForm.fields.details')}</label>
          <textarea className="w-full border rounded p-2" rows={4} value={form.otherDetails} onChange={(e) => onChange('otherDetails', e.target.value)} placeholder={t('procurementLogbookRequestForm.fields.detailsPlaceholder')} />
        </div>

          <UrgentRequestToggle
            user={user}
            checked={isUrgent}
            onChange={setIsUrgent}
            disabled={isSubmitting}
          />

        <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50">
          {isSubmitting ? t('procurementLogbookRequestForm.fields.submitting') : t('procurementLogbookRequestForm.fields.submit')}
        </button>
      </form>
    </div>
  );
};

export default ProcurementLogbookRequestForm;