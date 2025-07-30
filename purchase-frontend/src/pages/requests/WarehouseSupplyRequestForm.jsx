import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import useCurrentUser from '../../hooks/useCurrentUser';
import { useNavigate } from 'react-router-dom';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const WarehouseSupplyRequestForm = () => {
  const [items, setItems] = useState([{ item_name: '', quantity: 1 }]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [justification, setJustification] = useState('');
  const [supplyDomain, setSupplyDomain] = useState('medical');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const { user, loading, error } = useCurrentUser();
  const targetDeptId = user?.department_id;
  const targetSectionId = user?.section_id;

  // No stock lookup - items are manually entered by the user

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await api.get('/api/warehouse-supply-templates');
        setTemplates(res.data || []);
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    };
    fetchTemplates();
  }, []);

  const applyTemplate = (id) => {
    setSelectedTemplateId(id);
    const template = templates.find((t) => t.id === parseInt(id, 10));
    if (template) {
      const mapped = (template.items || []).map((it) => ({
        item_name: it.item_name || '',
        quantity: 1,
      }));
      setItems(mapped.length ? mapped : items);
    }
  };

  const addItem = () => setItems([...items, { item_name: '', quantity: 1 }]);
  const removeItem = (idx) => {
    if (!window.confirm('Remove this item?')) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] =
      field === 'quantity' ? parseInt(value, 10) : value;
    setItems(updated);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!justification.trim()) {
      alert('Justification is required');
      return;
    }
    if (!targetDeptId) {
      alert('Your account is missing department information');
      return;
    }
    const hasInvalid = items.some(i => !i.item_name.trim() || i.quantity < 1);
    if (hasInvalid) {
      alert('Each item must have a name and quantity');
      return;
    }

    const payload = new FormData();
    payload.append('request_type', 'Warehouse Supply');
    payload.append('justification', justification);
    payload.append('target_department_id', targetDeptId);
    payload.append('target_section_id', targetSectionId || '');
    payload.append('budget_impact_month', '');
    payload.append('supply_domain', supplyDomain);
    const mapped = items.map(it => ({ item_name: it.item_name, quantity: it.quantity }));
    payload.append('items', JSON.stringify(mapped));

    try {
      setSubmitting(true);
      await api.post('/api/requests', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate('/request-submitted', { state: { requestType: 'Warehouse Supply' } });
    } catch (err) {
      console.error('Submission failed:', err);
      alert(err.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-center text-gray-600">Loading...</div>
      </>
    );
  }

  if (error || !user) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-center text-red-600">Unable to load user info.</div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">
          Warehouse Supply Request
          <HelpTooltip text="Request items from warehouse stock" />
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-semibold mb-1">Justification</label>
            <textarea
              className="w-full p-2 border rounded"
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Supply From</label>
            <select
              value={supplyDomain}
              onChange={(e) => setSupplyDomain(e.target.value)}
              className="p-2 border rounded"
              disabled={submitting}
            >
              <option value="medical">Medical Warehouse</option>
          <option value="operational">Operational Warehouse</option>
        </select>
      </div>

      <div>
        <label className="block font-semibold mb-1">Template</label>
        <select
          value={selectedTemplateId}
          onChange={(e) => applyTemplate(e.target.value)}
          className="p-2 border rounded"
          disabled={submitting}
        >
          <option value="">-- Select Template --</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.template_name}
            </option>
          ))}
        </select>
      </div>

          <div>
            <label className="block font-semibold mb-2">Items</label>
            {items.map((it, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center flex-wrap">
                <input
                  type="text"
                  value={it.item_name}
                  onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                  className="flex-1 p-2 border rounded"
                  placeholder="Item name"
                  required
                  disabled={submitting}
                />
                <input
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                  className="w-24 p-2 border rounded"
                  required
                  disabled={submitting}
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-600 text-lg" disabled={submitting}>✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addItem} className="text-blue-600 mt-2" disabled={submitting}>+ Add Item</button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </>
  );
};

export default WarehouseSupplyRequestForm;