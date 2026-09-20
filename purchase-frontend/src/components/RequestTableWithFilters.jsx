import React, { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

const valueOrFallback = (value, fallback = "—") => value || fallback;

const RequestTableWithFilters = ({ requests = [], onRowClick }) => {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  const options = (key) =>
    [
      ...new Set(requests.map((request) => request[key]).filter(Boolean)),
    ].sort();
  const statuses = useMemo(() => options("status"), [requests]); // eslint-disable-line react-hooks/exhaustive-deps
  const types = useMemo(() => options("request_type"), [requests]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRequests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return requests.filter((request) => {
      const searchable = [
        request.id,
        request.request_type,
        request.department_name,
        request.justification,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!needle || searchable.includes(needle)) &&
        (status === "all" || request.status === status) &&
        (type === "all" || request.request_type === type)
      );
    });
  }, [query, requests, status, type]);

  const hasFilters = query || status !== "all" || type !== "all";
  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setType("all");
  };

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      aria-label="Request table and filters"
    >
      <div className="border-b border-slate-200 bg-slate-50/70 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" /> Filter
            requests
          </div>
          <span
            className="text-xs font-medium text-slate-500"
            aria-live="polite"
          >
            Showing {filteredRequests.length} of {requests.length}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(15rem,1fr)_12rem_12rem_auto]">
          <label className="relative">
            <span className="sr-only">Search requests</span>
            <Search
              aria-hidden="true"
              className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ID, department or justification…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            {statuses.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by request type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All types</option>
            {types.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="font-medium text-slate-700">No matching requests</p>
          <p className="mt-1 text-sm text-slate-500">
            Try a different search or clear the filters.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="min-w-full text-left text-sm"
            aria-label="Request Table"
          >
            <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {[
                  "ID",
                  "Type",
                  "Department",
                  "Justification",
                  "Estimated Cost",
                  "Status",
                  "Created At",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="whitespace-nowrap px-4 py-3 font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((request) => {
                const cost = Number(request.estimated_cost);
                const created = new Date(request.created_at);
                const statusKey = String(request.status || "").toLowerCase();
                const badge =
                  statusKey === "rejected"
                    ? "bg-rose-50 text-rose-700 ring-rose-600/20"
                    : statusKey === "approved"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                      : statusKey === "pending"
                        ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                        : "bg-slate-100 text-slate-700 ring-slate-500/20";
                return (
                  <tr
                    key={request.id}
                    onClick={() => onRowClick?.(request)}
                    className={`transition hover:bg-blue-50/40 ${onRowClick ? "cursor-pointer" : ""}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                      #{request.id}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {valueOrFallback(request.request_type)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {valueOrFallback(request.department_name)}
                    </td>
                    <td className="max-w-sm px-4 py-3 text-slate-600">
                      <span className="line-clamp-2">
                        {valueOrFallback(request.justification)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                      {Number.isFinite(cost) && request.estimated_cost !== null
                        ? cost.toLocaleString("en-US", {
                            style: "currency",
                            currency: "IQD",
                            minimumFractionDigits: 0,
                          })
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${badge}`}
                      >
                        {valueOrFallback(request.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {Number.isNaN(created.getTime())
                        ? "—"
                        : created.toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default RequestTableWithFilters;