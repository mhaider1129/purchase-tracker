import React, { useEffect, useState } from "react";
import { listPendingItems, resolvePendingItem } from "../../api/itemMaster";
import GenericItemSelector from "../requests/GenericItemSelector";
import { hasPermission } from "../../utils/permissions";
import ItemHierarchyCreateForm from "./ItemHierarchyCreateForm";

export default function PendingItemWorkspace({ user }) {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [target, setTarget] = useState(null);
  const [selection, setSelection] = useState({ request_mode: "generic_item" });
  const [decision, setDecision] = useState("existing_generic");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createdDraft, setCreatedDraft] = useState(null);
  useEffect(() => {
    let active = true;
    listPendingItems({ page, page_size: 10, status: "open" })
      .then((data) => {
        if (active) {
          setRows(data.data || []);
          setTotal(data.total || 0);
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e.response?.data?.message ||
              "Unable to load pending item referrals.",
          );
      });
    return () => {
      active = false;
    };
  }, [page, revision]);
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await resolvePendingItem(target.id, {
        resolution_type: decision,
        generic_item_id:
          decision === "existing_generic"
            ? selection.generic_item_id
            : undefined,
        notes: notes.trim(),
      });
      setTarget(null);
      setRevision((value) => value + 1);
    } catch (e) {
      setError(e.response?.data?.message || "Unable to resolve referral.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-bold">Pending Item Master requests</h2>
      <p className="text-sm text-slate-600">
        Resolve missing-item referrals to active Generic Items, request more
        information, or record an authorized exception.
      </p>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">Proposed item</th>
              <th className="p-2">Request / line</th>
              <th className="p-2">Status</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">
                  {row.proposed_name}
                  <p className="text-xs text-slate-500">{row.justification}</p>
                </td>
                <td className="p-2">
                  {row.request_id || "—"} / {row.requested_item_id || "—"}
                </td>
                <td className="p-2">{row.status}</td>
                <td className="p-2">
                  {["submitted", "review", "needs_information"].includes(
                    row.status,
                  ) && (
                    <button
                      disabled={busy || creating}
                      className="rounded border px-3 py-1 text-blue-700"
                      onClick={() => {
                        setTarget(row);
                        setSelection({ request_mode: "generic_item" });
                        setDecision("existing_generic");
                        setNotes("");
                        setError("");
                        setCreatedDraft(null);
                      }}
                    >
                      Resolve referral
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-4 text-sm text-slate-500">
            No pending item referrals.
          </p>
        )}
      </div>
      <div className="flex justify-between text-sm">
        <button
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} · {total} referrals
        </span>
        <button
          disabled={page * 10 >= total}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </button>
      </div>
      {target && (
        <section className="space-y-3 rounded-lg border bg-slate-50 p-4">
          <h3 className="font-semibold">Resolve {target.proposed_name}</h3>
          {createdDraft && (
            <p
              role="status"
              className="rounded bg-blue-50 p-3 text-sm text-blue-900"
            >
              Created Generic Item draft{" "}
              {createdDraft.item_code || `#${createdDraft.id}`}. This referral
              remains open. Complete review → validation → approval → active in
              Generic Items, then return here to link it.{" "}
              {createdDraft.duplicate_candidates?.length > 0 &&
                "A steward must also resolve the duplicate candidates before activation."}
            </p>
          )}
          {creating ? (
            <ItemHierarchyCreateForm
              level="generic"
              canMaintainReferences={hasPermission(
                user,
                "item-master.references-maintain",
              )}
              initialValues={{
                generic_name: target.proposed_name,
                canonical_description:
                  target.required_specifications || target.proposed_name,
                item_type: target.item_type || "general_item",
              }}
              onClose={() => setCreating(false)}
              onSaved={(draft) => {
                setCreatedDraft(draft);
                setCreating(false);
              }}
            />
          ) : (
            <form onSubmit={save} className="space-y-3">
              <label className="block text-sm">
                Decision
                <select
                  className="ml-3 rounded border p-2"
                  value={decision}
                  disabled={busy}
                  onChange={(event) => setDecision(event.target.value)}
                >
                  <option value="existing_generic">
                    Link active Generic Item
                  </option>
                  <option value="needs_information">
                    Request more information
                  </option>
                  <option value="rejected">Reject referral</option>
                  {hasPermission(user, "item-master.free-text-exception") && (
                    <option value="approved_free_text_exception">
                      Authorize free-text exception
                    </option>
                  )}
                </select>
              </label>
              {decision === "existing_generic" && (
                <GenericItemSelector
                  value={selection}
                  disabled={busy}
                  allowPendingCreation={false}
                  onChange={(patch) =>
                    setSelection((previous) => ({ ...previous, ...patch }))
                  }
                />
              )}
              {decision === "existing_generic" && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    Select an active Generic Item above. If it does not exist,
                    create a governed draft and complete its approval before
                    linking this referral.
                  </p>
                  {hasPermission(user, "item-master.create") ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSelection({ request_mode: "generic_item" });
                        setCreating(true);
                      }}
                      className="rounded border px-3 py-2 font-medium text-blue-700"
                    >
                      Create Generic Item draft for this referral
                    </button>
                  ) : (
                    <p className="text-xs text-slate-600">
                      Creating a draft requires item-master.create permission.
                      Ask an Item Master creator to create and activate the
                      item.
                    </p>
                  )}
                </div>
              )}
              <label className="block text-sm">
                Decision notes
                <textarea
                  required
                  className="mt-1 w-full rounded border p-2"
                  value={notes}
                  disabled={busy}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <div className="flex gap-2">
                <button
                  className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-40"
                  disabled={
                    busy ||
                    !notes.trim() ||
                    (decision === "existing_generic" &&
                      !selection.generic_item_id)
                  }
                >
                  Save referral decision
                </button>
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  disabled={busy}
                  className="rounded border px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </section>
  );
}
