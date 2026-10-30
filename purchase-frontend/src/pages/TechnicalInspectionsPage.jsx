import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import DeliveryInspectionDetail from "../components/DeliveryInspectionDetail";
import HistoricalInspectionDetail from "../components/HistoricalInspectionDetail";
import { getTechnicalWorklist } from "../api/technicalInspections";
export {
  getChecklistProgress,
  getInspectionMetrics,
} from "./LegacyTechnicalInspectionsPage";

const initial = {
  search: "",
  type: "",
  department: "",
  status: "",
  from: "",
  to: "",
  tab: "pending",
  page: 1,
};
const names = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};
const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900";
export default function TechnicalInspectionsPage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState(initial);
  const [data, setData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const change = (name, value) =>
    setFilters((old) => ({
      ...old,
      [name]: value,
      page: name === "page" ? value : 1,
    }));
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(
      async () => {
        try {
          const next = await getTechnicalWorklist(filters);
          if (active) {
            setData(next);
            setDepartments(next.departments || []);
          }
        } catch (e) {
          if (active) {
            setData(null);
            setError(
              e.response?.data?.message || "Unable to load technical tasks.",
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      },
      filters.search ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters, reload]);
  // Retain entry from the historical completed-request inspection action.
  if (location.state?.prefillInspection)
    return (
      <Navigate
        to="/technical-inspections/legacy"
        state={location.state}
        replace
      />
    );
  if (params.get("delivery"))
    return <DeliveryInspectionDetail id={params.get("delivery")} />;
  if (params.get("inspection"))
    return <HistoricalInspectionDetail id={params.get("inspection")} />;
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-900 dark:text-slate-100">
      <header className="rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-900 p-7 text-white">
        <p className="text-sm text-cyan-200">Supply Chain Quality</p>
        <h1 className="mt-1 text-3xl font-bold">
          Technical Reviews &amp; Inspections
        </h1>
        <p className="mt-2 text-slate-200">
          Review assigned products before procurement and follow inspection
          records through acceptance.
        </p>
        <div className="mt-5 flex flex-wrap gap-4">
          {data?.can_manage && <Link className="rounded border border-white/40 px-4 py-2" to="/technical-inspections/settings">Technical responsibilities</Link>}
          {data?.can_manage && (
            <Link
              className="rounded bg-white px-4 py-2 font-semibold text-indigo-900"
              to="/technical-inspections/pre-procurement?new=1"
            >
              Request technical review
            </Link>
          )}
          <button
            className="rounded border border-white/40 px-4 py-2"
            onClick={() => setReload((v) => v + 1)}
            disabled={loading}
          >
            Refresh tasks
          </button>
        </div>
      </header>
      <section
        aria-label="Filter technical tasks"
        className="grid gap-3 rounded-xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2 lg:grid-cols-3"
      >
        <label>
          Search
          <input
            className={field}
            type="search"
            placeholder="Reference, item or assigned department"
            value={filters.search}
            onChange={(e) => change("search", e.target.value)}
          />
        </label>
        <label>
          Review type
          <select
            className={field}
            value={filters.type}
            onChange={(e) => change("type", e.target.value)}
          >
            <option value="">All types</option>
            <option value="PRE_PROCUREMENT">Pre-procurement review</option>
            <option value="DELIVERY_INSPECTION">Delivery inspection</option>
            <option value="LEGACY_INSPECTION">Historical inspection</option>
          </select>
        </label>
        <label>
          Assigned department
          <select
            className={field}
            value={filters.department}
            onChange={(e) => change("department", e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Technical review status
          <select
            className={field}
            value={filters.status}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(names).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            className={field}
            type="date"
            value={filters.from}
            onChange={(e) => change("from", e.target.value)}
          />
        </label>
        <label>
          To
          <input
            className={field}
            type="date"
            value={filters.to}
            onChange={(e) => change("to", e.target.value)}
          />
        </label>
        <button
          className="text-left text-indigo-700 underline dark:text-indigo-300"
          onClick={() => setFilters(initial)}
        >
          Reset filters
        </button>
      </section>
      <section
        aria-label="Technical task summary"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-busy={loading}
      >
        {[
          ["awaiting_my_review", "Awaiting My Review"],
          ["in_progress", "In Progress"],
          ["on_hold", "On Hold"],
          ["completed", "Completed"],
        ].map(([key, title]) => (
          <article
            key={key}
            className="rounded-xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
          >
            <p className="text-sm text-slate-500 dark:text-slate-300">
              {title}
            </p>
            <p
              className="mt-2 text-3xl font-bold"
              aria-label={`${title} count`}
            >
              {loading ? "…" : (data?.summary?.[key] ?? "—")}
            </p>
          </article>
        ))}
      </section>
      <p className="text-sm text-slate-500 dark:text-slate-300">
        Counts reflect the selected filters and tab across every matching page.
        Dates use Baghdad local time. Historical forms have no authenticated
        task assignment.
      </p>
      {error && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-4 text-red-800"
        >
          {error}{" "}
          <button className="underline" onClick={() => setReload((v) => v + 1)}>
            Retry
          </button>
        </div>
      )}
      {(data?.warnings || []).map((warning) => (
        <p
          key={warning}
          role="status"
          className="rounded bg-amber-50 p-3 text-amber-900"
        >
          {warning}
        </p>
      ))}
      <section className="rounded-xl border bg-white dark:border-slate-700 dark:bg-slate-800">
        <div
          role="tablist"
          aria-label="Technical task stage"
          className="flex flex-wrap gap-2 border-b p-3 dark:border-slate-700"
        >
          {[
            ["pending", "Pending"],
            ["in_progress", "In Progress"],
            ["history", "History"],
            ["", "All tasks"],
          ].map(([value, title]) => (
            <button
              key={value}
              role="tab"
              aria-selected={filters.tab === value}
              className={`rounded px-4 py-2 ${filters.tab === value ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-700"}`}
              onClick={() => change("tab", value)}
            >
              {title}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                {[
                  "Reference",
                  "Item",
                  "Review type",
                  "Assigned department",
                  "Technical review status",
                  "Action",
                ].map((h) => (
                  <th key={h} className="px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center" role="status">
                    Loading technical tasks…
                  </td>
                </tr>
              ) : !data?.rows?.length ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center">
                    {error
                      ? "Tasks could not be loaded."
                      : "No technical tasks match these filters."}
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr
                    key={`${row.type}-${row.id}`}
                    className="border-t dark:border-slate-700"
                  >
                    <td className="px-4 py-4">
                      {row.reference}
                      <span className="block text-xs text-slate-500">
                        {row.type === "PRE_PROCUREMENT"
                          ? "TR"
                          : row.type === "DELIVERY_INSPECTION"
                            ? "DI"
                            : "TI"}
                        -{row.id}
                      </span>
                    </td>
                    <td className="max-w-sm px-4 py-4">{row.item_name}</td>
                    <td className="px-4 py-4">
                      {row.type === "PRE_PROCUREMENT"
                        ? "Pre-procurement review"
                        : row.type === "DELIVERY_INSPECTION"
                          ? "Delivery inspection"
                          : "Historical inspection"}
                    </td>
                    <td className="px-4 py-4">
                      {row.assigned_department || "Not assigned"}
                    </td>
                    <td className="px-4 py-4">
                      {names[row.status]}
                      <span className="block text-xs text-slate-500">
                        {row.decision}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        className="font-semibold text-indigo-700 underline dark:text-indigo-300"
                        to={
                          row.type === "PRE_PROCUREMENT"
                            ? `/technical-inspections/pre-procurement?review=${row.id}`
                            : row.type === "DELIVERY_INSPECTION"
                              ? `/technical-inspections?delivery=${row.id}`
                              : `/technical-inspections?inspection=${row.id}`
                        }
                      >
                        {row.status === "COMPLETED"
                          ? "View"
                          : row.awaiting_me
                            ? "Review"
                            : "Open"}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-4 dark:border-slate-700">
          <span>
            {loading
              ? "Updating…"
              : `${data?.total ?? 0} matching tasks · Page ${filters.page}`}
          </span>
          <div className="flex gap-4">
            <button
              disabled={loading || filters.page === 1}
              onClick={() => change("page", filters.page - 1)}
            >
              Previous
            </button>
            <button
              disabled={
                loading || !data || filters.page * data.page_size >= data.total
              }
              onClick={() => change("page", filters.page + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
