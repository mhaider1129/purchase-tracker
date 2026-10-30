import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as api from "../api/preprocurementTechnicalReviews";
import useRequestAttachments from "../hooks/useRequestAttachments";

const label = (key) =>
  ({
    sds: "SDS available",
    specifications: "Compliance with specifications",
    disinfectant: "Disinfectant compatibility",
    labelling: "Labelling / markings",
  })[key] ||
  key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const message = (error) =>
  error.response?.data?.message ||
  "Unable to complete the technical review action.";
const freshKey = () =>
  window.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const inputClass = "rounded border border-slate-300 bg-white p-2 text-sm";
const today = () => new Date().toISOString().slice(0, 10);
const newReport = (packet, schema) =>
  schema.assessment
    ? {
        item_id: packet.item_id,
        assessment_version: 2,
        decision: "",
        findings: "",
        assessment: Object.fromEntries(
          Object.keys(schema.assessment).map((key) => [key, ""]),
        ),
      }
    : {
        item_id: packet.item_id,
        decision: "",
        inspection_date: today(),
        inspection_time: new Date().toTimeString().slice(0, 5),
        findings: "",
        overall_condition: "",
        immediate_actions: "",
        recommended_actions: "",
        additional_comments: "",
        checklist: Object.fromEntries(
          Object.keys(schema.checklist).map((key) => [
            key,
            { condition: "", comment: "", action_required: "" },
          ]),
        ),
      };

export default function PreprocurementTechnicalReviewsPage() {
  const [params, setParams] = useSearchParams();
  const [schema, setSchema] = useState(null),
    [records, setRecords] = useState([]),
    [detail, setDetail] = useState(null);
  const [requests, setRequests] = useState([]),
    [directory, setDirectory] = useState([]),
    [search, setSearch] = useState("");
  const [requestId, setRequestId] = useState(""),
    [packets, setPackets] = useState([]),
    [reviewerIds, setReviewerIds] = useState([]),
    [instructions, setInstructions] = useState("");
  const [attachments, setAttachments] = useState([]),
    [reports, setReports] = useState([]),
    [notes, setNotes] = useState("");
  const [policy, setPolicy] = useState(null),
    [policyReason, setPolicyReason] = useState("");
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [submissionKey, setSubmissionKey] = useState(freshKey);
  const { handleDownloadAttachment } = useRequestAttachments();
  const openedReview = useRef(null);
  const adopt = useCallback((review, meta) => {
    openedReview.current = String(review.id);
    setDetail(review);
    setReports(review.item_packets.map((packet) => newReport(packet, meta)));
    setNotes("");
  }, []);
  useEffect(() => {
    if (params.get("review") === openedReview.current && openedReview.current)
      return;
    let active = true;
    (async () => {
      try {
        const meta = await api.reviewSchema();
        if (!active) return;
        setSchema(meta);
        const rows = await api.listPreprocurementReviews();
        if (!active) return;
        setRecords(rows);
        if (meta.can_manage) {
          const [eligible, users, setting] = await Promise.all([
            api.eligibleReviewRequests(""),
            api.reviewDirectory(),
            api.reviewPolicy(),
          ]);
          if (!active) return;
          setRequests(eligible);
          setDirectory(users);
          setPolicy(setting);
        }
        const id = params.get("review");
        if (id) {
          const review = await api.getPreprocurementReview(id);
          if (active) adopt(review, meta);
        }
      } catch (e) {
        if (active) setError(message(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [adopt, params]);
  const action = async (work) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await work();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    setRecords(await api.listPreprocurementReviews(search));
    if (detail) adopt(await api.getPreprocurementReview(detail.id), schema);
  };
  const selectRequest = async (id) => {
    setRequestId(id);
    setAttachments([]);
    setReviewerIds([]);
    setSubmissionKey(freshKey());
    const selected = requests.find((row) => String(row.id) === id);
    setPackets(
      (selected?.items || []).map((item) => ({
        item_id: String(item.id),
        item_name: item.item_name,
        specs: item.specs,
        selected: true,
        evidence: {
          basis: "sample",
          category: "Other",
          supplier_name: "",
          manufacturer: "",
          model_number: "",
          serial_batch_number: "",
          sample_received_date: "",
          evidence_description: "",
          no_sample_reason: "",
          attachment_ids: [],
        },
      })),
    );
    if (id) setAttachments(await api.requestEvidence(id));
  };
  const evidence = (index, key, value) =>
    setPackets((old) =>
      old.map((row, i) =>
        i === index
          ? { ...row, evidence: { ...row.evidence, [key]: value } }
          : row,
      ),
    );
  const changeReport = (index, key, value) =>
    setReports((old) =>
      old.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  const changeCheck = (index, key, field, value) =>
    setReports((old) =>
      old.map((row, i) =>
        i === index
          ? {
              ...row,
              checklist: {
                ...row.checklist,
                [key]: { ...row.checklist[key], [field]: value },
              },
            }
          : row,
      ),
    );
  const assignment = detail?.assignments.find(
    (row) => String(row.reviewer_id) === String(detail.current_user_id),
  );
  const canSubmit =
    detail?.status === "IN_REVIEW" && assignment?.status === "PENDING";
  if (loading) return <main className="p-6">Loading technical reviews…</main>;
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <style>{`@media print { body * {visibility:hidden} #technical-review-record, #technical-review-record * {visibility:visible} #technical-review-record {position:absolute;left:0;top:0;width:100%;border:0} #technical-review-record button, #technical-review-record form, #technical-review-record .scm-actions {display:none} #technical-review-record article {break-inside:avoid} }`}</style>
      <header>
        <p className="text-sm text-indigo-700">
          {schema?.form_reference || "DPP.SC.001.F07"} · Before procurement
        </p>
        <h1 className="text-2xl font-bold">Pre-procurement technical review</h1>
        <p className="mt-2 text-slate-600">
          SCM sends an approved request for independent technical opinions from
          the requesting department and other relevant departments. All required
          opinions and SCM sign-off are needed for clearance.
        </p>
        <Link
          className="mt-2 inline-block text-blue-700 underline"
          to="/technical-inspections"
        >
          Back to technical worklist
        </Link>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-red-800"
        >
          {error}{" "}
          <button
            disabled={busy || !schema}
            onClick={() => action(refresh)}
            className="underline"
          >
            Reload latest review
          </button>
        </div>
      )}
      {success && (
        <p role="status" className="text-green-700">
          {success}
        </p>
      )}
      {!detail && (
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            action(async () => {
              setRecords(await api.listPreprocurementReviews(search));
              if (schema.can_manage)
                setRequests(await api.eligibleReviewRequests(search));
            });
          }}
        >
          <input
            aria-label="Search request reviews"
            className={inputClass}
            placeholder="Request number or description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button disabled={busy} className="rounded border px-3 py-2">
            Search
          </button>
        </form>
      )}
      {schema?.can_manage && !detail && (
        <details
          open={params.get("new") === "1"}
          className="rounded-xl border bg-white p-4"
        >
          <summary className="cursor-pointer font-semibold">
            Send a request for technical review
          </summary>
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              action(async () => {
                const review = await api.sendTechnicalReview({
                  request_id: requestId,
                  items: packets
                    .filter((row) => row.selected)
                    .map(({ item_id, evidence }) => ({ item_id, evidence })),
                  reviewer_ids: reviewerIds,
                  instructions,
                  submission_key: submissionKey,
                });
                adopt(review, schema);
                setParams({ review: review.id });
                setSubmissionKey(freshKey());
                setSuccess(
                  "Technical review sent to the selected departments.",
                );
                setRecords(await api.listPreprocurementReviews(search));
              });
            }}
          >
            <label className="block">
              Approved request
              <select
                required
                aria-label="Approved request"
                className={`${inputClass} ml-3`}
                value={requestId}
                onChange={(event) =>
                  action(() => selectRequest(event.target.value))
                }
              >
                <option value="">Select a request</option>
                {requests.map((row) => (
                  <option key={row.id} value={row.id}>
                    #{row.maintenance_ref_number || row.id} ·{" "}
                    {row.department_name} · {row.justification}
                  </option>
                ))}
              </select>
            </label>
            {requestId && (
              <div className="rounded border bg-slate-50 p-3">
                <p>Data sheets and supporting documents</p>
                <input
                  aria-label="Upload technical evidence"
                  type="file"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file)
                      action(async () => {
                        await api.uploadReviewEvidence(requestId, file);
                        setAttachments(await api.requestEvidence(requestId));
                        setSuccess(
                          "Evidence uploaded. Select it below for the relevant item.",
                        );
                      });
                  }}
                />
                <p className="text-xs text-slate-600">
                  A data-sheet review requires an attached document;
                  description-based reviews require enough written technical
                  evidence.
                </p>
              </div>
            )}
            {packets.map((packet, index) => (
              <fieldset
                key={packet.item_id}
                className="space-y-3 rounded border p-4"
              >
                <legend>
                  <label>
                    <input
                      type="checkbox"
                      checked={packet.selected}
                      onChange={(event) =>
                        setPackets((old) =>
                          old.map((row, i) =>
                            i === index
                              ? { ...row, selected: event.target.checked }
                              : row,
                          ),
                        )
                      }
                    />{" "}
                    {packet.item_name}
                  </label>
                </legend>
                <p className="text-sm text-slate-600">
                  Requested specifications: {packet.specs || "Not recorded"}
                </p>
                {packet.selected && (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label>
                        Review basis
                        <select
                          aria-label={`Review basis ${packet.item_id}`}
                          className={`${inputClass} block w-full`}
                          value={packet.evidence.basis}
                          onChange={(event) =>
                            evidence(index, "basis", event.target.value)
                          }
                        >
                          <option value="sample">Physical sample</option>
                          <option value="data_sheet">Data sheet</option>
                          <option value="description">
                            Technical description
                          </option>
                        </select>
                      </label>
                      <label>
                        Item category
                        <select
                          className={`${inputClass} block w-full`}
                          value={packet.evidence.category}
                          onChange={(event) =>
                            evidence(index, "category", event.target.value)
                          }
                        >
                          {schema.categories.map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                      {[
                        "supplier_name",
                        "manufacturer",
                        "model_number",
                        "serial_batch_number",
                      ].map((key) => (
                        <label key={key}>
                          {label(key)}
                          <input
                            className={`${inputClass} block w-full`}
                            value={packet.evidence[key]}
                            onChange={(event) =>
                              evidence(index, key, event.target.value)
                            }
                          />
                        </label>
                      ))}
                      <label>
                        Sample received date
                        <input
                          required={packet.evidence.basis === "sample"}
                          type="date"
                          className={`${inputClass} block`}
                          value={packet.evidence.sample_received_date}
                          onChange={(event) =>
                            evidence(
                              index,
                              "sample_received_date",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                    <label className="block">
                      Sample / evidence description
                      <textarea
                        required
                        className={`${inputClass} block w-full`}
                        value={packet.evidence.evidence_description}
                        onChange={(event) =>
                          evidence(
                            index,
                            "evidence_description",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    {packet.evidence.basis !== "sample" && (
                      <label className="block">
                        Why is a physical sample unavailable?
                        <textarea
                          required
                          className={`${inputClass} block w-full`}
                          value={packet.evidence.no_sample_reason}
                          onChange={(event) =>
                            evidence(
                              index,
                              "no_sample_reason",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    )}
                    <div>
                      <p>Documents for this item</p>
                      {attachments.map((file) => (
                        <label key={file.id} className="mr-4 inline-block">
                          <input
                            type="checkbox"
                            checked={packet.evidence.attachment_ids
                              .map(String)
                              .includes(String(file.id))}
                            onChange={(event) =>
                              evidence(
                                index,
                                "attachment_ids",
                                event.target.checked
                                  ? [...packet.evidence.attachment_ids, file.id]
                                  : packet.evidence.attachment_ids.filter(
                                      (id) => String(id) !== String(file.id),
                                    ),
                              )
                            }
                          />{" "}
                          {file.file_name}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </fieldset>
            ))}
            <fieldset className="rounded border p-3">
              <legend>Required departmental inspectors</legend>
              <p className="text-sm text-slate-600">
                Include the requesting department. Every selected inspector must
                submit an opinion. The SCM signatory cannot be one of these
                inspectors.
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {directory.map((user) => (
                  <label key={user.id}>
                    <input
                      type="checkbox"
                      checked={reviewerIds.includes(String(user.id))}
                      onChange={(event) =>
                        setReviewerIds((old) =>
                          event.target.checked
                            ? [...old, String(user.id)]
                            : old.filter((id) => id !== String(user.id)),
                        )
                      }
                    />{" "}
                    {user.name} · {user.role} · {user.department_name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              Review instructions
              <textarea
                required
                className={`${inputClass} block w-full`}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
              />
            </label>
            <button
              disabled={
                busy ||
                !requestId ||
                !reviewerIds.length ||
                !packets.some((row) => row.selected)
              }
              className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-40"
            >
              Send technical review
            </button>
          </form>
        </details>
      )}
      {!detail && (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">
            {schema?.can_manage
              ? "Technical review register"
              : "My assigned technical reviews"}
          </h2>
          {!records.length && (
            <p className="mt-3 text-slate-600">No reviews found.</p>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Request</th>
                  <th>State</th>
                  <th>Pending opinions</th>
                  <th>Rejected opinions</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-3">TI-{row.id}</td>
                    <td>#{row.maintenance_ref_number || row.request_id}</td>
                    <td>{row.status}</td>
                    <td>{row.pending_count}</td>
                    <td>{row.rejected_count}</td>
                    <td>
                      <button
                        disabled={busy}
                        className="text-blue-700 underline"
                        onClick={() =>
                          action(async () => {
                            adopt(
                              await api.getPreprocurementReview(row.id),
                              schema,
                            );
                            setParams({ review: row.id });
                          })
                        }
                      >
                        Review TI-{row.id}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {detail && (
        <section
          id="technical-review-record"
          className="space-y-4 rounded-xl border bg-white p-5"
        >
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                Technical Review · TR-{detail.id}
              </h2>
              <p>
                Request #{detail.maintenance_ref_number || detail.request_id} ·{" "}
                {detail.requesting_department_name} · {detail.status}
              </p>
              <p className="text-sm">
                Sent by {detail.created_by_name} ·{" "}
                {new Date(detail.created_at).toLocaleString()}
              </p>
            </div>
            <button
              className="rounded border px-3 py-2 print:hidden"
              onClick={() => window.print()}
            >
              Print review record
            </button>
          </div>
          <p>{detail.instructions}</p>
          {detail.item_packets.map((packet) => (
            <article key={packet.item_id} className="rounded bg-slate-50 p-3">
              <h3 className="font-semibold">
                {packet.snapshot.item_name} · {packet.snapshot.quantity}{" "}
                {packet.snapshot.unit_of_measure}
              </h3>
              <p>{packet.snapshot.specs}</p>
              <p>
                {label(packet.evidence.basis)} · {packet.evidence.category} ·
                Supplier: {packet.evidence.supplier_name || "Not specified"} ·
                Manufacturer: {packet.evidence.manufacturer || "Not specified"}{" "}
                · Model: {packet.evidence.model_number || "—"} · Serial / batch:{" "}
                {packet.evidence.serial_batch_number || "—"}
              </p>
              <p>
                Sample received:{" "}
                {packet.evidence.sample_received_date || "Not recorded"}
              </p>
              <p>{packet.evidence.evidence_description}</p>
              {packet.evidence.no_sample_reason && (
                <p>No sample: {packet.evidence.no_sample_reason}</p>
              )}
              <div>
                {detail.attachments
                  .filter((file) =>
                    packet.evidence.attachment_ids
                      .map(String)
                      .includes(String(file.id)),
                  )
                  .map((file) => (
                    <button
                      key={file.id}
                      className="mr-3 text-blue-700 underline"
                      onClick={() => handleDownloadAttachment(file)}
                    >
                      {file.file_name}
                    </button>
                  ))}
              </div>
            </article>
          ))}
          {detail.assignments.map((row) => (
            <article key={row.id} className="rounded border p-3">
              <h3 className="font-semibold">
                {row.reviewer_name} · {row.reviewer_title} ·{" "}
                {row.department_name}: {row.status}
              </h3>
              {row.signature && (
                <p className="text-sm">
                  Attested by {row.signature.name} ({row.signature.title}),{" "}
                  {row.signature.contact} ·{" "}
                  {new Date(row.submitted_at).toLocaleString()}
                </p>
              )}
              {row.reports.map((report) => (
                <details key={report.item_id} open>
                  <summary>
                    {
                      detail.item_packets.find(
                        (packet) =>
                          String(packet.item_id) === String(report.item_id),
                      )?.snapshot.item_name
                    }
                    : {report.decision}
                  </summary>
                  {report.assessment && (
                    <dl className="my-3 grid gap-2 sm:grid-cols-3">
                      {Object.entries(report.assessment).map(([key, value]) => (
                        <div key={key}>
                          <dt className="font-medium">{label(key)}</dt>
                          <dd>{label(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <p>
                    Inspection:{" "}
                    {report.assessed_at
                      ? new Date(report.assessed_at).toLocaleString()
                      : report.inspection_date}{" "}
                    {report.inspection_time}
                    {report.overall_condition
                      ? ` · Overall: ${report.overall_condition}`
                      : ""}
                  </p>
                  {report.assessment_version !== 2 && (
                    <table className="my-2 w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th>Check</th>
                          <th>Condition</th>
                          <th>Comments</th>
                          <th>Action required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(report.checklist).map(
                          ([key, value]) => (
                            <tr key={key}>
                              <td>{label(key)}</td>
                              <td>{label(value.condition)}</td>
                              <td>{value.comment}</td>
                              <td>{value.action_required}</td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  )}
                  <p>{report.findings}</p>
                  {report.immediate_actions && (
                    <p>Immediate actions: {report.immediate_actions}</p>
                  )}
                  {report.recommended_actions && (
                    <p>Recommended actions: {report.recommended_actions}</p>
                  )}
                  <p>{report.additional_comments}</p>
                </details>
              ))}
            </article>
          ))}
          {canSubmit && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                action(async () => {
                  adopt(
                    await api.submitTechnicalOpinion(detail.id, {
                      row_version: detail.row_version,
                      reports,
                    }),
                    schema,
                  );
                  setRecords(await api.listPreprocurementReviews(search));
                  setSuccess(
                    "Your technical opinion and authenticated attestation were recorded.",
                  );
                });
              }}
            >
              <h3 className="text-lg font-semibold">
                My departmental inspection report
              </h3>
              <p className="text-sm text-slate-600">
                Review the information above, assess technical suitability and
                record your decision. Your authenticated account and submission
                time identify the reviewer. Technical approval does not
                authorize spending.
              </p>
              {reports.map((report, index) => (
                <fieldset
                  key={report.item_id}
                  className="space-y-3 rounded border p-4"
                >
                  <legend>
                    {detail.item_packets[index].snapshot.item_name}
                  </legend>
                  {schema.assessment ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-3">
                        {Object.entries(schema.assessment).map(
                          ([key, choices]) => (
                            <label key={key}>
                              {{
                                specifications:
                                  "Compliance with required specifications",
                                compatibility:
                                  "Compatibility with existing systems",
                                suitability: "Suitability for intended use",
                              }[key] || label(key)}
                              <select
                                required
                                aria-label={`${label(key)} assessment ${report.item_id}`}
                                className={`${inputClass} block w-full`}
                                value={report.assessment[key]}
                                onChange={(event) =>
                                  changeReport(index, "assessment", {
                                    ...report.assessment,
                                    [key]: event.target.value,
                                  })
                                }
                              >
                                <option value="">Select assessment</option>
                                {choices.map((value) => (
                                  <option key={value} value={value}>
                                    {label(value)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ),
                        )}
                      </div>
                      <label className="block">
                        Comments / corrective action
                        <textarea
                          required={report.decision !== "APPROVED"}
                          className={`${inputClass} block w-full`}
                          value={report.findings}
                          onChange={(event) =>
                            changeReport(index, "findings", event.target.value)
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-3">
                        <label>
                          Inspection date
                          <input
                            required
                            type="date"
                            className={`${inputClass} block`}
                            value={report.inspection_date}
                            onChange={(event) =>
                              changeReport(
                                index,
                                "inspection_date",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label>
                          Inspection time
                          <input
                            required
                            type="time"
                            className={`${inputClass} block`}
                            value={report.inspection_time}
                            onChange={(event) =>
                              changeReport(
                                index,
                                "inspection_time",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr>
                              <th>Inspection item</th>
                              <th>Condition</th>
                              <th>Comments / details</th>
                              <th>Action required</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(schema.checklist).map(
                              ([key, choices]) => (
                                <tr key={key}>
                                  <th className="py-2 font-normal">
                                    {label(key)}
                                  </th>
                                  <td>
                                    <select
                                      required
                                      aria-label={`${label(key)} condition ${report.item_id}`}
                                      className={inputClass}
                                      value={report.checklist[key].condition}
                                      onChange={(event) =>
                                        changeCheck(
                                          index,
                                          key,
                                          "condition",
                                          event.target.value,
                                        )
                                      }
                                    >
                                      <option value="">Select</option>
                                      {choices.map((choice) => (
                                        <option key={choice} value={choice}>
                                          {label(choice)}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  {["comment", "action_required"].map(
                                    (field) => (
                                      <td key={field}>
                                        <input
                                          aria-label={`${label(key)} ${field} ${report.item_id}`}
                                          className={inputClass}
                                          value={report.checklist[key][field]}
                                          onChange={(event) =>
                                            changeCheck(
                                              index,
                                              key,
                                              field,
                                              event.target.value,
                                            )
                                          }
                                        />
                                      </td>
                                    ),
                                  )}
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                      <label className="block">
                        Overall condition
                        <select
                          required
                          className={`${inputClass} ml-3`}
                          value={report.overall_condition}
                          onChange={(event) =>
                            changeReport(
                              index,
                              "overall_condition",
                              event.target.value,
                            )
                          }
                        >
                          <option value="">Select</option>
                          {["excellent", "good", "fair", "poor"].map(
                            (value) => (
                              <option key={value} value={value}>
                                {label(value)}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      {[
                        "findings",
                        "immediate_actions",
                        "recommended_actions",
                        "additional_comments",
                      ].map((key) => (
                        <label key={key} className="block">
                          {label(key)}
                          <textarea
                            required={key === "findings"}
                            className={`${inputClass} block w-full`}
                            value={report[key]}
                            onChange={(event) =>
                              changeReport(index, key, event.target.value)
                            }
                          />
                        </label>
                      ))}
                    </>
                  )}
                  <label>
                    Technical recommendation
                    <select
                      required
                      aria-label={`Technical recommendation ${report.item_id}`}
                      className={`${inputClass} ml-3`}
                      value={report.decision}
                      onChange={(event) =>
                        changeReport(index, "decision", event.target.value)
                      }
                    >
                      <option value="">Select</option>
                      <option value="APPROVED">Approve for procurement</option>
                      <option value="REJECTED">
                        Reject / revise proposed item
                      </option>
                    </select>
                  </label>
                </fieldset>
              ))}
              <button
                disabled={busy}
                className="rounded bg-indigo-700 px-4 py-2 text-white"
              >
                Submit departmental opinion and attest
              </button>
            </form>
          )}
          {detail.can_manage && detail.status === "IN_REVIEW" && (
            <div className="scm-actions space-y-3 rounded border border-indigo-200 p-4">
              <h3 className="font-semibold">
                SCM / procurement supervisor sign-off
              </h3>
              <p className="text-sm">
                Approval is available only after every assigned inspector
                approves every selected item. Cancellation retains the record
                and does not grant technical clearance.
              </p>
              <textarea
                aria-label="SCM decision notes"
                required
                className={`${inputClass} block w-full`}
                placeholder="Decision reason / follow-up"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                {["APPROVED", "REJECTED"].map((decision) => (
                  <button
                    key={decision}
                    disabled={
                      busy ||
                      !notes.trim() ||
                      (decision === "APPROVED" &&
                        detail.assignments.some(
                          (row) => row.status !== "APPROVED",
                        ))
                    }
                    className="rounded border px-3 py-2 disabled:opacity-40"
                    onClick={() =>
                      action(async () => {
                        adopt(
                          await api.signTechnicalReview(detail.id, {
                            row_version: detail.row_version,
                            decision,
                            notes,
                          }),
                          schema,
                        );
                        setRecords(await api.listPreprocurementReviews(search));
                        setSuccess("SCM technical decision recorded.");
                      })
                    }
                  >
                    {decision === "APPROVED"
                      ? "Approve technical clearance"
                      : "Reject technical clearance"}
                  </button>
                ))}
                <button
                  disabled={busy || !notes.trim()}
                  className="rounded border px-3 py-2 disabled:opacity-40"
                  onClick={() =>
                    action(async () => {
                      adopt(
                        await api.cancelTechnicalReview(detail.id, {
                          row_version: detail.row_version,
                          notes,
                        }),
                        schema,
                      );
                      setRecords(await api.listPreprocurementReviews(search));
                      setSuccess("Review cancelled; history retained.");
                    })
                  }
                >
                  Cancel review
                </button>
              </div>
            </div>
          )}
          {detail.signer_snapshot && (
            <div className="rounded bg-indigo-50 p-4">
              <h3 className="font-semibold">
                Procurement supervisor / SCM signature
              </h3>
              <p>
                {detail.signer_snapshot.name} · {detail.signer_snapshot.title} ·{" "}
                {new Date(detail.signed_at).toLocaleString()}
              </p>
              <p>{detail.decision_notes}</p>
            </div>
          )}
        </section>
      )}
      {schema?.can_manage && policy && (
        <details className="rounded border bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            Technical review requirement
          </summary>
          <p className="mt-2 text-sm">
            Selected requests always require clearance once sent for review.
            Requiring it for all approved requests applies to future procurement
            commands, including existing approved requests.
          </p>
          <label className="mt-3 block">
            <input
              type="checkbox"
              checked={policy.require_for_all}
              onChange={(event) =>
                setPolicy({ ...policy, require_for_all: event.target.checked })
              }
            />{" "}
            Require clearance for every approved request
          </label>
          <input
            aria-label="Technical review policy reason"
            className={`${inputClass} my-3 w-full`}
            placeholder="Reason for changing the requirement"
            value={policyReason}
            onChange={(event) => setPolicyReason(event.target.value)}
          />
          <button
            disabled={busy || !policyReason.trim()}
            className="rounded border px-3 py-2 disabled:opacity-40"
            onClick={() =>
              action(async () => {
                setPolicy(
                  await api.saveReviewPolicy({
                    require_for_all: policy.require_for_all,
                    reason: policyReason,
                  }),
                );
                setPolicyReason("");
                setSuccess("Technical review requirement saved.");
              })
            }
          >
            Save review requirement
          </button>
        </details>
      )}
    </main>
  );
}
