import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';
import {
  listSupplierEvaluations,
  createSupplierEvaluation,
  updateSupplierEvaluation,
  deleteSupplierEvaluation,
} from '../api/supplierEvaluations';

const initialFormState = {
  supplier_name: '',
  evaluation_date: '',
  quality_score: '',
  delivery_score: '',
  cost_score: '',
  compliance_score: '',
  overall_score: '',
  strengths: '',
  weaknesses: '',
  action_items: '',
};

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }

  return Math.round(numeric * 100) / 100;
};

const initialFiltersState = {
  search: '',
  start_date: '',
  end_date: '',
};

const SupplierEvaluationsPage = () => {
  const { user } = useCurrentUser();

  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState(initialFiltersState);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [formState, setFormState] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const canManage = useMemo(() => {
    const normalizedRole = user?.role?.toLowerCase?.();
    return [
      'admin',
      'scm',
      'procurementspecialist',
      'procurementmanager',
    ].includes(normalizedRole);
  }, [user]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput]);

  const activeFilters = useMemo(
    () => ({
      search: debouncedSearch,
      start_date: filters.start_date,
      end_date: filters.end_date,
    }),
    [debouncedSearch, filters.end_date, filters.start_date]
  );

  const fetchEvaluations = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');

      const params = {};
      if (activeFilters.search) {
        params.search = activeFilters.search;
      }
      if (activeFilters.start_date) {
        params.start_date = activeFilters.start_date;
      }
      if (activeFilters.end_date) {
        params.end_date = activeFilters.end_date;
      }

      try {
        const data = await listSupplierEvaluations(params, { signal });
        setEvaluations(data);
      } catch (err) {
        if (signal?.aborted) {
          return;
        }
        console.error('Failed to load supplier evaluations', err);
        setError(
          err?.response?.data?.message ||
            'Unable to load supplier evaluations. Please try again later.'
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [activeFilters]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchEvaluations(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchEvaluations]);

  useEffect(() => {
    if (!formSuccess) {
      return () => {};
    }

    const timer = setTimeout(() => setFormSuccess(''), 4000);
    return () => clearTimeout(timer);
  }, [formSuccess]);

  const resetForm = () => {
    setFormState(initialFormState);
    setEditingId(null);
    setFormError('');
  };

  const handleSelectEvaluation = (evaluation) => {
    setEditingId(evaluation.id);
    setFormState({
      supplier_name: evaluation.supplier_name || '',
      evaluation_date: evaluation.evaluation_date || '',
      quality_score:
        evaluation.quality_score === null || evaluation.quality_score === undefined
          ? ''
          : String(evaluation.quality_score),
      delivery_score:
        evaluation.delivery_score === null || evaluation.delivery_score === undefined
          ? ''
          : String(evaluation.delivery_score),
      cost_score:
        evaluation.cost_score === null || evaluation.cost_score === undefined
          ? ''
          : String(evaluation.cost_score),
      compliance_score:
        evaluation.compliance_score === null ||
        evaluation.compliance_score === undefined
          ? ''
          : String(evaluation.compliance_score),
      overall_score:
        evaluation.overall_score === null || evaluation.overall_score === undefined
          ? ''
          : String(evaluation.overall_score),
      strengths: evaluation.strengths || '',
      weaknesses: evaluation.weaknesses || '',
      action_items: evaluation.action_items || '',
    });
    setFormError('');
    setFormSuccess('');
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const validateScores = () => {
    const scoreFields = [
      'quality_score',
      'delivery_score',
      'cost_score',
      'compliance_score',
      'overall_score',
    ];

    for (const field of scoreFields) {
      const value = formState[field];
      if (value === '') {
        continue;
      }

      const numeric = Number(value);
      if (Number.isNaN(numeric) || numeric < 0 || numeric > 100) {
        return `${field.replace('_', ' ')} must be between 0 and 100.`;
      }
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }

    const payload = {
      supplier_name: formState.supplier_name.trim(),
      evaluation_date: formState.evaluation_date || undefined,
      quality_score: toNumberOrNull(formState.quality_score),
      delivery_score: toNumberOrNull(formState.delivery_score),
      cost_score: toNumberOrNull(formState.cost_score),
      compliance_score: toNumberOrNull(formState.compliance_score),
      overall_score: toNumberOrNull(formState.overall_score),
      strengths: formState.strengths.trim() || null,
      weaknesses: formState.weaknesses.trim() || null,
      action_items: formState.action_items.trim() || null,
    };

    if (!payload.supplier_name) {
      setFormError('Supplier name is required.');
      return;
    }

    const scoreValidationError = validateScores();
    if (scoreValidationError) {
      setFormError(scoreValidationError);
      return;
    }

    setFormError('');
    setSubmitting(true);

    try {
      if (editingId) {
        await updateSupplierEvaluation(editingId, payload);
        setFormSuccess('Supplier evaluation updated successfully.');
      } else {
        await createSupplierEvaluation(payload);
        setFormSuccess('Supplier evaluation created successfully.');
      }

      resetForm();
      await fetchEvaluations();
    } catch (err) {
      console.error('Failed to save supplier evaluation', err);
      setFormError(
        err?.response?.data?.message ||
          'Unable to save supplier evaluation. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (evaluationId) => {
    if (!canManage) {
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to delete this supplier evaluation?'
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(evaluationId);
    try {
      await deleteSupplierEvaluation(evaluationId);
      setFormSuccess('Supplier evaluation deleted successfully.');
      if (editingId === evaluationId) {
        resetForm();
      }
      await fetchEvaluations();
    } catch (err) {
      console.error('Failed to delete supplier evaluation', err);
      setFormError(
        err?.response?.data?.message ||
          'Unable to delete supplier evaluation. Please try again.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const computedAverage = useMemo(() => {
    const scores = [
      formState.quality_score,
      formState.delivery_score,
      formState.cost_score,
      formState.compliance_score,
    ]
      .map(toNumberOrNull)
      .filter((score) => score !== null);

    if (!scores.length) {
      return null;
    }

    const sum = scores.reduce((acc, score) => acc + score, 0);
    return Math.round((sum / scores.length) * 100) / 100;
  }, [
    formState.compliance_score,
    formState.cost_score,
    formState.delivery_score,
    formState.quality_score,
  ]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        searchInput.trim() || filters.start_date?.trim() || filters.end_date?.trim()
      ),
    [filters.end_date, filters.start_date, searchInput]
  );

  const handleClearFilters = () => {
    setFilters({ ...initialFiltersState });
    setSearchInput('');
    setDebouncedSearch('');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Supplier Evaluations</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track supplier performance scores, strengths, weaknesses, and follow-up actions.
            </p>
          </div>
        </header>

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-6 p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold">Filters</h2>
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear filters
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1" htmlFor="search">
                Search suppliers
              </label>
              <input
                id="search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by supplier name"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="start_date">
                Start date
              </label>
              <input
                id="start_date"
                type="date"
                value={filters.start_date}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, start_date: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="end_date">
                End date
              </label>
              <input
                id="end_date"
                type="date"
                value={filters.end_date}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, end_date: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Supplier evaluation history</h2>
            {loading && <span className="text-sm text-gray-500">Loading...</span>}
          </div>

          {error && (
            <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400 border-b border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                  <th className="px-4 py-3 text-left font-semibold">Evaluation date</th>
                  <th className="px-4 py-3 text-left font-semibold">Overall score</th>
                  <th className="px-4 py-3 text-left font-semibold">Evaluator</th>
                  <th className="px-4 py-3 text-left font-semibold">Updated</th>
                  <th className="px-4 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {evaluations.length === 0 && !loading ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                      colSpan={6}
                    >
                      No supplier evaluations found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  evaluations.map((evaluation) => (
                    <tr key={evaluation.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/40">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {evaluation.supplier_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {evaluation.evaluation_date}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 text-xs font-semibold">
                          {evaluation.overall_score ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {evaluation.evaluator_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {new Date(evaluation.updated_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectEvaluation(evaluation)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View / Edit
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleDelete(evaluation.id)}
                              disabled={deletingId === evaluation.id}
                              className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingId === evaluation.id ? 'Deleting…' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {canManage && (
          <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Edit supplier evaluation' : 'New supplier evaluation'}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:underline"
                >
                  Cancel editing
                </button>
              )}
            </div>

            {formError && (
              <div className="mb-3 rounded-md border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="mb-3 rounded-md border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="supplier_name">
                    Supplier name<span className="text-red-500">*</span>
                  </label>
                  <input
                    id="supplier_name"
                    name="supplier_name"
                    type="text"
                    value={formState.supplier_name}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="evaluation_date">
                    Evaluation date
                  </label>
                  <input
                    id="evaluation_date"
                    name="evaluation_date"
                    type="date"
                    value={formState.evaluation_date}
                    onChange={handleInputChange}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="quality_score">
                  Quality score
                </label>
                <input
                  id="quality_score"
                  name="quality_score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formState.quality_score}
                  onChange={handleInputChange}
                  placeholder="0-100"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="delivery_score">
                  Delivery score
                </label>
                <input
                  id="delivery_score"
                  name="delivery_score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formState.delivery_score}
                  onChange={handleInputChange}
                  placeholder="0-100"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="cost_score">
                  Cost score
                </label>
                <input
                  id="cost_score"
                  name="cost_score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formState.cost_score}
                  onChange={handleInputChange}
                  placeholder="0-100"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="compliance_score">
                  Compliance score
                </label>
                <input
                  id="compliance_score"
                  name="compliance_score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formState.compliance_score}
                  onChange={handleInputChange}
                  placeholder="0-100"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="overall_score">
                  Overall score
                </label>
                <input
                  id="overall_score"
                  name="overall_score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formState.overall_score}
                  onChange={handleInputChange}
                  placeholder="0-100"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {computedAverage !== null && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Average of component scores: {computedAverage}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" htmlFor="strengths">
                  Strengths
                </label>
                <textarea
                  id="strengths"
                  name="strengths"
                  rows={2}
                  value={formState.strengths}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" htmlFor="weaknesses">
                  Weaknesses
                </label>
                <textarea
                  id="weaknesses"
                  name="weaknesses"
                  rows={2}
                  value={formState.weaknesses}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" htmlFor="action_items">
                  Action items
                </label>
                <textarea
                  id="action_items"
                  name="action_items"
                  rows={2}
                  value={formState.action_items}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? editingId
                      ? 'Saving...'
                      : 'Creating...'
                    : editingId
                    ? 'Save changes'
                    : 'Create evaluation'}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
};

export default SupplierEvaluationsPage;