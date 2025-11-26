import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';
import useWarehouses from '../hooks/useWarehouses';

const numberFormatter = new Intl.NumberFormat();

const WarehouseInventoryPage = () => {
  const { t } = useTranslation();
  const tr = (key, fallback) => t(`warehouseInventory.${key}`, fallback);
  const { user, loading: userLoading } = useCurrentUser();
  const { warehouses, loading: warehousesLoading, error: warehousesError } = useWarehouses();

  const [stockItems, setStockItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [issueItemSearch, setIssueItemSearch] = useState('');
  const [form, setForm] = useState({
    stock_item_id: '',
    quantity: '',
    notes: '',
    warehouse_id: '',
  });
  const [issueForm, setIssueForm] = useState({
    stock_item_id: '',
    department_id: '',
    quantity: '',
    notes: '',
    warehouse_id: '',
  });
  const [formStatus, setFormStatus] = useState({ state: 'idle', message: '' });
  const [issueFormStatus, setIssueFormStatus] = useState({ state: 'idle', message: '' });

  const [departments, setDepartments] = useState([]);
  const [departmentsStatus, setDepartmentsStatus] = useState({ state: 'idle', message: '' });
  const [report, setReport] = useState({ departments: [], window_start: '', window_end: '', generated_at: '' });
  const [reportStatus, setReportStatus] = useState({ state: 'idle', message: '' });

  const loadStockItems = async () => {
    try {
      const res = await api.get('/api/stock-items');
      setStockItems(res.data || []);
    } catch (err) {
      console.error('Failed to load stock items:', err);
      setFormStatus({ state: 'error', message: tr('alerts.loadItemsFailed') });
    }
  };

  const loadDepartments = async () => {
    setDepartmentsStatus({ state: 'loading', message: '' });
    try {
      const res = await api.get('/api/departments');
      setDepartments(res.data || []);
      setDepartmentsStatus({ state: 'idle', message: '' });
    } catch (err) {
      console.error('Failed to load departments:', err);
      setDepartmentsStatus({ state: 'error', message: tr('alerts.loadDepartmentsFailed') });
    }
  };

  const loadReport = async () => {
    setReportStatus({ state: 'loading', message: '' });
    try {
      const res = await api.get('/api/warehouse-inventory/reports/weekly');
      setReport({
        departments: res.data?.departments || [],
        window_start: res.data?.window_start || '',
        window_end: res.data?.window_end || '',
        generated_at: res.data?.generated_at || '',
      });
      setReportStatus({ state: 'idle', message: '' });
    } catch (err) {
      console.error('Failed to load weekly stocking report:', err);
      setReportStatus({ state: 'error', message: tr('alerts.reportFailed') });
    }
  };

  useEffect(() => {
    if (!userLoading && user) {
      loadStockItems();
      loadDepartments();
      loadReport();
    }
  }, [user, userLoading]);

  useEffect(() => {
    if (warehouses.length > 0) {
      const preferred = user?.warehouse_id || warehouses[0]?.id;
      if (preferred) {
        if (!form.warehouse_id) {
          setForm((prev) => ({ ...prev, warehouse_id: String(preferred) }));
        }
        if (!issueForm.warehouse_id) {
          setIssueForm((prev) => ({ ...prev, warehouse_id: String(preferred) }));
        }
      }
    }
  }, [form.warehouse_id, issueForm.warehouse_id, warehouses, user]);

  useEffect(() => {
    if (formStatus.state === 'success') {
      const timer = setTimeout(() => setFormStatus({ state: 'idle', message: '' }), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [formStatus]);

  useEffect(() => {
    if (issueFormStatus.state === 'success') {
      const timer = setTimeout(() => setIssueFormStatus({ state: 'idle', message: '' }), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [issueFormStatus]);

  const filteredItems = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    if (!term) return stockItems;
    return stockItems.filter((item) =>
      [item.name, item.brand, item.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [itemSearch, stockItems]);

  const filteredIssueItems = useMemo(() => {
    const term = issueItemSearch.trim().toLowerCase();
    if (!term) return stockItems;
    return stockItems.filter((item) =>
      [item.name, item.brand, item.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [issueItemSearch, stockItems]);

  const selectedItem = stockItems.find((item) => String(item.id) === String(form.stock_item_id));
  const selectedIssueItem = stockItems.find((item) => String(item.id) === String(issueForm.stock_item_id));

  const handleFormChange = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleIssueFormChange = (key) => (event) => {
    const value = event.target.value;
    setIssueForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const parsedQuantity = Number(form.quantity);
    if (!form.warehouse_id) {
      setFormStatus({ state: 'error', message: tr('alerts.validationFailed') });
      return;
    }
    if (!form.stock_item_id || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setFormStatus({ state: 'error', message: tr('alerts.validationFailed') });
      return;
    }

    setFormStatus({ state: 'loading', message: '' });
    try {
      await api.post('/api/warehouse-inventory/stock', {
        stock_item_id: Number(form.stock_item_id),
        quantity: parsedQuantity,
        notes: form.notes?.trim() || undefined,
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : undefined,
      });
      setFormStatus({ state: 'success', message: tr('alerts.submitSuccess') });
      setForm({ stock_item_id: '', quantity: '', notes: '', warehouse_id: form.warehouse_id });
      setItemSearch('');
      loadReport();
    } catch (err) {
      console.error('Failed to add warehouse stock:', err);
      const message = err?.response?.data?.message || tr('alerts.submitFailed');
      setFormStatus({ state: 'error', message });
    }
  };

  const handleIssueSubmit = async (event) => {
    event.preventDefault();
    const parsedQuantity = Number(issueForm.quantity);

    if (!issueForm.warehouse_id || !issueForm.stock_item_id || !issueForm.department_id) {
      setIssueFormStatus({ state: 'error', message: tr('alerts.issueValidationFailed') });
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setIssueFormStatus({ state: 'error', message: tr('alerts.issueValidationFailed') });
      return;
    }

    setIssueFormStatus({ state: 'loading', message: '' });
    try {
      await api.post('/api/warehouse-inventory/stock/issue', {
        stock_item_id: Number(issueForm.stock_item_id),
        department_id: Number(issueForm.department_id),
        quantity: parsedQuantity,
        notes: issueForm.notes?.trim() || undefined,
        warehouse_id: issueForm.warehouse_id ? Number(issueForm.warehouse_id) : undefined,
      });
      setIssueFormStatus({ state: 'success', message: tr('alerts.issueSubmitSuccess') });
      setIssueForm((prev) => ({
        stock_item_id: '',
        department_id: '',
        quantity: '',
        notes: '',
        warehouse_id: prev.warehouse_id,
      }));
      setIssueItemSearch('');
      loadReport();
    } catch (err) {
      console.error('Failed to issue warehouse stock:', err);
      const message = err?.response?.data?.message || tr('alerts.issueSubmitFailed');
      setIssueFormStatus({ state: 'error', message });
    }
  };

  const reportRange = useMemo(() => {
    if (!report.window_start || !report.window_end) return '';
    try {
      const start = new Date(report.window_start).toLocaleString();
      const end = new Date(report.window_end).toLocaleString();
      return `${start} → ${end}`;
    } catch (err) {
      return `${report.window_start} → ${report.window_end}`;
    }
  }, [report.window_end, report.window_start]);

  if (userLoading || !user) {
    return (
      <>
        <Navbar />
        <div className="p-6 text-gray-600">{tr('loading')}</div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('pageTitles.warehouseInventory', 'Warehouse Inventory')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">{tr('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {report.generated_at && `${tr('report.generatedAt')} ${new Date(report.generated_at).toLocaleString()}`}
            </span>
            <button
              type="button"
              onClick={loadReport}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {tr('report.refresh')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('form.title')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{tr('form.description')}</p>
              </div>
              {formStatus.state === 'loading' && (
                <span className="text-xs text-blue-600 dark:text-blue-300">{tr('form.saving')}</span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="warehouse">
                  {tr('form.fields.warehouse')}
                </label>
                <select
                  id="warehouse"
                  value={form.warehouse_id}
                  onChange={handleFormChange('warehouse_id')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  disabled={warehousesLoading || !warehouses.length}
                  required
                >
                  <option value="">{tr('form.fields.warehousePlaceholder')}</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
                {warehousesError && (
                  <p className="text-xs text-red-600">{warehousesError}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="stock-item">
                  {tr('form.fields.stockItem')}
                </label>
                <input
                  id="stock-item-search"
                  type="search"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder={tr('form.fields.stockItemSearch')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
                <select
                  id="stock-item"
                  value={form.stock_item_id}
                  onChange={handleFormChange('stock_item_id')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">{tr('form.fields.selectPlaceholder')}</option>
                  {filteredItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.brand ? `(${item.brand})` : ''}
                    </option>
                  ))}
                </select>
                {selectedItem && (
                  <p className="text-xs text-gray-500">
                    {selectedItem.category && `${selectedItem.category} • `}
                    {selectedItem.available_quantity !== undefined &&
                      tr('form.fields.available', {
                        count: numberFormatter.format(Number(selectedItem.available_quantity) || 0),
                      })}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="quantity">
                  {tr('form.fields.quantity')}
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quantity}
                  onChange={handleFormChange('quantity')}
                  placeholder={tr('form.fields.quantityPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="notes">
                  {tr('form.fields.notes')}
                </label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={handleFormChange('notes')}
                  rows="3"
                  placeholder={tr('form.fields.notesPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
              </div>

              {formStatus.message && (
                <div
                  className={`rounded-md px-3 py-2 text-sm ${
                    formStatus.state === 'success'
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-100'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-100'
                  }`}
                >
                  {formStatus.message}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                  disabled={formStatus.state === 'loading'}
                >
                  {formStatus.state === 'loading' ? tr('form.submitLoading') : tr('form.submit')}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('report.title')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{tr('report.description')}</p>
              </div>
              {reportRange && (
                <span className="text-xs text-gray-500">{reportRange}</span>
              )}
            </div>

            {reportStatus.state === 'error' && (
              <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-100">
                {reportStatus.message}
              </div>
            )}

            {reportStatus.state === 'loading' ? (
              <div className="text-sm text-gray-600 dark:text-gray-300">{tr('report.loading')}</div>
            ) : report.departments.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-300">{tr('report.empty')}</div>
            ) : (
              <div className="space-y-4">
                {report.departments.map((dept) => (
                  <div
                    key={dept.department_id}
                    className="rounded-md border border-gray-200 bg-gray-50 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{dept.department_name}</p>
                        <p className="text-xs text-gray-500">
                          {tr('report.itemCount', { count: dept.items?.length ?? 0 })}
                        </p>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        {tr('report.last7days')}
                      </div>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                        <thead className="bg-white dark:bg-gray-800">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                              {tr('report.columns.item')}
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                              {tr('report.columns.quantity')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                          {(dept.items || []).map((item) => (
                            <tr key={`${dept.department_id}-${item.stock_item_id}-${item.item_name}`}>
                              <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{item.item_name}</td>
                              <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                                {numberFormatter.format(Number(item.total_quantity) || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('issueForm.title')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{tr('issueForm.description')}</p>
              </div>
              {issueFormStatus.state === 'loading' && (
                <span className="text-xs text-blue-600 dark:text-blue-300">{tr('issueForm.saving')}</span>
              )}
            </div>

            <form onSubmit={handleIssueSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="issue-warehouse">
                  {tr('form.fields.warehouse')}
                </label>
                <select
                  id="issue-warehouse"
                  value={issueForm.warehouse_id}
                  onChange={handleIssueFormChange('warehouse_id')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  disabled={warehousesLoading || !warehouses.length}
                  required
                >
                  <option value="">{tr('form.fields.warehousePlaceholder')}</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
                {warehousesError && <p className="text-xs text-red-600">{warehousesError}</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="issue-stock-item">
                  {tr('issueForm.fields.stockItem')}
                </label>
                <input
                  id="issue-stock-item-search"
                  type="search"
                  value={issueItemSearch}
                  onChange={(e) => setIssueItemSearch(e.target.value)}
                  placeholder={tr('issueForm.fields.stockItemSearch')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
                <select
                  id="issue-stock-item"
                  value={issueForm.stock_item_id}
                  onChange={handleIssueFormChange('stock_item_id')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">{tr('issueForm.fields.selectPlaceholder')}</option>
                  {filteredIssueItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.brand ? `(${item.brand})` : ''}
                    </option>
                  ))}
                </select>
                {selectedIssueItem && (
                  <p className="text-xs text-gray-500">
                    {selectedIssueItem.category && `${selectedIssueItem.category} • `}
                    {selectedIssueItem.available_quantity !== undefined &&
                      tr('form.fields.available', {
                        count: numberFormatter.format(Number(selectedIssueItem.available_quantity) || 0),
                      })}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="issue-department">
                  {tr('issueForm.fields.department')}
                </label>
                <select
                  id="issue-department"
                  value={issueForm.department_id}
                  onChange={handleIssueFormChange('department_id')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  disabled={departmentsStatus.state === 'loading' || departments.length === 0}
                  required
                >
                  <option value="">{tr('issueForm.fields.departmentPlaceholder')}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {departmentsStatus.state === 'error' && (
                  <p className="text-xs text-red-600">{departmentsStatus.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="issue-quantity">
                  {tr('issueForm.fields.quantity')}
                </label>
                <input
                  id="issue-quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={issueForm.quantity}
                  onChange={handleIssueFormChange('quantity')}
                  placeholder={tr('issueForm.fields.quantityPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="issue-notes">
                  {tr('issueForm.fields.notes')}
                </label>
                <textarea
                  id="issue-notes"
                  value={issueForm.notes}
                  onChange={handleIssueFormChange('notes')}
                  rows="3"
                  placeholder={tr('issueForm.fields.notesPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
              </div>

              {issueFormStatus.message && (
                <div
                  className={`rounded-md px-3 py-2 text-sm ${
                    issueFormStatus.state === 'success'
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-100'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-100'
                  }`}
                >
                  {issueFormStatus.message}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                  disabled={issueFormStatus.state === 'loading'}
                >
                  {issueFormStatus.state === 'loading' ? tr('issueForm.submitLoading') : tr('issueForm.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default WarehouseInventoryPage;