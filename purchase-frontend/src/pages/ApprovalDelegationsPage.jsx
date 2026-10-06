import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import "./ApprovalDelegationsPage.css";
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
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
  const effectiveStatus = (row) =>
    row.status === "REVOKED"
      ? "REVOKED"
      : new Date(row.effective_from) > new Date()
        ? "SCHEDULED"
        : new Date(row.effective_to) <= new Date()
          ? "EXPIRED"
          : "ACTIVE";
  const filteredRows = rows.filter(
    (row) =>
      (statusFilter === "ALL" || effectiveStatus(row) === statusFilter) &&
      [
        row.authority_unit_name,
        row.position_name,
        row.delegator_user_name,
        row.delegate_user_name,
        row.reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  if (!canView)
    return <p role="alert">Permission required: approval-delegation.view</p>;
  return (
    <main className="delegations-page">
      <header className="delegations-header">
        <div>
          <span className="delegations-eyebrow">
            <ShieldCheck size={16} /> APPROVAL GOVERNANCE
          </span>
          <h1>Approval Delegations</h1>
          <p>
            Assign acting approvers while keeping structural authority clear.
          </p>
        </div>
        <button
          className="delegations-button secondary"
          type="button"
          disabled={loading || busy}
          onClick={load}
        >
          <RefreshCw size={16} className={loading ? "delegations-spin" : ""} />{" "}
          Refresh
        </button>
      </header>
      <section className="delegations-metrics" aria-label="Delegation overview">
        {[
          ["Total delegations", rows.length, Users],
          [
            "Effective now",
            rows.filter((r) => effectiveStatus(r) === "ACTIVE").length,
            ShieldCheck,
          ],
          [
            "Scheduled",
            rows.filter((r) => effectiveStatus(r) === "SCHEDULED").length,
            CalendarDays,
          ],
        ].map(([label, value, Icon]) => (
          <div key={label}>
            <span className="delegations-metric-icon">
              <Icon size={20} />
            </span>
            <div>
              <span>{label}</span>
              <strong>{loading ? "—" : value}</strong>
            </div>
          </div>
        ))}
      </section>
      {error && (
        <p className="delegations-notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="delegations-notice success" role="status">
          {message}
        </p>
      )}
      {loading ? (
        <div className="delegations-empty" role="status">
          <RefreshCw className="delegations-spin" size={24} />
          <p>Loading delegations…</p>
        </div>
      ) : (
        <>
          {canManage && (
            <form onSubmit={create} className="delegations-panel">
              <div className="delegations-panel-heading">
                <span className="delegations-metric-icon">
                  <Plus size={20} />
                </span>
                <div>
                  <h2>Create delegation</h2>
                  <p>
                    Choose an authority, acting approver and effective period.
                  </p>
                </div>
              </div>
              <fieldset disabled={busy} className="delegations-form-grid">
                <label className="delegations-field">
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
                    <label className="delegations-field">
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
                      <p className="delegations-holder">
                        Current system holder:{" "}
                        {selectedPosition.holder_name ||
                          "No system user assigned"}
                      </p>
                    )}
                  </>
                ) : (
                  <label className="delegations-field">
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
                <label className="delegations-field">
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
                <p className="delegations-form-divider">
                  <CalendarDays size={16} /> Effective period (your local time)
                </p>
                <label className="delegations-field">
                  Effective from{" "}
                  <input
                    required
                    type="datetime-local"
                    name="effectiveFrom"
                    value={form.effectiveFrom}
                    onChange={update}
                  />
                </label>
                <label className="delegations-field">
                  Effective to{" "}
                  <input
                    required
                    type="datetime-local"
                    name="effectiveTo"
                    value={form.effectiveTo}
                    onChange={update}
                  />
                </label>
                <label className="delegations-field">
                  Scope{" "}
                  <select name="scope" value={form.scope} onChange={update}>
                    <option value="PURCHASE_REQUEST_APPROVAL">
                      PURCHASE_REQUEST_APPROVAL
                    </option>
                  </select>
                </label>
                <label className="delegations-field">
                  Reason{" "}
                  <textarea
                    required
                    placeholder="Explain why approval authority is being delegated…"
                    rows={3}
                    name="reason"
                    value={form.reason}
                    onChange={update}
                  />
                </label>
                <div className="delegations-form-footer">
                  <span>Changes are recorded in the audit history.</span>
                  <button className="delegations-button primary" type="submit">
                    <Plus size={16} /> {busy ? "Saving…" : "Create delegation"}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          <section
            className="delegations-register"
            aria-label="Delegation register"
          >
            <div className="delegations-register-heading">
              <div>
                <h2>Delegation register</h2>
                <p>Review current, upcoming and past assignments.</p>
              </div>
              <span className="delegations-count">
                {filteredRows.length} records
              </span>
            </div>
            <div className="delegations-toolbar">
              <label className="delegations-search">
                <Search size={18} />
                <input
                  aria-label="Search delegations"
                  placeholder="Search authority, delegate or reason…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Effective now</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="EXPIRED">Expired</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>
            {!filteredRows.length && (
              <div className="delegations-empty">
                <Users size={30} />
                <h3>
                  {rows.length
                    ? "No matching delegations"
                    : "No delegations found."}
                </h3>
                <p>
                  {rows.length
                    ? "Try a different search or status filter."
                    : "Delegations will appear here once an acting approver is assigned."}
                </p>
              </div>
            )}
            {filteredRows.map((row) => (
              <article key={row.id} className="delegations-record">
                <div className="delegations-record-heading">
                  <span className="delegations-eyebrow">
                    {row.organization_position_id
                      ? "STRUCTURAL POSITION"
                      : "USER AUTHORITY"}
                  </span>
                  <span
                    className={`delegations-badge ${effectiveStatus(row).toLowerCase()}`}
                  >
                    {effectiveStatus(row) === "ACTIVE"
                      ? "Effective now"
                      : effectiveStatus(row).toLowerCase()}
                  </span>
                </div>
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
                <p className="delegations-acting">
                  <ArrowRight size={18} /> Delegated to:{" "}
                  {row.delegate_user_name}
                </p>
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
                    className="delegations-button danger"
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
                  <form onSubmit={revoke} className="delegations-revoke">
                    <label>
                      Revocation reason{" "}
                      <textarea
                        required
                        value={revocationReason}
                        onChange={(e) => setRevocationReason(e.target.value)}
                      />
                    </label>
                    <button
                      className="delegations-button danger"
                      disabled={busy}
                      type="submit"
                    >
                      Confirm revocation
                    </button>
                    <button
                      className="delegations-button secondary"
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
          </section>
        </>
      )}
    </main>
  );
}
