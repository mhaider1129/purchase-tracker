import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Save,
  Star,
} from "lucide-react";
import api from "../api/axios";

const parseJson = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  }

  if (typeof value === "object") {
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
      if (typeof component === "string") {
        const name = component.trim();
        return name ? { name, score: null } : null;
      }

      if (component && typeof component === "object") {
        const name = (
          component.name ||
          component.component ||
          component.label ||
          ""
        ).trim();
        const rawScore = component.score ?? component.value ?? null;
        const numericScore = Number(rawScore);
        return name
          ? { name, score: Number.isFinite(numericScore) ? numericScore : null }
          : null;
      }

      return null;
    })
    .filter(Boolean);
};

const calculateOverallScore = (components) => {
  const numericScores = components
    .map((component) =>
      Number.isFinite(component.score) ? component.score : null,
    )
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
  const base =
    typeof parsedCriteria === "object" && parsedCriteria !== null
      ? parsedCriteria
      : {};

  const components = normalizeComponents(
    base.components || base.criteria || base.items || fallback.components || [],
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
      overallScore: Number.isFinite(overallScore)
        ? Number(overallScore.toFixed(2))
        : null,
    },
    technical_inspection_results: parseJson(
      evaluation.technical_inspection_results,
    ),
    request_fulfillment_metrics: parseJson(
      evaluation.request_fulfillment_metrics,
    ),
  };
};

const EvaluationDetailsPage = () => {
  const { id } = useParams();
  const [evaluation, setEvaluation] = useState(null);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchEvaluationDetails = async () => {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const { data } = await api.get(`/contract-evaluations/${id}`);
        const normalized = normalizeEvaluation(data);
        setEvaluation(normalized);
        setNotes(normalized?.evaluation_notes || "");

        const initialScores = {};
        (normalized?.evaluation_criteria?.components || []).forEach(
          (component) => {
            initialScores[component.name] =
              component.score === null || component.score === undefined
                ? ""
                : component.score;
          },
        );
        setScores(initialScores);
      } catch (err) {
        console.error("Failed to load evaluation details", err);
        setError(
          err?.response?.data?.message || "Unable to load evaluation details.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEvaluationDetails();
  }, [id]);

  const handleScoreChange = (componentName, value) => {
    if (value === "") {
      setScores((prev) => ({ ...prev, [componentName]: "" }));
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
    setError("");
    setSuccess("");

    try {
      const components = (evaluation.evaluation_criteria?.components || []).map(
        (component) => {
          const rawScore = scores[component.name];
          if (rawScore === "" || rawScore === undefined || rawScore === null) {
            return { ...component, score: null };
          }

          const numericScore = Number(rawScore);
          return {
            ...component,
            score: Number.isFinite(numericScore) ? numericScore : null,
          };
        },
      );

      const overallScore = calculateOverallScore(components);

      const payloadCriteria = {
        ...evaluation.evaluation_criteria,
        components,
        overallScore,
      };

      const { data } = await api.patch(
        `/contract-evaluations/${evaluation.id}`,
        {
          status: "completed",
          evaluation_notes: notes,
          evaluation_criteria: payloadCriteria,
        },
      );

      const normalized = normalizeEvaluation(data);
      setEvaluation(normalized);
      setNotes(normalized?.evaluation_notes || "");

      const updatedScores = {};
      (normalized?.evaluation_criteria?.components || []).forEach(
        (component) => {
          updatedScores[component.name] =
            component.score === null || component.score === undefined
              ? ""
              : component.score;
        },
      );
      setScores(updatedScores);
      setSuccess("Evaluation submitted successfully.");
    } catch (err) {
      console.error("Failed to submit evaluation", err);
      setError(err?.response?.data?.message || "Unable to submit evaluation.");
    } finally {
      setSaving(false);
    }
  };

  const currentOverallScore = evaluation
    ? calculateOverallScore(
        (evaluation.evaluation_criteria?.components || []).map((component) => ({
          ...component,
          score:
            scores[component.name] === "" ||
            scores[component.name] === undefined
              ? null
              : Number(scores[component.name]),
        })),
      )
    : null;

  const renderBody = () => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          Loading evaluation…
        </div>
      );
    }

    if (error && !evaluation) {
      return (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      );
    }

    if (!evaluation) {
      return <p className="text-sm text-gray-600">Evaluation not found.</p>;
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white p-6 dark:border-slate-700 dark:from-blue-950/30 dark:to-slate-900">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${evaluation.status?.toLowerCase() === "completed" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300"}`}
              >
                <CheckCircle2 size={13} aria-hidden="true" />{" "}
                {evaluation.status}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
                Contract evaluation
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white sm:text-2xl">
              {evaluation.contract_title}
            </h2>
          </div>
          <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Criterion
              </span>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                {evaluation.evaluation_criteria?.criterionName || "—"}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Assigned role
              </span>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                {evaluation.evaluation_criteria?.criterionRole || "—"}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Evaluator
              </span>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                {evaluation.evaluator_name || "—"}
              </p>
            </div>
          </div>
        </section>

        {(evaluation.technical_inspection_results ||
          evaluation.request_fulfillment_metrics) && (
          <section className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Technical inspection signal
                </h3>
                {evaluation.technical_inspection_results ? (
                  <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-200">
                    <p>
                      <span className="font-semibold">
                        Latest inspection date:
                      </span>{" "}
                      {evaluation.technical_inspection_results
                        .latest_inspection_date || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">Overall condition:</span>{" "}
                      {evaluation.technical_inspection_results
                        .overall_condition || "—"}
                    </p>
                    {evaluation.technical_inspection_results.issues &&
                      evaluation.technical_inspection_results.issues.length >
                        0 && (
                        <div>
                          <p className="font-semibold">Flagged issues</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5">
                            {evaluation.technical_inspection_results.issues.map(
                              (issue, index) => (
                                <li key={index}>
                                  {issue.summary}
                                  {issue.severity ? ` (${issue.severity})` : ""}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    No technical inspection data was linked to this evaluation.
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Request fulfillment metrics
                </h3>
                {evaluation.request_fulfillment_metrics ? (
                  <div className="mt-2 grid gap-2 text-sm text-gray-700 dark:text-gray-200 sm:grid-cols-2">
                    <p>
                      <span className="font-semibold">Completion rate:</span>{" "}
                      {evaluation.request_fulfillment_metrics.completion_rate ??
                        "—"}
                      %
                    </p>
                    <p>
                      <span className="font-semibold">Completed requests:</span>{" "}
                      {evaluation.request_fulfillment_metrics
                        .completed_requests ?? "—"}{" "}
                      /{" "}
                      {evaluation.request_fulfillment_metrics.total_requests ??
                        "—"}
                    </p>
                    <p>
                      <span className="font-semibold">
                        Avg lead time (days):
                      </span>{" "}
                      {evaluation.request_fulfillment_metrics
                        .average_lead_time_days ?? "—"}
                    </p>
                    <p>
                      <span className="font-semibold">On-time rate:</span>{" "}
                      {evaluation.request_fulfillment_metrics.on_time_rate ??
                        "—"}
                    </p>
                    {evaluation.request_fulfillment_metrics.notes && (
                      <p className="sm:col-span-2">
                        <span className="font-semibold">Notes:</span>{" "}
                        {evaluation.request_fulfillment_metrics.notes}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    No fulfillment metrics are available for this contract yet.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
                <ClipboardList
                  className="text-blue-600"
                  size={20}
                  aria-hidden="true"
                />{" "}
                Component scores
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Score each component from 0 to 5.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-2 dark:bg-blue-950/40">
              <Star
                className="fill-blue-600 text-blue-600 dark:fill-blue-400 dark:text-blue-400"
                size={18}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-300">
                  Live average
                </p>
                <p className="font-bold text-blue-950 dark:text-blue-100">
                  {currentOverallScore ?? "—"}{" "}
                  <span className="text-xs font-medium opacity-60">/ 5</span>
                </p>
              </div>
            </div>
          </div>
          <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {(evaluation.evaluation_criteria?.components || []).map(
              (component) => (
                <div
                  key={component.name}
                  className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center sm:gap-6"
                >
                  <label
                    htmlFor={`score-${component.name}`}
                    className="text-sm font-medium text-slate-800 dark:text-slate-200"
                  >
                    {component.name}
                  </label>
                  <div className="relative">
                    <input
                      id={`score-${component.name}`}
                      aria-label={`${component.name} score`}
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={scores[component.name] ?? ""}
                      onChange={(event) =>
                        handleScoreChange(component.name, event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-slate-400">
                      / 5
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <label
            htmlFor="notes"
            className="block font-semibold text-slate-950 dark:text-white"
          >
            Evaluation notes
          </label>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add context, evidence, or follow-up actions that support your
            scores.
          </p>
          <textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder="Enter your assessment notes…"
            className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </section>

        {success && <p className="text-sm text-green-600">{success}</p>}
        {error && !loading && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/my-evaluations"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back to evaluations
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} aria-hidden="true" />
            {saving ? "Saving..." : "Submit evaluation"}
          </button>
        </div>
      </form>
    );
  };

  return (
    <>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="mb-8">
          <Link
            to="/my-evaluations"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
          >
            <ArrowLeft size={16} aria-hidden="true" /> My evaluations
          </Link>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Assessment workspace
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Evaluation Details
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Review contract context and provide consistent, evidence-based
            scores.
          </p>
        </header>
        {renderBody()}
      </main>
    </>
  );
};

export default EvaluationDetailsPage;