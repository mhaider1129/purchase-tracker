import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/axios';

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'on-hold', label: 'On hold' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'archived', label: 'Archived' },
];

const statusStyles = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  'on-hold': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  terminated: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  archived: 'bg-gray-200 text-gray-700 dark:bg-gray-800/70 dark:text-gray-300',
};

const initialFormState = {
  title: '',
  vendor: '',
  reference_number: '',
  start_date: '',
  end_date: '',
  status: 'active',
  contract_value: '',
  description: '',
};

const ContractsPage = () => {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [formState, setFormState] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [archivingId, setArchivingId] = useState(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput]);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError('');

    const params = {};
    if (statusFilter !== 'all') {
      params.status = statusFilter;
    }
    if (searchTerm) {
      params.search = searchTerm;
    }

    try {
      const { data } = await api.get('/api/contracts', { params });
      setContracts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load contracts', err);
      setError(err?.response?.data?.message || 'Unable to load contracts. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const resetForm = () => {
    setFormState(initialFormState);
    setEditingId(null);
    setFormError('');
  };

  const handleSelectContract = (contract) => {
    setEditingId(contract.id);
    setFormState({
      title: contract.title || '',
      vendor: contract.vendor || '',
      reference_number: contract.reference_number || '',
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
      status: contract.status || 'active',
      contract_value:
        contract.contract_value === null || contract.contract_value === undefined
          ? ''
          : String(contract.contract_value),
      description: contract.description || '',
    });
    setFormError('');
    setSuccessMessage('');
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const payload = {
      title: formState.title.trim(),
      vendor: formState.vendor.trim(),
      reference_number: formState.reference_number.trim() || null,
      start_date: formState.start_date || null,
      end_date: formState.end_date || null,
      status: formState.status,
      description: formState.description.trim() || null,
    };

    if (!payload.title) {
      setFormError('A contract title is required.');
      return;
    }

    if (!payload.vendor) {
      setFormError('A vendor name is required.');
      return;
    }

    if (formState.contract_value !== '') {
      const numericValue = Number(formState.contract_value);
      if (Number.isNaN(numericValue)) {
        setFormError('Contract value must be a valid number.');
        return;
      }
      payload.contract_value = numericValue;
    } else {
      payload.contract_value = null;
    }

    setSaving(true);

    try {
      if (editingId) {
        await api.patch(`/api/contracts/${editingId}`, payload);
        setSuccessMessage('Contract updated successfully.');
      } else {
        await api.post('/api/contracts', payload);
        setSuccessMessage('Contract created successfully.');
      }

      resetForm();
      await fetchContracts();
    } catch (err) {
      console.error('Failed to save contract', err);
      setFormError(err?.response?.data?.message || 'Failed to save contract. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (contractId) => {
    if (!window.confirm('Archive this contract? Archived contracts remain read-only.')) {
      return;
    }

    setArchivingId(contractId);
    setFormError('');
    setSuccessMessage('');

    try {
      await api.patch(`/api/contracts/${contractId}/archive`);
      if (editingId === contractId) {
        resetForm();
      }
      setSuccessMessage('Contract archived successfully.');
      await fetchContracts();
    } catch (err) {
      console.error('Failed to archive contract', err);
      setFormError(err?.response?.data?.message || 'Unable to archive this contract.');
    } finally {
      setArchivingId(null);
    }
  };

  const sortedContracts = useMemo(() => {
    return [...contracts].sort((a, b) => {
      const statusA = (a.status || '').toLowerCase();
      const statusB = (b.status || '').toLowerCase();

      if (statusA === statusB) {
        return (b.updated_at || '').localeCompare(a.updated_at || '');
      }

      return statusA.localeCompare(statusB);
    });
  }, [contracts]);

  const activeCount = useMemo(
    () => contracts.filter((contract) => (contract.status || '').toLowerCase() === 'active').length,
    [contracts]
  );

  const renderStatusBadge = (status) => {
    const normalized = (status || '').toLowerCase();
    const classes = statusStyles[normalized] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    const label = normalized ? normalized.replace('-', ' ') : 'unknown';

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${classes}`}>
        {label}
      </span>
    );
  };

  const renderExpiry = (contract) => {
    if (!contract.end_date) return '—';
    if (contract.is_expired) {
      const days = Math.abs(contract.days_until_expiry || 0);
      return days === 0 ? 'Expired today' : `Expired ${days} day${days === 1 ? '' : 's'} ago`;
    }
    if (typeof contract.days_until_expiry === 'number') {
      return `In ${contract.days_until_expiry} day${contract.days_until_expiry === 1 ? '' : 's'}`;
    }
    return '—';
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Contract management</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Track active agreements, update contract details, and keep visibility on upcoming renewals.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <div className="font-semibold">{contracts.length} contracts</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{activeCount} active</div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 gap-3">
                  <div className="flex-1">
                    <label htmlFor="contracts-search" className="sr-only">
                      Search contracts
                    </label>
                    <input
                      id="contracts-search"
                      type="search"
                      placeholder="Search by title, vendor, or reference"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <label htmlFor="status-filter" className="sr-only">
                      Filter by status
                    </label>
                    <select
                      id="status-filter"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchContracts}
                  className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Refresh
                </button>
              </div>
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                  {error}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="max-h-[480px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700" aria-label="Contracts table">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Contract
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Vendor
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Value
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Renewal
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-300">
                          Loading contracts...
                        </td>
                      </tr>
                    ) : sortedContracts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-300">
                          No contracts match your current filters.
                        </td>
                      </tr>
                    ) : (
                      sortedContracts.map((contract) => {
                        const isSelected = editingId === contract.id;
                        const contractValue =
                          contract.contract_value === null || contract.contract_value === undefined
                            ? '—'
                            : new Intl.NumberFormat(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              }).format(Number(contract.contract_value));

                        return (
                          <tr
                            key={contract.id}
                            className={`cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                              isSelected ? 'bg-blue-50/70 dark:bg-blue-900/20' : ''
                            }`}
                            onClick={() => handleSelectContract(contract)}
                          >
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-gray-900 dark:text-gray-100">{contract.title}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {contract.reference_number || 'No reference'}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top text-gray-700 dark:text-gray-200">{contract.vendor}</td>
                            <td className="px-4 py-3 align-top text-gray-700 dark:text-gray-200">{contractValue}</td>
                            <td className="px-4 py-3 align-top">{renderStatusBadge(contract.status)}</td>
                            <td className="px-4 py-3 align-top text-gray-700 dark:text-gray-200">{renderExpiry(contract)}</td>
                            <td className="px-4 py-3 align-top">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleSelectContract(contract);
                                  }}
                                  className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                  Edit
                                </button>
                                {contract.status !== 'archived' && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleArchive(contract.id);
                                    }}
                                    disabled={archivingId === contract.id}
                                    className="rounded-md border border-transparent bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                                  >
                                    {archivingId === contract.id ? 'Archiving...' : 'Archive'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {editingId ? 'Edit contract' : 'Create a new contract'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {editingId
                      ? 'Update the selected contract. All changes are tracked with timestamps.'
                      : 'Capture supplier agreements, contract periods, and renewal information.'}
                  </p>
                </div>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
                  >
                    Cancel editing
                  </button>
                )}
              </div>

              <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="title">
                      Contract title
                    </label>
                    <input
                      id="title"
                      name="title"
                      type="text"
                      value={formState.title}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="vendor">
                      Vendor
                    </label>
                    <input
                      id="vendor"
                      name="vendor"
                      type="text"
                      value={formState.vendor}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="reference_number">
                      Reference number
                    </label>
                    <input
                      id="reference_number"
                      name="reference_number"
                      type="text"
                      value={formState.reference_number}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="start_date">
                      Start date
                    </label>
                    <input
                      id="start_date"
                      name="start_date"
                      type="date"
                      value={formState.start_date}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="end_date">
                      End date
                    </label>
                    <input
                      id="end_date"
                      name="end_date"
                      type="date"
                      value={formState.end_date}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="contract_value">
                      Contract value
                    </label>
                    <input
                      id="contract_value"
                      name="contract_value"
                      type="text"
                      value={formState.contract_value}
                      onChange={handleInputChange}
                      placeholder="e.g. 250000"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="status">
                      Status
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={formState.status}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {statusOptions
                        .filter((option) => option.value !== 'all')
                        .map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="description">
                      Notes
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      rows={4}
                      value={formState.description}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      placeholder="Important clauses, renewal reminders, or performance notes"
                    />
                  </div>
                </div>

                {formError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                    {formError}
                  </div>
                )}
                {successMessage && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {successMessage}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : editingId ? 'Update contract' : 'Create contract'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => handleArchive(editingId)}
                      disabled={archivingId === editingId}
                      className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                    >
                      {archivingId === editingId ? 'Archiving...' : 'Archive contract'}
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">Contract tips</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>Keep the reference number consistent with the signed agreement.</li>
                <li>Use the notes section to track renewal discussions and milestones.</li>
                <li>Archive contracts that are no longer active to keep the dashboard tidy.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default ContractsPage;