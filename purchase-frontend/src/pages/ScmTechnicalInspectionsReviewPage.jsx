import React, { useEffect, useMemo, useState } from "react";
import { listTechnicalInspections } from "../api/technicalInspections";

const STATUS_STYLES = {
  passed:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
};

const statusLabel = (value) => {
  if (value === "passed") return "Accepted";
  if (value === "failed") return "Rejected";
  return "Pending";
};

const ScmTechnicalInspectionsReviewPage = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await listTechnicalInspections();
        setRecords(data);
      } catch (err) {
        setError(
          err?.response?.data?.message || "Failed to load technical inspections.",
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((record) => {
      const status = (record?.acceptance_status || "pending").toLowerCase();
      if (statusFilter && status !== statusFilter) return false;
      if (!q) return true;
      return [
        record?.item_name,
        record?.supplier_name,
        record?.location,
        record?.request_id ? `request ${record.request_id}` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [records, search, statusFilter]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-xl bg-white/90 p-6 shadow-sm dark:bg-gray-800/80">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          SCM Technical Inspections Review
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Review all submitted technical inspections and track their acceptance status.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Search by item, supplier, location, request"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="passed">Accepted</option>
            <option value="failed">Rejected</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
          >
            Clear filters
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mt-5 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Request</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Item</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Supplier</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Location</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm">Loading...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm">No inspections found.</td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const status = (record?.acceptance_status || "pending").toLowerCase();
                  return (
                    <tr key={record.id}>
                      <td className="px-3 py-2 text-sm">{record.inspection_date || "-"}</td>
                      <td className="px-3 py-2 text-sm">#{record.request_id || "-"}</td>
                      <td className="px-3 py-2 text-sm">{record.item_name || "-"}</td>
                      <td className="px-3 py-2 text-sm">{record.supplier_name || "-"}</td>
                      <td className="px-3 py-2 text-sm">{record.location || "-"}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
                          {statusLabel(status)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};

export default ScmTechnicalInspectionsReviewPage;