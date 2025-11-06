import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/axios';

const parseJson = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  }

  if (typeof value === 'object') {
    return value;
  }

  return null;
};

const normalizeComponents = (components) => {
  if (!Array.isArray(components)) {
    return [];
  }

  return components
    .map((component) => {
      if (typeof component === 'string') {
        const name = component.trim();
        return name ? { name, score: null } : null;
      }

      if (component && typeof component === 'object') {
        const name = (component.name || component.component || component.label || '').trim();
        const rawScore = component.score ?? component.value ?? null;
        const numericScore = Number(rawScore);
        return name ? { name, score: Number.isFinite(numericScore) ? numericScore : null } : null;
      }

      return null;
    })
    .filter(Boolean);
};

const calculateOverallScore = (components) => {
  const numericScores = components
    .map((component) => (Number.isFinite(component.score) ? component.score : null))
    .filter((score) => score !== null);

  if (numericScores.length === 0) {
    return null;
  }

  const total = numericScores.reduce((sum, value) => sum + value, 0);
  return Number((total / numericScores.length).toFixed(2));
};

const normalizeEvaluation = (evaluation) => {
  if (!evaluation) {
    return null;
  }

  const fallback = {
    id: evaluation.criterion_id || null,
    name: evaluation.criterion_name || null,
    role: evaluation.criterion_role || null,
  };

  const parsedCriteria = parseJson(evaluation.evaluation_criteria);
  const base = typeof parsedCriteria === 'object' && parsedCriteria !== null ? parsedCriteria : {};

  const components = normalizeComponents(
    base.components || base.criteria || base.items || fallback.components || []
  );

  const overallScore =
    base.overallScore !== undefined && base.overallScore !== null
      ? Number(base.overallScore)
      : calculateOverallScore(components);

  return {
    ...evaluation,
    evaluation_criteria: {
      ...base,
      criterionId: base.criterionId || fallback.id || null,
      criterionName: base.criterionName || base.name || fallback.name || null,
      criterionRole: base.criterionRole || base.role || fallback.role || null,
      components,
      overallScore: Number.isFinite(overallScore) ? Number(overallScore.toFixed(2)) : null,
    },
  };
};

const EvaluationDetailsPage = () => {
  const { id } = useParams();
  const [evaluation, setEvaluation] = useState(null);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchEvaluationDetails = async () => {
      setLoading(true);
      setError('');
      setSuccess('');
      try {
        const { data } = await api.get(`/api/contract-evaluations/${id}`);
        const normalized = normalizeEvaluation(data);
        setEvaluation(normalized);
        setNotes(normalized?.evaluation_notes || '');

        const initialScores = {};
        (normalized?.evaluation_criteria?.components || []).forEach((component) => {
          initialScores[component.name] =
            component.score === null || component.score === undefined ? '' : component.score;
        });
        setScores(initialScores);
      } catch (err) {
        console.error('Failed to load evaluation details', err);
        setError(err?.response?.data?.message || 'Unable to load evaluation details.');
      } finally {
        setLoading(false);
      }
    };

    fetchEvaluationDetails();
  }, [id]);

  const handleScoreChange = (componentName, value) => {
    if (value === '') {
      setScores((prev) => ({ ...prev, [componentName]: '' }));
      return;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return;
    }

    setScores((prev) => ({ ...prev, [componentName]: numericValue }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!evaluation) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const components = (evaluation.evaluation_criteria?.components || []).map((component) => {
        const rawScore = scores[component.name];
        if (rawScore === '' || rawScore === undefined || rawScore === null) {
          return { ...component, score: null };
        }

        const numericScore = Number(rawScore);
        return {
          ...component,
          score: Number.isFinite(numericScore) ? numericScore : null,
        };
      });

      const overallScore = calculateOverallScore(components);

      const payloadCriteria = {
        ...evaluation.evaluation_criteria,
        components,
        overallScore,
      };

      const { data } = await api.patch(`/api/contract-evaluations/${evaluation.id}`, {
        status: 'completed',
        evaluation_notes: notes,
        evaluation_criteria: payloadCriteria,
      });

      const normalized = normalizeEvaluation(data);
      setEvaluation(normalized);
      setNotes(normalized?.evaluation_notes || '');

      const updatedScores = {};
      (normalized?.evaluation_criteria?.components || []).forEach((component) => {
        updatedScores[component.name] =
          component.score === null || component.score === undefined ? '' : component.score;
      });
      setScores(updatedScores);
      setSuccess('Evaluation submitted successfully.');
    } catch (err) {
      console.error('Failed to submit evaluation', err);
      setError(err?.response?.data?.message || 'Unable to submit evaluation.');
    } finally {
      setSaving(false);
    }
  };

  const renderBody = () => {
    if (loading) {
      return <p>Loading evaluation...</p>;
    }

    if (error) {
      return <p className="text-red-500">{error}</p>;
    }

    if (!evaluation) {
      return <p className="text-sm text-gray-600">Evaluation not found.</p>;
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Contract</h2>
            <p className="text-sm text-gray-700 dark:text-gray-200">{evaluation.contract_title}</p>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            <div>
              <span className="text-xs uppercase text-gray-500">Criterion</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {evaluation.evaluation_criteria?.criterionName || '—'}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase text-gray-500">Assigned role</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {evaluation.evaluation_criteria?.criterionRole || '—'}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase text-gray-500">Evaluator</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {evaluation.evaluator_name || '—'}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase text-gray-500">Status</span>
              <p className="font-medium capitalize text-gray-900 dark:text-gray-100">
                {evaluation.status}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase text-gray-500">Overall score</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {evaluation.evaluation_criteria?.overallScore ?? '—'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Component scores</h3>
          <div className="mt-4 space-y-4">
            {(evaluation.evaluation_criteria?.components || []).map((component) => (
              <div key={component.name} className="flex items-center justify-between gap-4">
                <label className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                  {component.name}
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={scores[component.name] ?? ''}
                  onChange={(event) => handleScoreChange(component.name, event.target.value)}
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-800 dark:text-gray-100">
            Evaluation notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </section>

        {success && <p className="text-sm text-green-600">{success}</p>}
        {error && !loading && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Submit evaluation'}
          </button>
        </div>
      </form>
    );
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Evaluation Details</h1>
        </header>
        {renderBody()}
      </main>
    </>
  );
};

export default EvaluationDetailsPage;