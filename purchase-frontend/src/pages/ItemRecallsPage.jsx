// src/pages/ItemRecallsPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';
import {
  escalateRecallToProcurement,
  fetchRecallWorkspaceItems,
  submitDepartmentRecall,
  submitWarehouseRecall,
} from '../api/itemRecalls';

const warehouseRoleSet = new Set([
  'warehousemanager',
  'warehouse_manager',
  'warehousekeeper',
  'warehouse_keeper',
]);

const procurementRoleSet = new Set([
  'procurementspecialist',
  'procurement_specialist',
  'scm',
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
    recallNotice: '',
    supplierLetters: '',
    ncrReference: '',
    capaReference: '',
    finalReport: '',
  });
  const [departmentStatus, setDepartmentStatus] = useState({ submitting: false, success: '', error: '' });

  const [warehouseForm, setWarehouseForm] = useState({
    itemId: '',
    itemName: '',
    quantity: '',
    reason: '',
    notes: '',
    warehouseNotes: '',
    recallNotice: '',
    supplierLetters: '',
    ncrReference: '',
    capaReference: '',
    finalReport: '',
  });
  const [warehouseStatus, setWarehouseStatus] = useState({ submitting: false, success: '', error: '' });

  const [escalationForm, setEscalationForm] = useState({
    recallId: '',
    warehouseNotes: '',
  });
  const [escalationStatus, setEscalationStatus] = useState({ submitting: false, success: '', error: '' });

  const [visibleRecalls, setVisibleRecalls] = useState([]);
  const [recallListState, setRecallListState] = useState({ loading: false, error: '' });

  const normalizedRole = useMemo(() => {
    const role = user?.role;
    if (!role || typeof role !== 'string') {
      return '';
    }
    return role.toLowerCase();
  }, [user?.role]);

  const canUseWarehouseTools = useMemo(
    () => normalizedRole !== '' && warehouseRoleSet.has(normalizedRole),
    [normalizedRole],
  );

  const isProcurementUser = useMemo(
    () => normalizedRole !== '' && procurementRoleSet.has(normalizedRole),
    [normalizedRole],
  );

  const canViewRecallList = useMemo(
    () => normalizedRole !== '' && (warehouseRoleSet.has(normalizedRole) || procurementRoleSet.has(normalizedRole)),
    [normalizedRole],
  );

  const loadRecalls = useCallback(
    async (signal) => {
      if (!canViewRecallList) {
        return;
      }

      setRecallListState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const data = await fetchRecallWorkspaceItems({ signal });
        if (signal?.aborted) {
          return;
        }
        setVisibleRecalls(Array.isArray(data?.recalls) ? data.recalls : []);
        setRecallListState({ loading: false, error: '' });
      } catch (err) {
        if (signal?.aborted || err?.code === 'ERR_CANCELED') {
          return;
        }
        const message =
          err?.response?.data?.message ?? err?.message ?? t('itemRecalls.errors.loadRecalls');
        setRecallListState({ loading: false, error: message });
      }
    },
    [canViewRecallList, t],
  );

  useEffect(() => {
    if (!canViewRecallList) {
      setVisibleRecalls([]);
      setRecallListState({ loading: false, error: '' });
      return;
    }

    const controller = new AbortController();
    loadRecalls(controller.signal);

    return () => {
      controller.abort();
    };
  }, [canViewRecallList, loadRecalls]);

  const handleRefreshRecalls = useCallback(() => {
    loadRecalls();
  }, [loadRecalls]);

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
        recallNotice: departmentForm.recallNotice.trim(),
        supplierLetters: departmentForm.supplierLetters.trim(),
        ncrReference: departmentForm.ncrReference.trim(),
        capaReference: departmentForm.capaReference.trim(),
        finalReport: departmentForm.finalReport.trim(),
      });
      setDepartmentForm({
        itemId: '',
        itemName: '',
        quantity: '',
        reason: '',
        notes: '',
        recallNotice: '',
        supplierLetters: '',
        ncrReference: '',
        capaReference: '',
        finalReport: '',
      });
      setDepartmentStatus({
        submitting: false,
        success: t('itemRecalls.department.success', { item: response?.recall?.item_name ?? '' }),
        error: '',
      });
      handleRefreshRecalls();
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
        recallNotice: warehouseForm.recallNotice.trim(),
        supplierLetters: warehouseForm.supplierLetters.trim(),
        ncrReference: warehouseForm.ncrReference.trim(),
        capaReference: warehouseForm.capaReference.trim(),
        finalReport: warehouseForm.finalReport.trim(),
      });
      setWarehouseForm({
        itemId: '',
        itemName: '',
        quantity: '',
        reason: '',
        notes: '',
        warehouseNotes: '',
        recallNotice: '',
        supplierLetters: '',
        ncrReference: '',
        capaReference: '',
        finalReport: '',
      });
      setWarehouseStatus({
        submitting: false,
        success: t('itemRecalls.warehouse.success', { item: response?.recall?.item_name ?? '' }),
        error: '',
      });
      handleRefreshRecalls();
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
      handleRefreshRecalls();
    } catch (err) {
      const message = err?.response?.data?.message ?? err?.message ?? t('itemRecalls.errors.generic');
      setEscalationStatus({ submitting: false, success: '', error: message });
    }
  };

  const formatWorkflowLabel = useCallback(
    (type) => {
      switch (type) {
        case 'department_to_warehouse':
          return t('itemRecalls.list.recallType.departmentToWarehouse');
        case 'warehouse_to_procurement':
          return t('itemRecalls.list.recallType.warehouseToProcurement');
        default:
          return type ?? t('itemRecalls.list.recallType.unknown');
      }
    },
    [t],
  );

  const formatDepartmentLabel = useCallback(
    (recall) => {
      if (recall?.department_name) {
        return recall.department_name;
      }
      if (recall?.department_id) {
        return t('itemRecalls.list.labels.departmentFallback', { id: recall.department_id });
      }
      return t('itemRecalls.list.labels.unknownDepartment');
    },
    [t],
  );

  const formatTimestamp = useCallback(
    (recall) => {
      const timestamp = recall?.updated_at ?? recall?.escalated_at ?? recall?.created_at;
      if (!timestamp) {
        return t('itemRecalls.list.notAvailable');
      }

      const parsed = new Date(timestamp);
      if (Number.isNaN(parsed.getTime())) {
        return t('itemRecalls.list.notAvailable');
      }

      return parsed.toLocaleString();
    },
    [t],
  );

  const formatQuantity = useCallback(
    (value) => {
      if (value === null || value === undefined || value === '') {
        return t('itemRecalls.list.notAvailable');
      }
      return value;
    },
    [t],
  );

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
            {canViewRecallList && (
              <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {t('itemRecalls.list.title')}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {t('itemRecalls.list.description')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshRecalls}
                    className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus:ring-offset-gray-900"
                    disabled={recallListState.loading}
                  >
                    {recallListState.loading
                      ? t('itemRecalls.list.loading')
                      : t('itemRecalls.list.refresh')}
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {recallListState.error && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
                      {recallListState.error}
                    </div>
                  )}

                  {!recallListState.error && recallListState.loading && (
                    <div className="rounded-md border border-dashed border-gray-300 bg-white/70 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
                      {t('itemRecalls.list.loading')}
                    </div>
                  )}

                  {!recallListState.loading && !recallListState.error && visibleRecalls.length === 0 && (
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                      {t(
                        isProcurementUser
                          ? 'itemRecalls.list.empty.procurement'
                          : canUseWarehouseTools
                          ? 'itemRecalls.list.empty.warehouse'
                          : 'itemRecalls.list.empty.generic',
                      )}
                    </div>
                  )}

                  {!recallListState.loading && !recallListState.error && visibleRecalls.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/40">
                          <tr>
                            <th
                              scope="col"
                              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                            >
                              {t('itemRecalls.list.columns.item')}
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                            >
                              {t('itemRecalls.list.columns.department')}
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                            >
                              {t('itemRecalls.list.columns.workflow')}
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                            >
                              {t('itemRecalls.list.columns.status')}
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                            >
                              {t('itemRecalls.list.columns.quantity')}
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                            >
                              {t('itemRecalls.list.columns.updated')}
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                            >
                              {t('itemRecalls.list.columns.details')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-950">
                          {visibleRecalls.map((recall) => {
                            const workflowLabel = formatWorkflowLabel(recall.recall_type);
                            const timestampDisplay = formatTimestamp(recall);
                            const quantityDisplay = formatQuantity(recall.quantity);
                            const departmentDisplay = formatDepartmentLabel(recall);
                            const recallIdLabel = t('itemRecalls.list.labels.recallId', { id: recall.id });

                            return (
                              <tr key={recall.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                                <td className="whitespace-nowrap px-3 py-3 text-sm">
                                  <div className="font-semibold text-gray-900 dark:text-gray-100">{recall.item_name}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span>{recallIdLabel}</span>
                                    {recall.escalated_to_procurement && (
                                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200">
                                        {t('itemRecalls.list.labels.escalated')}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                                  {departmentDisplay}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                                  {workflowLabel}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {recall.status || t('itemRecalls.list.notAvailable')}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                                  {quantityDisplay}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                                  {timestampDisplay}
                                </td>
                                <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                                  <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-200">
                                      {t('itemRecalls.list.labels.reason')}:
                                    </span>{' '}
                                    {recall.reason || t('itemRecalls.list.notAvailable')}
                                  </div>
                                  {(recall.notes || recall.warehouse_notes) && (
                                    <ul className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                                      {recall.notes && (
                                        <li>
                                          <span className="font-medium text-gray-600 dark:text-gray-300">
                                            {t('itemRecalls.list.labels.departmentNotes')}:
                                          </span>{' '}
                                          {recall.notes}
                                        </li>
                                      )}
                                      {recall.warehouse_notes && (
                                        <li>
                                          <span className="font-medium text-gray-600 dark:text-gray-300">
                                            {t('itemRecalls.list.labels.warehouseNotes')}:
                                          </span>{' '}
                                          {recall.warehouse_notes}
                                        </li>
                                      )}
                                    </ul>
                                  )}
                                  {(recall.recall_notice ||
                                    recall.supplier_letters ||
                                    recall.ncr_reference ||
                                    recall.capa_reference ||
                                    recall.final_report) && (
                                    <div className="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                                      <p className="font-medium text-gray-700 dark:text-gray-200">
                                        {t('itemRecalls.list.labels.recordKeeping')}
                                      </p>
                                      <ul className="space-y-1">
                                        {recall.recall_notice && (
                                          <li>
                                            <span className="font-medium text-gray-600 dark:text-gray-300">
                                              {t('itemRecalls.list.labels.recallNotice')}:
                                            </span>{' '}
                                            {recall.recall_notice}
                                          </li>
                                        )}
                                        {recall.supplier_letters && (
                                          <li>
                                            <span className="font-medium text-gray-600 dark:text-gray-300">
                                              {t('itemRecalls.list.labels.supplierLetters')}:
                                            </span>{' '}
                                            {recall.supplier_letters}
                                          </li>
                                        )}
                                        {recall.ncr_reference && (
                                          <li>
                                            <span className="font-medium text-gray-600 dark:text-gray-300">
                                              {t('itemRecalls.list.labels.ncrReference')}:
                                            </span>{' '}
                                            {recall.ncr_reference}
                                          </li>
                                        )}
                                        {recall.capa_reference && (
                                          <li>
                                            <span className="font-medium text-gray-600 dark:text-gray-300">
                                              {t('itemRecalls.list.labels.capaReference')}:
                                            </span>{' '}
                                            {recall.capa_reference}
                                          </li>
                                        )}
                                        {recall.final_report && (
                                          <li>
                                            <span className="font-medium text-gray-600 dark:text-gray-300">
                                              {t('itemRecalls.list.labels.finalReport')}:
                                            </span>{' '}
                                            {recall.final_report}
                                          </li>
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}

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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col">
                    <label htmlFor="department-recall-notice" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {t('itemRecalls.fields.recallNotice.label')}
                    </label>
                    <textarea
                      id="department-recall-notice"
                      value={departmentForm.recallNotice}
                      onChange={handleDepartmentChange('recallNotice')}
                      className="mt-1 h-20 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      placeholder={t('itemRecalls.fields.recallNotice.placeholder')}
                    />
                    <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('itemRecalls.fields.recallNotice.help')}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="department-supplier-letters" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {t('itemRecalls.fields.supplierLetters.label')}
                    </label>
                    <textarea
                      id="department-supplier-letters"
                      value={departmentForm.supplierLetters}
                      onChange={handleDepartmentChange('supplierLetters')}
                      className="mt-1 h-20 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      placeholder={t('itemRecalls.fields.supplierLetters.placeholder')}
                    />
                    <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('itemRecalls.fields.supplierLetters.help')}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col">
                    <label htmlFor="department-ncr" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {t('itemRecalls.fields.ncrReference.label')}
                    </label>
                    <input
                      id="department-ncr"
                      type="text"
                      value={departmentForm.ncrReference}
                      onChange={handleDepartmentChange('ncrReference')}
                      className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      placeholder={t('itemRecalls.fields.ncrReference.placeholder')}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="department-capa" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {t('itemRecalls.fields.capaReference.label')}
                    </label>
                    <input
                      id="department-capa"
                      type="text"
                      value={departmentForm.capaReference}
                      onChange={handleDepartmentChange('capaReference')}
                      className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      placeholder={t('itemRecalls.fields.capaReference.placeholder')}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="department-final-report" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {t('itemRecalls.fields.finalReport.label')}
                    </label>
                    <textarea
                      id="department-final-report"
                      value={departmentForm.finalReport}
                      onChange={handleDepartmentChange('finalReport')}
                      className="mt-1 h-20 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      placeholder={t('itemRecalls.fields.finalReport.placeholder')}
                    />
                    <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('itemRecalls.fields.finalReport.help')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                        type="button"
                        onClick={() => {
                          setDepartmentForm({
                            itemId: '',
                            itemName: '',
                            quantity: '',
                            reason: '',
                            notes: '',
                            recallNotice: '',
                            supplierLetters: '',
                            ncrReference: '',
                            capaReference: '',
                            finalReport: '',
                          });
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

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col">
                        <label htmlFor="warehouse-recall-notice" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('itemRecalls.fields.recallNotice.label')}
                        </label>
                        <textarea
                          id="warehouse-recall-notice"
                          value={warehouseForm.recallNotice}
                          onChange={handleWarehouseChange('recallNotice')}
                          className="mt-1 h-20 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          placeholder={t('itemRecalls.fields.recallNotice.placeholder')}
                        />
                        <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t('itemRecalls.fields.recallNotice.help')}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <label htmlFor="warehouse-supplier-letters" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('itemRecalls.fields.supplierLetters.label')}
                        </label>
                        <textarea
                          id="warehouse-supplier-letters"
                          value={warehouseForm.supplierLetters}
                          onChange={handleWarehouseChange('supplierLetters')}
                          className="mt-1 h-20 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          placeholder={t('itemRecalls.fields.supplierLetters.placeholder')}
                        />
                        <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t('itemRecalls.fields.supplierLetters.help')}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="flex flex-col">
                        <label htmlFor="warehouse-ncr" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('itemRecalls.fields.ncrReference.label')}
                        </label>
                        <input
                          id="warehouse-ncr"
                          type="text"
                          value={warehouseForm.ncrReference}
                          onChange={handleWarehouseChange('ncrReference')}
                          className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          placeholder={t('itemRecalls.fields.ncrReference.placeholder')}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label htmlFor="warehouse-capa" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('itemRecalls.fields.capaReference.label')}
                        </label>
                        <input
                          id="warehouse-capa"
                          type="text"
                          value={warehouseForm.capaReference}
                          onChange={handleWarehouseChange('capaReference')}
                          className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          placeholder={t('itemRecalls.fields.capaReference.placeholder')}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label htmlFor="warehouse-final-report" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('itemRecalls.fields.finalReport.label')}
                        </label>
                        <textarea
                          id="warehouse-final-report"
                          value={warehouseForm.finalReport}
                          onChange={handleWarehouseChange('finalReport')}
                          className="mt-1 h-20 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          placeholder={t('itemRecalls.fields.finalReport.placeholder')}
                        />
                        <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t('itemRecalls.fields.finalReport.help')}
                        </span>
                      </div>
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
                          setWarehouseForm({
                            itemId: '',
                            itemName: '',
                            quantity: '',
                            reason: '',
                            notes: '',
                            warehouseNotes: '',
                            recallNotice: '',
                            supplierLetters: '',
                            ncrReference: '',
                            capaReference: '',
                            finalReport: '',
                          });
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