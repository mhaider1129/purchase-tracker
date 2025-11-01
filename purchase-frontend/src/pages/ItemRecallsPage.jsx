// src/pages/ItemRecallsPage.jsx
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';
import {
  escalateRecallToProcurement,
  submitDepartmentRecall,
  submitWarehouseRecall,
} from '../api/itemRecalls';

const warehouseRoleSet = new Set([
  'warehousemanager',
  'warehouse_manager',
  'warehousekeeper',
  'warehouse_keeper',
]);

const ItemRecallsPage = () => {
  const { t } = useTranslation();
  const { user, loading, error } = useCurrentUser();

  const [departmentForm, setDepartmentForm] = useState({
    itemId: '',
    itemName: '',
    quantity: '',
    reason: '',
    notes: '',
  });
  const [departmentStatus, setDepartmentStatus] = useState({ submitting: false, success: '', error: '' });

  const [warehouseForm, setWarehouseForm] = useState({
    itemId: '',
    itemName: '',
    quantity: '',
    reason: '',
    notes: '',
    warehouseNotes: '',
  });
  const [warehouseStatus, setWarehouseStatus] = useState({ submitting: false, success: '', error: '' });

  const [escalationForm, setEscalationForm] = useState({
    recallId: '',
    warehouseNotes: '',
  });
  const [escalationStatus, setEscalationStatus] = useState({ submitting: false, success: '', error: '' });

  const canUseWarehouseTools = useMemo(() => {
    const normalizedRole = user?.role?.toLowerCase();
    return Boolean(normalizedRole && warehouseRoleSet.has(normalizedRole));
  }, [user]);

  const renderStatusMessage = ({ success, error: statusError }) => {
    if (success) {
      return (
        <p className="mt-3 rounded bg-green-100 px-3 py-2 text-sm font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200">
          {success}
        </p>
      );
    }
    if (statusError) {
      return (
        <p className="mt-3 rounded bg-red-100 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">
          {statusError}
        </p>
      );
    }
    return null;
  };

  const handleDepartmentChange = (field) => (event) => {
    const { value } = event.target;
    setDepartmentForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleWarehouseChange = (field) => (event) => {
    const { value } = event.target;
    setWarehouseForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEscalationChange = (field) => (event) => {
    const { value } = event.target;
    setEscalationForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDepartmentSubmit = async (event) => {
    event.preventDefault();
    setDepartmentStatus({ submitting: true, success: '', error: '' });
    try {
      const response = await submitDepartmentRecall({
        itemId: departmentForm.itemId.trim(),
        itemName: departmentForm.itemName.trim(),
        quantity: departmentForm.quantity.trim(),
        reason: departmentForm.reason.trim(),
        notes: departmentForm.notes.trim(),
      });
      setDepartmentForm({ itemId: '', itemName: '', quantity: '', reason: '', notes: '' });
      setDepartmentStatus({
        submitting: false,
        success: t('itemRecalls.department.success', { item: response?.recall?.item_name ?? '' }),
        error: '',
      });
    } catch (err) {
      const message = err?.response?.data?.message ?? err?.message ?? t('itemRecalls.errors.generic');
      setDepartmentStatus({ submitting: false, success: '', error: message });
    }
  };

  const handleWarehouseSubmit = async (event) => {
    event.preventDefault();
    setWarehouseStatus({ submitting: true, success: '', error: '' });
    try {
      const response = await submitWarehouseRecall({
        itemId: warehouseForm.itemId.trim(),
        itemName: warehouseForm.itemName.trim(),
        quantity: warehouseForm.quantity.trim(),
        reason: warehouseForm.reason.trim(),
        notes: warehouseForm.notes.trim(),
        warehouseNotes: warehouseForm.warehouseNotes.trim(),
      });
      setWarehouseForm({ itemId: '', itemName: '', quantity: '', reason: '', notes: '', warehouseNotes: '' });
      setWarehouseStatus({
        submitting: false,
        success: t('itemRecalls.warehouse.success', { item: response?.recall?.item_name ?? '' }),
        error: '',
      });
    } catch (err) {
      const message = err?.response?.data?.message ?? err?.message ?? t('itemRecalls.errors.generic');
      setWarehouseStatus({ submitting: false, success: '', error: message });
    }
  };

  const handleEscalationSubmit = async (event) => {
    event.preventDefault();
    const trimmedRecallId = escalationForm.recallId.trim();
    if (!trimmedRecallId) {
      setEscalationStatus({ submitting: false, success: '', error: t('itemRecalls.errors.recallIdRequired') });
      return;
    }

    if (!/^[0-9]+$/.test(trimmedRecallId) || Number(trimmedRecallId) <= 0) {
      setEscalationStatus({ submitting: false, success: '', error: t('itemRecalls.errors.invalidRecallId') });
      return;
    }

    setEscalationStatus({ submitting: true, success: '', error: '' });
    try {
      const response = await escalateRecallToProcurement({
        recallId: trimmedRecallId,
        warehouseNotes: escalationForm.warehouseNotes.trim(),
      });
      setEscalationForm({ recallId: '', warehouseNotes: '' });
      setEscalationStatus({
        submitting: false,
        success: t('itemRecalls.escalation.success', { item: response?.recall?.item_name ?? '' }),
        error: '',
      });
    } catch (err) {
      const message = err?.response?.data?.message ?? err?.message ?? t('itemRecalls.errors.generic');
      setEscalationStatus({ submitting: false, success: '', error: message });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('itemRecalls.title')}</h1>
          <p className="mt-2 max-w-3xl text-base text-gray-600 dark:text-gray-300">{t('itemRecalls.subtitle')}</p>
        </header>

        {loading && (
          <div className="rounded-md border border-dashed border-gray-300 bg-white/60 p-6 text-center text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
            {t('itemRecalls.loading')}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        )}

        {!loading && user && (
          <div className="space-y-10">
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
              <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
                {t('itemRecalls.department.title')}
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {t('itemRecalls.department.description')}
              </p>

              <form className="mt-4 space-y-4" onSubmit={handleDepartmentSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col">
                    <label htmlFor="department-item-id" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {t('itemRecalls.fields.itemId.label')}
                    </label>
                    <input
                      id="department-item-id"
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={departmentForm.itemId}
                      onChange={handleDepartmentChange('itemId')}
                      className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      placeholder={t('itemRecalls.fields.itemId.placeholder')}
                    />
                    <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('itemRecalls.fields.itemId.help')}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="department-item-name" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {t('itemRecalls.fields.itemName.label')}
                    </label>
                    <input
                      id="department-item-name"
                      type="text"
                      value={departmentForm.itemName}
                      onChange={handleDepartmentChange('itemName')}
                      className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      placeholder={t('itemRecalls.fields.itemName.placeholder')}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col">
                    <label htmlFor="department-quantity" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {t('itemRecalls.fields.quantity.label')}
                    </label>
                    <input
                      id="department-quantity"
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={departmentForm.quantity}
                      onChange={handleDepartmentChange('quantity')}
                      className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      placeholder={t('itemRecalls.fields.quantity.placeholder')}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="department-reason" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {t('itemRecalls.fields.reason.label')}
                    </label>
                    <textarea
                      id="department-reason"
                      value={departmentForm.reason}
                      onChange={handleDepartmentChange('reason')}
                      className="mt-1 h-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      placeholder={t('itemRecalls.fields.reason.placeholder')}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label htmlFor="department-notes" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {t('itemRecalls.fields.notes.label')}
                  </label>
                  <textarea
                    id="department-notes"
                    value={departmentForm.notes}
                    onChange={handleDepartmentChange('notes')}
                    className="mt-1 h-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    placeholder={t('itemRecalls.fields.notes.placeholder')}
                  />
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDepartmentForm({ itemId: '', itemName: '', quantity: '', reason: '', notes: '' });
                      setDepartmentStatus({ submitting: false, success: '', error: '' });
                    }}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {t('itemRecalls.actions.reset')}
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-gray-900"
                    disabled={departmentStatus.submitting}
                  >
                    {departmentStatus.submitting
                      ? t('itemRecalls.actions.submitting')
                      : t('itemRecalls.actions.submitDepartment')}
                  </button>
                </div>
              </form>

              {renderStatusMessage(departmentStatus)}
            </section>

            {canUseWarehouseTools && (
              <>
                <section className="rounded-lg border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-700/60 dark:bg-gray-900/70">
                  <h2 className="text-xl font-semibold text-amber-700 dark:text-amber-300">
                    {t('itemRecalls.warehouse.title')}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {t('itemRecalls.warehouse.description')}
                  </p>

                  <form className="mt-4 space-y-4" onSubmit={handleWarehouseSubmit}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col">
                        <label htmlFor="warehouse-item-id" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('itemRecalls.fields.itemId.label')}
                        </label>
                        <input
                          id="warehouse-item-id"
                          type="number"
                          min="1"
                          inputMode="numeric"
                          value={warehouseForm.itemId}
                          onChange={handleWarehouseChange('itemId')}
                          className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          placeholder={t('itemRecalls.fields.itemId.placeholder')}
                        />
                        <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t('itemRecalls.fields.itemId.help')}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <label htmlFor="warehouse-item-name" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('itemRecalls.fields.itemName.label')}
                        </label>
                        <input
                          id="warehouse-item-name"
                          type="text"
                          value={warehouseForm.itemName}
                          onChange={handleWarehouseChange('itemName')}
                          className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          placeholder={t('itemRecalls.fields.itemName.placeholder')}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col">
                        <label htmlFor="warehouse-quantity" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('itemRecalls.fields.quantity.label')}
                        </label>
                        <input
                          id="warehouse-quantity"
                          type="number"
                          min="1"
                          inputMode="numeric"
                          value={warehouseForm.quantity}
                          onChange={handleWarehouseChange('quantity')}
                          className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          placeholder={t('itemRecalls.fields.quantity.placeholder')}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label htmlFor="warehouse-reason" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('itemRecalls.fields.reason.label')}
                        </label>
                        <textarea
                          id="warehouse-reason"
                          value={warehouseForm.reason}
                          onChange={handleWarehouseChange('reason')}
                          className="mt-1 h-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          placeholder={t('itemRecalls.fields.reason.placeholder')}
                          required
                        />
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="warehouse-notes" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {t('itemRecalls.fields.notes.label')}
                      </label>
                      <textarea
                        id="warehouse-notes"
                        value={warehouseForm.notes}
                        onChange={handleWarehouseChange('notes')}
                        className="mt-1 h-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        placeholder={t('itemRecalls.fields.notes.placeholder')}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="warehouse-warehouse-notes" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {t('itemRecalls.fields.warehouseNotes.label')}
                      </label>
                      <textarea
                        id="warehouse-warehouse-notes"
                        value={warehouseForm.warehouseNotes}
                        onChange={handleWarehouseChange('warehouseNotes')}
                        className="mt-1 h-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        placeholder={t('itemRecalls.fields.warehouseNotes.placeholder')}
                      />
                      <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('itemRecalls.fields.warehouseNotes.help')}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setWarehouseForm({ itemId: '', itemName: '', quantity: '', reason: '', notes: '', warehouseNotes: '' });
                          setWarehouseStatus({ submitting: false, success: '', error: '' });
                        }}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {t('itemRecalls.actions.reset')}
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-gray-900"
                        disabled={warehouseStatus.submitting}
                      >
                        {warehouseStatus.submitting
                          ? t('itemRecalls.actions.submitting')
                          : t('itemRecalls.actions.submitWarehouse')}
                      </button>
                    </div>
                  </form>

                  {renderStatusMessage(warehouseStatus)}
                </section>

                <section className="rounded-lg border border-indigo-200 bg-white p-6 shadow-sm dark:border-indigo-700/60 dark:bg-gray-900/70">
                  <h2 className="text-xl font-semibold text-indigo-700 dark:text-indigo-300">
                    {t('itemRecalls.escalation.title')}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {t('itemRecalls.escalation.description')}
                  </p>

                  <form className="mt-4 space-y-4" onSubmit={handleEscalationSubmit}>
                    <div className="flex flex-col">
                      <label htmlFor="escalation-recall-id" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {t('itemRecalls.fields.recallId.label')}
                      </label>
                      <input
                        id="escalation-recall-id"
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={escalationForm.recallId}
                        onChange={handleEscalationChange('recallId')}
                        className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        placeholder={t('itemRecalls.fields.recallId.placeholder')}
                        required
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="escalation-warehouse-notes" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {t('itemRecalls.fields.warehouseNotes.label')}
                      </label>
                      <textarea
                        id="escalation-warehouse-notes"
                        value={escalationForm.warehouseNotes}
                        onChange={handleEscalationChange('warehouseNotes')}
                        className="mt-1 h-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        placeholder={t('itemRecalls.fields.warehouseNotes.escalationPlaceholder')}
                      />
                      <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('itemRecalls.fields.warehouseNotes.escalationHelp')}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEscalationForm({ recallId: '', warehouseNotes: '' });
                          setEscalationStatus({ submitting: false, success: '', error: '' });
                        }}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {t('itemRecalls.actions.reset')}
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-gray-900"
                        disabled={escalationStatus.submitting}
                      >
                        {escalationStatus.submitting
                          ? t('itemRecalls.actions.submitting')
                          : t('itemRecalls.actions.escalate')}
                      </button>
                    </div>
                  </form>

                  {renderStatusMessage(escalationStatus)}
                </section>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ItemRecallsPage;