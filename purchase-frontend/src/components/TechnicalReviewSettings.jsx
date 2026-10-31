import useUiTranslation from "../utils/useUiTranslation";
import React, { useCallback, useEffect, useState } from "react";
import * as api from "../api/technicalWorkflow";
const base = {
  pre_required: false,
  delivery_required: false,
  level: 2,
  evidence_required: false,
  reviewers: [{ department_id: "REQUESTING", reviewer_id: null }],
  pre_checks: [],
  delivery_checks: [
    "specifications",
    "physical_condition",
    "documents",
    "functional_test",
  ],
};
const cls = "block w-full rounded border p-2";
export default function TechnicalReviewSettings() {
  const uiText = useUiTranslation();
  const [data, setData] = useState(null),
    [key, setKey] = useState("unclassified"),
    [settings, setSettings] = useState(base),
    [version, setVersion] = useState(0),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  const load = useCallback(async (targetKey = "unclassified") => {
    try {
      const next = await api.technicalProfiles();
      setData(next);
      const current = next.profiles.find((p) => p.profile_key === targetKey);
      setSettings(current?.settings || base);
      setVersion(current?.row_version || 0);
      setError("");
    } catch (e) {
      setError(
        e.response?.data?.message || "Unable to load technical profiles",
      );
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const choose = (k) => {
    setKey(k);
    const p = data.profiles.find((p) => p.profile_key === k);
    setSettings(p?.settings || { ...base, reviewers: [...base.reviewers] });
    setVersion(p?.row_version || 0);
    setReason("");
    setSuccess("");
  };
  return (
    <section className="max-w-4xl space-y-4 rounded-xl border bg-white p-5 dark:bg-slate-800">
      <h2 className="text-xl font-bold">Technical review responsibilities</h2>
      <p>
        Configure requirements by controlled Item Master type. Routine receiving
        stays unchanged unless a requirement is enabled. Procurement can also
        request an additional review. Free-text items use the Unclassified
        profile.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {success && <p role="status">{success}</p>}
      <button
        disabled={busy}
        type="button"
        className="underline"
        onClick={() => load(key)}
      >
        Reload profiles
      </button>
      {data && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const saved = await api.saveTechnicalProfile({
                profile_key: key,
                settings,
                row_version: version,
                reason,
              });
              setVersion(saved.row_version);
              setData({
                ...data,
                profiles: [
                  ...data.profiles.filter((p) => p.profile_key !== key),
                  saved,
                ],
              });
              setSuccess(
                "Technical profile saved. New reviews and receipts use this policy; existing task snapshots are preserved.",
              );
              setReason("");
            } catch (e) {
              setError(
                e.response?.data?.message || "Unable to save technical profile",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Item type
            <select
              className={cls}
              value={key}
              onChange={(e) => choose(e.target.value)}
            >
              {data.keys.map((k) => (
                <option key={k} value={k}>
                  {k.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <input
              type="checkbox"
              disabled={settings.level === 1}
              checked={settings.pre_required}
              onChange={(e) =>
                setSettings({ ...settings, pre_required: e.target.checked })
              }
            />{" "}
            Require pre-procurement technical review and create tasks on final
            PR approval
          </label>
          <label className="block">
            <input
              type="checkbox"
              disabled={settings.level === 1}
              checked={settings.delivery_required}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  delivery_required: e.target.checked,
                })
              }
            />{" "}
            Require delivery inspection before accepting receipt quantities
          </label>
          <label>
            Inspection level
            <select
              className={cls}
              value={settings.level}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  level: Number(e.target.value),
                  ...(e.target.value === "1"
                    ? {
                        pre_required: false,
                        delivery_required: false,
                        evidence_required: false,
                      }
                    : {}),
                })
              }
            >
              <option value={1}>1 — Basic verification</option>
              <option value={2}>2 — Technical review</option>
              <option value={3}>3 — Formal acceptance with evidence</option>
            </select>
          </label>
          <label className="block">
            <input
              type="checkbox"
              checked={settings.evidence_required || settings.level === 3}
              disabled={settings.level === 3}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  evidence_required: e.target.checked,
                })
              }
            />{" "}
            Require supporting evidence
          </label>
          <fieldset className="space-y-3 rounded border p-3">
            <legend>Technical responsibilities</legend>
            <p className="text-sm">
              Resolve the current department head, or designate an active
              reviewer. Add multiple departments when necessary. Pre-procurement
              reviews also include the requesting department. Inspectors must be
              independent of final sign-off and receiving.
            </p>
            {settings.reviewers.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3">
                <label>{uiText("Department")}<select
                    aria-label={`Technical department ${i + 1}`}
                    className={cls}
                    value={r.department_id}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        reviewers: settings.reviewers.map((v, n) =>
                          n === i
                            ? {
                                department_id: e.target.value,
                                reviewer_id: null,
                              }
                            : v,
                        ),
                      })
                    }
                  >
                    <option value="REQUESTING">Requesting department</option>
                    {data.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reviewer
                  <select
                    aria-label={`Technical reviewer ${i + 1}`}
                    className={cls}
                    value={r.reviewer_id || ""}
                    disabled={r.department_id === "REQUESTING"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        reviewers: settings.reviewers.map((v, n) =>
                          n === i
                            ? { ...v, reviewer_id: e.target.value || null }
                            : v,
                        ),
                      })
                    }
                  >
                    <option value="">Current department head</option>
                    {data.users
                      .filter(
                        (u) =>
                          String(u.department_id) === String(r.department_id),
                      )
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} · {u.role}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={settings.reviewers.length === 1}
                  onClick={() =>
                    setSettings({
                      ...settings,
                      reviewers: settings.reviewers.filter((_, n) => n !== i),
                    })
                  }
                >
                  Remove reviewer
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setSettings({
                  ...settings,
                  reviewers: [
                    ...settings.reviewers,
                    { department_id: "REQUESTING", reviewer_id: null },
                  ],
                })
              }
            >
              Add technical department
            </button>
          </fieldset>
          <fieldset className="rounded border p-3">
            <legend>Additional pre-procurement assessment</legend>
            {Object.keys(data.delivery_checks)
              .filter((k) => !data.base_checks.includes(k))
              .map((k) => (
                <label key={k} className="mr-4 inline-block">
                  <input
                    type="checkbox"
                    checked={(settings.pre_checks || []).includes(k)}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        pre_checks: e.target.checked
                          ? [...(settings.pre_checks || []), k]
                          : (settings.pre_checks || []).filter((v) => v !== k),
                      })
                    }
                  />{" "}
                  {k.replaceAll("_", " ")}
                </label>
              ))}
          </fieldset>
          <fieldset className="rounded border p-3">
            <legend>Delivery assessment</legend>
            {Object.keys(data.delivery_checks).map((k) => (
              <label key={k} className="mr-4 inline-block">
                <input
                  type="checkbox"
                  checked={settings.delivery_checks.includes(k)}
                  disabled={data.base_checks.includes(k)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      delivery_checks: e.target.checked
                        ? [...settings.delivery_checks, k]
                        : settings.delivery_checks.filter((v) => v !== k),
                    })
                  }
                />{" "}
                {k.replaceAll("_", " ")}
              </label>
            ))}
          </fieldset>
          <label>
            Change reason
            <textarea
              required
              className={cls}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            disabled={busy || !reason.trim()}
            className="rounded bg-indigo-700 px-4 py-2 text-white"
          >
            Save technical profile
          </button>
        </form>
      )}
    </section>
  );
}
