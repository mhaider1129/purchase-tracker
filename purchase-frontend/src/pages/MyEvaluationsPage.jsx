import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Search,
  Star,
} from "lucide-react";
import api from "../api/axios";

const parseJson = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  }
  return typeof value === "object" ? value : null;
};

const normalizeComponents = (components) => {
  if (!Array.isArray(components)) return [];

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
        const numericScore = Number(component.score ?? component.value ?? null);
        return name
          ? { name, score: Number.isFinite(numericScore) ? numericScore : null }
          : null;
      }
      return null;
    })
    .filter(Boolean);
};

const calculateOverallScore = (components) => {
  const scores = components.map(({ score }) => score).filter(Number.isFinite);
  if (!scores.length) return null;
  return Number(
    (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2),
  );
};

const normalizeEvaluation = (evaluation) => {
  const parsedCriteria = parseJson(evaluation.evaluation_criteria);
  const base =
    typeof parsedCriteria === "object" && parsedCriteria !== null
      ? parsedCriteria
      : {};
  const components = normalizeComponents(
    base.components || base.criteria || base.items || [],
  );
  const rawOverallScore =
    base.overallScore ?? calculateOverallScore(components);
  const overallScore = Number(rawOverallScore);

  return {
    ...evaluation,
    evaluation_criteria: {
      ...base,
      criterionId: base.criterionId || evaluation.criterion_id || null,
      criterionName:
        base.criterionName || base.name || evaluation.criterion_name || null,
      criterionRole:
        base.criterionRole || base.role || evaluation.criterion_role || null,
      components,
      overallScore: Number.isFinite(overallScore)
        ? Number(overallScore.toFixed(2))
        : null,
    },
  };
};

const statusStyles = {
  completed:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300",
  pending:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300",
};

const summaryIconStyles = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300",
  emerald:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
  violet:
    "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300",
};

const MyEvaluationsPage = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchEvaluations = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/contract-evaluations/my-evaluations");
        setEvaluations(
          Array.isArray(data) ? data.map(normalizeEvaluation) : [],
        );
      } catch (err) {
        console.error("Failed to load evaluations", err);
        setError("Unable to load evaluations. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvaluations();
  }, []);

  const summary = useMemo(() => {
    const completed = evaluations.filter(
      ({ status }) => status?.toLowerCase() === "completed",
    );
    const scored = completed
      .map(({ evaluation_criteria: criteria }) => criteria?.overallScore)
      .filter(Number.isFinite);
    return {
      total: evaluations.length,
      completed: completed.length,
      pending: evaluations.length - completed.length,
      average: scored.length
        ? (
            scored.reduce((sum, score) => sum + score, 0) / scored.length
          ).toFixed(1)
        : "—",
    };
  }, [evaluations]);

  const filteredEvaluations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return evaluations.filter((evaluation) => {
      const status = evaluation.status?.toLowerCase() || "pending";
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const searchable =
        `${evaluation.contract_title || ""} ${evaluation.evaluation_criteria?.criterionName || ""}`.toLowerCase();
      return (
        matchesStatus &&
        (!normalizedQuery || searchable.includes(normalizedQuery))
      );
    });
  }, [evaluations, query, statusFilter]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Contract performance
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            My Evaluations
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Review assigned criteria, complete pending scorecards, and track
            your submitted assessments.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <ClipboardCheck size={16} aria-hidden="true" /> {summary.pending}{" "}
          awaiting review
        </span>
      </header>

      <section
        aria-label="Evaluation overview"
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          {
            label: "Total assigned",
            value: summary.total,
            icon: ClipboardCheck,
            color: "blue",
          },
          {
            label: "Completed",
            value: summary.completed,
            icon: CheckCircle2,
            color: "emerald",
          },
          {
            label: "Pending",
            value: summary.pending,
            icon: Clock3,
            color: "amber",
          },
          {
            label: "Average score",
            value: summary.average,
            suffix: summary.average === "—" ? "" : " / 5",
            icon: Star,
            color: "violet",
          },
        ].map(({ label, value, suffix, icon: Icon, color }) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div
              className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${summaryIconStyles[color]}`}
            >
              <Icon size={20} aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold text-slate-950 dark:text-white">
              {value}
              <span className="text-sm font-medium text-slate-400">
                {suffix}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {label}
            </p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950 dark:text-white">
              Assigned evaluations
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filteredEvaluations.length} result
              {filteredEvaluations.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative block">
              <span className="sr-only">Search evaluations</span>
              <Search
                className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
                size={18}
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search contract or criterion"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white sm:w-64"
              />
            </label>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading your evaluations…
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </div>
        )}
        {!loading && !error && filteredEvaluations.length > 0 && (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredEvaluations.map((evaluation) => {
              const status = evaluation.status?.toLowerCase() || "pending";
              const score = evaluation.evaluation_criteria?.overallScore;
              return (
                <li key={evaluation.id}>
                  <Link
                    to={`/evaluations/${evaluation.id}`}
                    className="group grid gap-5 p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusStyles[status] || statusStyles.pending}`}
                        >
                          {status}
                        </span>
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          {evaluation.evaluation_criteria?.criterionRole ||
                            "Evaluation"}
                        </span>
                      </div>
                      <h3 className="truncate text-base font-semibold text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300 sm:text-lg">
                        {evaluation.contract_title || "Untitled contract"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {evaluation.evaluation_criteria?.criterionName ||
                          "Criterion not specified"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-6 sm:justify-end">
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Score
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                          {Number.isFinite(score) ? score : "—"}{" "}
                          <span className="text-xs font-medium text-slate-400">
                            / 5
                          </span>
                        </p>
                      </div>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-600 dark:border-slate-600 dark:group-hover:bg-blue-950/50">
                        <ArrowRight size={17} aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && !error && filteredEvaluations.length === 0 && (
          <div className="p-12 text-center">
            <ClipboardCheck
              className="mx-auto text-slate-300"
              size={36}
              aria-hidden="true"
            />
            <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">
              No evaluations found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Try changing your search or status filter.
            </p>
          </div>
        )}
      </section>
    </main>
  );
};

export default MyEvaluationsPage;