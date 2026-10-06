import React, { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../hooks/useAuth";
import { hasPermission } from "../utils/permissions";

const initialForm = {
  authorityKind: "POSITION",
  organizationPositionId: "",
  delegatorUserId: "",
  delegateUserId: "",
  effectiveFrom: "",
  effectiveTo: "",
  scope: "PURCHASE_REQUEST_APPROVAL",
  reason: "",
};
const errorMessage = (error) =>
  error.response?.data?.error || error.response?.data?.message || error.message;

export default function ApprovalDelegationsPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, "approval-delegation.view");
  const canManage = hasPermission(user, "approval-delegation.manage");
  const [rows, setRows] = useState([]);
  const [options, setOptions] = useState({ positions: [], users: [] });
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revoking, setRevoking] = useState(null);
  const [revocationReason, setRevocationReason] = useState("");
  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [list, choices] = await Promise.all([
        api.get("/approval-authority-delegations"),
        canManage
          ? api.get("/approval-authority-delegations/options")
          : Promise.resolve({ data: { positions: [], users: [] } }),
      ]);
      setRows(list.data);
      setOptions(choices.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [canView, canManage]);
  useEffect(() => {
    load();
  }, [load]);
  const update = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });
  const selectedPosition = options.positions.find(
    (p) => String(p.id) === form.organizationPositionId,
  );
  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = {
        delegateUserId: form.delegateUserId,
        effectiveFrom: new Date(form.effectiveFrom).toISOString(),
        effectiveTo: new Date(form.effectiveTo).toISOString(),
        scope: form.scope,
        reason: form.reason,
      };
      if (form.authorityKind === "POSITION")
        body.organizationPositionId = form.organizationPositionId;
      else body.delegatorUserId = form.delegatorUserId;
      await api.post("/approval-authority-delegations", body);
      setForm(initialForm);
      setMessage("Delegation created.");
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.post(`/approval-authority-delegations/${revoking}/revoke`, {
        reason: revocationReason,
      });
      setRevoking(null);
      setRevocationReason("");
      setMessage("Delegation revoked.");
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (!canView)
    return <p role="alert">Permission required: approval-delegation.view</p>;
  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Approval Delegations</h1>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button type="button" disabled={loading || busy} onClick={load}>
        Refresh
      </button>
      {loading ? (
        <p role="status">Loading delegations…</p>
      ) : (
        <>
          {canManage && (
            <form onSubmit={create} className="border rounded p-4 space-y-3">
              <h2 className="font-bold">Create delegation</h2>
              <fieldset disabled={busy} className="space-y-3">
                <label className="block">
                  Authority type{" "}
                  <select
                    name="authorityKind"
                    value={form.authorityKind}
                    onChange={update}
                  >
                    <option value="POSITION">Structural position</option>
                    <option value="USER">User</option>
                  </select>
                </label>
                {form.authorityKind === "POSITION" ? (
                  <>
                    <label className="block">
                      Authority{" "}
                      <select
                        required
                        name="organizationPositionId"
                        value={form.organizationPositionId}
                        onChange={update}
                      >
                        <option value="">Select structural position</option>
                        {options.positions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.organization_unit_name} — {p.position_name} /{" "}
                            {p.position_type}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedPosition && (
                      <p>
                        Current system holder:{" "}
                        {selectedPosition.holder_name ||
                          "No system user assigned"}
                      </p>
                    )}
                  </>
                ) : (
                  <label className="block">
                    Delegator user{" "}
                    <select
                      required
                      name="delegatorUserId"
                      value={form.delegatorUserId}
                      onChange={update}
                    >
                      <option value="">Select delegator</option>
                      {options.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block">
                  Delegated to{" "}
                  <select
                    required
                    name="delegateUserId"
                    value={form.delegateUserId}
                    onChange={update}
                  >
                    <option value="">Select delegate</option>
                    {options.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p>Effective period (your local time)</p>
                <label className="block">
                  Effective from{" "}
                  <input
                    required
                    type="datetime-local"
                    name="effectiveFrom"
                    value={form.effectiveFrom}
                    onChange={update}
                  />
                </label>
                <label className="block">
                  Effective to{" "}
                  <input
                    required
                    type="datetime-local"
                    name="effectiveTo"
                    value={form.effectiveTo}
                    onChange={update}
                  />
                </label>
                <label className="block">
                  Scope{" "}
                  <select name="scope" value={form.scope} onChange={update}>
                    <option value="PURCHASE_REQUEST_APPROVAL">
                      PURCHASE_REQUEST_APPROVAL
                    </option>
                  </select>
                </label>
                <label className="block">
                  Reason{" "}
                  <textarea
                    required
                    name="reason"
                    value={form.reason}
                    onChange={update}
                  />
                </label>
                <button type="submit">Create delegation</button>
              </fieldset>
            </form>
          )}
          {!rows.length && <p>No delegations found.</p>}
          {rows.map((row) => (
            <article key={row.id} className="border rounded p-4">
              <p>
                Authority:{" "}
                {row.organization_position_id
                  ? `${row.authority_unit_name} — ${row.position_name} / ${row.position_type}`
                  : row.delegator_user_name}
              </p>
              {row.organization_position_id && (
                <p>
                  Current system holder:{" "}
                  {row.structural_holder_name || "No system user assigned"}
                </p>
              )}
              <p>Delegated to: {row.delegate_user_name}</p>
              <p>
                Effective period:{" "}
                {new Date(row.effective_from).toLocaleString()} –{" "}
                {new Date(row.effective_to).toLocaleString()}
              </p>
              <p>Scope: {row.scope}</p>
              <p>Reason: {row.reason}</p>
              <p>Status: {row.status}</p>
              {canManage && row.status === "ACTIVE" && (
                <button
                  disabled={busy}
                  onClick={() => {
                    setRevoking(row.id);
                    setRevocationReason("");
                  }}
                >
                  Revoke
                </button>
              )}
              {revoking === row.id && (
                <form onSubmit={revoke}>
                  <label>
                    Revocation reason{" "}
                    <textarea
                      required
                      value={revocationReason}
                      onChange={(e) => setRevocationReason(e.target.value)}
                    />
                  </label>
                  <button disabled={busy} type="submit">
                    Confirm revocation
                  </button>
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() => setRevoking(null)}
                  >
                    Cancel
                  </button>
                </form>
              )}
            </article>
          ))}
        </>
      )}
    </main>
  );
}
