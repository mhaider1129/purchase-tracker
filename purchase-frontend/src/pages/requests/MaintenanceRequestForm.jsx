// src/pages/requests/MaintenanceRequestForm.jsx
import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { Button } from '../../components/ui/Button';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const MaintenanceRequestForm = () => {
  const [refNumber, setRefNumber] = useState('');
  const [justification, setJustification] = useState('');
  const [items, setItems] = useState([{ item_name: '', quantity: 1, specs: '', attachments: [] }]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [targetDeptId, setTargetDeptId] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
const [attachments, setAttachments] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await axios.get('/api/departments');
        setDepartments(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch departments:', err);
        alert('Failed to load departments. Please refresh the page.');
      }
    };
    fetchDepartments();

    const fetchStock = async () => {
      try {
        const res = await axios.get('/api/maintenance-stock');
        setStockItems(res.data || []);
      } catch (err) {
        console.error('Failed to load maintenance stock:', err);
      }
    };
    fetchStock();
  }, []);

  useEffect(() => {
    const fetchSections = async () => {
      if (!targetDeptId) {
        setSections([]);
        return;
      }

      try {
        const res = await axios.get(`/api/departments/${targetDeptId}/sections`);
        setSections(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch sections:', err);
        alert('Failed to load sections. Please try again.');
        setSections([]);
      }
    };
    fetchSections();
  }, [targetDeptId]);

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleItemFiles = (index, files) => {
    const updated = [...items];
    updated[index].attachments = Array.from(files);
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { item_name: '', quantity: 1, specs: '', attachments: [] }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (items.some((item) => !item.item_name || item.quantity <= 0)) {
      alert('⚠️ Please fill in all item fields with valid values.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('request_type', 'Maintenance');
      formData.append('maintenance_ref_number', refNumber);
      formData.append('justification', justification);
      formData.append('target_department_id', targetDeptId);
      formData.append('target_section_id', targetSectionId);
      const itemsPayload = items.map(({ attachments, ...rest }) => rest);
      formData.append('items', JSON.stringify(itemsPayload));
      attachments.forEach((file) => formData.append('attachments', file));
      items.forEach((item, idx) => {
        (item.attachments || []).forEach((file) => {
          formData.append(`item_${idx}`, file);
        });
      });

      await axios.post('/api/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate('/request-submitted');
      setAttachments([]);
    } catch (err) {
      console.error('❌ Failed to submit maintenance request:', err);
      alert('❌ Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="p-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">
          Maintenance Request Form
          <HelpTooltip text="Step 2: Provide details for your maintenance request." />
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            type="text"
            aria-label="Maintenance Reference Number"
            placeholder="Maintenance Ref Number"
            value={refNumber}
            onChange={(e) => setRefNumber(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />

          <select
            aria-label="Target Department"
            value={targetDeptId}
            onChange={(e) => {
              setTargetDeptId(e.target.value);
              setTargetSectionId(''); // Reset section on dept change
            }}
            className="w-full border p-2 rounded"
            required
          >
            <option value="">Select Target Department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          {sections.length > 0 && (
            <select
              aria-label="Target Section"
              value={targetSectionId}
              onChange={(e) => setTargetSectionId(e.target.value)}
              className="w-full border p-2 rounded"
              required
            >
              <option value="">Select Section</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          )}

          <textarea
            aria-label="Justification"
            placeholder="Justification"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />



          {stockItems.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Available Maintenance Stock</h4>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2 text-left">Item</th>
                    <th className="border p-2 text-left">Qty</th>
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
            <h4 className="font-semibold mb-2">Requested Items</h4>
            {items.map((item, idx) => (
              <div key={idx} className="border p-3 rounded mb-2 bg-gray-50">
                <input
                  type="text"
                  placeholder="Item Name"
                  aria-label={`Item ${idx + 1} Name`}
                  value={item.item_name}
                  onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                  className="w-full mb-2 border p-2 rounded"
                  required
                />
                <input
                  type="number"
                  placeholder="Qty"
                  aria-label={`Item ${idx + 1} Quantity`}
                  value={item.quantity}
                  min={1}
                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                  className="w-full border p-2 rounded"
                  required
                />
                <input
                  type="text"
                  placeholder="Specs"
                  aria-label={`Item ${idx + 1} Specs`}
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
              </div>
            ))}

            <Button
              type="button"
              onClick={addItem}
              variant="secondary"
              className="mt-2"
            >
              + Add Item
            </Button>
          </div>
 
          <div>
            <label className="block font-semibold mb-1">Attachments</label>
            <input
              type="file"
              multiple
              onChange={(e) => setAttachments(Array.from(e.target.files))}
              className="p-2 border rounded w-full"
              disabled={submitting}
            />
          </div>

          <Button
            type="submit"
            isLoading={submitting}
            fullWidth
            disabled={submitting}
          >
            <>
              Submit Maintenance Request
              <HelpTooltip text="Step 3: Submit the request for approval." />
            </>
          </Button>
        </form>
      </div>
    </>
  );
};

export default MaintenanceRequestForm;