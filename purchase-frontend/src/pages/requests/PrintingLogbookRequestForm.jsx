import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import useCurrentUser from '../../hooks/useCurrentUser';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';

const PrintingLogbookRequestForm = () => {
  const navigate = useNavigate();
  const { user, loading, error } = useCurrentUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFile, setFormFile] = useState(null);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.department_id) return alert('Department is required for submitting requests.');
    if (!formFile) return alert('Please upload the approved form (PDF or Word).');
    if (!form.logbookName.trim()) return alert('Please enter the logbook name.');

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
    payload.append('target_department_id', user.department_id);
    payload.append('target_section_id', user.section_id || '');
    payload.append('items', JSON.stringify([{ item_name: 'Logbook Printing', quantity: 1, specs }]));
    payload.append('attachments', formFile);

    try {
      setIsSubmitting(true);
      const response = await api.post('/requests', payload);
      const state = buildRequestSubmissionState('Printing Logbook', { ...response.data, request_type: 'Printing Logbook' });
      navigate('/request-submitted', { state });
    } catch (submitError) {
      console.error(submitError);
      alert(submitError?.response?.data?.message || 'Failed to submit printing logbook request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-600">Loading user information...</div>;
  if (error || !user) return <div className="p-6 text-center text-red-600">Unable to load user details.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Printing Logbook Request</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-1">Approved Form (PDF/Word)</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,image/*,.heic,.heif"
            onChange={(e) => setFormFile(e.target.files?.[0] || null)}
            className="w-full border rounded p-2"
            required
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Logbook Name</label>
          <input
            type="text"
            className="w-full border rounded p-2"
            value={form.logbookName}
            onChange={(e) => onChange('logbookName', e.target.value)}
            placeholder="Enter the name of the logbook"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">Logbook Orientation
            <select className="w-full border rounded p-2" value={form.orientation} onChange={(e) => onChange('orientation', e.target.value)}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>

          <label className="block">Number of Pages
            <input type="number" min="1" className="w-full border rounded p-2" value={form.numberOfPages} onChange={(e) => onChange('numberOfPages', Number(e.target.value) || 1)} required />
          </label>

          <label className="block">Starting Direction
            <select className="w-full border rounded p-2" value={form.pageDirection} onChange={(e) => onChange('pageDirection', e.target.value)}>
              <option value="left_to_right">Left to Right</option>
              <option value="right_to_left">Right to Left</option>
            </select>
          </label>

          <label className="block">Serial Numbering
            <select className="w-full border rounded p-2" value={form.serialNumbering} onChange={(e) => onChange('serialNumbering', e.target.value)}>
              <option value="auto">Auto Numbered</option>
              <option value="none">No Numbering</option>
            </select>
          </label>

          {form.serialNumbering === 'auto' && (
            <label className="block">Numbering Starts From
              <input type="number" min="1" className="w-full border rounded p-2" value={form.numberingStart} onChange={(e) => onChange('numberingStart', Number(e.target.value) || 1)} />
            </label>
          )}

          <label className="block">Printing Type
            <select className="w-full border rounded p-2" value={form.printSided} onChange={(e) => onChange('printSided', e.target.value)}>
              <option value="single_sided">Single-sided</option>
              <option value="double_sided">Double-sided</option>
            </select>
          </label>
        </div>

        <div className="flex gap-6">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.ncr} onChange={(e) => onChange('ncr', e.target.checked)} /> NCR required
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.tearOffPages} onChange={(e) => onChange('tearOffPages', e.target.checked)} /> Tear-off pages
          </label>
        </div>

        <div>
          <label className="block font-semibold mb-1">Other details/specifications</label>
          <textarea className="w-full border rounded p-2" rows={4} value={form.otherDetails} onChange={(e) => onChange('otherDetails', e.target.value)} placeholder="Any extra instructions: paper quality, binding, perforation, cover color, etc." />
        </div>

        <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50">
          {isSubmitting ? 'Submitting...' : 'Submit Printing Request'}
        </button>
      </form>
    </div>
  );
};

export default PrintingLogbookRequestForm;