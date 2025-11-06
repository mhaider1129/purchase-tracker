import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  const parsedCriteria = parseJson(evaluation.evaluation_criteria);
  const base = typeof parsedCriteria === 'object' && parsedCriteria !== null ? parsedCriteria : {};
  const components = normalizeComponents(base.components || base.criteria || base.items || []);

  const overallScore =
    base.overallScore !== undefined && base.overallScore !== null
      ? Number(base.overallScore)
      : calculateOverallScore(components);

  return {
    ...evaluation,
    evaluation_criteria: {
      ...base,
      criterionId: base.criterionId || evaluation.criterion_id || null,
      criterionName: base.criterionName || base.name || evaluation.criterion_name || null,
      criterionRole: base.criterionRole || base.role || evaluation.criterion_role || null,
      components,
      overallScore: Number.isFinite(overallScore) ? Number(overallScore.toFixed(2)) : null,
    },
  };
};

const MyEvaluationsPage = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvaluations = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/api/contract-evaluations/my-evaluations');
        const normalized = Array.isArray(data) ? data.map(normalizeEvaluation) : [];
        setEvaluations(normalized);
      } catch (err) {
        console.error('Failed to load evaluations', err);
        setError('Unable to load evaluations.');
      } finally {
        setLoading(false);
      }
    };
    fetchEvaluations();
  }, []);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">My Evaluations</h1>
        </header>
        {loading && <p>Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {evaluations.length > 0 ? (
          <ul className="space-y-4">
            {evaluations.map((evaluation) => (
              <li key={evaluation.id} className="rounded-lg border bg-white p-4 shadow-sm">
                <Link to={`/evaluations/${evaluation.id}`} className="block hover:underline">
                  <h2 className="text-xl font-semibold text-gray-900">{evaluation.contract_title}</h2>
                  <p className="text-sm text-gray-600">Criterion: {evaluation.evaluation_criteria?.criterionName || '—'}</p>
                  <p className="text-sm text-gray-600">Status: {evaluation.status}</p>
                  <p className="text-sm text-gray-600">
                    Overall score:{' '}
                    {evaluation.evaluation_criteria?.overallScore ?? '—'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>You have no evaluations assigned.</p>
        )}
      </main>
    </>
  );
};

export default MyEvaluationsPage;