import React, { useEffect, useMemo, useState } from "react";
import * as api from "../api/approvalPolicies";
import { getOrganizationOptions } from "../api/organization";
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
    [error, setError] = useState("");
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
          <button
            onClick={async () => {
              const name = window.prompt("Policy name", policy.name);
              if (name)
                try {
                  await api.updateApprovalPolicy(policy.id, { name });
                } catch (e) {
                  setError(message(e));
                }
            }}
          >
            Edit policy metadata
          </button>
          <button onClick={createVersion}>Create Draft Version</button>
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
    <section>
      <h2>POLICY VALIDATION / SHADOW ANALYSIS</h2>
      <label>
        Policy version
        <select
          aria-label="Shadow policy version"
          required
          value={form.policyVersionId}
          onChange={(e) =>
            setForm({ ...form, policyVersionId: e.target.value })
          }
        >
          <option value="">Select</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.policyName} — Version {v.version_number}
            </option>
          ))}
        </select>
      </label>
      <section>
        <h3>Individual request</h3>
        <p>
          Temporary UX debt: enter a numeric request ID. The server verifies
          that the request belongs to the authenticated institute.
        </p>
        <label>
          Request ID
          <input
            aria-label="Request ID"
            inputMode="numeric"
            value={form.requestId}
            onChange={(e) => setForm({ ...form, requestId: e.target.value })}
          />
        </label>
        <button
          type="button"
          disabled={!form.policyVersionId}
          onClick={runSingle}
        >
          Run Shadow
        </button>
      </section>
      <form onSubmit={runBatch}>
        <h3>Batch analysis</h3>
        <label>
          Date from
          <input
            type="date"
            value={form.dateFrom}
            onChange={(e) => setForm({ ...form, dateFrom: e.target.value })}
          />
        </label>
        <label>
          Date to
          <input
            type="date"
            value={form.dateTo}
            onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
          />
        </label>
        <label>
          Department
          <select
            aria-label="Shadow department"
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
          >
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Request type
          <input
            value={form.requestType}
            onChange={(e) => setForm({ ...form, requestType: e.target.value })}
          />
        </label>
        <label>
          Sample limit
          <input
            type="number"
            min="1"
            max="100"
            value={form.limit}
            onChange={(e) => setForm({ ...form, limit: e.target.value })}
          />
        </label>
        <button disabled={!form.policyVersionId}>Run shadow analysis</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <div>
            {fields.map(([key, label]) => (
              <p key={key}>
                {label}: <strong>{result[key] || 0}</strong>
              </p>
            ))}
          </div>
          <h3>Generated runs</h3>
          {(result.runs || []).map((run) => (
            <button key={run.id} onClick={() => openRun(run.id)}>
              Open generated run {run.id}
            </button>
          ))}
        </>
      )}
      <section>
        <h3>Existing shadow runs</h3>
        {existingRuns.map((run) => (
          <button key={run.id} onClick={() => openRun(run.id)}>
            Open shadow run {run.id}
          </button>
        ))}
      </section>
      {comparison && <ShadowComparison run={comparison} />}
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
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <header>
        <h1>Approval Policy Administration</h1>
        <p>
          Configure and validate shadow policies. Existing approval routing
          remains authoritative.
        </p>
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
          {canManage && (
            <button onClick={() => setCreating(true)}>Create Policy</button>
          )}
          <button onClick={() => setDashboard((x) => !x)}>
            Shadow validation dashboard
          </button>
          {creating && (
            <form
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
              <input aria-label="Name" name="name" required />
              <input aria-label="Code" name="code" required />
              <textarea aria-label="Description" name="description" />
              <button>Create</button>
              <button type="button" onClick={() => setCreating(false)}>
                Cancel
              </button>
            </form>
          )}
          {items.length === 0 ? (
            <p>No approval policies have been created.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Shadow version</th>
                  <th>Last updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.code}</td>
                    <td>
                      {p.is_active === false
                        ? "INACTIVE"
                        : p.shadow_status || "DRAFT"}
                    </td>
                    <td>{display(p.shadow_version_number)}</td>
                    <td>{display(p.updated_at)}</td>
                    <td>
                      <button
                        onClick={async () => {
                          try {
                            setSelected(await api.getApprovalPolicy(p.id));
                          } catch (e) {
                            setError(message(e));
                          }
                        }}
                      >
                        Open Policy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {dashboard && (
            <ShadowDashboard
              versions={versions}
              departments={orgOptions.departments}
            />
          )}
        </>
      )}
    </main>
  );
}