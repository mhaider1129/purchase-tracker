import useUiTranslation from "../utils/useUiTranslation";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../api/technicalWorkflow";
import { uploadReviewEvidence } from "../api/preprocurementTechnicalReviews";
import useRequestAttachments from "../hooks/useRequestAttachments";
const label = (v) => String(v).replaceAll("_", " ");
const cls = "block w-full rounded border p-2";
export default function DeliveryInspectionDetail({ id }) {
  const uiText = useUiTranslation();
  const [task, setTask] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  const [form, setForm] = useState({
      decision: "",
      accepted_quantity: "0",
      rejected_quantity: "0",
      notes: "",
      assessment: {},
      attachment_ids: [],
    }),
    [notes, setNotes] = useState("");
  const { handleDownloadAttachment } = useRequestAttachments();
  const adopt = (data) => {
    setTask(data);
    setForm({
      decision: "",
      accepted_quantity: "0",
      rejected_quantity: "0",
      notes: "",
      assessment: {},
      attachment_ids: [],
    });
    setNotes("");
  };
  const load = async () => {
    try {
      adopt(await api.deliveryTask(id));
      setError("");
    } catch (e) {
      setError(
        e.response?.data?.message || "Unable to load delivery inspection",
      );
    }
  };
  useEffect(() => {
    let active = true;
    setTask(null);
    api
      .deliveryTask(id)
      .then((t) => {
        if (active) adopt(t);
      })
      .catch((e) => {
        if (active)
          setError(
            e.response?.data?.message || "Unable to load delivery inspection",
          );
      });
    return () => {
      active = false;
    };
  }, [id]);
  const act = async (action, body = {}) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.deliveryAction(id, action, {
        row_version: task.row_version,
        ...body,
      });
      adopt(result.task || result);
      setSuccess("Inspection action recorded.");
    } catch (e) {
      setError(
        e.response?.data?.message || "Unable to record inspection action",
      );
    } finally {
      setBusy(false);
    }
  };
  const own = task?.assignments.find(
    (a) => String(a.reviewer_id) === String(task.current_user_id),
  );
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <Link className="text-indigo-700 underline" to="/technical-inspections">
        Back to technical worklist
      </Link>
      <h1 className="text-2xl font-bold">
        Delivery technical inspection · DI-{id}
      </h1>
      {error && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-red-800"
        >
          {error}
        </p>
      )}
      {success && <p role="status">{success}</p>}
      <button onClick={load} disabled={busy} className="underline">
        Reload latest inspection
      </button>
      {!task && !error && <p>Loading inspection…</p>}
      {task && (
        <>
          <section className="rounded-xl border p-5">
            <h2 className="text-lg font-semibold">Item information</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["Item", task.item_name],
                ["Goods Receipt", task.receipt_number],
                ["Purchase Order", task.po_number],
                ["Supplier", task.supplier_name],
                ["Approved product", task.approved_product?.product_name],
                ["Manufacturer", task.manufacturer],
                [
                  "Manufacturer part number",
                  task.approved_product?.manufacturer_part_number,
                ],
                ["Requesting department", task.requesting_department],
                ["Specifications", task.specs],
                ["Batch / lot", task.batch_number || task.lot_number],
                ["Serial", task.serial_number],
                ["Delivered", task.received_quantity],
                [
                  "Accepted / rejected",
                  `${task.technical_accepted_quantity} / ${task.technical_rejected_quantity}`,
                ],
                ["Remaining on hold", task.remaining_quantity],
                ["State", task.status],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-slate-500">{k}</dt>
                  <dd>{v || uiText("Not recorded")}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3">
              {task.attachments.map((f) => (
                <button
                  className="mr-4 text-indigo-700 underline"
                  key={f.id}
                  onClick={() => handleDownloadAttachment(f)}
                >
                  {f.file_name}
                </button>
              ))}
            </div>
          </section>
          <section className="space-y-3 rounded-xl border p-5">
            <h2 className="text-lg font-semibold">Technical opinions</h2>
            {task.assignments.map((a) => (
              <article className="rounded border p-3" key={a.id}>
                <p>
                  {a.name} · {a.department_name}:{" "}
                  {a.opinion?.decision || "Awaiting opinion"}
                </p>
                {a.opinion && (
                  <>
                    <p>{uiText("Accept")}{" "}{a.opinion.accepted_quantity} · Reject{" "}
                      {a.opinion.rejected_quantity} · Hold{" "}
                      {a.opinion.held_quantity}
                    </p>
                    <p>{a.opinion.notes}</p>
                    <p className="text-sm">{uiText("Attested by")}{" "}{a.opinion.signature?.name} · {a.submitted_at}
                    </p>
                  </>
                )}
              </article>
            ))}
          </section>
          {own &&
            !own.opinion &&
            ["PENDING", "IN_PROGRESS"].includes(task.status) && (
              <form
                className="space-y-4 rounded-xl border p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  act("opinion", form);
                }}
              >
                <h2 className="text-lg font-semibold">
                  Technical assessment and decision
                </h2>
                <p>
                  Assess the units proposed for acceptance. Explain rejected or
                  held units in the comments. A partial acceptance can be
                  released only when every required reviewer agrees on the
                  quantities.
                </p>
                {task.status === "PENDING" && (
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() => act("start")}
                  >
                    Start inspection
                  </button>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {task.profile_snapshot.delivery_checks.map((k) => (
                    <label key={k}>
                      {label(k)}
                      <select
                        required
                        className={cls}
                        aria-label={`Delivery ${k}`}
                        value={form.assessment[k] || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            assessment: {
                              ...form.assessment,
                              [k]: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">Select assessment</option>
                        {task.checks[k].map((v) => (
                          <option key={v} value={v}>
                            {label(v)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <label>{uiText("Decision")}<select
                    required
                    className={cls}
                    value={form.decision}
                    onChange={(e) => {
                      const decision = e.target.value;
                      setForm({
                        ...form,
                        decision,
                        accepted_quantity:
                          decision === "ACCEPTED"
                            ? task.remaining_quantity
                            : "0",
                        rejected_quantity:
                          decision === "REJECTED"
                            ? task.remaining_quantity
                            : "0",
                      });
                    }}
                  >
                    <option value="">Select decision</option>
                    <option value="ACCEPTED">Accept all remaining units</option>
                    <option value="PARTIAL">Partial acceptance</option>
                    <option value="HOLD">Hold / clarification</option>
                    <option value="REJECTED">Reject all remaining units</option>
                  </select>
                </label>
                {form.decision === "PARTIAL" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      Accepted quantity
                      <input
                        required
                        className={cls}
                        type="number"
                        min="0"
                        step="0.0001"
                        value={form.accepted_quantity}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            accepted_quantity: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Rejected quantity
                      <input
                        required
                        className={cls}
                        type="number"
                        min="0"
                        step="0.0001"
                        value={form.rejected_quantity}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            rejected_quantity: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                )}
                <label>
                  Comments / corrective action
                  <textarea
                    className={cls}
                    required={form.decision !== "ACCEPTED"}
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </label>
                <fieldset>
                  <legend>
                    Supporting evidence{" "}
                    {task.profile_snapshot.evidence_required
                      ? "(required)"
                      : "(optional)"}
                  </legend>
                  {task.attachments.map((f) => (
                    <label className="mr-3 inline-block" key={f.id}>
                      <input
                        type="checkbox"
                        checked={form.attachment_ids.includes(String(f.id))}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            attachment_ids: e.target.checked
                              ? [...form.attachment_ids, String(f.id)]
                              : form.attachment_ids.filter(
                                  (id) => id !== String(f.id),
                                ),
                          })
                        }
                      />{" "}
                      {f.file_name}
                    </label>
                  ))}
                  <label className="block">
                    Upload inspection evidence
                    <input
                      type="file"
                      disabled={busy}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setBusy(true);
                        try {
                          await uploadReviewEvidence(task.request_id, file);
                          setTask(await api.deliveryTask(id));
                        } catch (e) {
                          setError(
                            e.response?.data?.message ||
                              "Unable to upload evidence",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  </label>
                </fieldset>
                <button
                  disabled={busy}
                  className="rounded bg-indigo-700 px-4 py-2 text-white"
                >
                  Submit inspection opinion and attest
                </button>
              </form>
            )}
          {task.can_manage && task.status !== "CLOSED" && (
            <section className="space-y-3 rounded-xl border p-5">
              <h2 className="font-semibold">Independent final disposition</h2>
              <label>
                Disposition / clarification notes
                <textarea
                  className={cls}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <button
                disabled={
                  busy ||
                  !notes.trim() ||
                  !["PENDING", "IN_PROGRESS"].includes(task.status) ||
                  task.assignments.some(
                    (a) =>
                      !a.opinion ||
                      String(a.reviewer_id) === String(task.current_user_id),
                  )
                }
                onClick={() => act("decide", { notes })}
              >
                Authorize agreed disposition
              </button>
              <button
                disabled={busy || !notes.trim() || task.status === "DECIDED"}
                className="ml-4"
                onClick={() => act("reopen", { notes })}
              >
                Reopen held units / request clarification
              </button>
            </section>
          )}
          {task.status === "DECIDED" && (
            <section className="rounded-xl border p-5">
              <h2 className="font-semibold">Apply receiving disposition</h2>
              <p>
                Technical disposition is authorized. An authorized receiving
                officer applies accepted quantities through Goods Receipt
                controls. Held/rejected units are excluded from available
                inventory and financial acceptance.
              </p>
              {task.can_receive && (
                <button
                  disabled={busy}
                  className="mt-3 rounded bg-emerald-700 px-4 py-2 text-white"
                  onClick={() =>
                    act("apply", {
                      disposition_id: task.pending_disposition.history_id,
                    })
                  }
                >
                  Apply authorized receiving disposition
                </button>
              )}
            </section>
          )}
          <details className="rounded-xl border p-5">
            <summary>Decision and revision history</summary>
            {task.history.map((h) => (
              <article className="my-3 border-b p-2" key={h.id}>
                <p>
                  {label(h.action)} · {h.created_at}
                </p>
                <p>{h.payload.notes || h.payload.decision}</p>
              </article>
            ))}
          </details>
        </>
      )}
    </main>
  );
}
