import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { saveAs } from "file-saver";
import * as api from "../api/surgicalConsignments";
const css = "rounded border border-slate-300 bg-white p-2 text-sm";
const key = () =>
  window.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(
    new Date(),
  );
const label = (v) =>
  String(v || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
const requestedLine = () => ({
  item_name: "",
  quantity: 1,
  catalogue_code: "",
  functional_specs: "",
});
const receiptLine = () => ({
  requested_item_index: "0",
  item_name: "",
  catalogue_code: "",
  batch_number: "",
  serial_number: "",
  expiry_date: "",
  delivered_quantity: 1,
  unit_price: "0",
  sterile_intact: false,
  inspection_notes: "",
});
const initial = () => ({
  department_id: "",
  surgery_date: "",
  patient_mrn: "",
  procedure_type: "",
  surgeon_id: "",
  nurse_id: "",
  receiver_id: "",
  supplier_id: "",
  vendor_contact: "",
  agreement_reference: "",
  currency: "IQD",
  manager_id: "",
  cmo_id: "",
  scm_id: "",
  requested_items: [requestedLine()],
  justification: [],
  other_justification: "",
  submission_key: key(),
});
const money = (v) => String(v ?? "0.00");
export default function SurgicalConsignmentsPage() {
  const [params, setParams] = useSearchParams(),
    opened = useRef(null);
  const [meta, setMeta] = useState(null),
    [directory, setDirectory] = useState({
      departments: [],
      users: [],
      suppliers: [],
      reasons: [],
    }),
    [rows, setRows] = useState([]),
    [detail, setDetail] = useState(null),
    [form, setForm] = useState(initial),
    [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [notes, setNotes] = useState(""),
    [filePurpose, setFilePurpose] = useState("AGREEMENT");
  const [evidence, setEvidence] = useState(""),
    [receipt, setReceipt] = useState({
      received_date: today(),
      location: "",
      delivery_reference: "",
      vendor_representative: "",
      vendor_contact: "",
      lines: [receiptLine()],
    }),
    [ownership, setOwnership] = useState(false),
    [receiptTerms, setReceiptTerms] = useState(false);
  const [procedureOutcome, setProcedureOutcome] = useState("PERFORMED");
  const [usage, setUsage] = useState([]),
    [performedDate, setPerformedDate] = useState(today()),
    [returned, setReturned] = useState({
      receipt_line_id: "",
      kind: "INTACT",
      quantity: 1,
      returned_date: today(),
      vendor_representative: "",
    });
  const [waiverLine, setWaiverLine] = useState(""),
    [waiverAgreed, setWaiverAgreed] = useState(false),
    [disposalAgreed, setDisposalAgreed] = useState(false),
    [attest, setAttest] = useState({
      confirm_quantities: false,
      vendor_informed: false,
      acknowledge_used_billing: false,
    });
  const [pos, setPos] = useState([]),
    [poId, setPoId] = useState(""),
    [mappings, setMappings] = useState({});
  const adopt = useCallback((c) => {
    opened.current = String(c.id);
    setDetail(c);
    setNotes("");
    setEvidence("");
    setOwnership(false);
    setReceiptTerms(false);
    setWaiverAgreed(false);
    setDisposalAgreed(false);
    setAttest({
      confirm_quantities: false,
      vendor_informed: false,
      acknowledge_used_billing: false,
    });
    setPerformedDate(c.procedure_event_date || today());
    setProcedureOutcome(c.procedure_outcome || "PERFORMED");
    setUsage(
      (c.lines || []).map((l) => {
        const old = c.usage?.find(
          (u) => String(u.receipt_line_id) === String(l.id),
        );
        return {
          receipt_line_id: String(l.id),
          used_quantity: old?.used_quantity ?? 0,
          damaged_quantity: old?.damaged_quantity ?? 0,
          missing_quantity: old?.missing_quantity ?? 0,
          notes: old?.notes || "Quantities as recorded",
        };
      }),
    );
  }, []);
  useEffect(() => {
    if (params.get("case") === opened.current && opened.current) return;
    let active = true;
    (async () => {
      try {
        const m = await api.schema();
        if (!active) return;
        setMeta(m);
        setRows(await api.list(""));
        if (m.can_create) {
          const options = await api.options();
          if (active) setDirectory(options);
        }
        if (params.get("case")) {
          const c = await api.get(params.get("case"));
          if (active) adopt(c);
        }
      } catch (e) {
        if (active)
          setError(
            e.response?.data?.message ||
              "Unable to load surgical consignments.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [adopt, params]);
  const perform = async (work) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await work();
    } catch (e) {
      setError(
        e.response?.data?.message || "Unable to save this consignment action.",
      );
    } finally {
      setBusy(false);
    }
  };
  const action = (operation, fields = {}) =>
    perform(async () => {
      adopt(
        await api.action(detail.id, operation, {
          row_version: detail.row_version,
          notes,
          ...fields,
        }),
      );
      setRows(await api.list(search));
      setSuccess("Consignment record updated.");
    });
  const change = (field, value) =>
    setForm((old) => ({ ...old, [field]: value }));
  const fileChoices = (purpose) =>
    (detail?.files || [])
      .filter((f) => f.purpose === purpose)
      .map((f) => (
        <option key={f.id} value={f.id}>
          {f.file_name}
        </option>
      ));
  const role = String(meta?.current_user_id || detail?.current_user_id || "");
  const currentApproval = detail?.approvals?.find(
    (a) => a.status === "PENDING",
  );
  const ready =
    detail?.balance?.length === detail?.lines?.length &&
    detail?.balance?.length > 0 &&
    detail.balance.every((l) => !l.remaining_intact && !l.unresolved_exception);
  const bill = (detail?.usage_snapshot?.lines || detail?.balance || []).filter(
    (l) => Number(l.billable_quantity) > 0,
  );
  const selectedPo = pos.find((p) => String(p.id) === poId);
  if (loading)
    return <main className="p-6">Loading surgical consignments…</main>;
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <style>{`@media print {body *{visibility:hidden} #surgical-forms,#surgical-forms *{visibility:visible} #surgical-forms{position:absolute;top:0;left:0;width:100%} #surgical-forms button,#surgical-forms .no-print{display:none} #surgical-forms article{break-inside:avoid}}`}</style>
      <header className="rounded-xl bg-slate-900 p-6 text-white">
        <p className="text-sm text-cyan-200">Procedure-specific vendor stock</p>
        <h1 className="text-3xl font-bold">Surgical consignment requests</h1>
        <p className="mt-2">
          Authorize procedure-specific vendor stock, trace every lot, confirm
          what was used and return the rest. Temporary delivery creates no owned
          stock or invoice.
        </p>
      </header>
      <section
        className="rounded-xl border border-slate-200 bg-white p-4"
        aria-label="Consignment workflow"
      >
        <h2 className="font-semibold">
          One case from surgical need to used-only billing
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Request item families and size ranges → authorize the arrangement →
          record vendor delivery → confirm actual usage → return and reconcile
          unused items → bill confirmed usage.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Exact implant sizes are recorded at delivery and usage. Supporting
          forms document the case; delivery does not mean purchase, and custody
          closure does not mean payment.
        </p>
      </section>
      {error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-red-800"
        >
          {error}
          {detail && (
            <button
              disabled={busy}
              className="ml-3 underline"
              onClick={() =>
                perform(async () => {
                  adopt(await api.get(detail.id));
                })
              }
            >
              Reload latest consignment
            </button>
          )}
        </div>
      )}
      {success && (
        <p role="status" className="text-green-700">
          {success}
        </p>
      )}
      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          perform(async () => setRows(await api.list(search)));
        }}
      >
        <input
          aria-label="Search surgical consignments"
          className={css}
          placeholder="Case, authorization, vendor or catalogue / lot"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button disabled={busy} className="rounded border px-3">
          Search
        </button>
      </form>
      {meta?.can_create && (
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            New surgical consignment request
          </summary>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              perform(async () => {
                const c = await api.create(form);
                adopt(c);
                setParams({ case: c.id });
                setForm(initial());
                setRows(await api.list(search));
                setSuccess(
                  "Consignment submitted for department manager authorization.",
                );
              });
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                Surgical department
                <select
                  required
                  className={`${css} block w-full`}
                  value={form.department_id}
                  onChange={(e) => change("department_id", e.target.value)}
                >
                  <option value="">Choose department</option>
                  {directory.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              {[
                "surgery_date",
                "patient_mrn",
                "procedure_type",
                "vendor_contact",
                "agreement_reference",
                "currency",
              ].map((field) => (
                <label key={field}>
                  {
                    {
                      surgery_date: "Expected surgery date",
                      patient_mrn: "Patient MRN",
                      procedure_type: "Procedure type",
                      vendor_contact: "Vendor contact",
                      agreement_reference:
                        "Vendor agreement / price-list reference",
                      currency: "Currency",
                    }[field]
                  }
                  <input
                    required
                    type={field === "surgery_date" ? "date" : "text"}
                    autoComplete="off"
                    className={`${css} block w-full`}
                    value={form[field]}
                    onChange={(e) => change(field, e.target.value)}
                  />
                </label>
              ))}
              <label>
                Vendor
                <select
                  required
                  className={`${css} block w-full`}
                  value={form.supplier_id}
                  onChange={(e) => change("supplier_id", e.target.value)}
                >
                  <option value="">Choose company</option>
                  {directory.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {[
                "surgeon_id",
                "nurse_id",
                "receiver_id",
                "manager_id",
                "cmo_id",
                "scm_id",
              ].map((field) => (
                <label key={field}>
                  {
                    {
                      surgeon_id: "Assigned surgeon",
                      nurse_id: "Assigned nurse",
                      receiver_id: "Assigned hospital receiver",
                      manager_id: "Surgical department manager",
                      cmo_id: "CMO authorizer",
                      scm_id: "SCM authorizer",
                    }[field]
                  }
                  <select
                    required
                    className={`${css} block w-full`}
                    value={form[field]}
                    onChange={(e) => change(field, e.target.value)}
                  >
                    <option value="">Choose staff account</option>
                    {directory.users
                      .filter((u) => {
                        if (
                          ["manager_id", "cmo_id", "scm_id"].includes(field) &&
                          String(u.id) === role
                        )
                          return false;
                        if (field === "manager_id")
                          return (
                            u.is_department_manager &&
                            String(u.department_id) === form.department_id
                          );
                        if (field === "cmo_id")
                          return String(u.role).toLowerCase() === "cmo";
                        if (field === "scm_id")
                          return String(u.role).toLowerCase() === "scm";
                        return true;
                      })
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} · {u.role}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
            <fieldset className="rounded border p-3">
              <legend>Request justification</legend>
              {directory.reasons.map((reason) => (
                <label key={reason} className="mr-4 inline-block">
                  <input
                    type="checkbox"
                    checked={form.justification.includes(reason)}
                    onChange={(e) =>
                      change(
                        "justification",
                        e.target.checked
                          ? [...form.justification, reason]
                          : form.justification.filter((r) => r !== reason),
                      )
                    }
                  />{" "}
                  {label(reason)}
                </label>
              ))}
              {form.justification.includes("OTHER") && (
                <input
                  aria-label="Other justification"
                  required
                  className={`${css} mt-2 block w-full`}
                  value={form.other_justification}
                  onChange={(e) =>
                    change("other_justification", e.target.value)
                  }
                />
              )}
            </fieldset>
            <fieldset className="space-y-3 rounded border p-3">
              <legend>Requested item families / size ranges</legend>
              <p className="text-sm text-slate-600">
                Request the required range or set now. Exact sizes, quantities
                and lots are recorded when the company delivers; only confirmed
                use is billed.
              </p>
              {form.requested_items.map((line, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-4">
                  {Object.keys(line).map((field) => (
                    <label key={field}>
                      {label(field)}
                      <input
                        aria-label={`Requested ${field} ${index + 1}`}
                        required
                        type={field === "quantity" ? "number" : "text"}
                        min={field === "quantity" ? 1 : undefined}
                        className={`${css} block w-full`}
                        value={line[field]}
                        onChange={(e) =>
                          change(
                            "requested_items",
                            form.requested_items.map((r, i) =>
                              i === index
                                ? { ...r, [field]: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              ))}
              <button
                type="button"
                className="text-blue-700 underline"
                onClick={() =>
                  change("requested_items", [
                    ...form.requested_items,
                    requestedLine(),
                  ])
                }
              >
                Add requested range
              </button>
            </fieldset>
            <button
              disabled={busy}
              className="rounded bg-indigo-700 px-4 py-2 text-white"
            >
              Submit request for authorization
            </button>
          </form>
        </details>
      )}
      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">
          Consignment queue · {rows.length} shown
        </h2>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-left">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Department</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-3">SC-{c.id}</td>
                  <td>{c.department_name}</td>
                  <td>{c.supplier_name}</td>
                  <td>{label(c.status)}</td>
                  <td>
                    <button
                      disabled={busy}
                      className="text-blue-700 underline"
                      onClick={() =>
                        perform(async () => {
                          adopt(await api.get(c.id));
                          setParams({ case: c.id });
                        })
                      }
                    >
                      Open SC-{c.id}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {detail && (
        <section className="space-y-5 rounded-xl border bg-white p-5">
          <header>
            <h2 className="text-2xl font-bold">
              SC-{detail.id} · {detail.supplier_name}
            </h2>
            <p>
              {label(detail.status)} · Authorization{" "}
              {detail.authorization_code || "Pending"} · {detail.currency}
            </p>
            <button
              className="mt-2 rounded border px-3 py-2"
              onClick={() => window.print()}
            >
              Print records
            </button>
          </header>
          {detail.clinical_access && (
            <>
              <section className="space-y-3 rounded border bg-slate-50 p-4">
                <h3 className="font-semibold">Private supporting documents</h3>
                <p className="text-sm text-slate-600">
                  Upload the vendor agreement, signed temporary receipt, return
                  acknowledgment and any waiver. These clinical files require
                  case authorization to download.
                </p>
                <label>
                  Document purpose
                  <select
                    aria-label="Consignment document purpose"
                    className={`${css} ml-3`}
                    value={filePurpose}
                    onChange={(e) => setFilePurpose(e.target.value)}
                  >
                    {meta.file_purposes.map((p) => (
                      <option key={p} value={p}>
                        {label(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  aria-label="Upload private consignment document"
                  type="file"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      perform(async () => {
                        setDetail(
                          await api.upload(detail.id, file, filePurpose),
                        );
                        setSuccess("Private document attached.");
                      });
                  }}
                />
                {detail.files.map((f) => (
                  <p key={f.id}>
                    <button
                      className="text-blue-700 underline"
                      onClick={() =>
                        perform(async () =>
                          saveAs(
                            await api.download(detail.id, f.id),
                            f.file_name,
                          ),
                        )
                      }
                    >
                      {f.file_name}
                    </button>{" "}
                    · {label(f.purpose)} · {f.uploaded_by_name}
                  </p>
                ))}
              </section>
              <label className="block">
                Action notes
                <textarea
                  aria-label="Consignment action notes"
                  className={`${css} block w-full`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              {detail.status === "AWAITING_AUTHORIZATION" &&
                String(currentApproval?.approver_id) ===
                  String(detail.current_user_id) && (
                  <section className="space-y-3 rounded border border-indigo-200 p-4">
                    <h3 className="font-semibold">
                      {label(currentApproval.role)} authorization
                    </h3>
                    {currentApproval.role === "SCM" && (
                      <>
                        <label>
                          <input
                            type="checkbox"
                            checked={ownership}
                            onChange={(e) => setOwnership(e.target.checked)}
                          />{" "}
                          I acknowledge vendor ownership, agreed terms and
                          billing only for confirmed usage.
                        </label>
                        <label className="block">
                          Vendor agreement evidence
                          <select
                            aria-label="Agreement evidence"
                            className={`${css} ml-3`}
                            value={evidence}
                            onChange={(e) => setEvidence(e.target.value)}
                          >
                            <option value="">Choose agreement</option>
                            {fileChoices("AGREEMENT")}
                          </select>
                        </label>
                      </>
                    )}
                    {["APPROVED", "REJECTED"].map((decision) => (
                      <button
                        key={decision}
                        disabled={
                          busy ||
                          !notes.trim() ||
                          (decision === "APPROVED" &&
                            currentApproval.role === "SCM" &&
                            (!ownership || !evidence))
                        }
                        className="mr-3 rounded border px-3 py-2 disabled:opacity-40"
                        onClick={() =>
                          action("approve", {
                            decision,
                            acknowledge_vendor_ownership: ownership,
                            agreement_file_id: evidence,
                          })
                        }
                      >
                        {decision === "APPROVED"
                          ? "Approve consignment authorization"
                          : "Reject consignment request"}
                      </button>
                    ))}
                  </section>
                )}
              {String(detail.receiver_id) === String(detail.current_user_id) &&
                ["AUTHORIZED", "RECEIVED"].includes(detail.status) && (
                  <details className="rounded border p-4">
                    <summary className="cursor-pointer font-semibold">
                      Record temporary vendor delivery
                    </summary>
                    <form
                      className="mt-3 space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        action("receipt", {
                          ...receipt,
                          evidence_file_id: evidence,
                          vendor_ownership_acknowledged: ownership,
                          terms_acknowledged: receiptTerms,
                        });
                      }}
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        {[
                          "received_date",
                          "location",
                          "delivery_reference",
                          "vendor_representative",
                          "vendor_contact",
                        ].map((field) => (
                          <label key={field}>
                            {label(field)}
                            <input
                              aria-label={`Receipt ${field}`}
                              required
                              type={field === "received_date" ? "date" : "text"}
                              className={`${css} block w-full`}
                              value={receipt[field]}
                              onChange={(e) =>
                                setReceipt({
                                  ...receipt,
                                  [field]: e.target.value,
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <label className="block">
                        Signed vendor receipt evidence
                        <select
                          required
                          className={`${css} ml-3`}
                          value={evidence}
                          onChange={(e) => setEvidence(e.target.value)}
                        >
                          <option value="">
                            Choose signed delivery document
                          </option>
                          {fileChoices("RECEIPT")}
                        </select>
                      </label>
                      {receipt.lines.map((line, index) => (
                        <fieldset key={index} className="rounded border p-3">
                          <legend>Delivered lot {index + 1}</legend>
                          <label>
                            Authorized family
                            <select
                              aria-label={`Receipt family ${index + 1}`}
                              required
                              className={`${css} ml-3`}
                              value={line.requested_item_index}
                              onChange={(e) =>
                                setReceipt({
                                  ...receipt,
                                  lines: receipt.lines.map((r, i) =>
                                    i === index
                                      ? {
                                          ...r,
                                          requested_item_index: e.target.value,
                                        }
                                      : r,
                                  ),
                                })
                              }
                            >
                              {detail.requested_items.map((item, i) => (
                                <option key={i} value={i}>
                                  {item.item_name} · {item.catalogue_code}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="mt-2 grid gap-2 md:grid-cols-3">
                            {[
                              "item_name",
                              "catalogue_code",
                              "batch_number",
                              "serial_number",
                              "expiry_date",
                              "delivered_quantity",
                              "unit_price",
                              "inspection_notes",
                            ].map((field) => (
                              <label key={field}>
                                {label(field)}
                                <input
                                  required={field !== "serial_number"}
                                  aria-label={`Receipt ${field} ${index + 1}`}
                                  type={
                                    field === "expiry_date"
                                      ? "date"
                                      : [
                                            "delivered_quantity",
                                            "unit_price",
                                          ].includes(field)
                                        ? "number"
                                        : "text"
                                  }
                                  min={
                                    field === "delivered_quantity"
                                      ? 1
                                      : field === "unit_price"
                                        ? 0
                                        : undefined
                                  }
                                  step={
                                    field === "unit_price"
                                      ? "0.0001"
                                      : undefined
                                  }
                                  className={`${css} block w-full`}
                                  value={line[field]}
                                  onChange={(e) =>
                                    setReceipt({
                                      ...receipt,
                                      lines: receipt.lines.map((r, i) =>
                                        i === index
                                          ? { ...r, [field]: e.target.value }
                                          : r,
                                      ),
                                    })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                          <label>
                            <input
                              type="checkbox"
                              checked={line.sterile_intact}
                              onChange={(e) =>
                                setReceipt({
                                  ...receipt,
                                  lines: receipt.lines.map((r, i) =>
                                    i === index
                                      ? {
                                          ...r,
                                          sterile_intact: e.target.checked,
                                        }
                                      : r,
                                  ),
                                })
                              }
                            />{" "}
                            Packaging and sterile barrier intact
                          </label>
                        </fieldset>
                      ))}
                      <button
                        type="button"
                        className="text-blue-700 underline"
                        onClick={() =>
                          setReceipt({
                            ...receipt,
                            lines: [...receipt.lines, receiptLine()],
                          })
                        }
                      >
                        Add delivered lot / size
                      </button>
                      <label className="block">
                        <input
                          type="checkbox"
                          required
                          checked={ownership}
                          onChange={(e) => setOwnership(e.target.checked)}
                        />{" "}
                        Items remain vendor-owned until confirmed use.
                      </label>
                      <label className="block">
                        <input
                          type="checkbox"
                          required
                          checked={receiptTerms}
                          onChange={(e) => setReceiptTerms(e.target.checked)}
                        />{" "}
                        Signed vendor terms and counts checked; damaged or
                        missing items require separate resolution.
                      </label>
                      <button
                        disabled={busy || !notes.trim()}
                        className="rounded border px-3 py-2 disabled:opacity-40"
                      >
                        Save temporary receipt
                      </button>
                    </form>
                  </details>
                )}
              {detail.can_scm &&
                ["AUTHORIZED", "RECEIVED"].includes(detail.status) &&
                detail.receipts
                  .filter((r) => !r.confirmed_at)
                  .map((r) => (
                    <section className="rounded border p-3" key={r.id}>
                      <p>
                        F19-{r.id} · {r.delivery_reference} · {r.received_date}{" "}
                        · {r.vendor_representative}
                      </p>
                      <button
                        disabled={busy || !notes.trim()}
                        className="mt-2 rounded border px-3 py-2 disabled:opacity-40"
                        onClick={() =>
                          action("confirm_receipt", { receipt_id: r.id })
                        }
                      >
                        SCM confirm temporary receipt #{r.id}
                      </button>
                    </section>
                  ))}
              {String(detail.nurse_id) === String(detail.current_user_id) &&
                ["RECEIVED", "RECONCILING"].includes(detail.status) && (
                  <form
                    className="space-y-3 rounded border p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      action("save_usage", {
                        procedure_event_date: performedDate,
                        procedure_outcome: procedureOutcome,
                        lines: usage,
                      });
                    }}
                  >
                    <h3 className="font-semibold">
                      Prepare post-operation usage and discrepancies
                    </h3>
                    <p className="text-sm text-slate-600">
                      Record used units and any opened/damaged unused or missing
                      units for every lot. Unused intact units will be returned
                      separately. This draft is not yet a billable confirmation.
                    </p>
                    <label>
                      Actual surgery / cancellation date
                      <input
                        required
                        aria-label="Actual surgery / cancellation date"
                        type="date"
                        className={`${css} ml-3`}
                        value={performedDate}
                        onChange={(e) => setPerformedDate(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      Procedure outcome
                      <select
                        aria-label="Procedure outcome"
                        className={`${css} ml-3`}
                        value={procedureOutcome}
                        onChange={(e) => setProcedureOutcome(e.target.value)}
                      >
                        <option value="PERFORMED">Performed</option>
                        <option value="CANCELLED">
                          Cancelled — return unused stock
                        </option>
                        <option value="POSTPONED">
                          Postponed — return / reconcile this delivery
                        </option>
                      </select>
                    </label>
                    {usage.map((row, index) => {
                      const line = detail.lines[index];
                      return (
                        <fieldset
                          key={row.receipt_line_id}
                          className="rounded border p-3"
                        >
                          <legend>
                            {line.item_name} · {line.catalogue_code} ·{" "}
                            {line.batch_number} · Delivered{" "}
                            {line.delivered_quantity} ·{" "}
                            {line.accepted ? "Accepted" : "QUARANTINED"}
                          </legend>
                          <div className="grid gap-2 md:grid-cols-4">
                            {[
                              "used_quantity",
                              "damaged_quantity",
                              "missing_quantity",
                              "notes",
                            ].map((field) => (
                              <label key={field}>
                                {label(field)}
                                <input
                                  aria-label={`Usage ${field} ${row.receipt_line_id}`}
                                  required
                                  type={field === "notes" ? "text" : "number"}
                                  min={field === "notes" ? undefined : 0}
                                  className={`${css} block w-full`}
                                  value={row[field]}
                                  onChange={(e) =>
                                    setUsage((old) =>
                                      old.map((r, i) =>
                                        i === index
                                          ? { ...r, [field]: e.target.value }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      );
                    })}
                    <button
                      disabled={busy || !notes.trim()}
                      className="rounded border px-3 py-2 disabled:opacity-40"
                    >
                      Save usage draft
                    </button>
                  </form>
                )}
              {detail.status === "RECONCILING" &&
                String(detail.receiver_id) ===
                  String(detail.current_user_id) && (
                  <form
                    className="space-y-3 rounded border p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      action("return", {
                        ...returned,
                        evidence_file_id: evidence,
                      });
                    }}
                  >
                    <h3 className="font-semibold">
                      Return unused consignment stock
                    </h3>
                    <label>
                      Delivered lot
                      <select
                        required
                        className={`${css} ml-3`}
                        value={returned.receipt_line_id}
                        onChange={(e) =>
                          setReturned({
                            ...returned,
                            receipt_line_id: e.target.value,
                          })
                        }
                      >
                        <option value="">Choose lot</option>
                        {detail.lines.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.item_name} · {l.catalogue_code} ·{" "}
                            {l.batch_number}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Return condition
                      <select
                        className={`${css} ml-3`}
                        value={returned.kind}
                        onChange={(e) =>
                          setReturned({ ...returned, kind: e.target.value })
                        }
                      >
                        <option value="INTACT">Intact unused</option>
                        <option value="DAMAGED">Damaged / opened unused</option>
                      </select>
                    </label>
                    <div className="grid gap-2 md:grid-cols-3">
                      {[
                        "quantity",
                        "returned_date",
                        "vendor_representative",
                      ].map((field) => (
                        <label key={field}>
                          {label(field)}
                          <input
                            required
                            type={
                              field === "returned_date"
                                ? "date"
                                : field === "quantity"
                                  ? "number"
                                  : "text"
                            }
                            min={field === "quantity" ? 1 : undefined}
                            className={`${css} block w-full`}
                            value={returned[field]}
                            onChange={(e) =>
                              setReturned({
                                ...returned,
                                [field]: e.target.value,
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label>
                      Signed return acknowledgment
                      <select
                        required
                        className={`${css} ml-3`}
                        value={evidence}
                        onChange={(e) => setEvidence(e.target.value)}
                      >
                        <option value="">Choose return evidence</option>
                        {fileChoices("RETURN")}
                      </select>
                    </label>
                    <button
                      disabled={busy || !notes.trim()}
                      className="rounded border px-3 py-2 disabled:opacity-40"
                    >
                      Record vendor-acknowledged return
                    </button>
                  </form>
                )}
              {detail.can_scm &&
                detail.status === "RECONCILING" &&
                detail.balance.some(
                  (l) => l.damaged_quantity || l.missing_quantity,
                ) && (
                  <section className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4">
                    <h3 className="font-semibold">
                      Damaged / missing-item liability resolution
                    </h3>
                    <p>
                      Charges are not silently included in the used-items bill.
                      Keep disputed claims open until resolved. Use this action
                      only for a documented vendor no-charge settlement.
                    </p>
                    <label>
                      Exception lot
                      <select
                        className={`${css} ml-3`}
                        value={waiverLine}
                        onChange={(e) => setWaiverLine(e.target.value)}
                      >
                        <option value="">Choose exception</option>
                        {detail.balance
                          .filter(
                            (l) => l.damaged_quantity || l.missing_quantity,
                          )
                          .map((l) => (
                            <option
                              key={l.receipt_line_id}
                              value={l.receipt_line_id}
                            >
                              {l.item_name} · Damaged {l.damaged_quantity} ·
                              Missing {l.missing_quantity}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block">
                      Vendor waiver evidence
                      <select
                        className={`${css} ml-3`}
                        value={evidence}
                        onChange={(e) => setEvidence(e.target.value)}
                      >
                        <option value="">Choose written waiver</option>
                        {fileChoices("WAIVER")}
                      </select>
                    </label>
                    <label className="block">
                      <input
                        type="checkbox"
                        checked={waiverAgreed}
                        onChange={(e) => setWaiverAgreed(e.target.checked)}
                      />{" "}
                      Vendor confirms no charge for the documented
                      damaged/missing units.
                    </label>
                    <label className="block">
                      <input
                        type="checkbox"
                        checked={disposalAgreed}
                        onChange={(e) => setDisposalAgreed(e.target.checked)}
                      />{" "}
                      Vendor authorizes disposal of any damaged units not
                      physically returned.
                    </label>
                    <button
                      disabled={
                        busy ||
                        !notes.trim() ||
                        !waiverLine ||
                        !evidence ||
                        !waiverAgreed
                      }
                      className="rounded border px-3 py-2 disabled:opacity-40"
                      onClick={() =>
                        action("waiver", {
                          receipt_line_id: waiverLine,
                          evidence_file_id: evidence,
                          vendor_no_charge: waiverAgreed,
                          vendor_disposal_authorized: disposalAgreed,
                        })
                      }
                    >
                      Record SCM no-charge resolution
                    </button>
                  </section>
                )}
              {((detail.status === "RECONCILING" &&
                String(detail.nurse_id) === String(detail.current_user_id)) ||
                (detail.status === "USAGE_REVIEW" &&
                  [detail.surgeon_id, detail.receiver_id]
                    .map(String)
                    .includes(String(detail.current_user_id)))) && (
                <section className="space-y-3 rounded border border-indigo-200 p-4">
                  <h3 className="font-semibold">
                    Confirm final usage and returns
                  </h3>
                  <p>
                    {ready
                      ? "All quantities are reconciled."
                      : "Unused returns or exceptions remain outstanding."}{" "}
                    Once the nurse signs, the usage/return snapshot is frozen
                    for the surgeon and receiver.
                  </p>
                  {[
                    "confirm_quantities",
                    "vendor_informed",
                    "acknowledge_used_billing",
                  ].map((field) => (
                    <label className="block" key={field}>
                      <input
                        type="checkbox"
                        checked={attest[field]}
                        onChange={(e) =>
                          setAttest({ ...attest, [field]: e.target.checked })
                        }
                      />{" "}
                      {
                        {
                          confirm_quantities:
                            "I confirm the used, returned and discrepancy quantities shown in the usage record.",
                          vendor_informed:
                            "The vendor has been informed of usage and return status.",
                          acknowledge_used_billing:
                            "I understand only confirmed used quantities enter the normal bill; exceptions require separate resolution.",
                        }[field]
                      }
                    </label>
                  ))}
                  <button
                    disabled={
                      busy ||
                      !notes.trim() ||
                      !Object.values(attest).every(Boolean) ||
                      (detail.status === "RECONCILING" && !ready)
                    }
                    className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-40"
                    onClick={() => action("attest", attest)}
                  >
                    Sign final usage record
                  </button>
                </section>
              )}
              {detail.can_scm && detail.status === "USAGE_CONFIRMED" && (
                <button
                  disabled={busy || !notes.trim()}
                  className="rounded border px-3 py-2 disabled:opacity-40"
                  onClick={() => action("release_billing")}
                >
                  SCM release confirmed used-items billing packet
                </button>
              )}
            </>
          )}
          <div id="surgical-forms" className="space-y-5">
            {detail.clinical_access && (
              <>
                <article className="rounded border p-4">
                  <h3 className="text-xl font-semibold">
                    DPP.SC.001.F18 · Surgical Consignment Request · SC-
                    {detail.id}
                  </h3>
                  <p>
                    Requester: {detail.requester_snapshot.name} ·{" "}
                    {detail.requester_snapshot.role} ·{" "}
                    {detail.requester_snapshot.phone_number ||
                      detail.requester_snapshot.email}
                  </p>
                  <p>
                    Expected surgery: {detail.surgery_date} · Patient MRN:{" "}
                    {detail.patient_mrn} · Procedure: {detail.procedure_type}
                  </p>
                  <p>
                    Surgeon: {detail.surgeon_name} · Nurse: {detail.nurse_name}{" "}
                    · Receiver: {detail.receiver_name}
                  </p>
                  <p>
                    Vendor: {detail.supplier_name} · {detail.vendor_contact} ·
                    Agreement: {detail.agreement_reference}
                  </p>
                  {detail.requested_items.map((l, i) => (
                    <p key={i}>
                      {l.item_name} · Qty / range {l.quantity} ·{" "}
                      {l.catalogue_code} · {l.functional_specs}
                    </p>
                  ))}
                  <p>
                    Justification: {detail.justification.map(label).join(", ")}{" "}
                    {detail.other_justification}
                  </p>
                  {detail.approvals.map((a) => (
                    <p key={a.step}>
                      {label(a.role)}: {a.signature?.name || a.name} ·{" "}
                      {a.status}{" "}
                      {a.decided_at && new Date(a.decided_at).toLocaleString()}{" "}
                      · {a.notes}
                    </p>
                  ))}
                  <p>Authorization: {detail.authorization_code || "Pending"}</p>
                </article>
                <article className="rounded border p-4">
                  <h3 className="text-xl font-semibold">
                    DPP.SC.001.F19 · Temporary Consignment Receipt
                  </h3>
                  <p>
                    Vendor-owned temporary custody. This delivery is not a
                    purchase or an owned-inventory receipt.
                  </p>
                  {detail.receipts.map((r) => (
                    <div key={r.id} className="my-3 border-t pt-3">
                      <p>
                        F19-{r.id} · {r.delivery_reference} · Received{" "}
                        {r.received_date} · {r.location}
                      </p>
                      <p>
                        Vendor representative (recorded acknowledgment):{" "}
                        {r.vendor_representative} · {r.vendor_contact}
                      </p>
                      <p>
                        Hospital receiver: {r.receiver_signature.name} · SCM:{" "}
                        {r.scm_signature?.name || "Confirmation pending"}
                      </p>
                      <table className="mt-2 w-full text-left text-sm">
                        <thead>
                          <tr>
                            <th>Item / code</th>
                            <th>Lot / serial</th>
                            <th>Expiry</th>
                            <th>Delivered</th>
                            <th>Rate</th>
                            <th>Inspection</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.lines
                            .filter(
                              (l) => String(l.receipt_id) === String(r.id),
                            )
                            .map((l) => (
                              <tr key={l.id}>
                                <td>
                                  {l.item_name} · {l.catalogue_code}
                                </td>
                                <td>
                                  {l.batch_number} · {l.serial_number}
                                </td>
                                <td>{l.expiry_date}</td>
                                <td>{l.delivered_quantity}</td>
                                <td>{money(l.unit_price)}</td>
                                <td>
                                  {l.accepted ? "Accepted" : "QUARANTINED"} ·{" "}
                                  {l.inspection_notes}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </article>
                <article className="rounded border p-4">
                  <h3 className="text-xl font-semibold">
                    DPP.SC.001.F20 · Usage Confirmation
                  </h3>
                  <p>
                    SC-{detail.id} ·{" "}
                    {detail.procedure_outcome || "Outcome pending"} · Procedure
                    event {detail.procedure_event_date || "Usage not recorded"}{" "}
                    · MRN {detail.patient_mrn} · {detail.procedure_type}
                  </p>
                  <p>
                    Vendor: {detail.supplier_name} · Surgeon:{" "}
                    {detail.surgeon_name}
                  </p>
                  {detail.reconciliation_error && (
                    <p className="text-red-700">
                      {detail.reconciliation_error}
                    </p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="mt-3 w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th>Item / catalogue / lot</th>
                          <th>Delivered</th>
                          <th>Used</th>
                          <th>Returned intact</th>
                          <th>Damaged</th>
                          <th>Returned damaged</th>
                          <th>Missing</th>
                          <th>Still intact on hand</th>
                          <th>Exception</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.usage_snapshot?.lines || detail.balance).map(
                          (l) => (
                            <tr key={l.receipt_line_id} className="border-t">
                              <td className="py-2">
                                {l.item_name} · {l.catalogue_code} ·{" "}
                                {l.batch_number}
                              </td>
                              <td>{l.delivered_quantity}</td>
                              <td>{l.used_quantity}</td>
                              <td>{l.returned_intact}</td>
                              <td>{l.damaged_quantity}</td>
                              <td>{l.returned_damaged}</td>
                              <td>{l.missing_quantity}</td>
                              <td>{l.remaining_intact}</td>
                              <td>
                                {l.unresolved_exception
                                  ? "UNRESOLVED"
                                  : "Accounted for"}
                                {l.disposed_quantity > 0
                                  ? ` · Disposed ${l.disposed_quantity}`
                                  : ""}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                  {detail.attestations.map((s) => (
                    <p key={s.role}>
                      {label(s.role)}: {s.signature.name} ({s.signature.role}) ·{" "}
                      {new Date(s.created_at).toLocaleString()} · {s.notes}
                    </p>
                  ))}
                </article>
              </>
            )}
            <article className="rounded border border-green-200 bg-green-50 p-4">
              <h3 className="text-xl font-semibold">
                Confirmed used-items billing packet
              </h3>
              <p>
                SC-{detail.id} · {detail.supplier_name} · {detail.currency}
              </p>
              <p>
                Amounts exclude tax; normal purchase approvals, invoice matching
                and finance/payment controls still apply.
              </p>
              {!["RECONCILED", "BILLING_LINKED", "CLOSED"].includes(
                detail.status,
              ) ? (
                <p>
                  Pending final clinical confirmation and SCM reconciliation. Do
                  not invoice this draft.
                </p>
              ) : (
                <>
                  <table className="my-3 w-full text-left">
                    <thead>
                      <tr>
                        <th>Required PO line description</th>
                        <th>Used quantity</th>
                        <th>Agreed unit price</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.map((l) => (
                        <tr key={l.receipt_line_id}>
                          <td>{l.billing_description}</td>
                          <td>{l.billable_quantity}</td>
                          <td>{money(l.unit_price)}</td>
                          <td>{money(l.line_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="font-semibold">
                    Confirmed used-items total:{" "}
                    {money(detail.usage_snapshot?.total || detail.amount)}{" "}
                    {detail.currency}
                  </p>
                  <p>No unused, damaged or missing quantities are included.</p>
                  {detail.billing_po_id && (
                    <Link
                      className="text-blue-700 underline no-print"
                      to={
                        detail.billing_request_id
                          ? `/requests/${detail.billing_request_id}/procure-to-pay`
                          : "/procure-to-pay/purchase-orders"
                      }
                    >
                      Linked to PO #{detail.billing_po_id} · View standard
                      procurement workflow
                    </Link>
                  )}
                </>
              )}
            </article>
          </div>
          {detail.clinical_access &&
            detail.can_scm &&
            detail.status === "RECONCILED" &&
            bill.length > 0 && (
              <section className="space-y-3 rounded border p-4">
                <h3 className="font-semibold">
                  Link a dedicated approved / issued used-items PO
                </h3>
                <p>
                  Use the billing packet above to create the normal purchase
                  request and obtain the standard PO approvals. The PO must
                  contain only these used lots, with exact descriptions,
                  quantities and rates, one-piece conversion and non-inventory
                  lines. Link it before recording normal goods receipts or
                  invoices.
                </p>
                <Link
                  className="text-blue-700 underline"
                  to="/requests/non-stock"
                >
                  Create the normal used-items purchase request
                </Link>
                <button
                  disabled={busy}
                  className="ml-3 rounded border px-3 py-2"
                  onClick={() =>
                    perform(async () =>
                      setPos(await api.purchaseOrders(detail.id)),
                    )
                  }
                >
                  Load eligible issued POs
                </button>
                <label className="block">
                  Issued PO
                  <select
                    aria-label="Issued consignment PO"
                    className={`${css} ml-3`}
                    value={poId}
                    onChange={(e) => {
                      setPoId(e.target.value);
                      setMappings({});
                    }}
                  >
                    <option value="">Choose issued company PO</option>
                    {pos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.po_number} · {p.currency}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedPo &&
                  bill.map((line) => (
                    <label className="block" key={line.receipt_line_id}>
                      {line.billing_description} · Used {line.billable_quantity}
                      <select
                        className={`${css} ml-3`}
                        value={mappings[line.receipt_line_id] || ""}
                        onChange={(e) =>
                          setMappings({
                            ...mappings,
                            [line.receipt_line_id]: e.target.value,
                          })
                        }
                      >
                        <option value="">Match PO line</option>
                        {selectedPo.lines.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.item_name} · Qty {p.quantity} · {p.unit_price}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                <button
                  disabled={
                    busy ||
                    !notes.trim() ||
                    !poId ||
                    bill.some((l) => !mappings[l.receipt_line_id])
                  }
                  className="rounded border px-3 py-2 disabled:opacity-40"
                  onClick={() =>
                    action("bind_po", {
                      purchase_order_id: poId,
                      mappings: bill.map((l) => ({
                        receipt_line_id: l.receipt_line_id,
                        purchase_order_item_id: mappings[l.receipt_line_id],
                      })),
                    })
                  }
                >
                  Bind usage-only PO and invoice limits
                </button>
              </section>
            )}
          {detail.clinical_access && (
            <>
              <section>
                <h3 className="font-semibold">Case journal</h3>
                {detail.events.map((e) => (
                  <article key={e.id} className="mt-2 rounded border p-3">
                    <p className="font-medium">
                      {label(e.action.replace("SURGICAL_CONSIGNMENT_", ""))} ·{" "}
                      {e.signature.name} ·{" "}
                      {new Date(e.created_at).toLocaleString()}
                    </p>
                    <p>{e.notes}</p>
                  </article>
                ))}
              </section>
              {detail.can_scm &&
                ["RECONCILED", "BILLING_LINKED"].includes(detail.status) && (
                  <button
                    disabled={
                      busy ||
                      !notes.trim() ||
                      (detail.status === "RECONCILED" && bill.length > 0)
                    }
                    className="rounded border px-3 py-2 disabled:opacity-40"
                    onClick={() => action("close")}
                  >
                    Close custody-reconciled case (finance remains in P2P)
                  </button>
                )}
              {detail.can_scm &&
                !detail.receipts.length &&
                ["AWAITING_AUTHORIZATION", "AUTHORIZED"].includes(
                  detail.status,
                ) && (
                  <button
                    disabled={busy || !notes.trim()}
                    className="ml-3 rounded border px-3 py-2 text-red-700 disabled:opacity-40"
                    onClick={() => action("cancel")}
                  >
                    Cancel before delivery
                  </button>
                )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
