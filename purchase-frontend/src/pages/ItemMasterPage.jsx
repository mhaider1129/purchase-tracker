import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  approveItemMaster,
  attachItemMasterDocument,
  createItemMaster,
  getItemMasterById,
  listItemMaster,
  rejectItemMaster,
  submitItemMaster,
  updateItemMaster,
} from '../api/itemMaster';

const CLASSIFICATIONS = [
  'medication',
  'medical_supply',
  'medical_device',
  'laboratory_item',
  'maintenance_spare_part',
  'it_item',
  'stationery',
  'general_item',
];

const emptyForm = {
  item_code: '',
  item_name: '',
  generic_name: '',
  brand_name: '',
  category: '',
  subcategory: '',
  item_classification: 'general_item',
  unit_of_measure: '',
  pack_size: '',
  specifications: '',
  storage_condition: '',
  batch_controlled: false,
  expiry_controlled: false,
  serial_controlled: false,
  standard_cost: '',
  preferred_suppliers: '',
  contract_eligibility: false,
  reorder_level: '',
  safety_stock: '',
  institute_applicability: '',
};

const mapFormToPayload = form => ({
  ...form,
  preferred_suppliers: form.preferred_suppliers
    .split(',')
    .map(value => value.trim())
    .filter(Boolean),
  institute_applicability: form.institute_applicability
    .split(',')
    .map(value => value.trim())
    .filter(Boolean),
  standard_cost: form.standard_cost === '' ? null : Number(form.standard_cost),
  reorder_level: form.reorder_level === '' ? null : Number(form.reorder_level),
  safety_stock: form.safety_stock === '' ? null : Number(form.safety_stock),
});

const mapItemToForm = item => ({
  ...emptyForm,
  ...item,
  preferred_suppliers: (item.preferred_suppliers || []).join(', '),
  institute_applicability: (item.institute_applicability || []).join(', '),
  standard_cost: item.standard_cost ?? '',
  reorder_level: item.reorder_level ?? '',
  safety_stock: item.safety_stock ?? '',
});

export default function ItemMasterPage() {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [filters, setFilters] = useState({ q: '', status: '', item_classification: '' });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [docForm, setDocForm] = useState({ document_type: 'catalogue', document_name: '', file_path: '' });

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listItemMaster(filters);
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load item master records.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadItemDetails = useCallback(async id => {
    try {
      const data = await getItemMasterById(id);
      setSelectedItem(data);
    } catch {
      setSelectedItem(null);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage('');
  };

  const startEdit = item => {
    setEditingId(item.id);
    setForm(mapItemToForm(item));
    setMessage('');
  };

  const onFormChange = event => {
    const { name, type, checked, value } = event.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const submitForm = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = mapFormToPayload(form);
      if (editingId) {
        await updateItemMaster(editingId, payload);
        setMessage('Item updated successfully.');
      } else {
        await createItemMaster(payload);
        setMessage('Item created successfully.');
      }
      await loadItems();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save item.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action, successMessage) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
      await loadItems();
      if (selectedItem?.id) {
        await loadItemDetails(selectedItem.id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed.');
    } finally {
      setSaving(false);
    }
  };

  const submitDocument = async event => {
    event.preventDefault();
    if (!selectedItem?.id) return;

    setSaving(true);
    setError('');
    try {
      await attachItemMasterDocument(selectedItem.id, docForm);
      setDocForm({ document_type: 'catalogue', document_name: '', file_path: '' });
      await loadItemDetails(selectedItem.id);
      setMessage('Document attached successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to attach document.');
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => {
    const active = items.filter(item => item.status === 'active').length;
    const pending = items.filter(item => item.status === 'pending_approval').length;
    return { total: items.length, active, pending };
  }, [items]);

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Item Master</h1>
            <p className="text-sm text-slate-600">Create, validate, approve, and activate standardized items across institutes.</p>
          </div>
          <button type="button" onClick={startCreate} className="px-4 py-2 rounded bg-blue-600 text-white">New Item</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded border p-3 bg-white"><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-semibold">{summary.total}</div></div>
          <div className="rounded border p-3 bg-white"><div className="text-xs text-slate-500">Pending Approval</div><div className="text-2xl font-semibold text-amber-700">{summary.pending}</div></div>
          <div className="rounded border p-3 bg-white"><div className="text-xs text-slate-500">Active</div><div className="text-2xl font-semibold text-emerald-700">{summary.active}</div></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <section className="lg:col-span-2 bg-white border rounded p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input className="border rounded px-3 py-2" placeholder="Search code/name/generic/brand/spec" value={filters.q} onChange={e => setFilters(prev => ({ ...prev, q: e.target.value }))} />
              <select className="border rounded px-3 py-2" value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}>
                <option value="">All status</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending approval</option>
                <option value="active">Active</option>
                <option value="rejected">Rejected</option>
              </select>
              <select className="border rounded px-3 py-2" value={filters.item_classification} onChange={e => setFilters(prev => ({ ...prev, item_classification: e.target.value }))}>
                <option value="">All classifications</option>
                {CLASSIFICATIONS.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <button type="button" onClick={loadItems} className="px-3 py-1.5 border rounded">Apply filters</button>

            {loading && <p className="text-sm text-slate-500">Loading...</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-emerald-700">{message}</p>}

            <div className="overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-2">Code</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Classification</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="p-2">{item.item_code}</td>
                      <td className="p-2">{item.item_name}</td>
                      <td className="p-2">{item.item_classification}</td>
                      <td className="p-2">{item.status}</td>
                      <td className="p-2 space-x-2">
                        <button type="button" className="underline" onClick={() => loadItemDetails(item.id)}>View</button>
                        {(item.status === 'draft' || item.status === 'rejected') && (
                          <button type="button" className="underline" onClick={() => startEdit(item)}>Edit</button>
                        )}
                        {(item.status === 'draft' || item.status === 'rejected') && (
                          <button type="button" className="underline" onClick={() => runAction(() => submitItemMaster(item.id), 'Submitted for approval.')}>Submit</button>
                        )}
                        {item.status === 'pending_approval' && (
                          <>
                            <button type="button" className="underline text-emerald-700" onClick={() => runAction(() => approveItemMaster(item.id), 'Item approved and activated.')}>Approve</button>
                            <button type="button" className="underline text-red-700" onClick={() => {
                              const reason = window.prompt('Enter rejection reason');
                              if (reason) runAction(() => rejectItemMaster(item.id, reason), 'Item rejected.');
                            }}>Reject</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border rounded p-4 space-y-3">
            <h2 className="font-semibold">{editingId ? `Edit Item #${editingId}` : 'Create Item'}</h2>
            <form className="space-y-2" onSubmit={submitForm}>
              <input className="w-full border rounded px-3 py-2" name="item_code" value={form.item_code} onChange={onFormChange} placeholder="Item code" required />
              <input className="w-full border rounded px-3 py-2" name="item_name" value={form.item_name} onChange={onFormChange} placeholder="Item name" required />
              <input className="w-full border rounded px-3 py-2" name="generic_name" value={form.generic_name} onChange={onFormChange} placeholder="Generic name" />
              <input className="w-full border rounded px-3 py-2" name="brand_name" value={form.brand_name} onChange={onFormChange} placeholder="Brand name" />
              <input className="w-full border rounded px-3 py-2" name="category" value={form.category} onChange={onFormChange} placeholder="Category" required />
              <input className="w-full border rounded px-3 py-2" name="subcategory" value={form.subcategory} onChange={onFormChange} placeholder="Subcategory" />
              <select className="w-full border rounded px-3 py-2" name="item_classification" value={form.item_classification} onChange={onFormChange}>
                {CLASSIFICATIONS.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
              <input className="w-full border rounded px-3 py-2" name="unit_of_measure" value={form.unit_of_measure} onChange={onFormChange} placeholder="UOM" required />
              <input className="w-full border rounded px-3 py-2" name="pack_size" value={form.pack_size} onChange={onFormChange} placeholder="Pack size" />
              <input className="w-full border rounded px-3 py-2" name="storage_condition" value={form.storage_condition} onChange={onFormChange} placeholder="Storage condition" />
              <input className="w-full border rounded px-3 py-2" name="specifications" value={form.specifications} onChange={onFormChange} placeholder="Specifications" />
              <input className="w-full border rounded px-3 py-2" name="preferred_suppliers" value={form.preferred_suppliers} onChange={onFormChange} placeholder="Preferred suppliers (comma separated)" />
              <input className="w-full border rounded px-3 py-2" name="institute_applicability" value={form.institute_applicability} onChange={onFormChange} placeholder="Institute applicability (comma separated)" />
              <div className="grid grid-cols-3 gap-2 text-sm">
                <input className="border rounded px-2 py-1" type="number" min="0" step="0.01" name="standard_cost" value={form.standard_cost} onChange={onFormChange} placeholder="Standard cost" />
                <input className="border rounded px-2 py-1" type="number" min="0" step="0.01" name="reorder_level" value={form.reorder_level} onChange={onFormChange} placeholder="Reorder level" />
                <input className="border rounded px-2 py-1" type="number" min="0" step="0.01" name="safety_stock" value={form.safety_stock} onChange={onFormChange} placeholder="Safety stock" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="batch_controlled" checked={form.batch_controlled} onChange={onFormChange} /> Batch controlled</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="expiry_controlled" checked={form.expiry_controlled} onChange={onFormChange} /> Expiry controlled</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="serial_controlled" checked={form.serial_controlled} onChange={onFormChange} /> Serial controlled</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="contract_eligibility" checked={form.contract_eligibility} onChange={onFormChange} /> Contract eligible</label>
              <button disabled={saving} className="w-full rounded bg-slate-900 text-white py-2" type="submit">{saving ? 'Saving...' : editingId ? 'Update item' : 'Create item'}</button>
            </form>

            {selectedItem && (
              <div className="border-t pt-3 space-y-2">
                <h3 className="font-semibold">Attach Document - {selectedItem.item_code}</h3>
                <form className="space-y-2" onSubmit={submitDocument}>
                  <select className="w-full border rounded px-3 py-2" value={docForm.document_type} onChange={e => setDocForm(prev => ({ ...prev, document_type: e.target.value }))}>
                    <option value="catalogue">Catalogue</option>
                    <option value="coa_coc">COA/COC</option>
                    <option value="msds">MSDS</option>
                    <option value="registration_certificate">Registration Certificate</option>
                    <option value="technical_datasheet">Technical Datasheet</option>
                  </select>
                  <input className="w-full border rounded px-3 py-2" value={docForm.document_name} onChange={e => setDocForm(prev => ({ ...prev, document_name: e.target.value }))} placeholder="Document name" required />
                  <input className="w-full border rounded px-3 py-2" value={docForm.file_path} onChange={e => setDocForm(prev => ({ ...prev, file_path: e.target.value }))} placeholder="File path or URL" />
                  <button disabled={saving} className="w-full rounded border py-2" type="submit">Attach document</button>
                </form>
                <ul className="text-xs text-slate-600 list-disc pl-4">
                  {(selectedItem.documents || []).map(doc => (
                    <li key={doc.id}>{doc.document_type}: {doc.document_name}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}