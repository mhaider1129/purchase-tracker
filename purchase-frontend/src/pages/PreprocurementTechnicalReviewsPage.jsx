import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as api from "../api/preprocurementTechnicalReviews";
import { generateRequiredReview } from "../api/technicalWorkflow";
import { matchesSearchTokens } from "../utils/search";
import "./PreprocurementTechnicalReviewsPage.css";
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
        extra_assessment: {},
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
  const sendRef = useRef(null);
  const [reviewerSearch, setReviewerSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const [proposals, setProposals] = useState({
    suppliers: [],
    products: [],
    quotations: [],
  });
  const [revisionPackets, setRevisionPackets] = useState([]),
    [revisionNotes, setRevisionNotes] = useState(""),
    [revisionFiles, setRevisionFiles] = useState([]);
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
    setRevisionPackets(
      review.item_packets.map((p) => ({
        item_id: p.item_id,
        evidence: {
          ...p.evidence,
          ...(p.awaiting_proposal ? { no_sample_reason: "" } : {}),
        },
      })),
    );
    setRevisionFiles(review.attachments || []);
    setRevisionNotes("");
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
          if (meta.workflow_available) {
            const options = await api.proposalDirectory();
            if (active) setProposals(options);
          }
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
    setReviewerSearch("");
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
          category: item.technical_category || "Other",
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
  const visibleInspectors = directory.filter((user) =>
    matchesSearchTokens(reviewerSearch, [
      user.name,
      user.role,
      user.department_name,
    ]),
  );
  const selectedRequest = requests.find((row) => String(row.id) === requestId);
  const selectedPackets = packets.filter((row) => row.selected);
  const assignment = detail?.assignments.find(
    (row) => String(row.reviewer_id) === String(detail.current_user_id),
  );
  const canSubmit =
    detail?.status === "IN_REVIEW" &&
    ["PENDING", "IN_PROGRESS"].includes(assignment?.status) &&
    !detail.item_packets.some((p) => p.awaiting_proposal);
  if (loading) return <main className="p-6">Loading technical reviews…</main>;
  return (
    <main className="technical-reviews mx-auto max-w-7xl space-y-6 p-6">
      <style>{`@media print { body * {visibility:hidden} #technical-review-record, #technical-review-record * {visibility:visible} #technical-review-record {position:absolute;left:0;top:0;width:100%;border:0} #technical-review-record button, #technical-review-record form, #technical-review-record .scm-actions {display:none} #technical-review-record article {break-inside:avoid} }`}</style>
      <header className="technical-review-hero">
        <div>
          <p className="text-sm text-indigo-700">
            {schema?.form_reference || "DPP.SC.001.F07"} · Before procurement
          </p>
          <h1 className="text-2xl font-bold">
            Pre-procurement technical review
          </h1>
          <p className="mt-2 text-slate-600">
            SCM sends an approved request for independent technical opinions
            from the requesting department and other relevant departments. All
            required opinions and SCM sign-off are needed for clearance.
          </p>
        </div>
        <div className="technical-review-hero-actions">
          {schema?.can_manage && !detail && (
            <button
              type="button"
              onClick={() => {
                if (sendRef.current) {
                  sendRef.current.open = true;
                  sendRef.current.scrollIntoView?.({
                    behavior: "smooth",
                    block: "start",
                  });
                  sendRef.current
                    .querySelector("select")
                    ?.focus({ preventScroll: true });
                }
              }}
            >
              New technical review
            </button>
          )}
          <Link
            className="mt-2 inline-block text-blue-700 underline"
            to="/technical-inspections"
          >
            Back to technical worklist
          </Link>
        </div>
      </header>
      <section
        className="technical-review-workflow"
        aria-label="Technical review workflow"
      >
        <h2>Independent opinions before procurement clearance</h2>
        <ol>
          {[
            [
              "Prepare evidence",
              "Choose approved items and record the review basis",
            ],
            [
              "Departmental opinions",
              "Every required inspector submits an opinion",
            ],
            [
              "SCM sign-off",
              "An independent SCM signatory reviews the opinions",
            ],
            ["Clearance", "Required opinions and sign-off determine clearance"],
          ].map(([title, description], index) => (
            <li key={title}>
              <span>{index + 1}</span>
              <strong>{title}</strong>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>
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
          className="technical-review-search"
          aria-label="Find technical reviews"
          onSubmit={(event) => {
            event.preventDefault();
            action(async () => {
              setRecords(await api.listPreprocurementReviews(search));
              if (schema.can_manage)
                setRequests(await api.eligibleReviewRequests(search));
            });
          }}
        >
          <label>
            Search reviews
            <input
              aria-label="Search request reviews"
              className={inputClass}
              placeholder="Request number or description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button disabled={busy} className="rounded border px-3 py-2">
            Search
          </button>
          {search && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSearch("");
                action(async () => {
                  setRecords(await api.listPreprocurementReviews(""));
                  if (schema.can_manage)
                    setRequests(await api.eligibleReviewRequests(""));
                });
              }}
            >
              Clear search
            </button>
          )}
        </form>
      )}
      {schema?.can_manage && !detail && (
        <details
          open={params.get("new") === "1"}
          ref={sendRef}
          id="technical-review-send"
          aria-label="Send a request for technical review"
          className="technical-review-send rounded-xl border bg-white p-4"
        >
          <summary className="cursor-pointer font-semibold">
            Send a request for technical review
          </summary>
          <form
            className="technical-review-send-form mt-4 space-y-4"
            aria-label="Send technical review request"
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
            {schema.workflow_available && (
              <button
                type="button"
                disabled={busy || !requestId}
                className="text-indigo-700 underline"
                onClick={() =>
                  action(async () => {
                    const review = await generateRequiredReview(requestId);
                    if (review) {
                      adopt(review, schema);
                      setParams({ review: review.id });
                    } else
                      setSuccess(
                        "No new required review was generated. Check the configured profiles or open the existing review.",
                      );
                  })
                }
              >
                Generate configured review for the selected request
              </button>
            )}
            <div className="technical-review-setup-layout">
              <div className="technical-review-setup-fields">
                <fieldset className="technical-review-form-section">
                  <legend>
                    <span>1</span>Request and supporting evidence
                  </legend>
                  <p className="technical-review-help">
                    Select an approved request, then prepare evidence for each
                    selected item.
                  </p>
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
                    <div className="technical-review-upload rounded border bg-slate-50 p-3">
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
                              setAttachments(
                                await api.requestEvidence(requestId),
                              );
                              setSuccess(
                                "Evidence uploaded. Select it below for the relevant item.",
                              );
                            });
                        }}
                      />
                      <p className="text-xs text-slate-600">
                        A data-sheet review requires an attached document;
                        description-based reviews require enough written
                        technical evidence.
                      </p>
                    </div>
                  )}
                </fieldset>
                <fieldset className="technical-review-form-section">
                  <legend>
                    <span>2</span>Items and technical evidence
                  </legend>
                  {!packets.length && (
                    <p className="technical-review-empty">
                      Choose an approved request to prepare item evidence.
                    </p>
                  )}
                  {packets.map((packet, index) => (
                    <fieldset
                      key={packet.item_id}
                      className="technical-review-item space-y-3 rounded border p-4"
                    >
                      <legend>
                        <span className="technical-review-item-number">
                          Item {index + 1}
                        </span>
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
                        Requested specifications:{" "}
                        {packet.specs || "Not recorded"}
                      </p>
                      {packet.selected && (
                        <>
                          <div className="technical-review-field-grid grid gap-3 md:grid-cols-2">
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
                                  evidence(
                                    index,
                                    "category",
                                    event.target.value,
                                  )
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
                          <p className="technical-review-basis-help">
                            {packet.evidence.basis === "sample"
                              ? "Record the sample details and received date, then describe what inspectors should assess."
                              : packet.evidence.basis === "data_sheet"
                                ? "Attach a data sheet to this item and explain why a physical sample is unavailable."
                                : "Provide enough written technical evidence and explain why a physical sample is unavailable."}
                          </p>
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
                          {schema.workflow_available && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label>
                                Quotation under review (optional)
                                <select
                                  className={inputClass}
                                  value={
                                    packet.evidence.quotation_item_id || ""
                                  }
                                  onChange={(e) =>
                                    evidence(
                                      index,
                                      "quotation_item_id",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="">
                                    No quotation selected
                                  </option>
                                  {(proposals.quotations || [])
                                    .filter(
                                      (q) =>
                                        String(q.requested_item_id) ===
                                        String(packet.item_id),
                                    )
                                    .map((q) => (
                                      <option key={q.id} value={q.id}>
                                        {q.supplier_name} · {q.item_name} ·
                                        quotation line {q.id}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <label>
                                Proposed supplier
                                <select
                                  className={inputClass}
                                  value={packet.evidence.supplier_id || ""}
                                  onChange={(e) =>
                                    evidence(
                                      index,
                                      "supplier_id",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="">
                                    Requirements-only review
                                  </option>
                                  {proposals.suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Proposed approved product (optional)
                                <select
                                  className={inputClass}
                                  value={
                                    packet.evidence.approved_product_id || ""
                                  }
                                  onChange={(e) =>
                                    evidence(
                                      index,
                                      "approved_product_id",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="">
                                    No catalogued product
                                  </option>
                                  {proposals.products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.product_name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          )}
                          <div className="technical-review-item-documents">
                            <p>Documents for this item</p>
                            {!attachments.length && (
                              <p className="technical-review-help">
                                No request documents available. Upload
                                supporting evidence above if required for this
                                review basis.
                              </p>
                            )}
                            {attachments.map((file) => (
                              <label
                                key={file.id}
                                className="mr-4 inline-block"
                              >
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
                                        ? [
                                            ...packet.evidence.attachment_ids,
                                            file.id,
                                          ]
                                        : packet.evidence.attachment_ids.filter(
                                            (id) =>
                                              String(id) !== String(file.id),
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
                </fieldset>
                <fieldset className="technical-review-form-section rounded border p-3">
                  <legend>
                    <span>3</span>Required departmental inspectors
                  </legend>
                  <p className="text-sm text-slate-600">
                    Include the requesting department. Every selected inspector
                    must submit an opinion. The SCM signatory cannot be one of
                    these inspectors.
                  </p>
                  <div className="technical-review-inspector-toolbar">
                    <label>
                      Find inspectors
                      <input
                        type="search"
                        value={reviewerSearch}
                        onChange={(event) =>
                          setReviewerSearch(event.target.value)
                        }
                        placeholder="Name, role, or department"
                      />
                    </label>
                    <p role="status">
                      {reviewerIds.length} selected · {visibleInspectors.length}{" "}
                      of {directory.length} shown
                    </p>
                    {reviewerSearch && (
                      <button
                        type="button"
                        onClick={() => setReviewerSearch("")}
                      >
                        Clear inspector search
                      </button>
                    )}
                  </div>
                  <div className="technical-review-inspector-list mt-2 grid gap-2 md:grid-cols-2">
                    {visibleInspectors.map((user) => (
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
                        <span>
                          {user.name} · {user.role} · {user.department_name}
                        </span>
                      </label>
                    ))}
                    {!visibleInspectors.length && (
                      <p className="technical-review-empty">
                        No inspectors match this search.
                      </p>
                    )}
                  </div>
                </fieldset>
                <fieldset className="technical-review-form-section">
                  <legend>
                    <span>4</span>Review instructions
                  </legend>
                  <label className="block">
                    Review instructions
                    <textarea
                      required
                      className={`${inputClass} block w-full`}
                      value={instructions}
                      onChange={(event) => setInstructions(event.target.value)}
                    />
                  </label>
                </fieldset>
              </div>
              <aside
                className="technical-review-draft"
                aria-label="Technical review draft summary"
              >
                <h3>Review at a glance</h3>
                <dl>
                  <div>
                    <dt>Approved request</dt>
                    <dd>
                      {selectedRequest
                        ? `#${selectedRequest.maintenance_ref_number || selectedRequest.id}`
                        : "Not selected"}
                    </dd>
                  </div>
                  <div>
                    <dt>Requesting department</dt>
                    <dd>
                      {selectedRequest?.department_name || "Not selected"}
                    </dd>
                  </div>
                  <div>
                    <dt>Items selected</dt>
                    <dd>
                      {selectedPackets.length} / {packets.length}
                    </dd>
                  </div>
                  <div>
                    <dt>Inspectors selected</dt>
                    <dd>{reviewerIds.length}</dd>
                  </div>
                </dl>
                <p>Every selected inspector must submit an opinion.</p>
                <p>
                  The SCM signatory cannot be one of the departmental
                  inspectors. Required opinions and SCM sign-off are needed for
                  clearance.
                </p>
              </aside>
            </div>
            <div className="technical-review-submit">
              <p>
                Send the selected item evidence and instructions to the required
                departmental inspectors.
              </p>
              <button
                disabled={
                  busy ||
                  !requestId ||
                  !reviewerIds.length ||
                  !packets.some((row) => row.selected)
                }
                className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-40"
              >
                {busy ? "Please wait…" : "Send technical review"}
              </button>
            </div>
          </form>
        </details>
      )}
      {!detail && (
        <section
          id="technical-review-register"
          className="technical-review-register rounded-xl border bg-white p-4"
        >
          <h2 className="font-semibold">
            {schema?.can_manage
              ? "Technical review register"
              : "My assigned technical reviews"}
          </h2>
          {!records.length && (
            <p className="mt-3 text-slate-600">No reviews found.</p>
          )}
          <p className="technical-review-help">
            {records.length} reviews shown. Open a record to review the item
            evidence, departmental opinions and sign-off.
          </p>
          <div
            className="technical-review-table-scroll mt-3 overflow-x-auto"
            role="region"
            aria-label="Technical review register table"
            tabIndex={0}
          >
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
                    <td>
                      <span className="technical-review-status">
                        {row.status?.replaceAll("_", " ") || "—"}
                      </span>
                    </td>
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
          {detail.item_packets.some((p) => p.awaiting_proposal) && (
            <p role="status" className="rounded bg-amber-50 p-3 text-amber-900">
              This required task was generated from the approved request.
              Procurement must prepare the proposed product and evidence before
              technical assessment.
            </p>
          )}
          {schema.workflow_available &&
            canSubmit &&
            assignment.status === "PENDING" && (
              <button
                disabled={busy}
                className="rounded border p-2"
                onClick={() =>
                  action(async () =>
                    adopt(
                      await api.startTechnicalReview(detail.id, {
                        row_version: detail.row_version,
                      }),
                      schema,
                    ),
                  )
                }
              >
                Start technical review
              </button>
            )}
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
                      {(
                        detail.item_packets[index].assessment_policy
                          ?.pre_checks || []
                      ).map((key) => (
                        <label key={key} className="block">
                          {label(key)}
                          <select
                            required
                            className={inputClass}
                            value={report.extra_assessment?.[key] || ""}
                            onChange={(e) =>
                              changeReport(index, "extra_assessment", {
                                ...report.extra_assessment,
                                [key]: e.target.value,
                              })
                            }
                          >
                            <option value="">Select assessment</option>
                            {(schema.extra_assessment_choices?.[key] || []).map(
                              (v) => (
                                <option key={v} value={v}>
                                  {label(v)}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      ))}
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
                      {schema.workflow_available && (
                        <>
                          <option value="CONDITIONAL">
                            Approve with conditions — blocks purchase until
                            resolved
                          </option>
                          <option value="CLARIFICATION">
                            Request clarification — blocks purchase
                          </option>
                        </>
                      )}
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
          {schema.workflow_available &&
            detail.can_manage &&
            detail.status === "IN_REVIEW" && (
              <details className="rounded border p-4">
                <summary>
                  Revise proposal / resolve conditions or clarification
                </summary>
                <p className="my-3 text-sm">
                  A revision starts a new opinion round for every reviewer.
                  Previous opinions and product evidence stay in immutable
                  history; this action does not grant clearance.
                </p>
                <label>
                  Revision reason
                  <textarea
                    className={`${inputClass} block w-full`}
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                  />
                </label>
                {revisionPackets.map((packet, index) => (
                  <fieldset
                    className="my-3 space-y-3 rounded border p-3"
                    key={packet.item_id}
                  >
                    <legend>
                      {detail.item_packets[index].snapshot.item_name}
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label>
                        Review basis
                        <select
                          className={inputClass}
                          value={packet.evidence.basis}
                          onChange={(e) =>
                            setRevisionPackets((old) =>
                              old.map((v, n) =>
                                n === index
                                  ? {
                                      ...v,
                                      evidence: {
                                        ...v.evidence,
                                        basis: e.target.value,
                                        ...(e.target.value === "sample"
                                          ? { no_sample_reason: "" }
                                          : {}),
                                      },
                                    }
                                  : v,
                              ),
                            )
                          }
                        >
                          <option value="sample">Physical sample</option>
                          <option value="data_sheet">Data sheet</option>
                          <option value="description">Description</option>
                        </select>
                      </label>
                      <label>
                        Review category
                        <select
                          className={inputClass}
                          value={packet.evidence.category}
                          onChange={(e) =>
                            setRevisionPackets((old) =>
                              old.map((v, n) =>
                                n === index
                                  ? {
                                      ...v,
                                      evidence: {
                                        ...v.evidence,
                                        category: e.target.value,
                                      },
                                    }
                                  : v,
                              ),
                            )
                          }
                        >
                          {schema.categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {packet.evidence.basis === "sample" && (
                      <label className="block">
                        Sample received date
                        <input
                          type="date"
                          className={inputClass}
                          value={packet.evidence.sample_received_date || ""}
                          onChange={(e) =>
                            setRevisionPackets((old) =>
                              old.map((v, n) =>
                                n === index
                                  ? {
                                      ...v,
                                      evidence: {
                                        ...v.evidence,
                                        sample_received_date: e.target.value,
                                      },
                                    }
                                  : v,
                              ),
                            )
                          }
                        />
                      </label>
                    )}
                    <label className="block">
                      Quotation under review (optional)
                      <select
                        className={inputClass}
                        value={packet.evidence.quotation_item_id || ""}
                        onChange={(e) =>
                          setRevisionPackets((old) =>
                            old.map((v, n) =>
                              n === index
                                ? {
                                    ...v,
                                    evidence: {
                                      ...v.evidence,
                                      quotation_item_id: e.target.value || null,
                                    },
                                  }
                                : v,
                            ),
                          )
                        }
                      >
                        <option value="">No quotation selected</option>
                        {(proposals.quotations || [])
                          .filter(
                            (q) =>
                              String(q.requested_item_id) ===
                              String(packet.item_id),
                          )
                          .map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.supplier_name} · {q.item_name} · quotation line{" "}
                              {q.id}
                            </option>
                          ))}
                      </select>
                    </label>
                    {["supplier_id", "approved_product_id"].map((k) => (
                      <label key={k} className="block">
                        {k === "supplier_id"
                          ? "Proposed supplier"
                          : "Proposed approved product (optional)"}
                        <select
                          className={inputClass}
                          value={packet.evidence[k] || ""}
                          onChange={(e) =>
                            setRevisionPackets((old) =>
                              old.map((v, n) =>
                                n === index
                                  ? {
                                      ...v,
                                      evidence: {
                                        ...v.evidence,
                                        [k]: e.target.value || null,
                                      },
                                    }
                                  : v,
                              ),
                            )
                          }
                        >
                          <option value="">
                            {k === "supplier_id"
                              ? "Requirements-only review"
                              : "No catalogued product"}
                          </option>
                          {(k === "supplier_id"
                            ? proposals.suppliers
                            : proposals.products
                          ).map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name || v.product_name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    {[
                      "manufacturer",
                      "model_number",
                      "evidence_description",
                      "no_sample_reason",
                    ].map((k) => (
                      <label key={k} className="block">
                        {label(k)}
                        <textarea
                          className={`${inputClass} block w-full`}
                          value={packet.evidence[k] || ""}
                          onChange={(e) =>
                            setRevisionPackets((old) =>
                              old.map((v, n) =>
                                n === index
                                  ? {
                                      ...v,
                                      evidence: {
                                        ...v.evidence,
                                        [k]: e.target.value,
                                      },
                                    }
                                  : v,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                    <p>Supporting documents</p>
                    {revisionFiles.map((f) => (
                      <label key={f.id} className="mr-3 inline-block">
                        <input
                          type="checkbox"
                          checked={(packet.evidence.attachment_ids || [])
                            .map(String)
                            .includes(String(f.id))}
                          onChange={(e) =>
                            setRevisionPackets((old) =>
                              old.map((v, n) =>
                                n === index
                                  ? {
                                      ...v,
                                      evidence: {
                                        ...v.evidence,
                                        attachment_ids: e.target.checked
                                          ? [
                                              ...(v.evidence.attachment_ids ||
                                                []),
                                              f.id,
                                            ]
                                          : (
                                              v.evidence.attachment_ids || []
                                            ).filter(
                                              (id) =>
                                                String(id) !== String(f.id),
                                            ),
                                      },
                                    }
                                  : v,
                              ),
                            )
                          }
                        />{" "}
                        {f.file_name}
                      </label>
                    ))}
                  </fieldset>
                ))}
                <label className="block">
                  Upload revised evidence
                  <input
                    type="file"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        action(async () => {
                          await api.uploadReviewEvidence(
                            detail.request_id,
                            file,
                          );
                          setRevisionFiles(
                            await api.requestEvidence(detail.request_id),
                          );
                        });
                    }}
                  />
                </label>
                <button
                  disabled={busy || !revisionNotes.trim()}
                  className="mt-3 rounded border p-2"
                  onClick={() =>
                    action(async () => {
                      adopt(
                        await api.reviseTechnicalReview(detail.id, {
                          row_version: detail.row_version,
                          notes: revisionNotes,
                          items: revisionPackets,
                        }),
                        schema,
                      );
                      setSuccess(
                        "New review round started. Previous attestations remain in history.",
                      );
                    })
                  }
                >
                  Save revised proposal and request new opinions
                </button>
              </details>
            )}
          {detail.history?.length > 0 && (
            <details className="rounded border p-4">
              <summary>Decision and proposal history</summary>
              {detail.history.map((h) => (
                <article key={h.id} className="my-3 border-b p-2">
                  <p>
                    {label(h.action)} ·{" "}
                    {new Date(h.created_at).toLocaleString()}
                  </p>
                  <p>{h.payload.notes}</p>
                  {h.payload.assignment?.reports?.map((r) => (
                    <p key={r.item_id}>
                      {r.decision}: {r.findings}
                    </p>
                  ))}
                </article>
              ))}
            </details>
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
        <details
          id="technical-review-policy"
          className="technical-review-policy rounded border bg-white p-4"
        >
          <summary className="cursor-pointer font-semibold">
            Technical review requirement
          </summary>
          <div className="technical-review-policy-layout">
            <div>
              <p className="technical-review-help mt-2 text-sm">
                Selected requests always require clearance once sent for review.
                Requiring it for all approved requests applies to future
                procurement commands, including existing approved requests.
              </p>
              <label className="technical-review-policy-toggle mt-3 block">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={policy.require_for_all}
                  onChange={(event) =>
                    setPolicy({
                      ...policy,
                      require_for_all: event.target.checked,
                    })
                  }
                />{" "}
                Require clearance for every approved request
              </label>
              <label className="technical-review-policy-reason">
                Reason for changing the requirement
                <textarea
                  aria-label="Technical review policy reason"
                  disabled={busy}
                  className={`${inputClass} my-3 w-full`}
                  placeholder="Reason for changing the requirement"
                  value={policyReason}
                  onChange={(event) => setPolicyReason(event.target.value)}
                />
              </label>
              <p className="technical-review-help">
                Explain the change. This reason is recorded with the policy
                update.
              </p>
            </div>
            <aside
              className="technical-review-policy-preview"
              aria-label="Draft review requirement"
            >
              <h3>Draft coverage</h3>
              <strong>
                {policy.require_for_all
                  ? "All approved requests"
                  : "Selected requests only"}
              </strong>
              <p>
                {policy.require_for_all
                  ? "Saving this setting requires technical clearance for every approved request, including those already approved."
                  : "Selected requests still require clearance once sent for review."}
              </p>
              <p>Changes apply only after saving with a reason.</p>
            </aside>
          </div>
          <div className="technical-review-submit">
            <p>
              Review the coverage and provide an audit reason before saving.
            </p>
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
              {busy ? "Please wait…" : "Save review requirement"}
            </button>
          </div>
        </details>
      )}
    </main>
  );
}
