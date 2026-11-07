import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import GenericItemSelector from "../../components/requests/GenericItemSelector";
import useRequestDraftAutosave from "../../hooks/useRequestDraftAutosave";
import {
  getGuidedOptions,
  previewGuidedRequest,
  searchGuidedItems,
  submitGuidedRequest,
} from "../../api/guidedRequests";
import { buildRequestSubmissionState } from "../../utils/requestSubmission";
import { useAuth } from "../../hooks/useAuth";
import RequestTypeSelector from "./RequestTypeSelector";
const fieldClass =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
const buttonClass =
  "rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50";
const newItem = () => ({
  item_name: "",
  request_mode: "generic_item",
  quantity: 1,
  unit_of_measure: "Piece",
  unit_cost: 0,
  specs: "",
});
const newKey = () =>
  window.crypto?.randomUUID?.() ||
  `guided-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const errorMessage = (error) => error.response?.data?.message || error.message;
export function GuidedRequestForm({ options }) {
  const { t, i18n } = useTranslation();
  const tr = (key) => t(`guidedRequest.${key}`);
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => ({
    family: "",
    category_id: "",
    purpose: "",
    required_by: "",
    justification: "",
    operational_impact: "",
    specialized: {},
    items: [newItem()],
    client_submission_key: newKey(),
  }));
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState([]);
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef(null);
  const inFlight = useRef(false);
  const { clearDraft, saveDraft, status, lastSavedLabel } =
    useRequestDraftAutosave({
      storageKey: `guided-request-v1:${options.requester.institute_id}:${options.requester.id}`,
      data: draft,
      restoreDraft: (saved) => {
        if (
          typeof saved?.client_submission_key === "string" &&
          Array.isArray(saved.items) &&
          saved.items.length > 0 &&
          saved.items.every((item) => item && typeof item === "object") &&
          saved.specialized &&
          typeof saved.specialized === "object"
        )
          setDraft({ ...saved });
      },
    });
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const family = options.families.find((row) => row.id === draft.family);
  const loadReferences = useCallback(
    async () => ({ categories: options.categories }),
    [options.categories],
  );
  const change = (key, value) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setReview(null);
    setError("");
  };
  const changeItem = (index, patch) =>
    change(
      "items",
      draft.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    );
  // Only the documented server payload is sent; local draft bookkeeping is excluded.
  const payload = () => ({
    ...Object.fromEntries(
      [
        "family",
        "category_id",
        "purpose",
        "required_by",
        "justification",
        "operational_impact",
        "specialized",
        "client_submission_key",
      ].map((key) => [key, draft[key]]),
    ),
    specialized: {
      ...draft.specialized,
      ...(draft.specialized.calibration_at
        ? {
            calibration_at: new Date(
              draft.specialized.calibration_at,
            ).toISOString(),
          }
        : {}),
    },
    items: draft.items.map((item) =>
      Object.fromEntries(
        [
          "item_name",
          "generic_item_id",
          "request_mode",
          "pending_item",
          "restriction_justification",
          "quantity",
          "unit_of_measure",
          "unit_cost",
          "specs",
        ]
          .filter((key) => item[key] !== undefined)
          .map((key) => [key, item[key]]),
      ),
    ),
  });
  const preview = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      setReview(await previewGuidedRequest(payload()));
      setStep(2);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const submit = async () => {
    if (inFlight.current || !review) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await submitGuidedRequest(payload(), files);
      clearDraft();
      navigate("/request-submitted", {
        state: buildRequestSubmissionState(review.request_type, result, {
          items: draft.items,
        }),
      });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const chooseFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    if (
      selected.length > options.attachments.max_files ||
      selected.some((file) => file.size > options.attachments.max_bytes)
    ) {
      setFiles([]);
      setError(tr("attachmentLimit"));
      event.target.value = "";
      return;
    }
    setFiles(selected);
    setError("");
  };
  const itemReady = (item) =>
    Number.isSafeInteger(Number(item.quantity)) &&
    Number(item.quantity) > 0 &&
    Number.isSafeInteger(Number(item.unit_cost)) &&
    Number(item.unit_cost) >= 0 &&
    (item.request_mode === "generic_item"
      ? Boolean(item.generic_item_id)
      : Boolean(
          item.pending_item?.proposed_name?.trim() &&
            item.pending_item?.item_type &&
            item.pending_item?.category &&
            item.pending_item?.justification?.trim() &&
            item.unit_of_measure?.trim(),
        ));
  const detailsReady = family?.enabled && draft.items.every(itemReady);
  return (
    <section
      aria-labelledby="guided-request-heading"
      dir={i18n.dir()}
      className="mx-auto max-w-5xl space-y-6 p-4 text-slate-900 dark:text-slate-100 sm:p-8"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            WICI · {tr("supplyChain")}
          </p>
          <h1
            id="guided-request-heading"
            ref={heading}
            tabIndex={-1}
            className="mt-2 text-3xl font-semibold outline-none"
          >
            {tr("title")}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            {tr("intro")}
          </p>
        </div>
        <Link
          className="rounded-lg border px-4 py-2 underline"
          to="/requests/legacy"
        >
          {tr("legacy")}
        </Link>
      </header>
      <ol aria-label={tr("steps")} className="grid grid-cols-3 gap-2">
        {["choose", "details", "review"].map((name, index) => (
          <li
            key={name}
            aria-current={step === index ? "step" : undefined}
            className={`rounded-lg border p-3 text-sm ${step === index ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-900" : "border-slate-300"}`}
          >
            {index + 1}. {tr(name)}
          </li>
        ))}
      </ol>
      <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
        <strong>{options.requester.name}</strong> ·{" "}
        {options.requester.department_name} · {options.requester.institute_name}
        <p className="mt-2">{tr("sapUnavailable")}</p>
      </aside>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900"
        >
          {error}
        </p>
      )}
      {step === 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{tr("what")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {options.families.map((row) => (
              <button
                key={row.id}
                type="button"
                disabled={!row.enabled}
                aria-pressed={draft.family === row.id}
                onClick={() => {
                  change("family", row.id);
                  if (draft.family !== row.id) change("specialized", {});
                  setStep(1);
                }}
                className={`rounded-xl border p-5 text-start focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${draft.family === row.id ? "border-indigo-600 bg-indigo-50 text-indigo-900" : "border-slate-300 hover:border-indigo-500"}`}
              >
                <strong className="block">{tr(`families.${row.id}`)}</strong>
                {!row.enabled && (
                  <span className="mt-1 block text-sm">
                    {tr("notEligible")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
      {step === 1 && (
        <form onSubmit={preview} className="space-y-6">
          <section className="rounded-xl border border-slate-200 p-5 dark:border-slate-700">
            <h2 className="mb-4 text-xl font-semibold">
              {tr(`families.${draft.family}`)}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                {tr("category")}
                <select
                  required
                  className={fieldClass}
                  aria-label={tr("category")}
                  value={draft.category_id}
                  onChange={(event) =>
                    change("category_id", event.target.value)
                  }
                >
                  <option value="">{tr("select")}</option>
                  {options.categories.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("purpose")}
                <select
                  required
                  className={fieldClass}
                  aria-label={tr("purpose")}
                  value={draft.purpose}
                  onChange={(event) => change("purpose", event.target.value)}
                >
                  <option value="">{tr("select")}</option>
                  {options.purposes.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("requiredBy")}
                <input
                  required
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  className={fieldClass}
                  value={draft.required_by}
                  onChange={(event) =>
                    change("required_by", event.target.value)
                  }
                />
              </label>
            </div>
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {tr("privacy")}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {family?.fields.map((field) => (
                <label key={field}>
                  {tr(`fields.${field}`)}
                  <input
                    required
                    maxLength={400}
                    type={
                      field === "procedure_date"
                        ? "date"
                        : field === "calibration_at"
                          ? "datetime-local"
                          : field === "period"
                            ? "month"
                            : "text"
                    }
                    className={fieldClass}
                    value={draft.specialized[field] || ""}
                    onChange={(event) =>
                      change("specialized", {
                        ...draft.specialized,
                        [field]: event.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </div>
            {["maintenance", "nuclear"].includes(draft.family) && (
              <p className="mt-3 text-sm">{tr("specialistNotice")}</p>
            )}
          </section>
          {draft.family === "warehouse" && (
            <p className="rounded-lg border border-indigo-200 p-3 text-sm">
              <Link className="underline" to="/requests/stock">
                {tr("stockContracts")}
              </Link>
            </p>
          )}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{tr("items")}</h2>
            {draft.items.map((item, index) => (
              <fieldset
                key={`${draft.client_submission_key}-${index}`}
                className="space-y-4 rounded-xl border border-slate-300 p-5 dark:border-slate-700"
              >
                <legend className="px-2 font-semibold">
                  {tr("item")} {index + 1}
                </legend>
                <GenericItemSelector
                  value={item}
                  searchItems={searchGuidedItems}
                  loadReferences={loadReferences}
                  onChange={(patch) => changeItem(index, patch)}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <label>
                    {tr("quantity")}
                    <input
                      required
                      type="number"
                      min="1"
                      step="1"
                      className={fieldClass}
                      value={item.quantity}
                      onChange={(event) =>
                        changeItem(index, { quantity: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    {tr("uom")}
                    <input
                      required
                      maxLength={80}
                      readOnly={Boolean(item.generic_item_id)}
                      className={fieldClass}
                      value={item.unit_of_measure}
                      onChange={(event) =>
                        changeItem(index, {
                          unit_of_measure: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    {tr("cost")}
                    <input
                      required
                      type="number"
                      min="0"
                      step="1"
                      className={fieldClass}
                      value={item.unit_cost}
                      onChange={(event) =>
                        changeItem(index, { unit_cost: event.target.value })
                      }
                    />
                  </label>
                </div>
                <label className="block">
                  {tr("specs")}
                  <textarea
                    maxLength={3000}
                    className={fieldClass}
                    value={item.specs}
                    onChange={(event) =>
                      changeItem(index, { specs: event.target.value })
                    }
                  />
                </label>
                {draft.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      change(
                        "items",
                        draft.items.filter((_, i) => index !== i),
                      )
                    }
                    className="text-red-700 underline"
                  >
                    {tr("remove")}
                  </button>
                )}
              </fieldset>
            ))}
            <button
              type="button"
              disabled={draft.items.length >= 50}
              onClick={() => change("items", [...draft.items, newItem()])}
              className="rounded-lg border border-indigo-600 px-4 py-2"
            >
              {tr("addItem")}
            </button>
          </section>
          <label className="block">
            {tr("justification")}
            <textarea
              required
              maxLength={2000}
              className={fieldClass}
              value={draft.justification}
              onChange={(event) => change("justification", event.target.value)}
            />
          </label>
          <label className="block">
            {tr("impact")}
            <textarea
              required
              maxLength={2000}
              className={fieldClass}
              value={draft.operational_impact}
              onChange={(event) =>
                change("operational_impact", event.target.value)
              }
            />
          </label>
          <label className="block">
            {tr("attachments")}
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xlsx"
              className={fieldClass}
              onChange={chooseFiles}
            />
            <span className="mt-1 block text-sm">{tr("reattach")}</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-lg border px-4 py-3"
            >
              {tr("back")}
            </button>
            <button
              type="submit"
              disabled={busy || !detailsReady}
              className={buttonClass}
            >
              {busy ? tr("working") : tr("review")}
            </button>
          </div>
        </form>
      )}
      {step === 2 && review && (
        <section className="space-y-5 rounded-xl border border-slate-300 p-5 dark:border-slate-700">
          <h2 className="text-xl font-semibold">{tr("review")}</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              [tr("family"), tr(`families.${draft.family}`)],
              [
                tr("category"),
                options.categories.find(
                  (row) => String(row.id) === String(draft.category_id),
                )?.name,
              ],
              [
                tr("purpose"),
                options.purposes.find((row) => row.code === draft.purpose)
                  ?.label,
              ],
              [tr("requiredBy"), draft.required_by],
              [tr("justification"), draft.justification],
              [tr("impact"), draft.operational_impact],
              ...Object.entries(draft.specialized).map(([key, value]) => [
                tr(`fields.${key}`),
                value,
              ]),
            ].map(([key, value]) => (
              <div key={key}>
                <dt className="text-sm text-slate-600 dark:text-slate-300">
                  {key}
                </dt>
                <dd className="whitespace-pre-wrap font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <ul className="divide-y">
            {draft.items.map((item, index) => (
              <li className="py-3" key={index}>
                {item.item_name || item.pending_item?.proposed_name} ·{" "}
                {item.quantity} {item.unit_of_measure}
                <p className="text-sm">{item.specs}</p>
              </li>
            ))}
          </ul>
          <p>
            {tr("attachments")}: {files.length}
          </p>
          <h3 className="font-semibold">{tr("estimatedRoute")}</h3>
          <ol className="list-inside list-decimal">
            {review.approvals.map((rule, index) => (
              <li key={index}>
                {rule.role} · {rule.level}
              </li>
            ))}
          </ol>
          <p className="text-sm">{tr("routeNotice")}</p>
          {review.pending_item_review && (
            <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
              {tr("pendingNotice")}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              type="button"
              onClick={() => {
                setStep(1);
                setReview(null);
              }}
              className="rounded-lg border px-4 py-3"
            >
              {tr("edit")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className={buttonClass}
            >
              {busy ? tr("working") : tr("submit")}
            </button>
          </div>
        </section>
      )}
      <footer className="flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
        <button
          type="button"
          disabled={busy}
          onClick={saveDraft}
          className="rounded-lg border px-4 py-2"
        >
          {tr("saveDraft")}
        </button>
        <span role="status">
          {status === "error"
            ? tr("draftError")
            : status === "saving"
              ? tr("draftSaving")
              : lastSavedLabel
                ? tr("draftNotice")
                : tr("draftLocal")}{" "}
          {lastSavedLabel}
        </span>
      </footer>
    </section>
  );
}
export default function GuidedRequestPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [loadedFor, setLoadedFor] = useState(null);
  const [options, setOptions] = useState(null);
  const [error, setError] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (process.env.REACT_APP_GUIDED_REQUESTS_ENABLED !== "true")
      return undefined;
    let active = true;
    setOptions(null);
    setError("");
    setDisabled(false);
    getGuidedOptions()
      .then((result) => {
        if (active) {
          setOptions(result);
          setLoadedFor(token);
        }
      })
      .catch((failure) => {
        if (active) {
          if (failure.response?.status === 404) setDisabled(true);
          else setError(errorMessage(failure));
        }
      });
    return () => {
      active = false;
    };
  }, [revision, token]);
  if (process.env.REACT_APP_GUIDED_REQUESTS_ENABLED !== "true" || disabled)
    return <RequestTypeSelector />;
  if (error)
    return (
      <div role="alert" className="mx-auto max-w-3xl space-y-4 p-8">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            setError("");
            setRevision((value) => value + 1);
          }}
          className={buttonClass}
        >
          {t("guidedRequest.retry")}
        </button>
        <Link className="block underline" to="/requests/legacy">
          {t("guidedRequest.legacy")}
        </Link>
      </div>
    );
  return options && loadedFor === token ? (
    <GuidedRequestForm
      key={`${options.requester.institute_id}:${options.requester.id}`}
      options={options}
    />
  ) : (
    <p role="status" className="p-8">
      {t("guidedRequest.working")}
    </p>
  );
}
