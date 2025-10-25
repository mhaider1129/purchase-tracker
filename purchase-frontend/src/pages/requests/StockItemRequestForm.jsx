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
      const res = await api.post('/api/stock-item-requests', {
        name,
        description,
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
            <label className="block font-semibold mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full p-2 border rounded"
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