import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import GenericItemSelector from "./GenericItemSelector";

export default function ItemIdentityResolutionDialog({
  requestId,
  item,
  onClose,
  onSaved,
}) {
  const [selection, setSelection] = useState({
    request_mode: "generic_item",
    item_name: "",
  });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = selection.request_mode === "pending_item_creation";
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const base = `/requests/${requestId}/items/${item.item_id || item.id}`;
      if (pending)
        await api.post(`${base}/pending-item`, {
          ...selection.pending_item,
          justification: reason.trim(),
        });
      else
        await api.post(`${base}/resolve-identity`, {
          generic_item_id: selection.generic_item_id,
          reason: reason.trim(),
        });
      await onSaved();
    } catch (e) {
      setError(
        e.response?.data?.message ||
          e.response?.data?.error ||
          "Unable to resolve this item.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-resolution-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex justify-between gap-4">
          <h2 id="identity-resolution-title" className="text-xl font-bold">
            Resolve requested item identity
          </h2>
          <button
            type="button"
            aria-label="Close identity resolution"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <p className="my-4 rounded-lg bg-slate-50 p-3 text-sm">
          <strong>{item.item_name}</strong>
          <br />
          Original request wording and quantity are preserved. Choose an active
          Generic Item, or refer missing master data to the steward queue.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <GenericItemSelector
            value={selection}
            disabled={saving}
            onChange={(patch) =>
              setSelection((previous) => ({ ...previous, ...patch }))
            }
          />
          <label className="block text-sm font-semibold">
            Resolution / referral reason
            <textarea
              required
              className="mt-1 min-h-20 w-full rounded-lg border p-3"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="rounded bg-red-50 p-3 text-red-700">
              {error}
            </p>
          )}
          <Link
            to="/item-master"
            className="block text-sm font-semibold text-blue-700 underline"
          >
            Open Item Master to create or activate a Generic Item
          </Link>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border px-4 py-2"
            >
              Cancel
            </button>
            <button
              disabled={
                saving ||
                (!pending && !selection.generic_item_id) ||
                !reason.trim()
              }
              className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-40"
            >
              {saving
                ? "Saving…"
                : pending
                  ? "Refer to Item Master"
                  : "Save identity resolution"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
