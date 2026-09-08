import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import {
  createCustodyRecord,
  searchCustodyRecipients,
} from '../../api/custody';
import { Button } from '../../components/ui/Button';

const CustodyIssueForm = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    itemName: '',
    quantity: '',
    description: '',
    custodyType: 'personal',
    custodyCode: '',
    departmentId: '',
    assetCategory: '',
    assetTag: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    conditionAtIssue: '',
    building: '',
    floor: '',
    room: '',
    sectionUnit: '',
    costCenter: '',
    preExistingCondition: '',
    acknowledgmentAccepted: false,
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
        const { data } = await api.get('/departments');
        if (!isMounted) return;
        setDepartments(data.map((dept) => ({ id: dept.id, name: dept.name })));
      } catch (err) {
        console.error('❌ Failed to load departments:', err);
        if (!isMounted) return;
        setDepartmentsError(t('custodyIssuePage.errors.departments'));
      }
    };

    loadDepartments();
    return () => {
      isMounted = false;
    };
  }, [t]);

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
          setSearchError(t('custodyIssuePage.errors.search'));
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
  }, [recipientQuery, form.custodyType, t]);

  useEffect(() => {
    if (form.custodyType !== 'personal') {
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
      assetCategory: '', assetTag: '', manufacturer: '', model: '', serialNumber: '',
      conditionAtIssue: '', building: '', floor: '', room: '', sectionUnit: '',
      costCenter: '', preExistingCondition: '', acknowledgmentAccepted: false,
    });
    setSelectedRecipient(null);
    setRecipientQuery('');
    setRecipientResults([]);
  };

  const formIsValid = useMemo(() => {
    if (!form.itemName.trim()) return false;
    if (!form.quantity || Number.isNaN(Number(form.quantity))) return false;
    if (!form.conditionAtIssue) return false;
    if (!form.acknowledgmentAccepted) return false;
    if (form.custodyType === 'personal' && !selectedRecipient) return false;
    if (form.custodyType === 'departmental' && !form.departmentId) return false;
    if (form.custodyType === 'location' && (!form.departmentId || !form.room.trim())) return false;
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
        form.custodyType !== 'personal' ? Number(form.departmentId) : undefined,
      asset_category: form.assetCategory || undefined,
      asset_tag: form.assetTag.trim() || undefined,
      manufacturer: form.manufacturer.trim() || undefined,
      model: form.model.trim() || undefined,
      serial_number: form.serialNumber.trim() || undefined,
      condition_at_issue: form.conditionAtIssue,
      building: form.building.trim() || undefined,
      floor: form.floor.trim() || undefined,
      room: form.room.trim() || undefined,
      section_unit: form.sectionUnit.trim() || undefined,
      cost_center: form.costCenter.trim() || undefined,
      pre_existing_condition: form.preExistingCondition.trim() || undefined,
      acknowledgment_accepted: form.acknowledgmentAccepted,
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
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">{t('custodyIssuePage.title')}</h1>
          <p className="mt-1 text-xl font-semibold" dir="rtl">نموذج عهدة الموجودات الثابتة والأثاث</p>
          <p className="mt-2 text-sm text-gray-500">{t('custodyIssuePage.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
          <section>
            <h2 className="text-lg font-semibold border-b pb-2">{t('custodyIssuePage.sections.assignment')}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div><span className="block text-sm font-medium text-gray-700">{t('custodyIssuePage.fields.formNumber')}</span><span className="mt-1 block rounded bg-gray-100 px-3 py-2 text-gray-500">{t('custodyIssuePage.fields.generated')}</span></div>
              <div><span className="block text-sm font-medium text-gray-700">{t('custodyIssuePage.fields.issueDate')}</span><span className="mt-1 block rounded bg-gray-100 px-3 py-2 text-gray-700">{new Date().toLocaleDateString()}</span></div>
              {['sectionUnit', 'costCenter', 'building', 'floor', 'room'].map((name) => (
                <div key={name}><label htmlFor={name} className="block text-sm font-medium text-gray-700">{t(`custodyIssuePage.fields.${name}`)}{name === 'room' && form.custodyType === 'location' ? ' *' : ''}</label><input id={name} name={name} value={form[name]} onChange={handleInputChange} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" required={name === 'room' && form.custodyType === 'location'} /></div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b pb-2">{t('custodyIssuePage.sections.asset')}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="itemName" className="block text-sm font-medium text-gray-700">
              {t('custodyIssuePage.fields.itemName')}
            </label>
            <input
              id="itemName"
              name="itemName"
              type="text"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              placeholder={t('custodyIssuePage.fields.itemNamePlaceholder')}
              value={form.itemName}
              onChange={handleInputChange}
              required
            />
          </div>

              <div><label htmlFor="assetCategory" className="block text-sm font-medium text-gray-700">{t('custodyIssuePage.fields.assetCategory')}</label><select id="assetCategory" name="assetCategory" value={form.assetCategory} onChange={handleInputChange} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"><option value="">{t('custodyIssuePage.fields.selectCategory')}</option>{['Furniture', 'IT Equipment', 'Medical Equipment', 'Electrical Equipment', 'Office Equipment', 'Other'].map((category) => <option key={category} value={category}>{t(`custodyIssuePage.categories.${category}`)}</option>)}</select></div>
              {[['assetTag', false], ['manufacturer', false], ['model', false], ['serialNumber', false]].map(([name]) => <div key={name}><label htmlFor={name} className="block text-sm font-medium text-gray-700">{t(`custodyIssuePage.fields.${name}`)}</label><input id={name} name={name} value={form[name]} onChange={handleInputChange} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" /></div>)}

              <div><label htmlFor="conditionAtIssue" className="block text-sm font-medium text-gray-700">{t('custodyIssuePage.fields.conditionAtIssue')} *</label><select id="conditionAtIssue" name="conditionAtIssue" value={form.conditionAtIssue} onChange={handleInputChange} required className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"><option value="">{t('custodyIssuePage.fields.selectCondition')}</option>{['New', 'Excellent', 'Good', 'Fair', 'Damaged / Defective'].map((condition) => <option key={condition} value={condition}>{t(`custodyIssuePage.conditions.${condition}`)}</option>)}</select></div>

          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
              {t('custodyIssuePage.fields.quantity')}
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              placeholder={t('custodyIssuePage.fields.quantityPlaceholder')}
              value={form.quantity}
              onChange={handleInputChange}
              required
            />
          </div>
            </div>
            <div className="mt-4"><label htmlFor="preExistingCondition" className="block text-sm font-medium text-gray-700">{t('custodyIssuePage.fields.preExistingCondition')}</label><textarea id="preExistingCondition" name="preExistingCondition" rows="2" value={form.preExistingCondition} onChange={handleInputChange} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" placeholder={t('custodyIssuePage.fields.preExistingPlaceholder')} /></div>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b pb-2">{t('custodyIssuePage.sections.accountability')}</h2>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              {t('custodyIssuePage.fields.description')}
            </label>
            <textarea
              id="description"
              name="description"
              rows="3"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              placeholder={t('custodyIssuePage.fields.detailsPlaceholder')}
              value={form.description}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{t('custodyIssuePage.fields.custodyType')}</label>
            <div className="mt-2 flex gap-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="custodyType"
                  value="personal"
                  checked={form.custodyType === 'personal'}
                  onChange={handleInputChange}
                />
                <span>{t('custodyIssuePage.fields.personal')}</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="custodyType" value="location" checked={form.custodyType === 'location'} onChange={handleInputChange} />
                <span>{t('custodyIssuePage.fields.location')}</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="custodyType"
                  value="departmental"
                  checked={form.custodyType === 'departmental'}
                  onChange={handleInputChange}
                />
                <span>{t('custodyIssuePage.fields.departmental')}</span>
              </label>
            </div>
          </div>

          {form.custodyType === 'personal' && (
            <div>
              <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">
                {t('custodyIssuePage.fields.custodian')}
              </label>
              <input
                id="recipient"
                type="text"
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                placeholder={t('custodyIssuePage.fields.recipientSearch')}
                value={recipientQuery}
                onChange={(event) => {
                  setRecipientQuery(event.target.value);
                  setSelectedRecipient(null);
                }}
                autoComplete="off"
              />
              {isSearchingRecipients && (
                <p className="text-sm text-gray-500 mt-1">{t('custodyIssuePage.states.searching')}</p>
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
                            {t('custodyIssuePage.fields.employeeId', { id: recipient.employee_id })}
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
                  {t('custodyIssuePage.fields.selectedCustodian', { name: selectedRecipient.name, email: selectedRecipient.email, employeeId: selectedRecipient.employee_id ? ` • ${selectedRecipient.employee_id}` : '' })}
                </p>
              )}
            </div>
          )}

          {form.custodyType !== 'personal' && (
            <div>
              <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700">
                {t('custodyIssuePage.fields.department')}
              </label>
              <select
                id="departmentId"
                name="departmentId"
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                value={form.departmentId}
                onChange={handleInputChange}
                required
              >
                <option value="">{t('custodyIssuePage.fields.selectDepartment')}</option>
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
              placeholder={t('custodyIssuePage.fields.custodyCodePlaceholder')}
              value={form.custodyCode}
              onChange={handleInputChange}
            />
          </div>
          </section>

          <section className="rounded border border-blue-200 bg-blue-50 p-4">
            <h2 className="font-semibold text-blue-950">{t('custodyIssuePage.sections.acknowledgment')}</h2>
            <div className="mt-3 space-y-3 text-sm leading-6 text-gray-800">
              <p>{t('custodyIssuePage.acknowledgment.receipt')}</p><p>{t('custodyIssuePage.acknowledgment.care')}</p><p>{t('custodyIssuePage.acknowledgment.report')}</p><p>{t('custodyIssuePage.acknowledgment.return')}</p><p className="font-medium">{t('custodyIssuePage.acknowledgment.investigation')}</p><p className="rounded bg-white p-3">{t('custodyIssuePage.acknowledgment.historical')}</p>
            </div>
            <label className="mt-4 flex items-start gap-3 font-medium text-gray-900"><input type="checkbox" name="acknowledgmentAccepted" checked={form.acknowledgmentAccepted} onChange={(event) => setForm((prev) => ({ ...prev, acknowledgmentAccepted: event.target.checked }))} className="mt-1" required /><span>{t('custodyIssuePage.acknowledgment.accept')}</span></label>
          </section>

          <section className="rounded border p-4">
            <h2 className="font-semibold">{t('custodyIssuePage.sections.approvals')}</h2>
            <p className="mt-2 text-sm text-gray-600">{t('custodyIssuePage.approvalNote')}</p>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3"><div>{t('custodyIssuePage.roles.custodian')}</div><div>{t('custodyIssuePage.roles.departmentHead')}</div><div>{t('custodyIssuePage.roles.assetRepresentative')}</div></div>
          </section>

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
              {isSubmitting ? t('custodyIssuePage.actions.submitting') : t('custodyIssuePage.actions.submit')}
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