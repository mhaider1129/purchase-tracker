import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../hooks/useAuth";
import { hasAllPermissions } from "../utils/permissions";
import useUiTranslation from "../utils/useUiTranslation";
const decisions = [
  ["CONFIRMED_MATCH", "Confirm supported relationship"],
  ["REJECTED_PROPOSAL", "Reject proposed match"],
  ["CONFLICTING", "Flag conflict"],
  ["NEEDS_INVESTIGATION", "Further investigation"],
];
function ReviewRow({ row, onSaved }) {
  const text = useUiTranslation();
  const [selected, setSelected] = useState([]),
    [notes, setNotes] = useState(""),
    [evidence, setEvidence] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const command = useRef(null);
  const submit = async (decision) => {
    setBusy(true);
    setError("");
    const input = {
      record_type: row.record_type,
      source_id: row.source_id,
      decision,
      canonical_ids: selected,
      expected_version: row.version,
      fingerprint: row.fingerprint,
      notes,
      supporting_evidence: evidence,
    };
    const signature = JSON.stringify(input);
    try {
      if (command.current?.signature !== signature)
        command.current = { signature, key: crypto.randomUUID() };
      await api.post("/contracts/financial-reconciliation/reviews", {
        ...input,
        command_key: command.current.key,
      });
      await onSaved();
    } catch (e) {
      setError(
        e.response?.data?.message ||
          text(
            "Reconciliation review could not be saved. Reload before reviewing changed evidence.",
          ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <article
      className="space-y-3 rounded border p-3"
      aria-label={`${row.record_type} #${row.source_id}`}
    >
      <h3 className="font-semibold">
        {row.contract_title} ·{" "}
        {text(
          row.record_type === "legacy_invoice"
            ? "Legacy invoice"
            : "Legacy payment",
        )}{" "}
        #{row.source_id}
      </h3>
      <p>
        {text("Institute")} #{row.institute_id} · {text("Supplier")}:{" "}
        {row.supplier_name || "—"} #{row.supplier_id || "—"} ·{" "}
        <span dir="ltr">
          {row.amount} {row.currency}
        </span>
      </p>
      <p>
        {text(row.classification)} · {text("Review status")}:{" "}
        {row.review ? text(row.review.decision) : text("Not reviewed")}
      </p>
      {row.stale_review && (
        <p role="alert">
          {text(
            "Evidence changed. Previous reviews are historical and need a new review.",
          )}
        </p>
      )}
      <details>
        <summary>{text("Source evidence")}</summary>
        <pre className="overflow-auto text-xs">
          {JSON.stringify(
            {
              source: row.source_snapshot.source,
              legacy_invoice: row.source_snapshot.legacy_invoice,
            },
            null,
            2,
          )}
        </pre>
        <p>{row.reasons.map((p) => text(p)).join(" · ")}</p>
      </details>
      <fieldset disabled={busy}>
        <legend>{text("Potential canonical records")}</legend>
        {!row.candidates.length && (
          <p>{text("No supported canonical candidate found.")}</p>
        )}
        {row.candidates.map((c) => (
          <label key={c.id} className="block rounded border p-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              onChange={(e) =>
                setSelected((v) =>
                  e.target.checked
                    ? [...v, c.id]
                    : v.filter((id) => id !== c.id),
                )
              }
            />{" "}
            {text(
              c.type === "supplier_invoice" ? "Invoice" : "Payment allocation",
            )}{" "}
            #{c.id} · {c.evidence.invoice.invoice_number} ·{" "}
            {c.amount || c.evidence.invoice.total_amount}{" "}
            {c.evidence.invoice.currency}
            <span className="block">
              {c.problems.map((p) => text(p)).join(" · ")}
            </span>
            <details>
              <summary>{text("Canonical source evidence")}</summary>
              <pre className="overflow-auto text-xs">
                {JSON.stringify(c.evidence, null, 2)}
              </pre>
            </details>
          </label>
        ))}
        <label className="block">
          {text("Supporting evidence reference")}
          <textarea
            className="block w-full rounded border p-2"
            value={evidence}
            maxLength={8000}
            onChange={(e) => setEvidence(e.target.value)}
          />
        </label>
        <label className="block">
          {text("Review notes")}
          <textarea
            className="block w-full rounded border p-2"
            value={notes}
            maxLength={4000}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {decisions.map(([decision, label]) => (
            <button
              type="button"
              key={decision}
              disabled={
                busy ||
                !notes.trim() ||
                !evidence.trim() ||
                (["CONFIRMED_MATCH", "REJECTED_PROPOSAL"].includes(decision) &&
                  !selected.length)
              }
              className="rounded border px-3 py-2 disabled:opacity-50"
              onClick={() => submit(decision)}
            >
              {text(label)}
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <details>
        <summary>
          {text("Review history")} ({row.history.length})
        </summary>
        {row.history.map((r) => (
          <div className="border-t p-2 text-sm" key={r.id}>
            #{r.revision} · {text(r.decision)} · {text("Reviewer")} #
            {r.reviewer_id} · <time>{r.reviewed_at}</time>
            <p>{r.notes}</p>
            <p>{r.supporting_evidence}</p>
          </div>
        ))}
      </details>
    </article>
  );
}
export default function ContractFinancialReconciliation({ contractId }) {
  const text = useUiTranslation();
  const { user } = useAuth();
  const allowed = hasAllPermissions(user, [
    "finance.verify",
    "procure-to-pay.lifecycle.view",
  ]);
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const generation = useRef(null);
  const load = useCallback(async () => {
    const current = Symbol("reconciliation-load");
    generation.current = current;
    if (!allowed) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const r = await api.get("/contracts/financial-reconciliation/worklist", {
        params: contractId ? { contractId } : {},
      });
      if (current === generation.current) setData(r.data);
    } catch (e) {
      if (current === generation.current)
        setError(
          e.response?.data?.message ||
            text("Reconciliation information is unavailable."),
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [allowed, contractId, text]);
  useEffect(() => {
    load();
    return () => {
      generation.current = null;
    };
  }, [load]);
  if (!allowed) return null;
  return (
    <section
      className="space-y-4 rounded border p-4"
      aria-label={text("Historical financial reconciliation")}
    >
      <h2 className="text-xl font-semibold">
        {text("Historical financial reconciliation")}
      </h2>
      <p>
        {text(
          "Review evidence only. No posting, payment, reversal or release of financial holds occurs. Potential duplicates are not confirmed losses.",
        )}
      </p>
      <button
        type="button"
        className="rounded border px-3 py-2"
        onClick={load}
        disabled={loading}
      >
        {text("Reload worklist")}
      </button>
      {loading && <p role="status">{text("Loading...")}</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            {text("Institute")} #{data.report.institute_id} ·{" "}
            {text("Canonical integrity")}:{" "}
            {text(
              data.report.acceptance.canonical_integrity_passed
                ? "Passed"
                : "Investigation required",
            )}
          </p>
          <p>
            {text(
              data.report.scope === "CONTRACT"
                ? "Contract scope"
                : "Institute scope",
            )}{" "}
            · {text("Review audit complete")}:{" "}
            {text(
              data.report.acceptance.review_audit_complete
                ? "Passed"
                : "Investigation required",
            )}
          </p>
          {data.report.progress && (
            <p>
              {text("Confirmed records")}:{" "}
              {data.report.progress.confirmed_records}/
              {data.report.progress.total_records} ·{" "}
              {text("Unreviewed records")}:{" "}
              {data.report.progress.unreviewed_records} ·{" "}
              {text("Stale reviews")}:{" "}
              {data.report.progress.stale_review_records}
            </p>
          )}
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {[
                    "Record type",
                    "Currency",
                    "Legacy unreconciled value",
                    "Confirmed matched value",
                    "Potential duplicate exposure",
                    "Conflicting records",
                  ].map((x) => (
                    <th key={x} className="p-2 text-start">
                      {text(x)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.report.totals.map((t) => (
                  <tr key={`${t.record_type}:${t.currency}`}>
                    <td>
                      {text(
                        t.record_type === "legacy_invoice"
                          ? "Legacy invoice"
                          : "Legacy payment",
                      )}
                    </td>
                    <td>{t.currency}</td>
                    <td>{t.legacy_unreconciled_value}</td>
                    <td>{t.confirmed_matched_value}</td>
                    <td>{t.potential_duplicate_exposure}</td>
                    <td>{t.conflicting_records}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {text(
              "Invoice obligations and payment evidence are separate totals. Do not add them or convert currencies.",
            )}
          </p>
          <details>
            <summary>{text("Contract financial completeness")}</summary>
            {data.report.contracts.map((c) => (
              <p key={c.contract_id}>
                #{c.contract_id}: {c.confirmed_records}/{c.records} ·{" "}
                {text(
                  c.review_complete
                    ? "Review complete"
                    : "Investigation required",
                )}{" "}
                · {text("Unmapped consumption records")}:{" "}
                {c.legacy_consumption_count} ·{" "}
                {text("Historical header evidence")}:{" "}
                {String(c.historical_header_evidence)}
              </p>
            ))}
            <pre className="overflow-auto text-xs">
              {JSON.stringify(data.report.acceptance.defects, null, 2)}
            </pre>
          </details>
          {!data.rows.length && (
            <p>
              {text(
                "No owned historical invoice or payment records in this scope.",
              )}
            </p>
          )}
          {data.rows.map((row) => (
            <ReviewRow
              key={`${row.record_type}:${row.source_id}:${row.version}:${row.fingerprint}`}
              row={row}
              onSaved={load}
            />
          ))}
        </>
      )}
    </section>
  );
}
