import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import useCurrentUser from '../hooks/useCurrentUser';
import {
  listSupplierEvaluations,
  listSupplierEvaluationBenchmarks,
  createSupplierEvaluation,
  updateSupplierEvaluation,
  deleteSupplierEvaluation,
} from '../api/supplierEvaluations';

const DEFAULT_KPI_WEIGHTS = {
  otif: 0.4,
  corrective_actions: 0.35,
  esg_compliance: 0.25,
};

const CRITERIA_RATING_QUESTIONS = [
  {
    key: 'overall_supplier_happiness',
    label: 'Overall, how happy are you with the supplier?',
    category: 'Quality',
  },
  {
    key: 'price_satisfaction',
    label: 'How satisfied are you with the price of the goods/services?',
    category: 'Quality',
  },
  {
    key: 'delivery_as_scheduled',
    label: 'Does the supplier deliver the goods/services as scheduled?',
    category: 'Service delivery',
  },
  {
    key: 'delivery_in_good_condition',
    label: 'Does the supplier deliver the goods/services in good condition?',
    category: 'Service delivery',
  },
  {
    key: 'delivery_meets_quality_expectations',
    label: 'Does the supplier deliver the goods/services within acceptable quality?',
    category: 'Service delivery (quality)',
  },
  {
    key: 'communication_effectiveness',
    label: 'How effective is the supplier communication?',
    category: 'Communication',
  },
  {
    key: 'compliance_alignment',
    label: 'Does the supplier comply with requirements and regulations?',
    category: 'Compliance',
  },
  {
    key: 'operations_effectiveness_rating',
    label: 'How effective are the supplier operations?',
    category: 'Operations',
  },
  {
    key: 'payment_terms_comfort',
    label: 'How comfortable are you with the payment terms?',
    category: 'Payment terms',
  },
];

const RATING_SCALE_OPTIONS = [1, 2, 3, 4, 5];

const formatWeightForInput = (decimalValue, fallbackDecimal = null) => {
  const source =
    decimalValue !== null && decimalValue !== undefined
      ? Number(decimalValue)
      : fallbackDecimal !== null && fallbackDecimal !== undefined
      ? Number(fallbackDecimal)
      : null;

  if (source === null || Number.isNaN(source)) {
    return '';
  }

  const percent = source > 1 ? source : source * 100;
  return String(Math.round(percent * 100) / 100);
};

const boolToChoice = (value, fallback = 'yes') => {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return fallback;
};

const formatScaleInput = (value) =>
  value === null || value === undefined ? '' : String(value);

const initialFormState = {
  supplier_name: '',
  evaluation_date: '',
  quality_score: '',
  delivery_score: '',
  cost_score: '',
  compliance_score: '',
  otif_score: '',
  corrective_actions_score: '',
  esg_compliance_score: '',
  otif_weight: formatWeightForInput(null, DEFAULT_KPI_WEIGHTS.otif),
  corrective_actions_weight: formatWeightForInput(
    null,
    DEFAULT_KPI_WEIGHTS.corrective_actions
  ),
  esg_compliance_weight: formatWeightForInput(
    null,
    DEFAULT_KPI_WEIGHTS.esg_compliance
  ),
  overall_score: '',
  strengths: '',
  weaknesses: '',
  action_items: '',
  scheduled_annually: 'yes',
  travel_required: 'no',
  evaluation_criteria_notes: '',
  ...CRITERIA_RATING_QUESTIONS.reduce(
    (acc, question) => ({
      ...acc,
      [question.key]: '',
    }),
    {}
  ),
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
  const [benchmarks, setBenchmarks] = useState([]);
  const [benchmarksLoading, setBenchmarksLoading] = useState(false);
  const [benchmarksError, setBenchmarksError] = useState('');
  const [benchmarkInterval, setBenchmarkInterval] = useState('quarter');
  const [benchmarkSupplier, setBenchmarkSupplier] = useState('');

  const canManage = useMemo(() => {
    const normalizedRole = user?.role?.toLowerCase?.();
    return [
      'admin',
      'scm',
      'procurementspecialist',
      'procurementmanager',
    ].includes(normalizedRole);
  }, [user]);

  const supplierOptions = useMemo(() => {
    const names = new Set();
    evaluations.forEach((evaluation) => {
      if (evaluation?.supplier_name) {
        names.add(evaluation.supplier_name);
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [evaluations]);

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

  const fetchBenchmarks = useCallback(
    async (signal) => {
      setBenchmarksLoading(true);
      setBenchmarksError('');

      const params = {
        interval: benchmarkInterval,
      };

      if (benchmarkSupplier) {
        params.supplier_name = benchmarkSupplier;
      }

      if (filters.start_date) {
        params.start_date = filters.start_date;
      }

      if (filters.end_date) {
        params.end_date = filters.end_date;
      }

      try {
        const data = await listSupplierEvaluationBenchmarks(params, { signal });
        setBenchmarks(Array.isArray(data) ? data : []);
      } catch (err) {
        if (signal?.aborted) {
          return;
        }
        console.error('Failed to load supplier benchmarking data', err);
        setBenchmarksError(
          err?.response?.data?.message ||
            'Unable to load supplier benchmarking data. Please try again later.'
        );
      } finally {
        if (!signal?.aborted) {
          setBenchmarksLoading(false);
        }
      }
    },
    [benchmarkInterval, benchmarkSupplier, filters.end_date, filters.start_date]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchEvaluations(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchEvaluations]);

  useEffect(() => {
    const controller = new AbortController();
    fetchBenchmarks(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchBenchmarks]);

  useEffect(() => {
    if (!formSuccess) {
      return () => {};
    }

    const timer = setTimeout(() => setFormSuccess(''), 4000);
    return () => clearTimeout(timer);
  }, [formSuccess]);

  useEffect(() => {
    if (benchmarkSupplier && !supplierOptions.includes(benchmarkSupplier)) {
      setBenchmarkSupplier('');
    }
  }, [benchmarkSupplier, supplierOptions]);

  const resetForm = () => {
    setFormState(initialFormState);
    setEditingId(null);
    setFormError('');
  };

  const handleSelectEvaluation = (evaluation) => {
    setEditingId(evaluation.id);
    const kpiWeights = evaluation.kpi_weights || {};
    const criteria = evaluation.criteria_responses || {};
    const criteriaRatingsState = CRITERIA_RATING_QUESTIONS.reduce(
      (acc, question) => ({
        ...acc,
        [question.key]: formatScaleInput(criteria[question.key]),
      }),
      {}
    );
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
      otif_score:
        evaluation.otif_score === null || evaluation.otif_score === undefined
          ? ''
          : String(evaluation.otif_score),
      corrective_actions_score:
        evaluation.corrective_actions_score === null ||
        evaluation.corrective_actions_score === undefined
          ? ''
          : String(evaluation.corrective_actions_score),
      esg_compliance_score:
        evaluation.esg_compliance_score === null ||
        evaluation.esg_compliance_score === undefined
          ? ''
          : String(evaluation.esg_compliance_score),
      otif_weight: formatWeightForInput(
        kpiWeights?.otif,
        DEFAULT_KPI_WEIGHTS.otif
      ),
      corrective_actions_weight: formatWeightForInput(
        kpiWeights?.corrective_actions,
        DEFAULT_KPI_WEIGHTS.corrective_actions
      ),
      esg_compliance_weight: formatWeightForInput(
        kpiWeights?.esg_compliance,
        DEFAULT_KPI_WEIGHTS.esg_compliance
      ),
      overall_score:
        evaluation.overall_score === null || evaluation.overall_score === undefined
          ? ''
          : String(evaluation.overall_score),
      strengths: evaluation.strengths || '',
      weaknesses: evaluation.weaknesses || '',
      action_items: evaluation.action_items || '',
      scheduled_annually: boolToChoice(criteria.scheduled_annually),
      travel_required: boolToChoice(criteria.travel_required, 'no'),
      evaluation_criteria_notes: criteria.evaluation_criteria_notes || '',
      ...criteriaRatingsState,
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
      'otif_score',
      'corrective_actions_score',
      'esg_compliance_score',
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

    const weightFields = [
      'otif_weight',
      'corrective_actions_weight',
      'esg_compliance_weight',
    ];

    for (const field of weightFields) {
      const value = formState[field];
      if (value === '' || value === null || value === undefined) {
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

    const missingRating = CRITERIA_RATING_QUESTIONS.find(
      (question) => !formState[question.key]
    );
    if (missingRating) {
      setFormError('Please provide a score for every performance indicator.');
      return;
    }

    const ratingResponses = CRITERIA_RATING_QUESTIONS.reduce((acc, question) => {
      acc[question.key] = toNumberOrNull(formState[question.key]);
      return acc;
    }, {});

    const payload = {
      supplier_name: formState.supplier_name.trim(),
      evaluation_date: formState.evaluation_date || undefined,
      quality_score: toNumberOrNull(formState.quality_score),
      delivery_score: toNumberOrNull(formState.delivery_score),
      cost_score: toNumberOrNull(formState.cost_score),
      compliance_score: toNumberOrNull(formState.compliance_score),
      otif_score: toNumberOrNull(formState.otif_score),
      corrective_actions_score: toNumberOrNull(
        formState.corrective_actions_score
      ),
      esg_compliance_score: toNumberOrNull(formState.esg_compliance_score),
      otif_weight: toNumberOrNull(formState.otif_weight),
      corrective_actions_weight: toNumberOrNull(
        formState.corrective_actions_weight
      ),
      esg_compliance_weight: toNumberOrNull(formState.esg_compliance_weight),
      overall_score: toNumberOrNull(formState.overall_score),
      strengths: formState.strengths.trim() || null,
      weaknesses: formState.weaknesses.trim() || null,
      action_items: formState.action_items.trim() || null,
      criteria_responses: {
        scheduled_annually: formState.scheduled_annually === 'yes',
        travel_required: formState.travel_required === 'yes',
        evaluation_criteria_notes: formState.evaluation_criteria_notes.trim() || null,
        ...ratingResponses,
      },
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

  const componentAverage = useMemo(() => {
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

  const weightedKpiPreview = useMemo(() => {
    const metrics = [];

    const resolveWeightDecimal = (value, key) => {
      const numeric = toNumberOrNull(value);
      if (numeric === null || numeric === undefined) {
        return DEFAULT_KPI_WEIGHTS[key];
      }
      return numeric > 1 ? numeric / 100 : numeric;
    };

    const otifScore = toNumberOrNull(formState.otif_score);
    if (otifScore !== null) {
      metrics.push({
        key: 'otif',
        label: 'OTIF',
        score: otifScore,
        weight: resolveWeightDecimal(formState.otif_weight, 'otif'),
      });
    }

    const correctiveScore = toNumberOrNull(formState.corrective_actions_score);
    if (correctiveScore !== null) {
      metrics.push({
        key: 'corrective_actions',
        label: 'Corrective actions',
        score: correctiveScore,
        weight: resolveWeightDecimal(
          formState.corrective_actions_weight,
          'corrective_actions'
        ),
      });
    }

    const esgScore = toNumberOrNull(formState.esg_compliance_score);
    if (esgScore !== null) {
      metrics.push({
        key: 'esg_compliance',
        label: 'ESG compliance',
        score: esgScore,
        weight: resolveWeightDecimal(
          formState.esg_compliance_weight,
          'esg_compliance'
        ),
      });
    }

    if (!metrics.length) {
      return { score: null, normalizedWeights: null };
    }

    const positiveMetrics = metrics.filter((metric) => metric.weight > 0);
    const targetMetrics = positiveMetrics.length ? positiveMetrics : metrics;

    const totalWeight = targetMetrics.reduce(
      (acc, metric) => acc + Math.max(metric.weight, 0),
      0
    );

    if (totalWeight <= 0) {
      return { score: null, normalizedWeights: null };
    }

    const normalizedWeights = {};
    let weightedSum = 0;

    targetMetrics.forEach((metric) => {
      const normalized = Math.max(metric.weight, 0) / totalWeight;
      normalizedWeights[metric.key] = normalized;
      weightedSum += metric.score * normalized;
    });

    return {
      score: Math.round(weightedSum * 100) / 100,
      normalizedWeights,
    };
  }, [
    formState.corrective_actions_score,
    formState.corrective_actions_weight,
    formState.esg_compliance_score,
    formState.esg_compliance_weight,
    formState.otif_score,
    formState.otif_weight,
  ]);

  const formatBenchmarkPeriod = useCallback(
    (periodStart, intervalOverride = benchmarkInterval) => {
      if (!periodStart) {
        return '—';
      }

      const date = new Date(periodStart);
      if (Number.isNaN(date.getTime())) {
        return periodStart;
      }

      const intervalValue = intervalOverride || benchmarkInterval;

      if (intervalValue === 'month') {
        return date.toLocaleDateString(undefined, {
          month: 'short',
          year: 'numeric',
        });
      }

      if (intervalValue === 'quarter') {
        const month = date.getUTCMonth();
        const year = date.getUTCFullYear();
        const quarter = Math.floor(month / 3) + 1;
        return `Q${quarter} ${year}`;
      }

      if (intervalValue === 'year') {
        return String(date.getUTCFullYear());
      }

      return date.toISOString().slice(0, 10);
    },
    [benchmarkInterval]
  );

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
                  <th className="px-4 py-3 text-left font-semibold">Weighted KPI</th>
                  <th className="px-4 py-3 text-left font-semibold">OTIF</th>
                  <th className="px-4 py-3 text-left font-semibold">Corrective actions</th>
                  <th className="px-4 py-3 text-left font-semibold">ESG compliance</th>
                  <th className="px-4 py-3 text-left font-semibold">Legacy overall</th>
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
                      colSpan={10}
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
                          {evaluation.weighted_overall_score ?? evaluation.overall_score ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {evaluation.otif_score ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {evaluation.corrective_actions_score ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {evaluation.esg_compliance_score ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {evaluation.overall_score ?? '—'}
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

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Supplier benchmarking</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Compare weighted KPI performance over time to identify trends and benchmark vendors.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-gray-600 dark:text-gray-300">
                Interval
                <select
                  value={benchmarkInterval}
                  onChange={(event) => setBenchmarkInterval(event.target.value)}
                  className="ml-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="month">Monthly</option>
                  <option value="quarter">Quarterly</option>
                  <option value="year">Yearly</option>
                </select>
              </label>
              <label className="text-sm text-gray-600 dark:text-gray-300">
                Supplier
                <select
                  value={benchmarkSupplier}
                  onChange={(event) => setBenchmarkSupplier(event.target.value)}
                  className="ml-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All suppliers</option>
                  {supplierOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {benchmarksError && (
            <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400 border-b border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
              {benchmarksError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                  <th className="px-4 py-3 text-left font-semibold">Period</th>
                  <th className="px-4 py-3 text-left font-semibold">Weighted KPI</th>
                  <th className="px-4 py-3 text-left font-semibold">OTIF</th>
                  <th className="px-4 py-3 text-left font-semibold">Corrective actions</th>
                  <th className="px-4 py-3 text-left font-semibold">ESG compliance</th>
                  <th className="px-4 py-3 text-left font-semibold">Legacy overall</th>
                  <th className="px-4 py-3 text-left font-semibold">Evaluations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {benchmarksLoading ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                      colSpan={8}
                    >
                      Loading benchmarking data…
                    </td>
                  </tr>
                ) : benchmarks.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                      colSpan={8}
                    >
                      No benchmarking data found for the selected interval.
                    </td>
                  </tr>
                ) : (
                  benchmarks.map((entry) => (
                    <tr key={`${entry.supplier_name}-${entry.period_start}`}> 
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {entry.supplier_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {formatBenchmarkPeriod(entry.period_start, entry.interval)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 text-xs font-semibold">
                          {entry.avg_weighted_overall_score ?? entry.avg_overall_score ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {entry.avg_otif_score ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {entry.avg_corrective_actions_score ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {entry.avg_esg_compliance_score ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {entry.avg_overall_score ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {entry.evaluation_count}
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
                <label className="block text-sm font-medium mb-1" htmlFor="otif_score">
                  OTIF score
                </label>
                <input
                  id="otif_score"
                  name="otif_score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formState.otif_score}
                  onChange={handleInputChange}
                  placeholder="0-100"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="corrective_actions_score">
                  Corrective actions score
                </label>
                <input
                  id="corrective_actions_score"
                  name="corrective_actions_score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formState.corrective_actions_score}
                  onChange={handleInputChange}
                  placeholder="0-100"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="esg_compliance_score">
                  ESG compliance score
                </label>
                <input
                  id="esg_compliance_score"
                  name="esg_compliance_score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formState.esg_compliance_score}
                  onChange={handleInputChange}
                  placeholder="0-100"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="otif_weight">
                  OTIF weight (%)
                </label>
                <input
                  id="otif_weight"
                  name="otif_weight"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formState.otif_weight}
                  onChange={handleInputChange}
                  placeholder="0-100"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="corrective_actions_weight">
                  Corrective actions weight (%)
                </label>
                <input
                  id="corrective_actions_weight"
                  name="corrective_actions_weight"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formState.corrective_actions_weight}
                  onChange={handleInputChange}
                  placeholder="0-100"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="esg_compliance_weight">
                  ESG compliance weight (%)
                </label>
                <input
                  id="esg_compliance_weight"
                  name="esg_compliance_weight"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formState.esg_compliance_weight}
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
                {componentAverage !== null && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Average of component scores: {componentAverage}
                  </p>
                )}
                {weightedKpiPreview.score !== null && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Weighted KPI preview: {weightedKpiPreview.score}
                    {weightedKpiPreview.normalizedWeights && (
                      <span>
                        {` (weights ${Object.entries(
                          weightedKpiPreview.normalizedWeights
                        )
                          .map(([key, value]) => {
                            const percent = Math.round(value * 1000) / 10;
                            if (key === 'otif') {
                              return `OTIF ${percent}%`;
                            }
                            if (key === 'corrective_actions') {
                              return `Corrective actions ${percent}%`;
                            }
                            if (key === 'esg_compliance') {
                              return `ESG compliance ${percent}%`;
                            }
                            return `${key} ${percent}%`;
                          })
                          .join(', ')})`}
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="md:col-span-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
                <div className="flex flex-col gap-2 mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Annual evaluation criteria
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Record how the supplier performs against each indicator. Scores use a 1 (poor) to 5 (excellent) scale.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="scheduled_annually">
                      Evaluation scheduled annually?
                    </label>
                    <select
                      id="scheduled_annually"
                      name="scheduled_annually"
                      value={formState.scheduled_annually}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="travel_required">
                      Travel to supplier required?
                    </label>
                    <select
                      id="travel_required"
                      name="travel_required"
                      value={formState.travel_required}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {CRITERIA_RATING_QUESTIONS.map((question) => (
                      <div key={question.key} className="flex flex-col gap-1">
                        <label className="text-sm font-medium" htmlFor={question.key}>
                          {question.label}
                        </label>
                        <select
                          id={question.key}
                          name={question.key}
                          value={formState[question.key]}
                          onChange={handleInputChange}
                          required
                          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select</option>
                          {RATING_SCALE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{question.category}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1" htmlFor="evaluation_criteria_notes">
                    Evaluation criteria notes
                  </label>
                  <textarea
                    id="evaluation_criteria_notes"
                    name="evaluation_criteria_notes"
                    rows={2}
                    value={formState.evaluation_criteria_notes}
                    onChange={handleInputChange}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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