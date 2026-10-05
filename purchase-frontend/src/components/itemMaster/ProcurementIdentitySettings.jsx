import React, { useEffect, useState } from "react";
import api from "../../api/axios";

export default function ProcurementIdentitySettings() {
  const [policy, setPolicy] = useState(null);
  const [enforce, setEnforce] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    let active = true;
    api
      .get("/item-master/procurement-policy")
      .then(({ data }) => {
        if (active) {
          setPolicy(data);
          setEnforce(data.enforce_item_identity);
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e.response?.data?.message || "Unable to load procurement policy.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.put("/item-master/procurement-policy", {
        enforce_item_identity: enforce,
        reason: reason.trim(),
      });
      setPolicy(data);
      setReason("");
      setSuccess(
        "Procurement policy saved. It applies to the next procurement command.",
      );
    } catch (e) {
      setError(
        e.response?.data?.message || "Unable to save procurement policy.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="max-w-3xl space-y-4 rounded-xl border bg-white p-6">
      <h2 className="text-xl font-bold">Item Master procurement policy</h2>
      <p className="text-sm text-slate-600">
        Keep enforcement on when the catalog is ready. Turn it off temporarily
        to use free-text and legacy description-only items while completing
        setup.
      </p>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded bg-green-50 p-3 text-green-800">
          {success}
        </p>
      )}
      {!policy && !error && <p>Loading policy…</p>}
      {policy && (
        <form onSubmit={save} className="space-y-4">
          {!policy.configured && (
            <p className="rounded bg-amber-50 p-3 text-amber-900">
              Strict enforcement is active. Apply the manual policy migration
              before changing this setting.
            </p>
          )}
          <label className="flex gap-3 font-semibold">
            <input
              type="checkbox"
              role="switch"
              checked={enforce}
              disabled={!policy.configured || busy}
              onChange={(event) => setEnforce(event.target.checked)}
            />
            Require resolved Item Master identity before procurement
          </label>
          <p
            className={`rounded-lg p-3 text-sm ${enforce ? "bg-blue-50 text-blue-900" : "bg-amber-50 text-amber-900"}`}
          >
            {enforce
              ? "On: free-text and legacy lines must be resolved before sourcing, awards, PO creation or procurement progress."
              : "Off: description-only lines may proceed as non-inventory procurement. Their pending identity remains visible and auditable. Pending Item Master referrals still require a steward decision."}
          </p>
          <p className="text-sm text-slate-600">
            Request approvals, supplier eligibility, quantity limits and
            invoice/payment controls continue to apply. Warehouse inventory
            receipts still require an approved stock mapping. Re-enabling
            enforcement blocks new procurement commands for unresolved lines and
            preserves existing documents.
          </p>
          <label className="block text-sm font-medium">
            Reason for this change
            <textarea
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 block min-h-24 w-full rounded-lg border p-3"
            />
          </label>
          <button
            disabled={!policy.configured || busy || !reason.trim()}
            className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save procurement policy"}
          </button>
          <p className="text-xs text-slate-500">
            Last reason: {policy.reason || "Default strict policy"}
          </p>
        </form>
      )}
    </section>
  );
}
