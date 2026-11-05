import {CompletionBadge} from '../CompletionReportingSummary';
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  Download,
  Printer,
  Search,
  ClipboardList,
  Building2,
  Wallet,
} from "lucide-react";
import axios from "../../api/axios";
import useUiTranslation from "../../utils/useUiTranslation";
import { matchesSearchTokens } from "../../utils/search";
import useRequestListPagination from "../../hooks/useRequestListPagination";
import PaginationControls from "../ui/PaginationControls";
import RequestViewModeToggle from "./RequestViewModeToggle";
import UrgentRequestBadge from "./UrgentRequestBadge";
import "./IncompleteRequestsDashboard.css";

const scopes = {
  all: {
    title: "Incomplete Requests (Admin / SCM)",
    path: "/incomplete",
    endpoint: "/requests/incomplete",
    label: "Admin / SCM",
  },
  medical: {
    title: "Medical Incomplete Requests",
    path: "/incomplete/medical",
    endpoint: "/requests/incomplete/medical",
    label: "Medical",
  },
  operational: {
    title: "Operational Incomplete Requests",
    path: "/incomplete/operational",
    endpoint: "/requests/incomplete/operational",
    label: "Operational",
  },
};
const emptyFilters = {
  search: "",
  type: "",
  department: "",
  status: "",
  from: "",
  to: "",
  urgency: "",
  sort: "newest",
};
const currency = (value) =>
  Number.isFinite(Number(value)) &&
  value !== null &&
  value !== "" &&
  value !== undefined
    ? Number(value).toLocaleString("en-US", {
        style: "currency",
        currency: "IQD",
        maximumFractionDigits: 0,
      })
    : "—";
const dateText = (value) =>
  value && Number.isFinite(new Date(value).getTime())
    ? new Date(value).toLocaleString("en-GB")
    : "—";
const statusTone = (value = "") =>
  /reject/i.test(value)
    ? "rejected"
    : /approved/i.test(value)
      ? "approved"
      : /pending|hold/i.test(value)
        ? "pending"
        : "submitted";
// Spreadsheet-safe quoting also preserves commas, quotes and multiline Arabic text.
const csvCell = (value) => {
  const text = String(value ?? "");
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
};
export default function IncompleteRequestsDashboard({ scope = "all" }) {
  const config = scopes[scope];
  const uiText = useUiTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(null);
  const [reload, setReload] = useState(0);
  const [filters, setFilters] = useState(emptyFilters);
  const [view, setView] = useState("detailed");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    axios
      .get(config.endpoint)
      .then(({ data }) => {
        if (active) {
          setRequests(Array.isArray(data) ? data : []);
          setUpdated(new Date());
        }
      })
      .catch((err) => {
        if (active)
          setError(
            err?.response?.data?.message ||
              "Failed to load requests. Try again.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [config.endpoint, reload]);
  const change = (key) => (event) =>
    setFilters((old) => ({ ...old, [key]: event.target.value }));
  const invalidDates = filters.from && filters.to && filters.from > filters.to;
  const filtered = useMemo(() => {
    if (invalidDates) return [];
    // Local calendar boundaries include the entire selected end date.
    const start = filters.from
      ? new Date(`${filters.from}T00:00:00`).getTime()
      : -Infinity;
    const end = filters.to
      ? new Date(`${filters.to}T23:59:59.999`).getTime()
      : Infinity;
    return requests
      .filter((r) => {
        const time = new Date(r.created_at).getTime();
        return (
          (!filters.type || r.request_type === filters.type) &&
          (!filters.status || r.status === filters.status) &&
          matchesSearchTokens(filters.department, r.department_name) &&
          (!filters.urgency ||
            (filters.urgency === "urgent"
              ? Boolean(r.is_urgent)
              : !r.is_urgent)) &&
          (!(filters.from || filters.to) || (time >= start && time <= end)) &&
          matchesSearchTokens(filters.search, [
            r.id,
            r.maintenance_ref_number,
            r.request_type,
            r.department_name,
            r.section_name,
            r.justification,
            r.status,
        r.completion?.category || "unavailable",
            r.requester_name,
            r.project_name,
          ])
        );
      })
      .sort((a, b) =>
        filters.sort === "cost"
          ? (Number(b.estimated_cost) || 0) - (Number(a.estimated_cost) || 0)
          : filters.sort === "urgent"
            ? Number(Boolean(b.is_urgent)) - Number(Boolean(a.is_urgent)) ||
              (new Date(a.created_at).getTime() || 0) -
                (new Date(b.created_at).getTime() || 0)
            : filters.sort === "oldest"
              ? (new Date(a.created_at).getTime() || 0) -
                (new Date(b.created_at).getTime() || 0)
              : (new Date(b.created_at).getTime() || 0) -
                (new Date(a.created_at).getTime() || 0),
      );
  }, [requests, filters, invalidDates]);
  const pagination = useRequestListPagination(
    filtered,
    JSON.stringify(filters),
  );
  const types = [
    ...new Set(requests.map((r) => r.request_type).filter(Boolean)),
  ].sort();
  const statuses = [
    ...new Set(requests.map((r) => r.status).filter(Boolean)),
  ].sort();
  const cost = filtered.reduce(
    (sum, r) =>
      sum +
      (Number.isFinite(Number(r.estimated_cost))
        ? Number(r.estimated_cost)
        : 0),
    0,
  );
  const departments = new Set(
    filtered.map((r) => r.department_name).filter(Boolean),
  ).size;
  const breakdown = Object.entries(
    filtered.reduce((counts, r) => {
      if (r.request_type)
        counts[r.request_type] = (counts[r.request_type] || 0) + 1;
      return counts;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const exportCsv = () => {
    const rows = [
      [
        "ID",
        "Type",
        "Department",
        "Section",
        "Justification",
        "Estimated Cost (IQD)",
        "Historical status",
        "Canonical completion",
        "Created At",
        "Urgent",
      ],
      ...filtered.map((r) => [
        r.id,
        r.request_type,
        r.department_name,
        r.section_name,
        r.justification,
        r.estimated_cost,
        r.status,
        r.created_at,
        r.is_urgent ? "Yes" : "No",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `incomplete_${scope}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const controls = (position) => (
    <PaginationControls
      ariaLabel={`Pagination (${position})`}
      currentPage={pagination.currentPage}
      totalPages={pagination.totalPages}
      onPageChange={pagination.setPage}
      summary={`Page ${pagination.currentPage} of ${pagination.totalPages}`}
    />
  );
  const table = (rows, print = false) => (
    <div
      className={print ? "incomplete-print-table" : "incomplete-table-scroll"}
      role={print ? undefined : "region"}
      aria-label={print ? undefined : "Incomplete request results"}
      tabIndex={print ? undefined : 0}
    >
      <table
        aria-label={`${scope === "all" ? "Incomplete" : config.label + " incomplete"} requests table`}
      >
        <thead>
          <tr>
            {[
              "ID",
              "Type",
              "Department",
              "Section",
              "Justification",
              "Estimated Cost",
              "Status",
              "Created At",
            ].map((title) => (
              <th scope="col" key={title}>
                {uiText(title)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.is_urgent ? "incomplete-urgent" : ""}>
              <td>
                <strong>#{r.id}</strong>
                <UrgentRequestBadge urgent={r.is_urgent} />
              </td>
              <td>{r.request_type || "—"}</td>
              <td dir="auto">{r.department_name || "—"}</td>
              <td dir="auto">{r.section_name || "—"}</td>
              <td className="incomplete-justification" dir="auto">
                {!print &&
                view === "summary" &&
                r.justification?.length > 90 ? (
                  <details>
                    <summary>{r.justification.slice(0, 90)}…</summary>
                    <p>{r.justification}</p>
                  </details>
                ) : (
                  r.justification || "—"
                )}
              </td>
              <td className="incomplete-money">{currency(r.estimated_cost)}</td>
              <td>
                <span
                  className={`incomplete-status incomplete-status--${statusTone(r.status)}`}
                >
                  {r.status || "Not recorded"}
                </span>
                <CompletionBadge completion={r.completion}/>
              </td>
              <td>
                <time dateTime={r.created_at || undefined}>
                  {dateText(r.created_at)}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <main className={`incomplete-dashboard incomplete-dashboard--${scope}`}>
      <header className="incomplete-hero">
        <div>
          <p className="incomplete-eyebrow">Governance · Request follow-up</p>
          <h1>{config.title}</h1>
          <p>
            Find outstanding requests, review demand, and identify work that
            still needs completion.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => setReload((n) => n + 1)}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? "Refreshing…" : "Refresh requests"}
        </button>
      </header>
      <nav
        className="incomplete-scope-nav"
        aria-label="Incomplete request scope"
      >
        {Object.entries(scopes).map(([key, c]) => (
          <Link
            key={key}
            to={c.path}
            aria-current={key === scope ? "page" : undefined}
          >
            {c.label} requests
          </Link>
        ))}
      </nav>
      {error && (
        <div className="incomplete-error" role="alert">
          {error}{" "}
          <button onClick={() => setReload((n) => n + 1)} disabled={loading}>
            Retry
          </button>
        </div>
      )}
      {loading && <p role="status">{uiText("Loading requests...")}</p>}
      {!loading && !error && (
        <>
          <section
            className="incomplete-metrics"
            aria-label="Filtered request totals"
          >
            {[
              [
                ClipboardList,
                "Total Incomplete",
                filtered.length.toLocaleString(),
                `${requests.length.toLocaleString()} in this scope`,
              ],
              [
                Wallet,
                "Estimated Cost",
                currency(cost),
                "Across filtered results",
              ],
              [
                Building2,
                "Departments involved",
                departments,
                "Unique departments in view",
              ],
            ].map(([Icon, title, value, help]) => (
              <article key={title}>
                <Icon size={21} aria-hidden="true" />
                <p>{uiText(title)}</p>
                <strong>{value}</strong>
                <small>{help}</small>
              </article>
            ))}
          </section>
          <section
            className="incomplete-filters"
            aria-label="Find incomplete requests"
          >
            <div className="incomplete-section-heading">
              <div>
                <h2>
                  <Search size={18} aria-hidden="true" />
                  Find requests
                </h2>
                <p>Filters update the results and totals immediately.</p>
              </div>
              <button onClick={() => setFilters(emptyFilters)}>
                Reset filters
              </button>
            </div>
            <div className="incomplete-filter-grid">
              <label className="incomplete-search">
                Search
                <input
                  value={filters.search}
                  onChange={change("search")}
                  placeholder="ID, requester, justification, or project"
                  type="search"
                />
              </label>
              <label>
                Request Type
                <select value={filters.type} onChange={change("type")}>
                  <option value="">All types</option>
                  {types.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Department
                <input
                  value={filters.department}
                  onChange={change("department")}
                  placeholder="Search department"
                />
              </label>
              <label>
                Status
                <select value={filters.status} onChange={change("status")}>
                  <option value="">All statuses</option>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                From Date
                <input
                  type="date"
                  value={filters.from}
                  onChange={change("from")}
                />
              </label>
              <label>
                To Date
                <input
                  type="date"
                  value={filters.to}
                  onChange={change("to")}
                  aria-invalid={Boolean(invalidDates)}
                />
              </label>
              <label>
                Urgency
                <select value={filters.urgency} onChange={change("urgency")}>
                  <option value="">All priorities</option>
                  <option value="urgent">Urgent only</option>
                  <option value="normal">Normal only</option>
                </select>
              </label>
              <label>
                Sort by
                <select value={filters.sort} onChange={change("sort")}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="urgent">Urgent, then oldest</option>
                  <option value="cost">Highest cost</option>
                </select>
              </label>
            </div>
            {invalidDates && (
              <p className="incomplete-error" role="alert">
                From Date must be on or before To Date.
              </p>
            )}
            <div className="incomplete-filter-footer">
              <p aria-live="polite">
                {filtered.length.toLocaleString()} of{" "}
                {requests.length.toLocaleString()} requests match
              </p>
              <div>
                <button onClick={exportCsv} disabled={!filtered.length}>
                  <Download size={16} aria-hidden="true" />
                  Export CSV
                </button>
                <button
                  onClick={() => window.print()}
                  disabled={!filtered.length}
                >
                  <Printer size={16} aria-hidden="true" />
                  Print / PDF
                </button>
              </div>
            </div>
          </section>
          {controls("top")}
          <section className="incomplete-results">
            <div className="incomplete-section-heading">
              <div>
                <h2>Outstanding requests</h2>
                <p>
                  {filtered.length
                    ? `Showing ${(pagination.currentPage - 1) * 10 + 1}–${Math.min(pagination.currentPage * 10, filtered.length)} of ${filtered.length}`
                    : "No results"}
                </p>
              </div>
              {updated && (
                <small>Last updated {updated.toLocaleString()}</small>
              )}
            </div>
            {breakdown.length > 0 && (
              <div
                className="incomplete-breakdown"
                aria-label="Request type breakdown"
              >
                {breakdown.map(([type, count]) => (
                  <span key={type}>
                    {type}
                    <strong>{count}</strong>
                  </span>
                ))}
              </div>
            )}
            <RequestViewModeToggle
              value={view}
              onChange={setView}
              description="Detailed shows full justifications. Summary keeps rows compact with expandable descriptions."
            />
            {!filtered.length ? (
              <div className="incomplete-empty">
                <ClipboardList size={32} aria-hidden="true" />
                <h3>
                  {requests.length
                    ? "No matching requests"
                    : "No incomplete requests"}
                </h3>
                <p>
                  {requests.length
                    ? "Try fewer filters or reset them to see all requests in this scope."
                    : "There are no outstanding requests in this scope."}
                </p>
                {requests.length > 0 && (
                  <button onClick={() => setFilters(emptyFilters)}>
                    Reset filters
                  </button>
                )}
              </div>
            ) : (
              table(pagination.paginatedItems)
            )}
          </section>
          {controls("bottom")}
          <section className="incomplete-print-only">
            <h2>{config.title} — filtered results</h2>
            <p>
              {filtered.length} requests · {currency(cost)} · {departments}{" "}
              departments
            </p>
            {table(filtered, true)}
          </section>
        </>
      )}
    </main>
  );
}
