// src/pages/requests/StockItemRequestForm.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';

const StockItemRequestForm = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [justification, setJustification] = useState('');
  const [expectedMonthlyUsage, setExpectedMonthlyUsage] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Item name is required.');
      return;
    }

    if (!window.confirm('Submit this stock item request?')) return;

    try {
      setIsSubmitting(true);
      const detailSections = [];
      if (description.trim()) {
        detailSections.push(`General Description:\n${description.trim()}`);
      }
      if (justification.trim()) {
        detailSections.push(`Use Case / Justification:\n${justification.trim()}`);
      }
      if (expectedMonthlyUsage.trim()) {
        detailSections.push(
          `Expected Monthly Usage:\n${expectedMonthlyUsage.trim()}`
        );
      }
      if (supplierNotes.trim()) {
        detailSections.push(`Suggested Supplier or Notes:\n${supplierNotes.trim()}`);
      }

      const res = await api.post('/api/stock-item-requests', {
        name: name.trim(),
        description: detailSections.join('\n\n'),
        unit: unit.trim() || undefined,
      });
      const state = buildRequestSubmissionState('Stock Item', res.data);
      navigate('/request-submitted', { state });
    } catch (err) {
      console.error('❌ Failed to submit stock item request:', err);
      alert(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">
          New Stock Item Request
          <HelpTooltip text="Request a new item to be added to the stock list." />
        </h1>
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <h2 className="text-lg font-semibold mb-2">SCM approval heads-up</h2>
          <p className="text-sm text-gray-700 mb-2">
            Submit this form to start the approval process to add the item to the
            stock database. The SCM team still reviews these requests outside the
            app, so include enough context for a quick decision.
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>Provide the unit of measure and how often you expect to use it.</li>
            <li>Share the intended use case so SCM can validate the need.</li>
            <li>
              If you know a preferred supplier or specs, add them to help SCM add
              the catalog entry correctly.
            </li>
          </ul>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">Item Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Unit of Measure</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g., box, pack, liter"
              className="w-full p-2 border rounded"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full p-2 border rounded"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Use Case / Justification</label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              className="w-full p-2 border rounded"
              placeholder="How and where will this item be used?"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Expected Monthly Usage</label>
            <input
              type="text"
              value={expectedMonthlyUsage}
              onChange={(e) => setExpectedMonthlyUsage(e.target.value)}
              placeholder="e.g., 40 units per month"
              className="w-full p-2 border rounded"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Supplier / Specification Notes</label>
            <textarea
              value={supplierNotes}
              onChange={(e) => setSupplierNotes(e.target.value)}
              rows={2}
              className="w-full p-2 border rounded"
              placeholder="Optional: preferred supplier, catalog link, or specs"
              disabled={isSubmitting}
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </>
  );
};

export default StockItemRequestForm;