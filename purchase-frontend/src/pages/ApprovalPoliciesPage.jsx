import React, { useEffect, useMemo, useState } from "react";
import * as api from "../api/approvalPolicies";
import { getOrganizationOptions } from "../api/organization";
import {
  Activity,
  ArrowRight,
  Beaker,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileStack,
  GitBranch,
  History,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
export const CONDITION_TYPES = [
  "REQUEST_TYPE_EQUALS",
  "DEPARTMENT_EQUALS",
  "SECTION_EQUALS",
  "DEPARTMENT_CLASSIFICATION_EQUALS",
  "ORGANIZATION_ANCESTOR_EQUALS",
  "AMOUNT_GTE",
  "AMOUNT_LT",
  "IS_STOCK_REQUEST",
  "IS_NON_STOCK_REQUEST",
  "IS_MAINTENANCE_REQUEST",
  "IS_MEDICAL_DEVICE_REQUEST",
  "IS_MEDICAL_REQUEST",
  "WAREHOUSE_REQUIRED",
];
export const RESOLVER_TYPES = [
  "REQUESTER",
  "DEPARTMENT_HEAD",
  "SECTION_HEAD",
  "EXECUTIVE_OWNER",
  "POSITION",
  "CAPABILITY_HOLDER",
  "FIXED_USER",
  "SUPPLY_CHAIN_AUTHORITY",
  "COO_AUTHORITY",
  "CEO_AUTHORITY",
  "CFO_AUTHORITY",
  "WAREHOUSE_AUTHORITY",
  "MEDICAL_DEVICES_AUTHORITY",
];
export const CAPABILITIES = [
  ["approval-authority.supply-chain", "Supply Chain authority"],
  ["approval-authority.coo", "Chief Operating Officer authority"],
  ["approval-authority.ceo", "Chief Executive Officer authority"],
  ["approval-authority.cfo", "Chief Financial Officer authority"],
  ["approval-authority.warehouse", "Warehouse authority"],
  ["approval-authority.medical-devices", "Medical Devices authority"],
];
const display = (v) => (v == null || v === "" ? "—" : v);
const message = (e) =>
  e?.response?.data?.message ||
  e?.response?.data?.error ||
  e?.message ||
  "The operation failed";
const blankRule = () => ({
  code: "",
  name: "",
  priority: 1,
  stopProcessing: false,
  conditions: [],
  steps: [],
});
const blankCondition = () => ({ type: "REQUEST_TYPE_EQUALS", value: "" });
const blankStep = () => ({
  approvalLevel: 1,
  stepOrder: 1,
  parallelGroup: "",
  semanticKey: "",
  displayName: "",
  resolverType: "REQUESTER",
  resolverReference: "",
  required: true,
});
const fieldClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const labelClass =
  "block text-xs font-semibold uppercase tracking-wide text-slate-600";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none";
export function ShadowComparison({ run }) {
  const facts = run.facts_snapshot || run.facts || {},
    differences = run.differences || run.comparison?.differences || [],
    current = run.currentRoute || [],
    shadow = run.steps || [];
  const Row = ({ s, shadowRoute }) => (
    <tr>
      <td>{display(s.approval_level ?? s.approvalLevel)}</td>
      <td>{display(s.sequence ?? s.stepOrder)}</td>
      <td>{display(s.semantic_key ?? s.semanticKey)}</td>
      <td>{display(s.resolver_type ?? s.resolverType)}</td>
      <td>{display(s.resolved_user_name ?? s.userName ?? s.userId)}</td>
      <td>{display(s.resolution_status ?? s.status)}</td>
    </tr>
  );
  return (
    <section className="space-y-4" aria-label="Shadow route comparison">
      <header className="rounded border-2 border-amber-500 bg-amber-50 p-4">
        <strong className="text-amber-900">
          SHADOW ONLY — DOES NOT CONTROL THIS REQUEST
        </strong>
        <p>Comparison: {run.run_status || run.comparison?.result}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        {[
          ["CURRENT APPROVAL ROUTE", current, false],
          ["POLICY SHADOW ROUTE", shadow, true],
        ].map(([title, rows, isShadow]) => (
          <div key={title}>
            <h3>{title}</h3>
            <table>
              <thead>
                <tr>
                  {[
                    "Level",
                    "Order",
                    "Semantic Purpose",
                    "Resolver",
                    "Resolved User",
                    "Status",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => (
                  <Row key={s.id || i} s={s} shadowRoute={isShadow} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <div aria-label="Differences">
        {differences.map((d, i) => {
          const type = d.difference_type || d.type;
          return (
            <span
              key={i}
              className={`mr-2 inline-block rounded px-2 py-1 difference-${type?.toLowerCase()}`}
            >
              {type}
            </span>
          );
        })}
      </div>
      <div>
        <h3>Matched rules</h3>
        <p>
          {(run.matchedRules || run.summary?.matchedRules || [])
            .map((r) => r.code || r)
            .join(", ") || "None"}
        </p>
        <h3>Relevant request facts</h3>
        <dl>
          {Object.entries(facts).map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{Array.isArray(v) ? v.join(", ") : display(v)}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    </section>
  );
}
function ResolverReference({ step, onChange, options = {} }) {
  const type = step.resolverType;
  if (type === "POSITION")
    return (
      <select
        aria-label="Position"
        value={step.resolverReference || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select position</option>
        {(options.positions || []).map((x) => (
          <option key={x.id} value={x.reference}>
            {x.unit_name} — {x.position_name}
          </option>
        ))}
      </select>
    );
  if (type === "FIXED_USER")
    return (
      <select
        aria-label="Institute user"
        value={step.resolverReference || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select institute user</option>
        {(options.users || []).map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    );
  if (type === "CAPABILITY_HOLDER")
    return (
      <select
        aria-label="Capability"
        value={step.resolverReference || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select capability</option>
        {CAPABILITIES.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    );
  if (type.endsWith("_AUTHORITY"))
    return (
      <span>
        {CAPABILITIES.find((x) =>
          type.startsWith(
            x[0].split(".")[1]?.replaceAll("-", "_").toUpperCase(),
          ),
        )?.[1] || type.replaceAll("_", " ")}
      </span>
    );
  return null;
}
export function VersionDetail({ version, onRefresh, options = {} }) {
  const [draft, setDraft] = useState(() => ({ rules: version.rules || [] })),
    [validation, setValidation] = useState(null),
    [routingReadiness, setRoutingReadiness] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => setDraft({ rules: version.rules || [] }), [version]);
  const editable = version.status === "DRAFT";
  const updateRule = (ri, patch) =>
    setDraft((x) => ({
      ...x,
      rules: x.rules.map((r, i) => (i === ri ? { ...r, ...patch } : r)),
    }));
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.saveApprovalPolicyVersion(version.id, draft);
      onRefresh?.();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  };
  const validate = async () => {
    setError("");
    try {
      const result = await api.validateApprovalPolicyVersion(version.id);
      setValidation(result);
      if (result.valid) onRefresh?.();
    } catch (e) {
      setError(message(e));
    }
  };
  const enter = async () => {
    setError("");
    try {
      await api.enterApprovalPolicyShadow(version.id);
      onRefresh?.();
    } catch (e) {
      setError(message(e));
    }
  };
  const checkReadiness = async () => {
    setError("");
    try {
      setRoutingReadiness(
        await api.getApprovalPolicyVersionReadiness(version.id),
      );
    } catch (e) {
      setError(message(e));
    }
  };
  return (
    <section className="space-y-4">
      <header>
        <h2>Version {version.version_number}</h2>
        <p>
          Status: <strong>{version.status}</strong>
        </p>
        <p>
          Effective: {display(version.effective_from)} –{" "}
          {display(version.effective_to)} · Created{" "}
          {display(version.created_at)}
        </p>
        {!editable && (
          <p>
            Read-only snapshot. Shadow mode validates policy behavior only; it
            is not live routing.
          </p>
        )}
      </header>
      {error && <p role="alert">{error}</p>}
      {validation && (
        <div role="status">
          <strong>
            {validation.valid ? "Validation passed" : "Validation failed"}
          </strong>
          {validation.errors?.map((x) => (
            <p key={x}>{x}</p>
          ))}
          {validation.warnings?.map((x) => (
            <p key={x}>Warning: {x}</p>
          ))}
        </div>
      )}
      {routingReadiness && (
        <div role="status" aria-label="Current routing readiness">
          <strong>Routing readiness: {routingReadiness.status}</strong>
          <p>
            Structural validation:{" "}
            {routingReadiness.structurallyValid ? "PASS" : "FAIL"}
          </p>
          <p>
            Currently routable:{" "}
            {routingReadiness.currentlyRoutable ? "YES" : "NO"}
          </p>
          {[
            ...(routingReadiness.errors || []),
            ...(routingReadiness.warnings || []),
          ].map((item, index) => (
            <p key={`${item.code}-${item.stepId || item.ruleId || index}`}>
              {item.code}: {item.message}
            </p>
          ))}
        </div>
      )}
      <div>
        {draft.rules.map((r, ri) => (
          <article className="rounded border p-4" key={r.id || ri}>
            <label>
              Rule code
              <input
                aria-label={`Rule ${ri + 1} code`}
                disabled={!editable}
                value={r.code || ""}
                onChange={(e) => updateRule(ri, { code: e.target.value })}
              />
            </label>
            <label>
              Rule name
              <input
                aria-label={`Rule ${ri + 1} name`}
                disabled={!editable}
                value={r.name || ""}
                onChange={(e) => updateRule(ri, { name: e.target.value })}
              />
            </label>
            <label>
              Priority
              <input
                aria-label={`Rule ${ri + 1} priority`}
                type="number"
                min="1"
                disabled={!editable}
                value={r.priority}
                onChange={(e) =>
                  updateRule(ri, { priority: Number(e.target.value) })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                disabled={!editable}
                checked={!!r.stopProcessing}
                onChange={(e) =>
                  updateRule(ri, { stopProcessing: e.target.checked })
                }
              />{" "}
              Stop processing
            </label>
            <h4>Conditions</h4>
            {(r.conditions || []).map((c, ci) => (
              <div key={ci}>
                <select
                  aria-label={`Condition ${ci + 1} type`}
                  disabled={!editable}
                  value={c.type}
                  onChange={(e) =>
                    updateRule(ri, {
                      conditions: r.conditions.map((v, i) =>
                        i === ci ? { ...v, type: e.target.value } : v,
                      ),
                    })
                  }
                >
                  {CONDITION_TYPES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <input
                  aria-label={`Condition ${ci + 1} value`}
                  disabled={!editable}
                  value={c.value}
                  onChange={(e) =>
                    updateRule(ri, {
                      conditions: r.conditions.map((v, i) =>
                        i === ci ? { ...v, value: e.target.value } : v,
                      ),
                    })
                  }
                />
                {editable && (
                  <button
                    onClick={() =>
                      updateRule(ri, {
                        conditions: r.conditions.filter((_, i) => i !== ci),
                      })
                    }
                  >
                    Remove condition
                  </button>
                )}
              </div>
            ))}
            {editable && (
              <button
                onClick={() =>
                  updateRule(ri, {
                    conditions: [...(r.conditions || []), blankCondition()],
                  })
                }
              >
                Add condition
              </button>
            )}
            <h4>Steps</h4>
            {(r.steps || []).map((s, si) => (
              <fieldset key={si}>
                <legend>Step {si + 1}</legend>
                {[
                  ["approvalLevel", "Approval level", "number"],
                  ["stepOrder", "Step order", "number"],
                  ["parallelGroup", "Parallel group", "text"],
                  ["semanticKey", "Semantic key", "text"],
                  ["displayName", "Display name", "text"],
                ].map(([key, label, type]) => (
                  <label key={key}>
                    {label}
                    <input
                      aria-label={`Step ${si + 1} ${label}`}
                      type={type}
                      disabled={!editable}
                      value={s[key] ?? ""}
                      onChange={(e) =>
                        updateRule(ri, {
                          steps: r.steps.map((v, i) =>
                            i === si
                              ? {
                                  ...v,
                                  [key]:
                                    type === "number"
                                      ? Number(e.target.value)
                                      : e.target.value,
                                }
                              : v,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Resolver
                  <select
                    aria-label={`Step ${si + 1} resolver`}
                    disabled={!editable}
                    value={s.resolverType}
                    onChange={(e) =>
                      updateRule(ri, {
                        steps: r.steps.map((v, i) =>
                          i === si
                            ? {
                                ...v,
                                resolverType: e.target.value,
                                resolverReference: "",
                              }
                            : v,
                        ),
                      })
                    }
                  >
                    {RESOLVER_TYPES.map((x) => (
                      <option key={x}>{x.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                </label>
                <ResolverReference
                  step={s}
                  options={options}
                  onChange={(value) =>
                    updateRule(ri, {
                      steps: r.steps.map((v, i) =>
                        i === si ? { ...v, resolverReference: value } : v,
                      ),
                    })
                  }
                />
                <label>
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={s.required !== false}
                    onChange={(e) =>
                      updateRule(ri, {
                        steps: r.steps.map((v, i) =>
                          i === si ? { ...v, required: e.target.checked } : v,
                        ),
                      })
                    }
                  />{" "}
                  Required
                </label>
                {editable && (
                  <button
                    onClick={() =>
                      updateRule(ri, {
                        steps: r.steps.filter((_, i) => i !== si),
                      })
                    }
                  >
                    Remove step
                  </button>
                )}
              </fieldset>
            ))}
            {editable && (
              <button
                onClick={() =>
                  updateRule(ri, { steps: [...(r.steps || []), blankStep()] })
                }
              >
                Add step
              </button>
            )}
            {editable && (
              <button
                onClick={() =>
                  setDraft((x) => ({
                    ...x,
                    rules: x.rules.filter((_, i) => i !== ri),
                  }))
                }
              >
                Remove rule
              </button>
            )}
          </article>
        ))}
      </div>
      {editable && (
        <div>
          <button
            onClick={() =>
              setDraft((x) => ({ ...x, rules: [...x.rules, blankRule()] }))
            }
          >
            Add rule
          </button>
          <button disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button onClick={validate}>Validate</button>
        </div>
      )}
      {version.status === "VALIDATED" && (
        <button onClick={enter}>Enter Shadow Mode</button>
      )}
      <button onClick={checkReadiness}>Check routing readiness</button>
    </section>
  );
}
export function PolicyDetail({
  policy,
  onBack,
  canManage = true,
  options = {},
}) {
  const [selected, setSelected] = useState(),
    [error, setError] = useState(""),
    [editingMetadata, setEditingMetadata] = useState(false),
    [metadata, setMetadata] = useState({
      name: policy.name,
      description: policy.description || "",
    });
  const createVersion = async () => {
    try {
      const v = await api.createApprovalPolicyVersion(policy.id, {});
      setSelected(v);
    } catch (e) {
      setError(message(e));
    }
  };
  return (
    <section>
      <button onClick={onBack}>Back to policies</button>
      <h1>{policy.name}</h1>
      <p>
        <strong>{policy.code}</strong> · {display(policy.description)}
      </p>
      {error && <p role="alert">{error}</p>}
      {canManage && (
        <>
          <button onClick={() => setEditingMetadata(true)}>
            Edit policy metadata
          </button>
          <button onClick={createVersion}>Create Draft Version</button>
          {editingMetadata && (
            <form
              aria-label="Edit policy metadata"
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  await api.updateApprovalPolicy(policy.id, metadata);
                  setEditingMetadata(false);
                } catch (e) {
                  setError(message(e));
                }
              }}
            >
              <label>
                Name
                <input
                  aria-label="Policy name"
                  required
                  value={metadata.name}
                  onChange={(e) =>
                    setMetadata({ ...metadata, name: e.target.value })
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  aria-label="Policy description"
                  value={metadata.description}
                  onChange={(e) =>
                    setMetadata({ ...metadata, description: e.target.value })
                  }
                />
              </label>
              <button>Save metadata</button>
              <button type="button" onClick={() => setEditingMetadata(false)}>
                Cancel
              </button>
            </form>
          )}
        </>
      )}
      <h2>Versions</h2>
      <table>
        <thead>
          <tr>
            <th>Number</th>
            <th>Status</th>
            <th>Effective dates</th>
            <th>Created</th>
            <th>Shadow status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(policy.versions || []).map((v) => (
            <tr key={v.id}>
              <td>{v.version_number}</td>
              <td>{v.status}</td>
              <td>
                {display(v.effective_from)} – {display(v.effective_to)}
              </td>
              <td>{display(v.created_at)}</td>
              <td>{v.status === "SHADOW" ? "Shadow analysis enabled" : "—"}</td>
              <td>
                <button
                  onClick={async () =>
                    setSelected(await api.getApprovalPolicyVersion(v.id))
                  }
                >
                  Open version
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && (
        <VersionDetail
          options={options}
          version={selected}
          onRefresh={async () =>
            setSelected(await api.getApprovalPolicyVersion(selected.id))
          }
        />
      )}
    </section>
  );
}
export function ShadowDashboard({ versions = [], departments = [] }) {
  const [form, setForm] = useState({
    policyVersionId: "",
    requestId: "",
    dateFrom: "",
    dateTo: "",
    departmentId: "",
    requestType: "",
    limit: 50,
  });
  const [result, setResult] = useState();
  const [comparison, setComparison] = useState();
  const [existingRuns, setExistingRuns] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .listShadowRuns({ limit: 50 })
      .then(setExistingRuns)
      .catch((x) => setError(message(x)));
  }, []);
  const openRun = async (id) => {
    setError("");
    try {
      setComparison(await api.getShadowRun(id));
    } catch (x) {
      setError(message(x));
    }
  };
  const runSingle = async () => {
    if (!/^\d+$/.test(form.requestId)) {
      setError("Request ID must be a numeric request identifier");
      return;
    }
    setError("");
    try {
      setComparison(
        await api.runApprovalPolicyShadow(form.policyVersionId, form.requestId),
      );
    } catch (x) {
      setError(message(x));
    }
  };
  const runBatch = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const batch = { ...form };
      delete batch.requestId;
      const value = await api.runApprovalPolicyShadowBatch({
        ...batch,
        limit: Number(form.limit),
      });
      setResult(value);
      setExistingRuns((x) => [...(value.runs || []), ...x]);
    } catch (x) {
      setError(message(x));
    }
  };
  const fields = [
    ["evaluated", "Evaluated"],
    ["match", "Matches"],
    ["partialMatch", "Partial matches"],
    ["different", "Different"],
    ["unresolved", "Unresolved"],
    ["ambiguous", "Ambiguous"],
  ];
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label="Policy validation and shadow analysis"
    >
      <header className="border-b border-slate-200 bg-slate-50/70 px-6 py-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
            <Beaker className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900">
              Policy validation &amp; shadow analysis
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Compare proposed routing against live behavior without affecting
              active requests.
            </p>
          </div>
        </div>
      </header>
      <div className="space-y-6 p-6">
        <label className={labelClass}>
          Shadow policy version
          <select
            className={`${fieldClass} max-w-xl`}
            aria-label="Shadow policy version"
            required
            value={form.policyVersionId}
            onChange={(e) =>
              setForm({ ...form, policyVersionId: e.target.value })
            }
          >
            <option value="">Select a validated version</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.policyName} — Version {v.version_number}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-slate-900">
                Test an individual request
              </h3>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-500">
              Enter a request ID to compare its current route with the selected
              policy. Your live workflow will not change.
            </p>
            <div className="mt-5 flex items-end gap-3">
              <label className={`${labelClass} flex-1`}>
                Request ID
                <input
                  className={fieldClass}
                  aria-label="Request ID"
                  inputMode="numeric"
                  placeholder="e.g. 10482"
                  value={form.requestId}
                  onChange={(e) =>
                    setForm({ ...form, requestId: e.target.value })
                  }
                />
              </label>
              <button
                className={primaryButtonClass}
                type="button"
                disabled={!form.policyVersionId}
                onClick={runSingle}
              >
                <Play className="h-4 w-4" /> Run Shadow
              </button>
            </div>
          </section>
          <form
            className="rounded-xl border border-slate-200 p-5"
            onSubmit={runBatch}
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-slate-900">
                Run a batch analysis
              </h3>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Sample historical requests using optional filters.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Date from
                <input
                  className={fieldClass}
                  type="date"
                  value={form.dateFrom}
                  onChange={(e) =>
                    setForm({ ...form, dateFrom: e.target.value })
                  }
                />
              </label>
              <label className={labelClass}>
                Date to
                <input
                  className={fieldClass}
                  type="date"
                  value={form.dateTo}
                  onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
                />
              </label>
              <label className={labelClass}>
                Department
                <select
                  className={fieldClass}
                  aria-label="Shadow department"
                  value={form.departmentId}
                  onChange={(e) =>
                    setForm({ ...form, departmentId: e.target.value })
                  }
                >
                  <option value="">All</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Request type
                <input
                  className={fieldClass}
                  placeholder="All request types"
                  value={form.requestType}
                  onChange={(e) =>
                    setForm({ ...form, requestType: e.target.value })
                  }
                />
              </label>
              <label className={labelClass}>
                Sample limit
                <input
                  className={fieldClass}
                  type="number"
                  min="1"
                  max="100"
                  value={form.limit}
                  onChange={(e) => setForm({ ...form, limit: e.target.value })}
                />
              </label>
              <div className="flex items-end">
                <button
                  className={`${primaryButtonClass} w-full`}
                  disabled={!form.policyVersionId}
                >
                  <Beaker className="h-4 w-4" /> Run shadow analysis
                </button>
              </div>
            </div>
          </form>
        </div>
        {error && (
          <div
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            <CircleAlert className="h-4 w-4" />
            {error}
          </div>
        )}
        {result && (
          <section className="rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900">Batch results</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {fields.map(([key, label]) => (
                <div className="rounded-lg bg-slate-50 p-3" key={key}>
                  <p className="text-xs font-medium text-slate-500">{label}:</p>
                  <strong className="mt-1 block text-xl text-slate-900">
                    {result[key] || 0}
                  </strong>
                </div>
              ))}
            </div>
            <h3 className="mt-5 text-sm font-semibold text-slate-700">
              Generated runs
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {(result.runs || []).map((run) => (
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  key={run.id}
                  onClick={() => openRun(run.id)}
                >
                  Open generated run {run.id}
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h3 className="font-semibold text-slate-900">Recent shadow runs</h3>
          </div>
          {existingRuns.length === 0 && (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center">
              <Clock3 className="mx-auto h-5 w-5 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-600">
                No shadow runs yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Completed comparisons will appear here.
              </p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {existingRuns.map((run) => (
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                key={run.id}
                onClick={() => openRun(run.id)}
              >
                Open shadow run {run.id}
              </button>
            ))}
          </div>
        </section>
        {comparison && <ShadowComparison run={comparison} />}
      </div>
    </section>
  );
}
export function PolicySimulator({ versions = [], departments = [] }) {
  const [form, setForm] = useState({
    versionId: "",
    departmentId: "",
    requestType: "NON_STOCK",
    estimatedAmount: "",
    isStockRequest: false,
    isMaintenanceRequest: false,
    isMedicalDeviceRequest: false,
    isMedicalRequest: false,
    warehouseRequired: false,
  });
  const [result, setResult] = useState(),
    [error, setError] = useState("");
  const run = async (event) => {
    event.preventDefault();
    setError("");
    try {
      setResult(
        await api.simulateApprovalPolicy(form.versionId, {
          ...form,
          versionId: undefined,
          departmentId: form.departmentId || null,
          estimatedAmount: form.estimatedAmount || null,
        }),
      );
    } catch (e) {
      setError(message(e));
    }
  };
  const flags = [
    ["isStockRequest", "Stock request"],
    ["isMaintenanceRequest", "Maintenance"],
    ["isMedicalDeviceRequest", "Medical device"],
    ["isMedicalRequest", "Medical request"],
    ["warehouseRequired", "Warehouse required"],
  ];
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label="Policy simulator"
    >
      <header className="border-b border-slate-200 bg-slate-50/70 px-6 py-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
            <SlidersHorizontal className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900">Policy simulator</h2>
            <p className="mt-1 text-sm text-slate-500">
              Preview the route a policy would resolve for a hypothetical
              request.
            </p>
          </div>
        </div>
      </header>
      <div className="space-y-6 p-6">
        <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Diagnostic only.</strong> No request, approval,
            notification, or workflow record will be created.
          </p>
        </div>
        <form className="space-y-6" onSubmit={run}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClass}>
              Policy version
              <select
                className={fieldClass}
                aria-label="Simulation policy version"
                required
                value={form.versionId}
                onChange={(e) =>
                  setForm({ ...form, versionId: e.target.value })
                }
              >
                <option value="">Select a policy version</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.policyName} — Version {v.version_number}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Department
              <select
                className={fieldClass}
                aria-label="Simulation department"
                value={form.departmentId}
                onChange={(e) =>
                  setForm({ ...form, departmentId: e.target.value })
                }
              >
                <option value="">No department selected</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Request type
              <input
                className={fieldClass}
                aria-label="Simulation request type"
                value={form.requestType}
                onChange={(e) =>
                  setForm({ ...form, requestType: e.target.value })
                }
              />
            </label>
            <label className={labelClass}>
              Estimated amount
              <input
                className={fieldClass}
                aria-label="Simulation amount"
                inputMode="decimal"
                placeholder="0.00"
                value={form.estimatedAmount}
                onChange={(e) =>
                  setForm({ ...form, estimatedAmount: e.target.value })
                }
              />
            </label>
          </div>
          <fieldset>
            <legend className={labelClass}>Request characteristics</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {flags.map(([key, label]) => (
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${form[key] ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                  key={key}
                >
                  <input
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button className={primaryButtonClass} disabled={!form.versionId}>
              <Play className="h-4 w-4" /> Simulate route
            </button>
          </div>
        </form>
        {error && (
          <div
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            <CircleAlert className="h-4 w-4" />
            {error}
          </div>
        )}
        {result && (
          <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">Resolved route</h3>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Simulation complete
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Matched rules:{" "}
              {result.matchedRules.map((r) => r.code).join(", ") || "None"}
            </p>
            <div className="mt-4 grid gap-3">
              {result.steps.map((s, i) => (
                <article
                  key={i}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <strong>
                    Level {s.approvalLevel}: {s.displayName}
                  </strong>
                  <p>Purpose: {s.semanticKey}</p>
                  <p>
                    Required authority: {s.requestedAuthority || s.resolverType}
                  </p>
                  <p>Position holder: {s.positionHolderName || "Unresolved"}</p>
                  {s.actingApproverName && (
                    <p>Acting approver: {s.actingApproverName}</p>
                  )}
                  <p>
                    Resolution: {s.resolutionStatus}
                    {s.duplicatePrincipal ? " · DUPLICATE_PRINCIPAL" : ""}
                  </p>
                  {s.resolutionReason && <p>{s.resolutionReason}</p>}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
export function CutoverReadiness() {
  const [data, setData] = useState(),
    [error, setError] = useState("");
  useEffect(() => {
    api
      .getApprovalPolicyReadiness()
      .then(setData)
      .catch((e) => setError(message(e)));
  }, []);
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label="Live cutover readiness"
    >
      <header className="border-b border-slate-200 bg-slate-50/70 px-6 py-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900">
              Live-cutover readiness
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Review the safeguards required before policy routing can control
              live requests.
            </p>
          </div>
        </div>
      </header>
      <div className="space-y-5 p-6">
        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}
        {!data && !error && (
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading readiness diagnostics…
          </div>
        )}
        {data && (
          <>
            <div
              className={`flex flex-col justify-between gap-4 rounded-xl border p-5 sm:flex-row sm:items-center ${data.cutoverStatus === "READY" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Current cutover status
                </p>
                <strong className="mt-1 block text-2xl text-slate-900">
                  {data.cutoverStatus}
                </strong>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${data.liveRoutingEnabled ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${data.liveRoutingEnabled ? "bg-white" : "bg-slate-500"}`}
                />
                Live routing {data.liveRoutingEnabled ? "enabled" : "disabled"}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(data)
                .filter(
                  ([k]) => !["cutoverStatus", "liveRoutingEnabled"].includes(k),
                )
                .map(([group, values]) => (
                  <article
                    className="rounded-xl border border-slate-200 bg-white p-5"
                    key={group}
                  >
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {group.replaceAll("_", " ")}
                    </h3>
                    <dl className="mt-3 divide-y divide-slate-100">
                      {Object.entries(values).map(([k, v]) => (
                        <div
                          className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                          key={k}
                        >
                          <dt className="text-sm capitalize text-slate-600">
                            {k.replaceAll("_", " ")}
                          </dt>
                          <dd className="rounded-md bg-slate-100 px-2 py-1 text-sm font-semibold text-slate-900">
                            {String(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
export default function ApprovalPoliciesPage({ canManage = true }) {
  const [items, setItems] = useState(null);
  const [orgOptions, setOrgOptions] = useState({
    departments: [],
    users: [],
    positions: [],
  });
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState();
  const [dashboard, setDashboard] = useState(false);
  const [simulator, setSimulator] = useState(false),
    [readiness, setReadiness] = useState(false);
  const load = () => {
    setError("");
    Promise.all([api.listApprovalPolicies(), getOrganizationOptions()])
      .then(([policies, options]) => {
        setItems(policies);
        setOrgOptions(options);
      })
      .catch((e) => setError(message(e) || "Unable to load approval policies"));
  };
  useEffect(load, []);
  const versions = useMemo(
    () =>
      (items || [])
        .filter((p) => p.shadow_version_id)
        .map((p) => ({
          id: p.shadow_version_id,
          version_number: p.shadow_version_number,
          status: "SHADOW",
          policyName: p.name,
        })),
    [items],
  );
  const policyStats = useMemo(() => {
    const policies = items || [];
    return {
      total: policies.length,
      shadow: policies.filter((policy) => policy.shadow_version_id).length,
      active: policies.filter((policy) => policy.is_active !== false).length,
      drafts: policies.filter((policy) => !policy.shadow_version_id).length,
    };
  }, [items]);
  if (selected)
    return (
      <main className="mx-auto max-w-7xl p-6">
        <PolicyDetail
          policy={selected}
          options={orgOptions}
          canManage={canManage}
          onBack={() => setSelected(null)}
        />
      </main>
    );
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 px-6 py-7 text-white shadow-xl sm:px-8">
        <div
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-400/10 blur-2xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              <ShieldCheck className="h-4 w-4" /> Governance control center
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Approval Engine 2.0
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Design, validate, and safely test intelligent approval routes
              before they reach production. Existing approval routing remains
              authoritative.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              onClick={load}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            {canManage && (
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400"
                onClick={() => setCreating(true)}
              >
                <Plus className="h-4 w-4" /> Create Policy
              </button>
            )}
          </div>
        </div>
      </header>
      {error && (
        <div>
          <p role="alert">{error}</p>
          <button onClick={load}>Retry</button>
        </div>
      )}
      {!items && !error && <p>Loading approval policies…</p>}
      {items && (
        <>
          <section
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Approval policy summary"
          >
            {[
              [
                "Total policies",
                policyStats.total,
                FileStack,
                "bg-blue-50 text-blue-700",
              ],
              [
                "Active policies",
                policyStats.active,
                CheckCircle2,
                "bg-emerald-50 text-emerald-700",
              ],
              [
                "In shadow mode",
                policyStats.shadow,
                Beaker,
                "bg-violet-50 text-violet-700",
              ],
              [
                "Awaiting validation",
                policyStats.drafts,
                Activity,
                "bg-amber-50 text-amber-700",
              ],
            ].map(([label, value, Icon, tone]) => (
              <article
                key={label}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      {value}
                    </p>
                  </div>
                  <span className={`rounded-xl p-3 ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </article>
            ))}
          </section>

          <nav
            className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
            aria-label="Approval engine tools"
          >
            <button
              aria-pressed={dashboard}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${dashboard ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
              onClick={() => {
                setDashboard((x) => !x);
                setSimulator(false);
                setReadiness(false);
              }}
            >
              <Beaker className="h-4 w-4" />
              Shadow validation dashboard
            </button>
            <button
              aria-pressed={simulator}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${simulator ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
              onClick={() => {
                setSimulator((x) => !x);
                setDashboard(false);
                setReadiness(false);
              }}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Policy simulator
            </button>
            <button
              aria-pressed={readiness}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${readiness ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
              onClick={() => {
                setReadiness((x) => !x);
                setDashboard(false);
                setSimulator(false);
              }}
            >
              <ShieldCheck className="h-4 w-4" />
              Cutover readiness
            </button>
          </nav>
          {creating && (
            <form
              className="grid gap-4 rounded-xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm md:grid-cols-2"
              onSubmit={async (ev) => {
                ev.preventDefault();
                const data = new FormData(ev.currentTarget);
                try {
                  const made = await api.createApprovalPolicy({
                    name: data.get("name"),
                    code: data.get("code"),
                    description: data.get("description"),
                  });
                  setItems((x) => [made, ...x]);
                  setCreating(false);
                } catch (e) {
                  setError(message(e));
                }
              }}
            >
              <label className="text-sm font-medium text-slate-700">
                Policy name
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  aria-label="Name"
                  name="name"
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Policy code
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  aria-label="Code"
                  name="code"
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Description
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  aria-label="Description"
                  name="description"
                  rows="2"
                />
              </label>
              <div className="flex gap-2 md:col-span-2">
                <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  Create
                </button>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  type="button"
                  onClick={() => setCreating(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {!dashboard &&
            !simulator &&
            !readiness &&
            (items.length === 0 ? (
              <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <GitBranch className="h-7 w-7" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">
                  Build your first approval policy
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  Start with a draft, validate every resolver, then safely
                  compare it in shadow mode before cutover.
                </p>
                {canManage && (
                  <button
                    className={`${primaryButtonClass} mt-6`}
                    onClick={() => setCreating(true)}
                  >
                    <Plus className="h-4 w-4" /> Create your first policy
                  </button>
                )}
              </section>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="font-semibold text-slate-900">
                    Policy registry
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Versioned routing policies and their current validation
                    state.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Name</th>
                        <th className="px-5 py-3">Code</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Shadow version</th>
                        <th className="px-5 py-3">Last updated</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr
                          key={p.id}
                          className="border-t border-slate-100 hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4 font-semibold text-slate-900">
                            {p.name}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-600">
                            {p.code}
                          </td>
                          <td className="px-5 py-4">
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              {p.is_active === false
                                ? "INACTIVE"
                                : p.shadow_status || "DRAFT"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {display(p.shadow_version_number)}
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {display(p.updated_at)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900"
                              onClick={async () => {
                                try {
                                  setSelected(
                                    await api.getApprovalPolicy(p.id),
                                  );
                                } catch (e) {
                                  setError(message(e));
                                }
                              }}
                            >
                              Open Policy <ArrowRight className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          {dashboard && (
            <ShadowDashboard
              versions={versions}
              departments={orgOptions.departments}
            />
          )}
          {simulator && (
            <PolicySimulator
              versions={versions}
              departments={orgOptions.departments}
            />
          )}
          {readiness && <CutoverReadiness />}
        </>
      )}
    </main>
  );
}