import React, { useCallback, useEffect, useState } from "react";
import { searchGenericItems, searchApprovedProducts } from "../api/itemMaster";
import {
  listMappings,
  mappingAction,
  mappingCoverage,
  proposeMapping,
  mappingHistory,
  supersedeMapping,
  rollbackMapping,
} from "../api/stockItemMappings";
import { useAuth } from "../hooks/useAuth";
import { hasAnyPermission } from "../utils/permissions";

const FILTERS = [
  "category",
  "subcategory",
  "uom",
  "manufacturer",
  "identity_source",
];

export function isBulkApprovalSafe(rows, user) {
  return (
    rows.length > 0 &&
    hasAnyPermission(user, ["item-master.stock-map.bulk"]) &&
    new Set(
      rows.map(
        (row) => `${row.generic_item_id}:${row.approved_product_id || ""}`,
      ),
    ).size === 1 &&
    rows.every(
      (row) =>
        !(row.hard_exclusions || []).length &&
        !row.required_attributes_unresolved &&
        !row.stale,
    ) &&
    new Set(rows.map((row) => row.parser_version)).size === 1
  );
}

function MappingDialog({ row, onClose, onMapped }) {
  const [query, setQuery] = useState(row.stock_item_name || "");
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [reason, setReason] = useState("Manual mapping by steward");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await searchGenericItems({
          q: query.trim(),
          status: "active",
          page_size: 10,
        });
        if (active) setOptions(result.data || []);
      } catch (_error) {
        if (active) setError("Unable to search Item Master. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    let active = true;
    setProducts([]);
    setProductId("");
    if (selected)
      searchApprovedProducts({ generic_item_id: selected.id, page_size: 100 })
        .then((data) => {
          if (active)
            setProducts(
              (data.data || []).filter(
                (row) => row.is_active && row.approval_status === "approved",
              ),
            );
        })
        .catch(() => {
          if (active) setError("Unable to load approved Products.");
        });
    return () => {
      active = false;
    };
  }, [selected]);
  const submit = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await proposeMapping({
        stock_item_id: row.stock_item_id,
        generic_item_id: selected.id,
        ...(productId ? { approved_product_id: Number(productId) } : {}),
        reason: reason.trim(),
      });
      await onMapped();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to create the mapping proposal.",
      );
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mapping-dialog-title"
        className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="mapping-dialog-title" className="text-xl font-semibold">
              Map stock item
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              <strong>{row.stock_item_name}</strong> · Stock item #
              {row.stock_item_id}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close mapping dialog"
            className="rounded px-2 text-2xl text-slate-500 hover:bg-slate-100"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">
            Find the matching Generic Item
            <input
              autoFocus
              className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
              }}
              placeholder="Search by item code, name or description"
            />
          </label>
          <div
            className="max-h-64 overflow-auto rounded-lg border border-slate-200"
            aria-label="Generic Item search results"
          >
            {loading && (
              <p className="p-3 text-sm text-slate-500">
                Searching Item Master…
              </p>
            )}
            {!loading && options.length === 0 && (
              <p className="p-3 text-sm text-slate-500">
                No active Generic Items found. Try a shorter search.
              </p>
            )}
            {!loading &&
              options.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`block w-full border-b p-3 text-left last:border-b-0 hover:bg-blue-50 ${selected?.id === item.id ? "bg-blue-50 ring-2 ring-inset ring-blue-500" : ""}`}
                  onClick={() => setSelected(item)}
                >
                  <span className="font-mono text-xs text-blue-700">
                    {item.item_code}
                  </span>{" "}
                  <strong>{item.generic_name}</strong>
                  <span className="block text-xs text-slate-600">
                    {item.canonical_description}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {[item.category, item.inventory_uom]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              ))}
          </div>
          {selected && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
              Target inventory UOM: <strong>{selected.inventory_uom}</strong>.
              Approval requires the current stock unit to match; balances are
              never converted automatically.
            </div>
          )}
          <label className="block text-sm font-medium">
            Approved Product (optional)
            <select
              className="mt-1 w-full rounded-lg border p-2"
              disabled={!selected}
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Generic mapping / interchangeable stock</option>
              {products.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.product_name} · {row.manufacturer_part_number}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mapping note
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
              rows="2"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {error && (
            <p
              role="alert"
              className="rounded bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          <p className="text-xs text-slate-500">
            This creates a proposal. Review and approve it from the Actions
            column to apply the mapping.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border px-4 py-2"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selected || saving || !reason.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Creating…" : "Create mapping proposal"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function StockItemMappingWorkspace() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ page: 1 });
  const [search, setSearch] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
  });
  const [coverage, setCoverage] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mappingRow, setMappingRow] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState(null);
  const currentMapping = history?.data.find(
    (row) => row.active && row.mapping_status === "approved",
  );
  const [revision, setRevision] = useState(0);
  const canOverride = hasAnyPermission(user, [
    "item-master.stock-map.override",
  ]);
  const load = useCallback(async () => {
    // Effects handle cancellation; explicit refresh starts a new generation.
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const [data, counts] = await Promise.all([
          listMappings({ ...filters, q: search }),
          mappingCoverage(),
        ]);
        if (active) {
          setRows(data.data || []);
          setPagination(
            data.pagination || {
              page: 1,
              limit: 25,
              total: (data.data || []).length,
            },
          );
          setCoverage(counts);
        }
      } catch (e) {
        if (active)
          setError(
            e.response?.data?.message || "Unable to load mapping workspace.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters, search, revision]);
  const act = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { row, action, replacementId } = actionTarget;
      if (action === "supersede" || action === "rollback") {
        const work =
          action === "supersede" ? supersedeMapping : rollbackMapping;
        await work(row.stock_item_id, row.id, {
          expected_current_mapping_id: Number(row.id),
          expected_version: row.version,
          [action === "supersede"
            ? "replacement_mapping_id"
            : "restore_mapping_id"]: Number(replacementId),
          reason: reason.trim(),
        });
      } else
        await mappingAction(row.id, action, {
          stock_item_id: row.stock_item_id,
          expected_version: row.version,
          reason: reason.trim(),
        });
      setActionTarget(null);
      await load();
      if (history) await showHistory(history.row);
    } catch (e) {
      setError(
        e.response?.data?.message ||
          "Unable to save mapping decision. Refresh if another reviewer changed the mapping.",
      );
    } finally {
      setBusy(false);
    }
  };
  const showHistory = async (row) => {
    setBusy(true);
    setError("");
    try {
      const data = await mappingHistory(row.stock_item_id);
      setHistory({ row, data: data.data || [] });
    } catch (e) {
      setError(e.response?.data?.message || "Unable to load mapping history.");
    } finally {
      setBusy(false);
    }
  };
  const chooseAction = (row, action) => {
    setActionTarget({ row, action });
    setReason("");
    setError("");
  };
  return (
    <main className="mx-auto max-w-7xl space-y-5 p-6">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Stock Item Mapping Steward Workspace
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Find existing stock, propose its governed identity, review and
            approve the mapping.
          </p>
        </div>
        <a
          href="/item-master"
          className="self-start rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-blue-700"
        >
          Open Item Master
        </a>
      </header>
      {error && (
        <div role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">
          {error}
        </div>
      )}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {["total", "mapped", "unmapped"].map((key) => (
          <div key={key} className="rounded-xl border bg-white p-4">
            <p className="text-sm capitalize text-slate-500">{key}</p>
            <strong className="text-2xl">{coverage[key] ?? "—"}</strong>
          </div>
        ))}
      </section>
      <section className="space-y-3 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap gap-3">
          <label className="min-w-64 flex-1 text-sm font-medium">
            Search stock items
            <input
              type="search"
              className="mt-1 w-full rounded-lg border p-2.5"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setFilters((previous) => ({ ...previous, page: 1 }));
              }}
              placeholder="Name, stock ID, category or brand"
            />
          </label>
          <label className="text-sm font-medium">
            Mapping status
            <select
              className="mt-1 block rounded-lg border p-2.5"
              value={filters.mapping_status || ""}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  mapping_status: event.target.value,
                  page: 1,
                }))
              }
            >
              <option value="">All statuses</option>
              {[
                "unmapped",
                "proposed",
                "review_required",
                "approved",
                "mapped_generic",
                "mapped_product",
                "rejected",
                "duplicate",
                "obsolete",
                "excluded",
              ].map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="self-end rounded-lg border px-3 py-2.5"
            onClick={() => setAdvanced((value) => !value)}
          >
            Advanced filters
          </button>
          <button
            type="button"
            className="self-end rounded-lg border px-3 py-2.5"
            onClick={() => {
              setFilters({ page: 1 });
              setSearch("");
            }}
          >
            Clear filters
          </button>
          <button
            type="button"
            disabled={loading}
            className="self-end rounded-lg border px-3 py-2.5"
            onClick={load}
          >
            Refresh
          </button>
        </div>
        {advanced && (
          <div className="grid gap-3 sm:grid-cols-3">
            {FILTERS.map((name) => (
              <label key={name} className="text-sm capitalize">
                {name.replaceAll("_", " ")}
                <input
                  className="mt-1 w-full rounded-lg border p-2"
                  value={filters[name] || ""}
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      [name]: event.target.value,
                      page: 1,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        )}
      </section>
      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
        Propose → review → approve. Only approval applies an identity to stock.
        Stock quantity units must match the Generic inventory UOM. Mapping does
        not change balances.
      </p>
      <div className="overflow-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {[
                "Stock item",
                "Source attributes",
                "Governed target",
                "Status",
                "Actions",
              ].map((label) => (
                <th className="p-3" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                className="border-t align-top"
                key={
                  row.id ? `mapping-${row.id}` : `stock-${row.stock_item_id}`
                }
              >
                <td className="p-3">
                  <strong>
                    {row.stock_item_name || `Stock item #${row.stock_item_id}`}
                  </strong>
                  <p className="text-xs text-slate-500">
                    #{row.stock_item_id} · {row.available_quantity ?? "—"}{" "}
                    {row.unit}
                  </p>
                </td>
                <td className="p-3">
                  <p>
                    {[row.category, row.sub_category, row.brand]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  <details>
                    <summary className="cursor-pointer text-xs text-blue-700">
                      Source details
                    </summary>
                    <pre className="mt-2 max-w-xs whitespace-pre-wrap text-xs">
                      {JSON.stringify(row.source_attributes || {}, null, 2)}
                    </pre>
                  </details>
                </td>
                <td className="p-3">
                  {row.generic_item_id
                    ? `Generic #${row.generic_item_id}`
                    : "Identity required"}
                  {row.approved_product_id && (
                    <p>Product #{row.approved_product_id}</p>
                  )}
                </td>
                <td className="p-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                    {row.mapping_status?.replaceAll("_", " ")}
                  </span>
                  <p className="mt-2 text-xs text-slate-500">
                    {row.identity_source || "Legacy source"}
                    {row.version ? ` · v${row.version}` : ""}
                  </p>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {!row.id ? (
                      <button
                        type="button"
                        className="rounded bg-blue-600 px-3 py-1.5 font-medium text-white"
                        onClick={() => setMappingRow(row)}
                      >
                        Map item
                      </button>
                    ) : (
                      <>
                        {row.mapping_status === "proposed" && (
                          <button
                            disabled={busy}
                            className="rounded border px-3 py-1"
                            onClick={() => chooseAction(row, "review")}
                          >
                            Review
                          </button>
                        )}
                        {row.mapping_status === "review_required" && (
                          <>
                            <button
                              disabled={busy}
                              className="rounded bg-emerald-600 px-3 py-1 text-white"
                              onClick={() => chooseAction(row, "approve")}
                            >
                              Approve
                            </button>
                            <button
                              disabled={busy}
                              className="rounded border px-3 py-1 text-red-700"
                              onClick={() => chooseAction(row, "reject")}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {["proposed", "review_required"].includes(
                          row.mapping_status,
                        ) &&
                          ["mark-duplicate", "mark-obsolete", "exclude"].map(
                            (action) => (
                              <button
                                key={action}
                                disabled={busy}
                                className="rounded border px-2 py-1"
                                onClick={() => chooseAction(row, action)}
                              >
                                {action.replace("mark-", "")}
                              </button>
                            ),
                          )}
                      </>
                    )}
                    {canOverride && row.mapping_status === "approved" && (
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded border px-3 py-1 text-blue-700"
                        onClick={() => setMappingRow(row)}
                      >
                        Propose replacement
                      </button>
                    )}
                    <button
                      disabled={busy}
                      className="rounded border px-3 py-1"
                      onClick={() => showHistory(row)}
                    >
                      History
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <p role="status" className="p-4 text-sm text-slate-500">
            Loading mapping queue…
          </p>
        )}
        {!loading && !rows.length && (
          <p className="p-6 text-center text-slate-500">
            No stock items match these filters. Clear filters or complete Item
            Master setup.
          </p>
        )}
        <div className="flex justify-between border-t p-3 text-sm">
          <button
            disabled={loading || pagination.page <= 1}
            onClick={() =>
              setFilters((previous) => ({
                ...previous,
                page: pagination.page - 1,
              }))
            }
          >
            Previous
          </button>
          <span>
            Page {pagination.page} · {pagination.total} records
          </span>
          <button
            disabled={
              loading || pagination.page * pagination.limit >= pagination.total
            }
            onClick={() =>
              setFilters((previous) => ({
                ...previous,
                page: pagination.page + 1,
              }))
            }
          >
            Next
          </button>
        </div>
      </div>
      {actionTarget && (
        <form
          className="space-y-3 rounded-xl border bg-white p-5"
          onSubmit={act}
        >
          <h2 className="font-bold">
            {actionTarget.action.replaceAll("-", " ")} ·{" "}
            {actionTarget.row.stock_item_name}
          </h2>
          <label className="block text-sm font-medium">
            Decision reason
            <textarea
              required
              className="mt-1 min-h-20 w-full rounded-lg border p-3"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button
              disabled={busy || !reason.trim()}
              className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-40"
            >
              Save mapping decision
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setActionTarget(null)}
              className="rounded-lg border px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {history && (
        <section className="space-y-3 rounded-xl border bg-white p-5">
          <div className="flex justify-between">
            <h2 className="font-bold">
              Mapping history · {history.row.stock_item_name}
            </h2>
            <button onClick={() => setHistory(null)}>Close history</button>
          </div>
          {history.data.length === 0 && <p>No mapping history yet.</p>}
          {history.data.map((row) => (
            <article key={row.id} className="rounded-lg border p-3 text-sm">
              <strong>
                #{row.id} · {row.mapping_status} · v{row.version}
              </strong>
              <p>
                Generic #{row.generic_item_id}
                {row.approved_product_id
                  ? ` · Product #${row.approved_product_id}`
                  : ""}
              </p>
              <p className="text-slate-600">
                {row.review_notes || "No decision note"} · {row.updated_at}
              </p>
              {canOverride &&
                currentMapping &&
                String(row.id) !== String(currentMapping.id) &&
                [
                  "proposed",
                  "review_required",
                  "superseded",
                  "rolled_back",
                ].includes(row.mapping_status) && (
                  <button
                    type="button"
                    disabled={busy}
                    className="mt-2 rounded border px-3 py-1 text-blue-700"
                    onClick={() => {
                      setActionTarget({
                        row: {
                          ...currentMapping,
                          stock_item_id: history.row.stock_item_id,
                          stock_item_name: history.row.stock_item_name,
                        },
                        action: ["proposed", "review_required"].includes(
                          row.mapping_status,
                        )
                          ? "supersede"
                          : "rollback",
                        replacementId: row.id,
                      });
                      setReason("");
                      setError("");
                    }}
                  >
                    {["proposed", "review_required"].includes(
                      row.mapping_status,
                    )
                      ? "Use replacement mapping"
                      : "Restore this mapping"}
                  </button>
                )}
            </article>
          ))}
          {canOverride && (
            <p className="text-xs text-slate-500">
              Choose a replacement or restore an earlier mapping with a recorded
              reason. A concurrent change requires a fresh review.
            </p>
          )}
        </section>
      )}
      {mappingRow && (
        <MappingDialog
          row={mappingRow}
          onClose={() => setMappingRow(null)}
          onMapped={async () => {
            const row = mappingRow;
            setMappingRow(null);
            await load();
            if (row.id) await showHistory(row);
          }}
        />
      )}
    </main>
  );
}
