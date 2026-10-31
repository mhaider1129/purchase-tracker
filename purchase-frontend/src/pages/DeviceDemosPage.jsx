import { workflowLabel } from '../utils/workflowTranslation';
import useUiTranslation from "../utils/useUiTranslation";
import "./DeviceDemosPage.css";
import { matchesSearchTokens } from "../utils/search";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as api from "../api/deviceDemos";
import useRequestAttachments from "../hooks/useRequestAttachments";
const css = "rounded border border-slate-300 bg-white p-2 text-sm";
const key = () =>
  window.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const emptyCandidate = () => ({
  supplier_id: "",
  supplier_catalog_item_id: "",
  manufacturer: "",
  model: "",
  serial_number: "",
  planned_start: "",
  planned_end: "",
  location: "",
  description: "",
});
export default function DeviceDemosPage() {
  const uiText = useUiTranslation();
  const readable = (value) => uiText(workflowLabel(value), { context: "status" });
  const setupRef = useRef(null);
  const [evaluatorSearch, setEvaluatorSearch] = useState("");
  const [params, setParams] = useSearchParams(),
    opened = useRef(null);
  const [schema, setSchema] = useState(null),
    [rows, setRows] = useState([]),
    [detail, setDetail] = useState(null),
    [eligible, setEligible] = useState([]),
    [directory, setDirectory] = useState([]),
    [options, setOptions] = useState({ suppliers: [], catalog: [] });
  const [supplierLoading, setSupplierLoading] = useState(false),
    [supplierError, setSupplierError] = useState("");
  const supplierLoad = useRef(0);
  const loadSupplierOptions = useCallback(async (workspaceId) => {
    const load = ++supplierLoad.current;
    setSupplierLoading(true);
    setSupplierError("");
    setOptions({ suppliers: [], catalog: [] });
    try {
      const result = await api.demoOptions(workspaceId);
      if (!Array.isArray(result?.suppliers) || !Array.isArray(result?.catalog))
        throw new Error(
          "The supplier directory returned an invalid response. Reload suppliers.",
        );
      if (load !== supplierLoad.current) return;
      setOptions(result);
      setCandidate((current) => {
        if (
          current.supplier_id &&
          !result.suppliers.some(
            (supplier) => String(supplier.id) === String(current.supplier_id),
          )
        )
          return { ...current, supplier_id: "", supplier_catalog_item_id: "" };
        if (
          current.supplier_catalog_item_id &&
          !result.catalog.some(
            (item) =>
              String(item.id) === String(current.supplier_catalog_item_id) &&
              String(item.supplier_id) === String(current.supplier_id),
          )
        )
          return { ...current, supplier_catalog_item_id: "" };
        return current;
      });
    } catch (e) {
      if (load === supplierLoad.current)
        setSupplierError(
          e.response?.data?.message || e.message || "Unable to load suppliers.",
        );
    } finally {
      if (load === supplierLoad.current) setSupplierLoading(false);
    }
  }, []);
  const [search, setSearch] = useState(params.get("request") || ""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [itemId, setItemId] = useState(""),
    [title, setTitle] = useState(""),
    [objectives, setObjectives] = useState(""),
    [reviewers, setReviewers] = useState([]),
    [criteria, setCriteria] = useState([]),
    [submission, setSubmission] = useState(key);
  const [candidate, setCandidate] = useState(emptyCandidate),
    [notes, setNotes] = useState(""),
    [demoId, setDemoId] = useState(""),
    [selectedId, setSelectedId] = useState(""),
    [attachments, setAttachments] = useState([]),
    [attachmentIds, setAttachmentIds] = useState([]);
  const [documentIds, setDocumentIds] = useState([]),
    [documentNote, setDocumentNote] = useState("");
  const [report, setReport] = useState({
    scores: [],
    recommendation: "",
    findings: "",
    safety_findings: "",
  });
  const { handleDownloadAttachment } = useRequestAttachments();
  const adopt = useCallback(
    async (w) => {
      opened.current = String(w.id);
      setDetail(w);
      setNotes("");
      setDemoId("");
      setSelectedId("");
      setAttachmentIds([]);
      setDocumentIds([]);
      setDocumentNote("");
      setCandidate(emptyCandidate());
      setReport({
        scores: w.criteria.map((c) => ({ key: c.key, score: "", comment: "" })),
        recommendation: "",
        findings: "",
        safety_findings: "",
      });
      if (w.can_coordinate) {
        await loadSupplierOptions(w.id);
      }
      if (
        w.can_coordinate ||
        w.reviewers.some(
          (r) => String(r.reviewer_id) === String(w.current_user_id),
        )
      )
        setAttachments(await api.demoEvidence(w.request_id));
    },
    [loadSupplierOptions],
  );
  useEffect(() => {
    if (params.get("workspace") === opened.current && opened.current) return;
    let active = true;
    (async () => {
      try {
        const meta = await api.demoSchema();
        if (!active) return;
        setSchema(meta);
        setCriteria(meta.criteria);
        setRows(await api.listDemos(params.get("request") || ""));
        if (meta.can_initiate) {
          const [items, users] = await Promise.all([
            api.eligibleDemoItems(params.get("request") || ""),
            api.demoReviewers(),
          ]);
          if (!active) return;
          setEligible(items);
          setDirectory(users);
        }
        if (params.get("workspace")) {
          const w = await api.getDemoWorkspace(params.get("workspace"));
          if (active) await adopt(w);
        }
      } catch (e) {
        if (active)
          setError(
            e.response?.data?.message || "Unable to load demo workspaces",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [params, adopt]);
  const perform = async (work) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await work();
    } catch (e) {
      setError(e.response?.data?.message || "Unable to save the demo action.");
    } finally {
      setBusy(false);
    }
  };
  const act = (operation, payload = {}) =>
    perform(async () => {
      const w = await api.demoAction(detail.id, operation, {
        row_version: detail.row_version,
        notes,
        attachment_ids: attachmentIds,
        ...payload,
      });
      await adopt(w);
      setRows(await api.listDemos(search));
      setSuccess("Demo workspace updated.");
    });
  const attachDocuments = async (ids, description) => {
    const updated = await api.demoAction(detail.id, "document", {
      row_version: detail.row_version,
      notes: description || "Supporting specification / data sheets",
      attachment_ids: ids,
    });
    // Linking evidence updates the workspace version without discarding trial/report drafts.
    setDetail(updated);
    setDocumentIds([]);
    setDocumentNote("");
    setRows(await api.listDemos(search));
    setSuccess("Files attached to the demo workspace.");
  };
  const refresh = () =>
    perform(async () => {
      await adopt(await api.getDemoWorkspace(detail.id));
      setRows(await api.listDemos(search));
    });
  const visibleEvaluators = directory.filter((user) =>
    matchesSearchTokens(evaluatorSearch, [
      user.name,
      user.role,
      user.department_name,
    ]),
  );
  const weightTotal = criteria.reduce(
    (sum, row) =>
      sum + (Number.isFinite(Number(row.weight)) ? Number(row.weight) : 0),
    0,
  );
  const weightsValid =
    criteria.length > 0 &&
    criteria.every(
      (row) => Number.isInteger(Number(row.weight)) && Number(row.weight) > 0,
    ) &&
    weightTotal === 100;
  const requestedDevice = eligible.find((item) => String(item.id) === itemId);
  const editable =
      detail && ["OPEN", "REVISION_REQUIRED"].includes(detail.status),
    assigned = detail?.reviewers.some(
      (r) => String(r.reviewer_id) === String(detail.current_user_id),
    );
  const selectedDemo = detail?.demos.find((d) => String(d.id) === demoId),
    canReport =
      editable &&
      assigned &&
      selectedDemo?.status === "COMPLETED" &&
      !detail.reports.some(
        (r) =>
          String(r.demo_id) === demoId &&
          String(r.reviewer_id) === String(detail.current_user_id),
      );
  const comparison =
    detail?.demos
      .filter((d) => d.status === "COMPLETED")
      .map((d) => {
        const reports = detail.reports.filter(
          (r) => String(r.demo_id) === String(d.id),
        );
        return {
          ...d,
          count: reports.length,
          score: reports.length
            ? (
                reports.reduce((n, r) => n + Number(r.weighted_score), 0) /
                reports.length
              ).toFixed(1)
            : "—",
          suitable:
            reports.length === detail.reviewers.length &&
            reports.every((r) => r.recommendation === "SUITABLE"),
        };
      }) || [];
  const ready =
    editable &&
    comparison.length > 0 &&
    comparison.every((d) => d.count === detail.reviewers.length) &&
    detail.demos.every((d) => ["COMPLETED", "WITHDRAWN"].includes(d.status));
  if (loading) return <main className="p-6">{uiText("Loading device demos…")}</main>;
  return (
    <main className="device-demos mx-auto max-w-7xl space-y-6 p-6">
      <header className="demo-hero rounded-xl bg-slate-900 p-6 text-white">
        <div>
          <p className="text-sm text-cyan-200">{uiText("DEVICE DEMONSTRATIONS")}</p>
          <h1 className="text-3xl font-bold">{uiText("Device demo workspace")}</h1>
          <p className="mt-2">{uiText("Compare supplier demos, document trials and departmental evaluations, then obtain COO approval for the selected device.")}</p>
        </div>
        <div className="demo-hero-actions">
          {schema?.can_initiate && (
            <button
              type="button"
              onClick={() => {
                if (setupRef.current) {
                  setupRef.current.open = true;
                  setupRef.current.scrollIntoView?.({
                    behavior: "smooth",
                    block: "start",
                  });
                  setupRef.current
                    .querySelector("select")
                    ?.focus({ preventScroll: true });
                }
              }}
            >{uiText("New demo workspace")}</button>
          )}
          <a href="#demo-workspaces">{uiText("View workspaces ↓")}</a>
        </div>
      </header>
      <section
        className="demo-workflow"
        aria-label={uiText("Device demonstration workflow")}
      >
        <h2>{uiText("From demo setup to an approved selection")}</h2>
        <ol>
          {[
            ["Set up", "Choose the requested device and evaluation team"],
            ["Trial", "Document supplier demos and supporting evidence"],
            ["Evaluate", "Each evaluator reports on completed demos"],
            [
              "COO decision",
              "Submit the selected device for independent approval",
            ],
          ].map(([title, description], index) => (
            <li key={title}>
              <span>{index + 1}</span>
              <strong>{uiText(title)}</strong>
              <p>{uiText(description)}</p>
            </li>
          ))}
        </ol>
      </section>
      {error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-red-800"
        >
          {error}
          {detail && (
            <button
              className="ml-3 underline"
              disabled={busy}
              onClick={refresh}
            >{uiText("Reload latest workspace")}</button>
          )}
        </div>
      )}
      {success && (
        <p role="status" className="text-green-700">
          {success}
        </p>
      )}
      <form
        className="demo-search"
        aria-label={uiText("Find demo workspaces")}
        onSubmit={(e) => {
          e.preventDefault();
          perform(async () => {
            setRows(await api.listDemos(search));
            if (schema.can_initiate)
              setEligible(await api.eligibleDemoItems(search));
          });
        }}
      >
        <label>{uiText("Search workspaces")}<input
            aria-label={uiText("Search demos")}
            className={css}
            placeholder={uiText("Request number or device name")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button disabled={busy} className="rounded border px-3">{uiText("Search")}</button>
        {search && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setSearch("");
              perform(async () => {
                setRows(await api.listDemos(""));
                if (schema.can_initiate)
                  setEligible(await api.eligibleDemoItems(""));
              });
            }}
          >{uiText("Clear search")}</button>
        )}
      </form>
      {schema?.can_initiate && (
        <details
          ref={setupRef}
          id="demo-setup"
          className="demo-setup rounded-xl border bg-white p-4"
        >
          <summary className="cursor-pointer font-semibold">{uiText("Open a device demo workspace")}</summary>
          <form
            className="demo-setup-form mt-4 space-y-3"
            aria-label={uiText("Open device demo workspace")}
            onSubmit={(e) => {
              e.preventDefault();
              if (!weightsValid) {
                setError(
                  "Evaluation weights must be positive whole numbers totaling 100%.",
                );
                return;
              }
              perform(async () => {
                const w = await api.openDemoWorkspace({
                  request_item_id: itemId,
                  title,
                  objectives,
                  reviewer_ids: reviewers,
                  criteria,
                  submission_key: submission,
                });
                await adopt(w);
                setParams({ workspace: w.id });
                setSubmission(key());
                setRows(await api.listDemos(search));
                setEligible(await api.eligibleDemoItems(search));
                setSuccess("Demo workspace opened and evaluators notified.");
              });
            }}
          >
            <div className="demo-setup-layout">
              <div className="demo-setup-fields">
                <fieldset className="demo-form-section">
                  <legend>
                    <span>1</span>{uiText("Device and objectives")}</legend>
                  <label className="block">{uiText("Requested device")}<select
                      required
                      className={`${css} block w-full`}
                      value={itemId}
                      onChange={(e) => {
                        setItemId(e.target.value);
                        setTitle(
                          eligible.find((i) => String(i.id) === e.target.value)
                            ?.item_name || "",
                        );
                      }}
                    >
                      <option value="">{uiText("Select outstanding device")}</option>
                      {eligible.map((item) => (
                        <option key={item.id} value={item.id}>
                          #{item.maintenance_ref_number || item.request_id} ·{" "}
                          {item.item_name} · {item.department_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-sm text-slate-600">{uiText("Medical-devices and SCM approvers can open at their active approval step. SCM can also open for approved requests before procurement starts.")}</p>
                  <label className="block">{uiText("Workspace title")}<input
                      required
                      className={`${css} block w-full`}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <label className="block">{uiText("Demo objectives and intended use")}<textarea
                      required
                      className={`${css} block w-full`}
                      value={objectives}
                      onChange={(e) => setObjectives(e.target.value)}
                    />
                  </label>
                </fieldset>
                <fieldset className="demo-form-section rounded border p-3">
                  <legend>
                    <span>2</span>{uiText("Required evaluators")}</legend>
                  <p className="text-sm text-slate-600">{uiText("Include the requesting department. Each evaluator reports on every completed demo. COO selection approval must be independent.")}</p>
                  <div className="demo-evaluator-toolbar">
                    <label>{uiText("Find evaluators")}<input
                        type="search"
                        value={evaluatorSearch}
                        onChange={(event) =>
                          setEvaluatorSearch(event.target.value)
                        }
                        placeholder={uiText("Name, role, or department")}
                      />
                    </label>
                    <p role="status">
                      {reviewers.length}{" "}{uiText("selected ·")}{" "}{visibleEvaluators.length}{" "}{uiText("of")}{" "}{directory.length}{" "}{uiText("shown")}</p>
                    {evaluatorSearch && (
                      <button
                        type="button"
                        onClick={() => setEvaluatorSearch("")}
                      >{uiText("Clear evaluator search")}</button>
                    )}
                  </div>
                  <div className="demo-evaluator-list">
                    {visibleEvaluators.map((user) => (
                      <label
                        key={user.id}
                        className="demo-evaluator-option mr-4 block"
                      >
                        <input
                          type="checkbox"
                          checked={reviewers.includes(String(user.id))}
                          onChange={(e) =>
                            setReviewers((old) =>
                              e.target.checked
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
                    {visibleEvaluators.length === 0 && (
                      <p className="demo-empty">{uiText("No evaluators match this search.")}</p>
                    )}
                  </div>
                </fieldset>
                <fieldset className="demo-form-section rounded border p-3">
                  <legend>
                    <span>3</span>{uiText("Evaluation criteria — weights total 100%")}</legend>
                  <p className="text-sm text-slate-600">{uiText("Agree the criteria before trials begin. Each criterion is scored 0–5 with evidence.")}</p>
                  <div
                    className={`demo-weight-total ${weightsValid ? "demo-weight-total--valid" : "demo-weight-total--invalid"}`}
                    role="status"
                  >
                    <strong>{uiText("Weight total:")}{" "}{weightTotal}%</strong>
                    <span>
                      {weightsValid
                        ? uiText("Ready — weights total 100%.")
                        : uiText("Use positive whole-number weights totaling 100%.")}
                    </span>
                  </div>
                  <div className="demo-criteria-heading" aria-hidden="true">
                    <span>{uiText("Criterion")}</span>
                    <span>{uiText("Weight (%)")}</span>
                  </div>
                  {criteria.map((criterion, index) => (
                    <div
                      key={criterion.key}
                      className="demo-criterion-row my-2 flex gap-2"
                    >
                      <input
                        aria-label={`Criterion ${index + 1}`}
                        required
                        className={`${css} flex-1`}
                        value={criterion.name}
                        onChange={(e) =>
                          setCriteria((old) =>
                            old.map((row, i) =>
                              i === index
                                ? { ...row, name: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                      <input
                        aria-label={`Weight ${index + 1}`}
                        type="number"
                        min="1"
                        max="100"
                        required
                        className={`${css} w-24`}
                        value={criterion.weight}
                        onChange={(e) =>
                          setCriteria((old) =>
                            old.map((row, i) =>
                              i === index
                                ? { ...row, weight: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                </fieldset>
              </div>
              <aside
                className="demo-setup-summary"
                aria-label={uiText("Demo setup summary")}
              >
                <h3>{uiText("Workspace at a glance")}</h3>
                <dl>
                  <div>
                    <dt>{uiText("Requested device")}</dt>
                    <dd>{requestedDevice?.item_name || uiText("Not selected")}</dd>
                  </div>
                  <div>
                    <dt>{uiText("Request / reference")}</dt>
                    <dd>
                      {requestedDevice
                        ? `#${requestedDevice.maintenance_ref_number || requestedDevice.request_id}`
                        : uiText("Not selected")}
                    </dd>
                  </div>
                  <div>
                    <dt>{uiText("Department")}</dt>
                    <dd>
                      {requestedDevice?.department_name || uiText("Not selected")}
                    </dd>
                  </div>
                  <div>
                    <dt>{uiText("Evaluators selected")}</dt>
                    <dd>{reviewers.length}</dd>
                  </div>
                  <div>
                    <dt>{uiText("Criteria")}</dt>
                    <dd>{criteria.length}</dd>
                  </div>
                </dl>
                <p>{uiText("Every required evaluator reports on each completed demo.")}</p>
                <p>{uiText("Workspace creation does not select a supplier. Complete trials and reports before requesting COO review.")}</p>
              </aside>
            </div>
            <div className="demo-setup-submit">
              <p>{uiText("Choose the requested device, agree the evaluation team and confirm weights before opening.")}</p>
              <button
                className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-40"
                disabled={busy || !itemId || !reviewers.length || !weightsValid}
              >
                {busy ? uiText("Please wait…") : uiText("Open demo workspace")}
              </button>
            </div>
          </form>
        </details>
      )}
      <section
        id="demo-workspaces"
        className="demo-queue rounded-xl border bg-white p-4"
      >
        <h2 className="text-lg font-semibold">{uiText("Demo workspaces")}</h2>
        <p className="demo-help">
          {rows.length}{" "}{uiText("workspaces shown. Open a workspace to review supplier trials, reports and selection decisions.")}</p>
        {!rows.length && <p>{uiText("No demo workspaces found.")}</p>}
        <div
          className="demo-table-scroll overflow-x-auto"
          role="region"
          aria-label={uiText("Demo workspace table")}
          tabIndex={0}
        >
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>{uiText("Device / request")}</th>
                <th>{uiText("Status")}</th>
                <th>{uiText("Supplier demos")}</th>
                <th>{uiText("Workspace")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} className="border-t">
                  <td className="py-3">
                    {w.title} · #{w.maintenance_ref_number || w.request_id}
                  </td>
                  <td>
                    <span className="demo-status-badge">
                      {readable(w.status)}
                    </span>
                  </td>
                  <td>{w.demo_count}</td>
                  <td>
                    <button
                      disabled={busy}
                      className="text-blue-700 underline"
                      onClick={() =>
                        perform(async () => {
                          await adopt(await api.getDemoWorkspace(w.id));
                          setParams({ workspace: w.id });
                        })
                      }
                    >
                      {uiText("Open")} DEMO-{w.id}
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
              DEMO-{detail.id}: {detail.title}
            </h2>
            <p>
              {readable(detail.status)} · {detail.department_name} ·{" "}
              <Link
                className="text-blue-700 underline"
                to={`/requests/${detail.request_id}`}
              >{uiText("Request #")}{detail.maintenance_ref_number || detail.request_id}
              </Link>
            </p>
            <p>{detail.objectives}</p>
            <p className="mt-2 text-sm">{uiText("Requested:")}{" "}{detail.item_snapshot.item_name} ·{" "}
              {detail.item_snapshot.quantity}{" "}
              {detail.item_snapshot.unit_of_measure} ·{" "}
              {detail.item_snapshot.specs}
            </p>
            <p className="text-sm text-slate-600">{uiText("Demo receipt and return are trial custody records. They do not mark the purchase request received or completed.")}</p>
          </header>
          <section className="space-y-3 rounded border border-indigo-200 bg-indigo-50 p-4">
            <h3 className="text-lg font-semibold">{uiText("Workspace documents")}</h3>
            <p className="text-sm">{uiText("Attach specification sheets, data sheets, brochures and supporting files at any point in the demo process. Each file is recorded in the workspace journal.")}</p>
            {!detail.attachments.length && (
              <p className="text-sm text-slate-600">{uiText("No supporting files attached yet.")}</p>
            )}
            {detail.attachments.map((file) => {
              const entry = detail.events.find((event) =>
                event.attachment_ids.map(String).includes(String(file.id)),
              );
              return (
                <article key={file.id} className="rounded border bg-white p-3">
                  <button
                    className="font-medium text-blue-700 underline"
                    onClick={() => handleDownloadAttachment(file)}
                  >
                    {file.file_name}
                  </button>
                  {entry && (
                    <p className="text-sm text-slate-600">{uiText("Attached by")}{" "}{entry.actor_snapshot.name} ·{" "}
                      {new Date(entry.created_at).toLocaleString()} ·{" "}
                      {entry.notes}
                    </p>
                  )}
                </article>
              );
            })}
            {(detail.can_coordinate || assigned) &&
              detail.status !== "CANCELLED" && (
                <div className="space-y-3">
                  <label className="block">{uiText("Document description (optional)")}<input
                      aria-label={uiText("Workspace document description")}
                      className={`${css} block w-full`}
                      value={documentNote}
                      onChange={(e) => setDocumentNote(e.target.value)}
                    />
                  </label>
                  <label className="block">{uiText("Upload a specification / data sheet")}<input
                      aria-label={uiText("Upload workspace document")}
                      type="file"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          perform(async () => {
                            const uploaded = await api.uploadDemoEvidence(
                              detail.request_id,
                              file,
                            );
                            setAttachments(
                              await api.demoEvidence(detail.request_id),
                            );
                            if (!uploaded.attachmentId)
                              throw new Error("Missing uploaded attachment ID");
                            setDocumentIds([uploaded.attachmentId]);
                            await attachDocuments(
                              [uploaded.attachmentId],
                              documentNote.trim() ||
                                `Supporting document: ${file.name}`,
                            );
                          });
                      }}
                    />
                  </label>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">{uiText("Attach existing request files")}</summary>
                    <div className="my-2">
                      {attachments.map((file) => (
                        <label key={file.id} className="mr-4 block">
                          <input
                            type="checkbox"
                            aria-label={`Workspace file ${file.file_name}`}
                            checked={documentIds
                              .map(String)
                              .includes(String(file.id))}
                            onChange={(e) =>
                              setDocumentIds((old) =>
                                e.target.checked
                                  ? [...old, file.id]
                                  : old.filter(
                                      (id) => String(id) !== String(file.id),
                                    ),
                              )
                            }
                          />{" "}
                          {file.file_name}
                        </label>
                      ))}
                    </div>
                    <button
                      disabled={busy || !documentIds.length}
                      className="rounded border bg-white px-3 py-2 disabled:opacity-40"
                      onClick={() =>
                        perform(() =>
                          attachDocuments(documentIds, documentNote.trim()),
                        )
                      }
                    >{uiText("Attach selected files to workspace")}</button>
                  </details>
                </div>
              )}
          </section>
          <section>
            <h3 className="font-semibold">{uiText("Evaluation team")}</h3>
            {detail.reviewers.map((r) => (
              <p key={r.reviewer_id}>
                {r.name} · {r.role} · {r.department_name}
              </p>
            ))}
          </section>
          {editable && detail.can_coordinate && (
            <details className="rounded border p-4">
              <summary className="cursor-pointer font-semibold">{uiText("Add a supplier demo")}</summary>
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    supplierLoading ||
                    supplierError ||
                    !candidate.supplier_id
                  )
                    return;
                  act("candidate", candidate);
                }}
              >
                <div className="rounded border bg-slate-50 p-3">
                  <p className="text-sm text-slate-600">{uiText("Choose an existing supplier from the Suppliers directory. No separate company setup is needed.")}</p>
                  <button
                    type="button"
                    disabled={busy || supplierLoading}
                    className="mt-2 rounded border px-3 py-2 text-sm disabled:opacity-40"
                    onClick={() => loadSupplierOptions(detail.id)}
                  >{uiText("Reload suppliers")}</button>
                  {supplierLoading && (
                    <p role="status" className="mt-2 text-sm">{uiText("Loading suppliers…")}</p>
                  )}
                  {supplierError && (
                    <p role="alert" className="mt-2 text-sm text-red-700">
                      {supplierError}
                    </p>
                  )}
                  {!supplierLoading &&
                    !supplierError &&
                    !options.suppliers.length && (
                      <p role="status" className="mt-2 text-sm text-amber-800">{uiText("No eligible suppliers are available. Add or activate the supplier in the Suppliers directory, then reload. Suppliers assigned to another institute are excluded.")}</p>
                    )}
                </div>
                <label className="block">{uiText("Supplier")}<select
                    required
                    className={`${css} block w-full`}
                    value={candidate.supplier_id}
                    disabled={
                      busy ||
                      supplierLoading ||
                      Boolean(supplierError) ||
                      !options.suppliers.length
                    }
                    onChange={(e) =>
                      setCandidate({
                        ...candidate,
                        supplier_id: e.target.value,
                        supplier_catalog_item_id: "",
                      })
                    }
                  >
                    <option value="">
                      {supplierLoading
                        ? uiText("Loading suppliers…")
                        : uiText("Select supplier")}
                    </option>
                    {options.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                {detail.item_snapshot.generic_item_id && (
                  <label className="block">{uiText("Approved device product")}<select
                      required
                      className={`${css} block w-full`}
                      value={candidate.supplier_catalog_item_id}
                      onChange={(e) =>
                        setCandidate({
                          ...candidate,
                          supplier_catalog_item_id: e.target.value,
                        })
                      }
                    >
                      <option value="">{uiText("Select the supplier's approved catalog device")}</option>
                      {options.catalog
                        .filter(
                          (c) =>
                            String(c.supplier_id) === candidate.supplier_id,
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.product_name} · {c.manufacturer} · {c.model}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    "manufacturer",
                    "model",
                    "serial_number",
                    "location",
                    "planned_start",
                    "planned_end",
                  ].map((field) => (
                    <label key={field}>
                      {readable(field)}
                      <input
                        required={
                          field !== "serial_number" &&
                          (!detail.item_snapshot.generic_item_id ||
                            !["manufacturer", "model"].includes(field))
                        }
                        type={field.startsWith("planned_") ? "date" : "text"}
                        className={`${css} block w-full`}
                        value={candidate[field]}
                        onChange={(e) =>
                          setCandidate({
                            ...candidate,
                            [field]: e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="block">{uiText("Demo configuration / description")}<textarea
                    required
                    className={`${css} block w-full`}
                    value={candidate.description}
                    onChange={(e) =>
                      setCandidate({
                        ...candidate,
                        description: e.target.value,
                      })
                    }
                  />
                </label>
                <p className="text-sm">{uiText("Record the registration notes below before saving. Governed devices must link to their supplier's approved catalog identity.")}</p>
                <label className="block">{uiText("Supplier demo registration notes")}<textarea
                    required
                    className={`${css} block w-full`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <button
                  disabled={
                    busy ||
                    supplierLoading ||
                    Boolean(supplierError) ||
                    !candidate.supplier_id ||
                    !notes.trim()
                  }
                  className="rounded border px-3 py-2 disabled:opacity-40"
                >{uiText("Save supplier demo")}</button>
              </form>
            </details>
          )}
          <section>
            <h3 className="text-lg font-semibold">{uiText("Supplier demos and evaluation period")}</h3>
            {!detail.demos.length && (
              <p className="text-slate-600">{uiText("Register one or more supplier demos to begin.")}</p>
            )}
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {detail.demos.map((d) => (
                <article className="space-y-2 rounded border p-4" key={d.id}>
                  <h4 className="font-semibold">
                    {d.supplier_name} · {d.manufacturer} {d.model}
                  </h4>
                  <p>
                    {readable(d.status)}{" "}{uiText("· Serial:")}{" "}
                    {d.serial_number || uiText("Not recorded")}
                  </p>
                  <p>
                    {String(d.planned_start).slice(0, 10)} →{" "}
                    {String(d.planned_end).slice(0, 10)} · {d.location}
                  </p>
                  <p>{d.description}</p>
                  {[
                    "received_at",
                    "started_at",
                    "completed_at",
                    "returned_at",
                  ].map(
                    (field) =>
                      d[field] && (
                        <p key={field} className="text-sm">
                          {readable(field)}:{" "}
                          {new Date(d[field]).toLocaleString()}
                        </p>
                      ),
                  )}
                </article>
              ))}
            </div>
          </section>
          <section className="space-y-3 rounded border bg-slate-50 p-4">
            <h3 className="font-semibold">{uiText("Document the demo")}</h3>
            <label className="block">{uiText("Supplier demo")}<select
                aria-label={uiText("Supplier demo")}
                className={`${css} ml-3`}
                value={demoId}
                onChange={(e) => {
                  setDemoId(e.target.value);
                  setReport({
                    scores: detail.criteria.map((c) => ({
                      key: c.key,
                      score: "",
                      comment: "",
                    })),
                    recommendation: "",
                    findings: "",
                    safety_findings: "",
                  });
                }}
              >
                <option value="">{uiText("Select demo")}</option>
                {detail.demos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.supplier_name} · {d.model} · {readable(d.status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">{uiText("Action notes / selection rationale")}<textarea
                aria-label={uiText("Demo action notes")}
                className={`${css} block w-full`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            {(detail.can_coordinate || assigned) && editable && (
              <div>
                <label>{uiText("Upload supporting evidence")}<input
                    aria-label={uiText("Upload demo evidence")}
                    type="file"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        perform(async () => {
                          await api.uploadDemoEvidence(detail.request_id, file);
                          setAttachments(
                            await api.demoEvidence(detail.request_id),
                          );
                          setSuccess(
                            "Evidence uploaded. Select it to attach to the action.",
                          );
                        });
                    }}
                  />
                </label>
                <div>
                  {attachments.map((file) => (
                    <label key={file.id} className="mr-3 inline-block">
                      <input
                        type="checkbox"
                        checked={attachmentIds
                          .map(String)
                          .includes(String(file.id))}
                        onChange={(e) =>
                          setAttachmentIds((old) =>
                            e.target.checked
                              ? [...old, file.id]
                              : old.filter(
                                  (id) => String(id) !== String(file.id),
                                ),
                          )
                        }
                      />{" "}
                      {file.file_name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {editable &&
                detail.can_coordinate &&
                selectedDemo &&
                (
                  {
                    PLANNED: ["RECEIVED", "WITHDRAWN"],
                    RECEIVED: ["EVALUATING", "WITHDRAWN"],
                    EVALUATING: ["COMPLETED", "WITHDRAWN"],
                  }[selectedDemo.status] || []
                ).map((status) => (
                  <button
                    key={status}
                    disabled={busy || !notes.trim()}
                    className="rounded border px-3 py-2 disabled:opacity-40"
                    onClick={() =>
                      act("transition", { demo_id: demoId, status })
                    }
                  >
                    {uiText(
                      {
                        RECEIVED: "Record demo receipt",
                        EVALUATING: "Start evaluation",
                        COMPLETED: "Complete evaluation",
                        WITHDRAWN: "Withdraw demo",
                      }[status]
                    )}
                  </button>
                ))}
              {editable &&
                (detail.can_coordinate || assigned) &&
                selectedDemo &&
                ["RECEIVED", "EVALUATING", "COMPLETED"].includes(
                  selectedDemo.status,
                ) && (
                  <button
                    disabled={busy || !notes.trim()}
                    className="rounded border px-3 py-2 disabled:opacity-40"
                    onClick={() => act("observation", { demo_id: demoId })}
                  >{uiText("Record observation")}</button>
                )}
              {detail.can_coordinate &&
                selectedDemo?.received_at &&
                !selectedDemo.returned_at &&
                ["COMPLETED", "WITHDRAWN"].includes(selectedDemo.status) && (
                  <button
                    disabled={busy || !notes.trim()}
                    className="rounded border px-3 py-2 disabled:opacity-40"
                    onClick={() => act("return", { demo_id: demoId })}
                  >{uiText("Record device return")}</button>
                )}
            </div>
          </section>
          {canReport && (
            <form
              className="space-y-3 rounded border p-4"
              onSubmit={(e) => {
                e.preventDefault();
                act("opinion", {
                  ...report,
                  demo_id: demoId,
                  notes: report.findings,
                });
              }}
            >
              <h3 className="text-lg font-semibold">{uiText("My evaluation report")}</h3>
              <p>{uiText("Score each criterion from 0 to 5. The weighted result is calculated by the server.")}</p>
              {report.scores.map((row, index) => (
                <div key={row.key} className="grid gap-2 md:grid-cols-3">
                  <label>
                    {detail.criteria[index].name} (
                    {detail.criteria[index].weight}%)
                    <select
                      aria-label={`Score ${row.key}`}
                      required
                      className={`${css} ml-2`}
                      value={row.score}
                      onChange={(e) =>
                        setReport({
                          ...report,
                          scores: report.scores.map((r, i) =>
                            i === index ? { ...r, score: e.target.value } : r,
                          ),
                        })
                      }
                    >
                      <option value="">{uiText("Select")}</option>
                      {[0, 1, 2, 3, 4, 5].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label className="md:col-span-2">{uiText("Evidence for")}{" "}{detail.criteria[index].name}
                    <textarea
                      required
                      aria-label={`Evidence ${row.key}`}
                      className={`${css} block w-full`}
                      value={row.comment}
                      onChange={(e) =>
                        setReport({
                          ...report,
                          scores: report.scores.map((r, i) =>
                            i === index ? { ...r, comment: e.target.value } : r,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              ))}
              {["findings", "safety_findings"].map((field) => (
                <label key={field} className="block">
                  {readable(field)}
                  <textarea
                    required
                    aria-label={
                      field === "findings"
                        ? uiText("Evaluation findings")
                        : uiText("Safety findings")
                    }
                    className={`${css} block w-full`}
                    value={report[field]}
                    onChange={(e) =>
                      setReport({ ...report, [field]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>{uiText("Suitability")}<select
                  aria-label={uiText("Demo suitability")}
                  required
                  className={`${css} ml-3`}
                  value={report.recommendation}
                  onChange={(e) =>
                    setReport({ ...report, recommendation: e.target.value })
                  }
                >
                  <option value="">{uiText("Select")}</option>
                  <option value="SUITABLE">{uiText("Suitable")}</option>
                  <option value="NOT_SUITABLE">{uiText("Not suitable")}</option>
                </select>
              </label>
              <button
                disabled={busy}
                className="ml-3 rounded bg-indigo-700 px-4 py-2 text-white"
              >{uiText("Submit evaluation and attest")}</button>
            </form>
          )}
          <section>
            <h3 className="text-lg font-semibold">{uiText("Comparison and recommendation")}</h3>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full text-left">
                <thead>
                  <tr>
                    <th>{uiText("Supplier / device")}</th>
                    <th>{uiText("Reports")}</th>
                    <th>{uiText("Score / 100")}</th>
                    <th>{uiText("Suitability")}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="py-2">
                        {d.supplier_name} · {d.model}
                      </td>
                      <td>
                        {d.count}/{detail.reviewers.length}
                      </td>
                      <td>{d.score}</td>
                      <td>
                        {d.count < detail.reviewers.length
                          ? uiText("Awaiting reports")
                          : d.suitable
                            ? uiText("Suitable")
                            : uiText("Not suitable")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editable && detail.can_coordinate && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-slate-600">{uiText("Complete or withdraw every supplier demo and collect every required report. Explain the best fit in the selection rationale; the highest score does not automatically select a supplier.")}</p>
                <label>{uiText("Recommended demo")}<select
                    aria-label={uiText("Recommended demo")}
                    className={`${css} ml-2`}
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    <option value="">{uiText("Select suitable device")}</option>
                    {comparison
                      .filter((d) => d.suitable)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.supplier_name} · {d.model}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  disabled={busy || !ready || !selectedId || !notes.trim()}
                  className="ml-3 rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-40"
                  onClick={() => act("recommend", { demo_id: selectedId })}
                >{uiText("Send selection to COO")}</button>
              </div>
            )}
          </section>
          {detail.selections.map((s) => (
            <article
              key={s.id}
              className="rounded border border-indigo-200 bg-indigo-50 p-4"
            >
              <h3 className="font-semibold">{uiText("Selection")}{" "}{s.id} · {s.status}
              </h3>
              <p>
                {
                  detail.demos.find((d) => String(d.id) === String(s.demo_id))
                    ?.supplier_name
                }{" "}
                ·{" "}
                {
                  detail.demos.find((d) => String(d.id) === String(s.demo_id))
                    ?.model
                }
              </p>
              <p>{s.rationale}</p>
              <p>{uiText("Submitted:")}{" "}{new Date(s.submitted_at).toLocaleString()}</p>
              {s.signature && (
                <p>{uiText("Decision by")}{" "}{s.signature.name} ({s.signature.role}) ·{" "}
                  {new Date(s.decided_at).toLocaleString()} · {s.decision_notes}
                </p>
              )}
            </article>
          ))}
          {detail.can_decide && detail.status === "COO_REVIEW" && (
            <section className="space-y-2 rounded border border-indigo-300 p-4">
              <h3 className="font-semibold">{uiText("COO selection decision")}</h3>
              <p>{uiText("Review the comparison, evaluator reports and recommendation. Your decision approves the selection; normal purchase-request approvals still apply.")}</p>
              {["APPROVED", "REJECTED"].map((decision) => (
                <button
                  key={decision}
                  disabled={busy || !notes.trim()}
                  className="mr-3 rounded border px-3 py-2 disabled:opacity-40"
                  onClick={() => act("decision", { decision })}
                >
                  {decision === "APPROVED"
                    ? uiText("Approve selected device")
                    : uiText("Return selection for revision")}
                </button>
              ))}
            </section>
          )}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold">{uiText("Signed evaluator reports")}</h3>
            {detail.reports.map((r) => (
              <details key={r.id} className="rounded border p-3">
                <summary>
                  {
                    detail.demos.find((d) => String(d.id) === String(r.demo_id))
                      ?.supplier_name
                  }{" "}
                  · {r.signature.name} · {r.weighted_score}/100 ·{" "}
                  {readable(r.recommendation)}
                </summary>
                <p>{r.findings}</p>
                <p>{uiText("Safety:")}{" "}{r.safety_findings}</p>
                {r.scores.map((s) => (
                  <p key={s.key}>
                    {detail.criteria.find((c) => c.key === s.key)?.name}:{" "}
                    {s.score}/5 · {s.comment}
                  </p>
                ))}
                <p className="text-sm">{uiText("Attested by")}{" "}{r.signature.name} ({r.signature.role}) ·{" "}
                  {new Date(r.submitted_at).toLocaleString()}
                </p>
              </details>
            ))}
          </section>
          <section>
            <h3 className="text-lg font-semibold">{uiText("Demo journal and evidence")}</h3>
            {detail.events.map((event) => (
              <article key={event.id} className="mt-2 rounded border p-3">
                <p className="font-medium">
                  {readable(event.action.replace("DEVICE_DEMO_", ""))} ·{" "}
                  {event.actor_snapshot.name} ·{" "}
                  {new Date(event.created_at).toLocaleString()}
                </p>
                <p>{event.notes}</p>
                {detail.attachments
                  .filter((a) =>
                    event.attachment_ids.map(String).includes(String(a.id)),
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
              </article>
            ))}
          </section>
          {detail.can_coordinate && detail.status !== "CANCELLED" && (
            <button
              disabled={busy || !notes.trim()}
              className="rounded border border-red-200 px-3 py-2 text-red-700 disabled:opacity-40"
              onClick={() => act("cancel")}
            >{uiText("Cancel workspace with reason")}</button>
          )}
        </section>
      )}
    </main>
  );
}
