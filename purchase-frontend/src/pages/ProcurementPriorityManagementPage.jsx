import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  archivePriorityGroup,
  createPriorityGroup,
  getPriorityGroups,
  getPriorityHistory,
  getPriorityManagementQueue,
  getPriorityProfile,
  previewPriorityAssessment,
  reorderInstitutionalPriorities,
  updatePriorityAssessment,
  updatePriorityGroup,
} from "../api/procurementPriority";
import PriorityTierBadge from "../components/priority/PriorityTierBadge";
import {
  PriorityFactorBreakdown,
  PriorityHistory,
} from "../components/priority/ProcurementPriorityViews";
import { useAuth } from "../hooks/useAuth";
import { hasPermission } from "../utils/permissions";

const emptyFilters = {
  search: "",
  tier: "",
  department: "",
  status: "",
  group: "",
};
const field = (row, ...names) =>
  names
    .map((name) => row?.[name])
    .find((value) => value !== undefined && value !== null);
const caseLabel = (row) =>
  field(row, "request_reference", "request_number", "case_reference") ||
  "Procurement requirement";

const OPTIONS = {
  impact_level: [
    "CONVENIENCE",
    "MINOR_OPERATIONAL",
    "DEPARTMENT_EFFICIENCY",
    "IMPORTANT_SERVICE",
    "MAJOR_SERVICE_DISRUPTION",
    "PATIENT_SAFETY_OR_ESSENTIAL_SERVICE",
  ],
  service_risk_level: [
    "NO_EFFECT",
    "LOW_STOCK",
    "BELOW_THRESHOLD",
    "PROJECTED_STOCKOUT",
    "OUT_OF_STOCK",
  ],
  deadline_type: [
    "NONE",
    "PLANNED",
    "TIME_SENSITIVE",
    "IMMINENT_OPERATIONAL",
    "FIXED_CRITICAL",
  ],
  dependency_level: [
    "NONE",
    "SINGLE_ACTIVITY_BLOCKED",
    "DEPARTMENT_PROCESS_BLOCKED",
    "MULTIPLE_PROCESSES_BLOCKED",
    "MAJOR_INSTITUTIONAL_DEPENDENCY",
  ],
  regulatory_level: [
    "NONE",
    "MINOR_COMPLIANCE",
    "CONTRACTUAL_EXPOSURE",
    "REGULATORY_OR_AUTHORIZATION_RISK",
  ],
};
export const toCanonicalAssessmentDto = (form) => ({
  impact_level: form.impact_level,
  impact_reason: form.impact_reason,
  scm_assessment: Number(form.scm_assessment),
  scm_reason: form.scm_reason,
  service_risk_level: form.service_risk_level,
  service_risk_override_reason: form.service_risk_override_reason,
  deadline_at: form.deadline_at || null,
  deadline_type: form.deadline_type,
  deadline_consequence: form.deadline_consequence,
  dependency_level: form.dependency_level,
  dependency_reason: form.dependency_reason,
  regulatory_level: form.regulatory_level,
  regulatory_reason: form.regulatory_reason,
  approved_initiative_id: form.approved_initiative_id || null,
  p0_justification: form.p0_justification,
});
function AssessmentForm({ profile, onSaved }) {
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const set = (name, value) => setForm((old) => ({ ...old, [name]: value }));
  useEffect(
    () =>
      setForm({
        scm_assessment: profile.scm_assessment ?? "",
        scm_reason: profile.scm_reason || "",
        impact_level: profile.impact_level || "CONVENIENCE",
        impact_reason: profile.impact_reason || "",
        service_risk_level: profile.service_risk_level || "NO_EFFECT",
        service_risk_override_reason:
          profile.service_risk_override_reason || "",
        deadline_type: profile.deadline_type || "NONE",
        deadline_at: profile.deadline_at?.slice?.(0, 10) || "",
        deadline_consequence: profile.deadline_consequence || "",
        dependency_level: profile.dependency_level || "NONE",
        dependency_reason: profile.dependency_reason || "",
        regulatory_level: profile.regulatory_level || "NONE",
        regulatory_reason: profile.regulatory_reason || "",
        approved_initiative_id: profile.approved_initiative_id || "",
        p0_justification: profile.p0_justification || "",
      }),
    [profile],
  );
  useEffect(() => {
    if (form.scm_assessment === "" || !form.scm_reason) return;
    const timer = setTimeout(
      () =>
        previewPriorityAssessment(
          profile.procurement_case_id,
          toCanonicalAssessmentDto(form),
        )
          .then((x) => {
            setPreview(x.data);
            setError("");
          })
          .catch((e) =>
            setError(
              e.response?.data?.message ||
                "Unable to calculate projected priority.",
            ),
          ),
      300,
    );
    return () => clearTimeout(timer);
  }, [form, profile.procurement_case_id]);
  const submit = async (e) => {
    e.preventDefault();
    if (preview?.p0JustificationRequired && !form.p0_justification.trim())
      return setError("P0 justification is required.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updatePriorityAssessment(
        profile.procurement_case_id,
        toCanonicalAssessmentDto(form),
      );
      setSuccess("Assessment saved successfully.");
      await onSaved();
    } catch (e) {
      setError(
        e.response?.status === 403
          ? "You do not have permission to save this assessment."
          : e.response?.status === 503
            ? "Procurement Priority schema is unavailable."
            : e.response?.data?.message || "Unable to save assessment.",
      );
    } finally {
      setSaving(false);
    }
  };
  const input = (label, name, props = {}) => (
    <label className="block text-sm font-medium">
      {label}
      <input
        {...props}
        value={form[name] ?? ""}
        onChange={(e) => set(name, e.target.value)}
        className="mt-1 w-full rounded border p-2"
      />
    </label>
  );
  const select = (label, name) => (
    <label className="block text-sm font-medium">
      {label}
      <select
        value={form[name] || ""}
        onChange={(e) => set(name, e.target.value)}
        className="mt-1 w-full rounded border p-2"
      >
        {OPTIONS[name].map((v) => (
          <option key={v} value={v}>
            {v.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="text-lg font-semibold">SCM Assessment</h3>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-green-700">
          {success}
        </p>
      )}
      {input("SCM assessment (0–100)", "scm_assessment", {
        type: "number",
        min: 0,
        max: 100,
        required: true,
      })}
      {input("Mandatory SCM reason", "scm_reason", { required: true })}
      {select("Impact", "impact_level")}
      {input("Impact reason", "impact_reason")}
      {select("Service / stockout risk", "service_risk_level")}
      {input("Service risk override reason", "service_risk_override_reason")}
      {select("Deadline classification", "deadline_type")}
      {input("Deadline date", "deadline_at", { type: "date" })}
      {input("Deadline consequence", "deadline_consequence")}
      {select("Dependency", "dependency_level")}
      {input("Dependency reason", "dependency_reason")}
      {select("Regulatory / contractual consequence", "regulatory_level")}
      {input("Regulatory reason", "regulatory_reason")}
      <p className="rounded bg-slate-100 p-2 text-sm">
        Strategic initiative:{" "}
        {profile.strategic_initiative_title ||
          "Not supplied by governed source"}{" "}
        (read-only)
      </p>
      {preview && (
        <p className="rounded bg-blue-50 p-2">
          <b>Projected Score:</b> {preview.score} · <b>Projected Tier:</b>{" "}
          {preview.tier}
        </p>
      )}
      {preview?.p0JustificationRequired &&
        input("P0 justification", "p0_justification", { required: true })}
      <button
        disabled={saving}
        className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save assessment"}
      </button>
    </form>
  );
}

function GroupManager({ cases }) {
  const [groups, setGroups] = useState([]);
  const [groupState, setGroupState] = useState("loading");
  const [groupError, setGroupError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    public_title: "",
    public_description: "",
    is_public: false,
    member_case_ids: [],
  });
  const load = () => {
    setGroupState("loading");
    getPriorityGroups()
      .then((x) => {
        setGroups(x.data || []);
        setGroupState("ready");
      })
      .catch((e) => {
        setGroupState(
          e.response?.status === 403
            ? "denied"
            : e.response?.status === 503
              ? "unavailable"
              : "error",
        );
        setGroupError(
          e.response?.data?.message || "Unable to load priority groups.",
        );
      });
  };
  useEffect(load, []);
  const save = async (e) => {
    e.preventDefault();
    editing
      ? await updatePriorityGroup(editing.id, form)
      : await createPriorityGroup(form);
    setEditing(null);
    setForm({
      public_title: "",
      public_description: "",
      is_public: false,
      member_case_ids: [],
    });
    load();
  };
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="text-xl font-semibold">Priority Groups</h2>
      {groupState === "loading" && <p>Loading priority groups…</p>}
      {groupState === "denied" && (
        <p role="alert">
          You do not have permission to manage priority groups.
        </p>
      )}
      {groupState === "unavailable" && (
        <p role="alert">Procurement Priority schema is unavailable.</p>
      )}
      {groupState === "error" && <p role="alert">{groupError}</p>}
      <form onSubmit={save} className="mt-3 grid gap-3 md:grid-cols-2">
        <label>
          Public title
          <input
            aria-label="Group public title"
            required
            className="block w-full rounded border p-2"
            value={form.public_title}
            onChange={(e) => setForm({ ...form, public_title: e.target.value })}
          />
        </label>
        <label>
          Public description
          <input
            className="block w-full rounded border p-2"
            value={form.public_description}
            onChange={(e) =>
              setForm({ ...form, public_description: e.target.value })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.is_public}
            onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
          />{" "}
          Public visibility
        </label>
        <fieldset className="md:col-span-2">
          <legend className="font-medium">Procurement cases</legend>
          <div className="max-h-48 overflow-y-auto rounded border p-2">
            {cases.map((item) => (
              <label key={item.procurement_case_id} className="block py-1">
                <input
                  type="checkbox"
                  checked={form.member_case_ids.includes(
                    item.procurement_case_id,
                  )}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      member_case_ids: e.target.checked
                        ? [...form.member_case_ids, item.procurement_case_id]
                        : form.member_case_ids.filter(
                            (id) => id !== item.procurement_case_id,
                          ),
                    })
                  }
                />{" "}
                {caseLabel(item)} · {item.public_title} ·{" "}
                {item.department_name || "Department"} · {item.system_tier} ·{" "}
                {item.system_score} · {item.case_status}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="rounded bg-blue-700 px-3 py-2 text-white">
          {editing ? "Save group" : "Create Group"}
        </button>
      </form>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th>Group title</th>
              <th>Tier</th>
              <th>Derived score</th>
              <th>Institutional rank</th>
              <th>Active members</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.id} className="border-t">
                <td>{group.public_title}</td>
                <td>
                  <PriorityTierBadge tier={group.tier || group.tier_override} />
                </td>
                <td>{group.derived_score ?? "—"}</td>
                <td>{group.institutional_rank ?? "—"}</td>
                <td>{group.active_member_count ?? group.member_count ?? 0}</td>
                <td>{group.status}</td>
                <td>
                  <button
                    onClick={() => {
                      setEditing(group);
                      setForm({
                        public_title: group.public_title,
                        public_description: group.public_description || "",
                        is_public: Boolean(group.is_public),
                        member_case_ids: group.member_case_ids || [],
                      });
                    }}
                  >
                    Edit
                  </button>{" "}
                  <button
                    onClick={async () => {
                      await archivePriorityGroup(group.id);
                      load();
                    }}
                  >
                    Archive
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ProcurementPriorityManagementPage() {
  const { user } = useAuth();
  const canManageGroups = hasPermission(
    user,
    "procurement-priority.manage-groups",
  );
  const canOverride = hasPermission(user, "procurement-priority.override");
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [state, setState] = useState("loading");
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [order, setOrder] = useState([]);
  const [reason, setReason] = useState("");
  const load = useCallback(() => {
    setState("loading");
    getPriorityManagementQueue()
      .then((x) => {
        const data = x.data || [];
        setRows(data);
        setOrder(data);
        setState("ready");
      })
      .catch((e) =>
        setState(
          e.response?.status === 404 || e.response?.status === 503
            ? "unavailable"
            : "error",
        ),
      );
  }, []);
  useEffect(load, [load]);
  const open = async (row) => {
    const [p, h] = await Promise.all([
      getPriorityProfile(row.procurement_case_id),
      getPriorityHistory(row.procurement_case_id),
    ]);
    setSelected(p.data);
    setHistory(h.data || []);
  };
  const shown = useMemo(
    () =>
      order.filter(
        (row) =>
          (!filters.search ||
            `${caseLabel(row)} ${row.public_title} ${row.department_name}`
              .toLowerCase()
              .includes(filters.search.toLowerCase())) &&
          (!filters.tier || row.system_tier === filters.tier) &&
          (!filters.department || row.department_name === filters.department) &&
          (!filters.status || row.case_status === filters.status) &&
          (!filters.group ||
            String(row.priority_group_name || "") === filters.group),
      ),
    [order, filters],
  );
  const move = (index, delta) =>
    setOrder((old) => {
      const next = [...old];
      next.splice(index + delta, 0, next.splice(index, 1)[0]);
      return next;
    });
  const filtersActive = Object.values(filters).some(Boolean);
  const differs = order.some(
    (row, index) => Number(row.system_suggested_rank) !== index + 1,
  );
  const saveOrder = async () => {
    if (differs && !reason.trim()) return;
    await reorderInstitutionalPriorities(
      order.map((row, index) => ({
        procurement_case_id: row.procurement_case_id,
        institutional_rank: index + 1,
      })),
      reason.trim(),
    );
    setReason("");
    load();
  };
  if (state !== "ready")
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Priority Management</h1>
        <p role={state === "error" ? "alert" : undefined}>
          {state === "loading"
            ? "Loading priority management…"
            : state === "unavailable"
              ? "Procurement Priority management is not configured yet."
              : "Unable to load priority management."}
        </p>
      </main>
    );
  return (
    <main className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Priority Management</h1>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          aria-label="Search priorities"
          placeholder="Search request or title"
          className="rounded border p-2"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        {[
          ["tier", "Tier"],
          ["department", "Department"],
          ["status", "Status"],
          ["group", "Priority Group"],
        ].map(([key, label]) => (
          <label key={key} className="text-xs">
            {label}
            <select
              className="block w-full rounded border p-2"
              value={filters[key]}
              onChange={(e) =>
                setFilters({ ...filters, [key]: e.target.value })
              }
            >
              <option value="">All</option>
              {[
                ...new Set(
                  rows
                    .map((r) =>
                      key === "tier"
                        ? r.system_tier
                        : key === "department"
                          ? r.department_name
                          : key === "status"
                            ? r.case_status
                            : r.priority_group_name,
                    )
                    .filter(Boolean),
                ),
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1450px] text-sm">
          <thead>
            <tr>
              {[
                "Institutional Rank",
                "System Suggested Rank",
                "Tier",
                "Score",
                "Request / Case",
                "Department",
                "Department Rank",
                "Age",
                "Impact",
                "Service Risk",
                "Deadline",
                "Status",
                "Priority Group",
                "Order",
              ].map((h) => (
                <th className="p-2 text-left" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, index) => (
              <tr
                key={row.procurement_case_id}
                onClick={() => open(row)}
                className="cursor-pointer border-t hover:bg-blue-50"
              >
                <td className="p-2">{row.institutional_rank ?? "—"}</td>
                <td>{row.system_suggested_rank}</td>
                <td>
                  <PriorityTierBadge tier={row.system_tier} />
                </td>
                <td>{row.system_score}</td>
                <td>
                  {caseLabel(row)} · {row.public_title}
                </td>
                <td>{row.department_name}</td>
                <td>{row.department_rank ?? "—"}</td>
                <td>{row.age} days</td>
                <td>{row.impact_level || "—"}</td>
                <td>{row.service_risk_level || "—"}</td>
                <td>{row.deadline_at || "—"}</td>
                <td>{row.case_status}</td>
                <td>{row.priority_group_name || "—"}</td>
                <td>
                  {canOverride && (
                    <>
                      <button
                        aria-label={`Move ${row.public_title} up`}
                        disabled={filtersActive || !index}
                        onClick={(e) => {
                          e.stopPropagation();
                          move(index, -1);
                        }}
                      >
                        Up
                      </button>{" "}
                      <button
                        aria-label={`Move ${row.public_title} down`}
                        disabled={filtersActive || index === shown.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          move(index, 1);
                        }}
                      >
                        Down
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canOverride && filtersActive && (
        <p role="status">Clear filters to change institutional order.</p>
      )}
      {canOverride && differs && (
        <label className="block">
          Override reason
          <input
            aria-label="Institutional order override reason"
            required
            className="ml-2 rounded border p-2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      )}
      {canOverride && (
        <button
          disabled={filtersActive || (differs && !reason.trim())}
          onClick={saveOrder}
          className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
        >
          Save institutional order
        </button>
      )}
      {canManageGroups && <GroupManager cases={rows} />}
      {selected && (
        <aside
          role="dialog"
          aria-label="Priority details"
          className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l bg-white p-6 shadow-2xl"
        >
          <button onClick={() => setSelected(null)} className="float-right">
            Close
          </button>
          <h2 className="text-xl font-bold">
            {selected.public_title || "Priority details"}
          </h2>
          <div className="my-4 grid grid-cols-2 gap-2 rounded bg-slate-50 p-3 text-sm">
            <b>System Score</b>
            <span>{selected.system_score}</span>
            <b>System Suggested Rank</b>
            <span>{selected.system_suggested_rank}</span>
            <b>Institutional Rank</b>
            <span>{selected.institutional_rank}</span>
            <b>Department Rank</b>
            <span>{selected.department_rank ?? "—"}</span>
          </div>
          <PriorityFactorBreakdown
            breakdown={selected.factor_breakdown || selected.breakdown}
            score={selected.system_score}
            tier={selected.system_tier}
          />
          <hr className="my-6" />
          <AssessmentForm
            profile={selected}
            onSaved={async () => {
              const p = await getPriorityProfile(selected.procurement_case_id);
              setSelected(p.data);
            }}
          />
          <hr className="my-6" />
          <PriorityHistory entries={history} />
        </aside>
      )}
    </main>
  );
}