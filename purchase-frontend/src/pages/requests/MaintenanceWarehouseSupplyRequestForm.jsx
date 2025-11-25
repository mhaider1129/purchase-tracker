import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import useCurrentUser from '../../hooks/useCurrentUser';
import { useNavigate } from 'react-router-dom';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { buildRequestSubmissionState } from '../../utils/requestSubmission';
import ProjectSelector from '../../components/projects/ProjectSelector';
import useWarehouses from '../../hooks/useWarehouses';
import useWarehouseStockItems from '../../hooks/useWarehouseStockItems';

const MaintenanceWarehouseSupplyRequestForm = () => {
  const [items, setItems] = useState([{ stock_item_id: '', item_name: '', quantity: 1 }]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [targetDeptId, setTargetDeptId] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [supplyWarehouseId, setSupplyWarehouseId] = useState('');

  const navigate = useNavigate();
  const { user, loading, error } = useCurrentUser();
  const { warehouses, loading: warehousesLoading, error: warehousesError } = useWarehouses();
  const {
    items: warehouseItems,
    loading: warehouseItemsLoading,
    error: warehouseItemsError,
  } = useWarehouseStockItems(supplyWarehouseId);

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

  useEffect(() => {
    if (!supplyWarehouseId && warehouses.length > 0) {
      const preferred = user?.warehouse_id || warehouses[0]?.id;
      if (preferred) {
        setSupplyWarehouseId(String(preferred));
      }
    }
  }, [supplyWarehouseId, warehouses, user]);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/api/departments');
        setDepartments(res.data || []);
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    };
    fetchDepartments();
  }, []);

  useEffect(() => {
    const fetchSections = async () => {
      if (!targetDeptId) {
        setSections([]);
        return;
      }
      try {
        const res = await api.get(`/api/departments/${targetDeptId}/sections`);
        setSections(res.data || []);
      } catch (err) {
        console.error('Failed to load sections:', err);
        setSections([]);
      }
    };
    fetchSections();
  }, [targetDeptId]);

  const applyTemplate = (id) => {
    setSelectedTemplateId(id);
    const template = templates.find((t) => t.id === parseInt(id, 10));
    if (template) {
      if (!supplyWarehouseId) {
        alert('Please select a fulfillment warehouse first');
        return;
      }

      const mapped = (template.items || [])
        .map((it) => {
          const matchedItem = warehouseItems.find(
            (whItem) => whItem.item_name?.toLowerCase() === (it.item_name || '').toLowerCase(),
          );
          if (!matchedItem) return null;
          return {
            stock_item_id: matchedItem.stock_item_id?.toString() || '',
            item_name: matchedItem.item_name || '',
            quantity: 1,
          };
        })
        .filter(Boolean);

      if (mapped.length === 0) {
        alert('None of the template items are available in the selected warehouse');
      }

      setItems(mapped.length ? mapped : [{ stock_item_id: '', item_name: '', quantity: 1 }]);
    }
  };

  const addItem = () =>
    setItems([...items, { stock_item_id: '', item_name: '', quantity: 1 }]);
  const removeItem = (idx) => {
    if (!window.confirm('Remove this item?')) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleWarehouseChange = (value) => {
    setSupplyWarehouseId(value);
    setSelectedTemplateId('');
    setItems([{ stock_item_id: '', item_name: '', quantity: 1 }]);
  };

  const handleItemSelection = (index, stockItemId) => {
    const selected = warehouseItems.find(
      (it) => String(it.stock_item_id) === String(stockItemId),
    );
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      stock_item_id: stockItemId,
      item_name: selected?.item_name || '',
    };
    setItems(updated);
  };

  const handleQuantityChange = (index, value) => {
    const updated = [...items];
    updated[index].quantity = parseInt(value, 10);
    setItems(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!justification.trim()) {
      alert('Justification is required');
      return;
    }
    if (!targetDeptId) {
      alert('Please select a target department');
      return;
    }
    if (!supplyWarehouseId) {
      alert('Please select the warehouse fulfilling this request');
      return;
    }
    const hasInvalid = items.some(
      (i) => !i.stock_item_id || !i.item_name.trim() || i.quantity < 1,
    );
    if (hasInvalid) {
      alert('Each item must have a warehouse item selected and a quantity');
      return;
    }

    const payload = new FormData();
    payload.append('request_type', 'Warehouse Supply');
    payload.append('justification', justification);
    payload.append('target_department_id', targetDeptId);
    payload.append('target_section_id', targetSectionId || '');
    payload.append('budget_impact_month', '');
    payload.append('project_id', projectId || '');
    const mapped = items.map((it) => ({ item_name: it.item_name, quantity: it.quantity }));
    payload.append('items', JSON.stringify(mapped));

    try {
      setSubmitting(true);
      const res = await api.post('/api/requests', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const state = buildRequestSubmissionState('Warehouse Supply', res.data);
      navigate('/request-submitted', { state });
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
          Maintenance Warehouse Supply Request
          <HelpTooltip text="Request items from warehouse stock for a specific department" />
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-semibold mb-1">Target Department</label>
            <select
              value={targetDeptId}
              onChange={(e) => {
                setTargetDeptId(e.target.value);
                setTargetSectionId('');
              }}
              className="p-2 border rounded w-full"
              disabled={submitting}
              required
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {sections.length > 0 && (
            <div>
              <label className="block font-semibold mb-1">Target Section</label>
              <select
                value={targetSectionId}
                onChange={(e) => setTargetSectionId(e.target.value)}
                className="p-2 border rounded w-full"
                disabled={submitting}
                required
              >
                <option value="">Select Section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
            <label className="block font-semibold mb-1">Fulfillment Warehouse</label>
            <select
              value={supplyWarehouseId}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              className="p-2 border rounded"
              disabled={submitting || warehousesLoading || warehouses.length === 0}
              required
            >
              <option value="">Select Warehouse</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
            {warehousesError && (
              <p className="text-sm text-red-600 mt-1">{warehousesError}</p>
            )}
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

        <ProjectSelector
          value={projectId}
          onChange={setProjectId}
          disabled={submitting}
          user={user}
        />

          <div>
            <label className="block font-semibold mb-2">Items</label>
            {supplyWarehouseId === '' && (
              <p className="text-sm text-gray-600 mb-2">
                Select a warehouse to choose from its available items.
              </p>
            )}
            {warehouseItemsError && (
              <p className="text-sm text-red-600 mb-2">{warehouseItemsError}</p>
            )}
            {warehouseItemsLoading && (
              <p className="text-sm text-gray-600 mb-2">Loading warehouse items...</p>
            )}
            {supplyWarehouseId && !warehouseItemsLoading && warehouseItems.length === 0 && (
              <p className="text-sm text-gray-600 mb-2">
                No items are configured for this warehouse.
              </p>
            )}
            {items.map((it, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center flex-wrap">
                <select
                  value={it.stock_item_id}
                  onChange={(e) => handleItemSelection(idx, e.target.value)}
                  className="flex-1 p-2 border rounded min-w-[200px]"
                  required
                  disabled={
                    submitting ||
                    warehouseItemsLoading ||
                    !supplyWarehouseId ||
                    warehouseItems.length === 0
                  }
                >
                  <option value="">Select item</option>
                  {warehouseItems.map((item) => (
                    <option key={item.stock_item_id} value={item.stock_item_id}>
                      {item.item_name} ({item.quantity} available)
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) => handleQuantityChange(idx, e.target.value)}
                  className="w-24 p-2 border rounded"
                  required
                  disabled={submitting}
                />
                {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-red-600 text-lg"
                  disabled={submitting}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="text-blue-600 mt-2"
            disabled={submitting}
          >
            + Add Item
          </button>
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

export default MaintenanceWarehouseSupplyRequestForm;