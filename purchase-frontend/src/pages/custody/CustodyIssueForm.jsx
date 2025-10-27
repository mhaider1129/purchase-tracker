import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import {
  createCustodyRecord,
  searchCustodyRecipients,
} from '../../api/custody';
import { Button } from '../../components/ui/Button';

const CustodyIssueForm = () => {
  const [form, setForm] = useState({
    itemName: '',
    quantity: '',
    description: '',
    custodyType: 'personal',
    custodyCode: '',
    departmentId: '',
  });

  const [departments, setDepartments] = useState([]);
  const [departmentsError, setDepartmentsError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: 'idle', message: '' });

  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientResults, setRecipientResults] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [isSearchingRecipients, setIsSearchingRecipients] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadDepartments = async () => {
      try {
        setDepartmentsError('');
        const { data } = await api.get('/api/departments');
        if (!isMounted) return;
        setDepartments(data.map((dept) => ({ id: dept.id, name: dept.name })));
      } catch (err) {
        console.error('❌ Failed to load departments:', err);
        if (!isMounted) return;
        setDepartmentsError('Unable to load departments. Please try again.');
      }
    };

    loadDepartments();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (form.custodyType !== 'personal') {
      setRecipientResults([]);
      setSearchError('');
      setIsSearchingRecipients(false);
      return;
    }

    const trimmed = recipientQuery.trim();
    if (trimmed.length < 2) {
      setRecipientResults([]);
      setSearchError('');
      setIsSearchingRecipients(false);
      return;
    }

    let isActive = true;
    setIsSearchingRecipients(true);
    setSearchError('');

    const timer = setTimeout(() => {
      searchCustodyRecipients(trimmed)
        .then((results) => {
          if (!isActive) return;
          setRecipientResults(results);
        })
        .catch((err) => {
          console.error('❌ Failed to search recipients:', err);
          if (!isActive) return;
          setSearchError('Unable to search recipients.');
        })
        .finally(() => {
          if (isActive) {
            setIsSearchingRecipients(false);
          }
        });
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [recipientQuery, form.custodyType]);

  useEffect(() => {
    if (form.custodyType === 'departmental') {
      setSelectedRecipient(null);
      setRecipientQuery('');
      setRecipientResults([]);
    }
  }, [form.custodyType]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFeedback({ type: 'idle', message: '' });

    if (name === 'custodyType') {
      setSelectedRecipient(null);
      setRecipientQuery('');
    }
  };

  const handleRecipientSelect = (recipient) => {
    setSelectedRecipient(recipient);
    setRecipientQuery(`${recipient.name} (${recipient.email})`);
    setRecipientResults([]);
  };

  const resetForm = () => {
    setForm({
      itemName: '',
      quantity: '',
      description: '',
      custodyType: form.custodyType,
      custodyCode: '',
      departmentId: '',
    });
    setSelectedRecipient(null);
    setRecipientQuery('');
    setRecipientResults([]);
  };

  const formIsValid = useMemo(() => {
    if (!form.itemName.trim()) return false;
    if (!form.quantity || Number.isNaN(Number(form.quantity))) return false;
    if (form.custodyType === 'personal' && !selectedRecipient) return false;
    if (form.custodyType === 'departmental' && !form.departmentId) return false;
    return true;
  }, [form, selectedRecipient]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formIsValid) {
      setFeedback({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback({ type: 'idle', message: '' });

    const payload = {
      item_name: form.itemName.trim(),
      quantity: Number(form.quantity),
      description: form.description.trim() || undefined,
      custody_type: form.custodyType,
      custody_code: form.custodyCode.trim() || undefined,
      custodian_user_id:
        form.custodyType === 'personal' ? selectedRecipient?.id : undefined,
      custodian_department_id:
        form.custodyType === 'departmental' ? Number(form.departmentId) : undefined,
    };

    try {
      await createCustodyRecord(payload);
      setFeedback({ type: 'success', message: 'Custody record submitted successfully.' });
      resetForm();
    } catch (err) {
      console.error('❌ Failed to submit custody record:', err);
      const message = err.response?.data?.message || 'Failed to submit custody record.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">Issue Custody Record</h1>
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
          <div>
            <label htmlFor="itemName" className="block text-sm font-medium text-gray-700">
              Item Name
            </label>
            <input
              id="itemName"
              name="itemName"
              type="text"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Enter item name"
              value={form.itemName}
              onChange={handleInputChange}
              required
            />
          </div>

          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
              Quantity
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Enter quantity"
              value={form.quantity}
              onChange={handleInputChange}
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows="3"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Provide additional details"
              value={form.description}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Custody Type</label>
            <div className="mt-2 flex gap-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="custodyType"
                  value="personal"
                  checked={form.custodyType === 'personal'}
                  onChange={handleInputChange}
                />
                <span>Personal custody</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="custodyType"
                  value="departmental"
                  checked={form.custodyType === 'departmental'}
                  onChange={handleInputChange}
                />
                <span>Departmental custody</span>
              </label>
            </div>
          </div>

          {form.custodyType === 'personal' && (
            <div>
              <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">
                Custodian
              </label>
              <input
                id="recipient"
                type="text"
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                placeholder="Search by name, email, or employee ID"
                value={recipientQuery}
                onChange={(event) => {
                  setRecipientQuery(event.target.value);
                  setSelectedRecipient(null);
                }}
                autoComplete="off"
              />
              {isSearchingRecipients && (
                <p className="text-sm text-gray-500 mt-1">Searching recipients...</p>
              )}
              {searchError && (
                <p className="text-sm text-red-500 mt-1">{searchError}</p>
              )}
              {recipientResults.length > 0 && (
                <ul className="mt-2 border rounded divide-y bg-white shadow">
                  {recipientResults.map((recipient) => (
                    <li key={recipient.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-100"
                        onClick={() => handleRecipientSelect(recipient)}
                      >
                        <div className="font-medium">{recipient.name}</div>
                        <div className="text-xs text-gray-500">{recipient.email}</div>
                        {recipient.employee_id && (
                          <div className="text-xs text-gray-500">
                            Employee ID: {recipient.employee_id}
                          </div>
                        )}
                        {recipient.department_name && (
                          <div className="text-xs text-gray-400">
                            {recipient.department_name}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedRecipient && (
                <p className="mt-2 text-sm text-green-600">
                  Selected custodian: {selectedRecipient.name} ({selectedRecipient.email}
                  {selectedRecipient.employee_id ? ` • ${selectedRecipient.employee_id}` : ''})
                </p>
              )}
            </div>
          )}

          {form.custodyType === 'departmental' && (
            <div>
              <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700">
                Department
              </label>
              <select
                id="departmentId"
                name="departmentId"
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                value={form.departmentId}
                onChange={handleInputChange}
                required
              >
                <option value="">Select department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              {departmentsError && (
                <p className="text-sm text-red-500 mt-1">{departmentsError}</p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="custodyCode" className="block text-sm font-medium text-gray-700">
              Custody code (optional)
            </label>
            <input
              id="custodyCode"
              name="custodyCode"
              type="text"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Enter custody code if available"
              value={form.custodyCode}
              onChange={handleInputChange}
            />
          </div>

          {feedback.type !== 'idle' && (
            <div
              className={`rounded px-3 py-2 text-sm ${
                feedback.type === 'success'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              {feedback.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting || !formIsValid}>
              {isSubmitting ? 'Submitting...' : 'Submit custody record'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={resetForm}
              disabled={isSubmitting}
            >
              Clear form
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustodyIssueForm;