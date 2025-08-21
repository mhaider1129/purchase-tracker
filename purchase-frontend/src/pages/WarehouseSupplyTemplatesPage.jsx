import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';

const WarehouseSupplyTemplatesPage = () => {
  const { user, loading } = useCurrentUser();
  const [templates, setTemplates] = useState([]);
  const [newTemplate, setNewTemplate] = useState({ template_name: '', items: [{ item_name: '' }] });

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/api/warehouse-supply-templates');
      setTemplates(res.data || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  useEffect(() => {
    if (user) fetchTemplates();
  }, [user]);

  const handleItemChange = (idx, value) => {
    const items = [...newTemplate.items];
    items[idx].item_name = value;
    setNewTemplate({ ...newTemplate, items });
  };

  const addItem = () => {
    setNewTemplate({
      ...newTemplate,
      items: [...newTemplate.items, { item_name: '' }],
    });
  };

  const removeItem = (idx) => {
    setNewTemplate({
      ...newTemplate,
      items: newTemplate.items.filter((_, i) => i !== idx),
    });
  };

  const saveTemplate = async () => {
    if (!newTemplate.template_name.trim()) {
      alert('Template name is required');
      return;
    }
    if (newTemplate.items.some((it) => !it.item_name.trim())) {
      alert('Each item must have a name');
      return;
    }
    try {
      await api.post('/api/warehouse-supply-templates', newTemplate);
      setNewTemplate({ template_name: '', items: [{ item_name: '' }] });
      fetchTemplates();
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Failed to save template');
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await api.delete(`/api/warehouse-supply-templates/${id}`);
      fetchTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert('Failed to delete');
    }
  };

  if (loading || !user) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-gray-600">Loading...</div>
      </>
    );
  }

  const isAuthorized = ['WarehouseManager', 'warehouse_manager', 'warehouse_keeper'].includes(user.role);

  if (!isAuthorized) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-red-600">Access denied</div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Warehouse Supply Templates</h1>
        <ul className="space-y-3 mb-8">
          {templates.map((t) => (
            <li key={t.id} className="border p-2 flex justify-between items-center">
              <span>{t.template_name}</span>
              <button onClick={() => deleteTemplate(t.id)} className="text-red-600">Delete</button>
            </li>
          ))}
        </ul>

        <h2 className="text-xl font-semibold mb-2">Add Template</h2>
        <div className="space-y-3">
          <input
            className="border p-2 w-full"
            placeholder="Template name"
            value={newTemplate.template_name}
            onChange={(e) => setNewTemplate({ ...newTemplate, template_name: e.target.value })}
          />
          {newTemplate.items.map((it, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                className="flex-1 border p-2"
                placeholder="Item name"
                value={it.item_name}
                onChange={(e) => handleItemChange(idx, e.target.value)}
              />
              {newTemplate.items.length > 1 && (
                <button type="button" onClick={() => removeItem(idx)} className="text-red-600">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addItem} className="text-blue-600">+ Add Item</button>
          <button onClick={saveTemplate} className="px-4 py-2 bg-blue-600 text-white rounded">
            Save Template
          </button>
        </div>
      </div>
    </>
  );
};

export default WarehouseSupplyTemplatesPage;