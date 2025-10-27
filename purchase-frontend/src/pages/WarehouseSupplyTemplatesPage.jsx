import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';

const WarehouseSupplyTemplatesPage = () => {
  const { user, loading } = useCurrentUser();
  const [templates, setTemplates] = useState([]);
  const [newTemplate, setNewTemplate] = useState({ template_name: '', items: [{ item_name: '' }] });
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const resetForm = () => {
    setNewTemplate({ template_name: '', items: [{ item_name: '' }] });
    setEditingTemplateId(null);
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/warehouse-supply-templates');
      const parsedTemplates = (res.data || []).map((template) => ({
        ...template,
        items:
          typeof template.items === 'string'
            ? JSON.parse(template.items || '[]')
            : template.items || [],
      }));
      setTemplates(parsedTemplates);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates. Please try again.');
    } finally {
      setIsLoading(false);
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
    if (isSaving) return;
    if (!newTemplate.template_name.trim()) {
      alert('Template name is required');
      return;
    }
    if (newTemplate.items.some((it) => !it.item_name.trim())) {
      alert('Each item must have a name');
      return;
    }
    const payload = {
      template_name: newTemplate.template_name.trim(),
      items: newTemplate.items.map((it) => ({ item_name: it.item_name.trim() })),
    };
    try {
      setIsSaving(true);
      if (editingTemplateId) {
        await api.put(`/api/warehouse-supply-templates/${editingTemplateId}`, payload);
      } else {
        await api.post('/api/warehouse-supply-templates', payload);
      }
      resetForm();
      fetchTemplates();
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await api.delete(`/api/warehouse-supply-templates/${id}`);
      if (editingTemplateId === id) {
        resetForm();
      }
      fetchTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert('Failed to delete');
    }
  };

  const startEditing = (template) => {
    setEditingTemplateId(template.id);
    setNewTemplate({
      template_name: template.template_name,
      items: (template.items && template.items.length > 0
        ? template.items
        : [{ item_name: '' }]
      ).map((item) => ({ item_name: item.item_name || '' })),
    });
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
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Warehouse Supply Templates</h1>
            <p className="text-sm text-gray-600">Create reusable supply lists and manage existing templates.</p>
          </div>
          <button
            onClick={fetchTemplates}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Refresh
          </button>
        </div>

        <section className="space-y-4">
          <header>
            <h2 className="text-xl font-semibold text-gray-800">Saved Templates</h2>
            <p className="text-sm text-gray-500">Review template contents or make quick edits.</p>
          </header>

          {isLoading ? (
            <div className="rounded border border-gray-200 bg-white p-6 text-gray-500">Loading templates…</div>
          ) : error ? (
            <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
          ) : templates.length === 0 ? (
            <div className="rounded border border-dashed border-gray-300 bg-white p-6 text-center text-gray-500">
              No templates yet. Create your first template below.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <article key={template.id} className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{template.template_name}</h3>
                        <p className="text-xs text-gray-500">{template.items.length} item{template.items.length === 1 ? '' : 's'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(template)}
                          className="rounded border border-blue-200 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="rounded border border-red-200 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  <ul className="flex-1 space-y-2 p-4 text-sm text-gray-700">
                    {template.items.map((item, idx) => (
                      <li key={`${template.id}-item-${idx}`} className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" aria-hidden="true"></span>
                        <span>{item.item_name}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {editingTemplateId ? 'Edit Template' : 'Create Template'}
              </h2>
              <p className="text-sm text-gray-500">
                {editingTemplateId
                  ? 'Update the template details and save your changes.'
                  : 'Define a template name and add the items that belong to it.'}
              </p>
            </div>
            {editingTemplateId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-medium text-blue-700 hover:underline"
              >
                Cancel editing
              </button>
            )}
          </header>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="template-name">
                Template name
              </label>
              <input
                id="template-name"
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Monthly replenishment"
                value={newTemplate.template_name}
                onChange={(e) => setNewTemplate({ ...newTemplate, template_name: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <span className="text-sm font-medium text-gray-700">Template items</span>
              {newTemplate.items.map((it, idx) => (
                <div key={idx} className="flex flex-col gap-2 rounded border border-gray-200 p-3 sm:flex-row sm:items-center">
                  <input
                    className="flex-1 rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder={`Item ${idx + 1}`}
                    value={it.item_name}
                    onChange={(e) => handleItemChange(idx, e.target.value)}
                  />
                  {newTemplate.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="self-end text-sm font-medium text-red-600 hover:underline sm:self-auto"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                className="text-sm font-medium text-blue-700 hover:underline"
              >
                + Add another item
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                onClick={saveTemplate}
                disabled={isSaving}
                className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isSaving ? 'Saving…' : editingTemplateId ? 'Save changes' : 'Save template'}
              </button>
              {!editingTemplateId && (
                <p className="text-xs text-gray-500">
                  Tip: add frequently requested items to save time on recurring warehouse requests.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default WarehouseSupplyTemplatesPage;