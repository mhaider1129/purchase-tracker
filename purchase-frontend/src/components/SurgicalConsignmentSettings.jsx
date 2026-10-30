import React, { useEffect, useState } from "react";
import * as api from "../api/surgicalConsignments";
const empty = {
  department_id: "",
  is_enabled: true,
  nurse_id: "",
  warehouse_id: "",
  receiver_id: "",
  row_version: 0,
  section_nurses: [],
};
const box = "block w-full rounded border p-2";
const role = (u) =>
  String(u.role || "")
    .toLowerCase()
    .replace(/[\s_]/g, "");
export default function SurgicalConsignmentSettings() {
  const [data, setData] = useState(null),
    [form, setForm] = useState(empty),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const load = async () => {
    try {
      setData(await api.settings());
      setError("");
    } catch (e) {
      setError(
        e.response?.data?.message ||
          "Unable to load surgical department setup.",
      );
    }
  };
  useEffect(() => {
    load();
  }, []);
  const select = (id) => {
    const setting = data.settings.find(
      (s) => String(s.department_id) === String(id),
    );
    setForm(
      setting
        ? {
            ...setting,
            department_id: String(id),
            nurse_id: String(setting.nurse_id || ""),
            warehouse_id: String(setting.warehouse_id || ""),
            receiver_id: String(setting.receiver_id || ""),
          }
        : { ...empty, department_id: id },
    );
    setReason("");
    setSaved(false);
  };
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const next = await api.saveSettings({ ...form, reason });
      setData(next);
      const setting = next.settings.find(
        (s) => String(s.department_id) === String(form.department_id),
      );
      setForm({
        ...setting,
        department_id: String(setting.department_id),
        nurse_id: String(setting.nurse_id || ""),
        warehouse_id: String(setting.warehouse_id || ""),
        receiver_id: String(setting.receiver_id || ""),
      });
      setReason("");
      setSaved(true);
    } catch (e) {
      setError(
        e.response?.data?.message ||
          "Unable to save surgical department setup. Reload if another administrator changed it.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return (
      <section>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <p>Loading surgical consignment setup…</p>
        )}
        <button type="button" onClick={load}>
          Reload setup
        </button>
      </section>
    );
  const users = data.users || [],
    sections = (data.sections || []).filter(
      (s) => String(s.department_id) === form.department_id,
    ),
    receivers = users.filter(
      (u) =>
        String(u.warehouse_id) === form.warehouse_id &&
        ["warehousekeeper", "warehousemanager"].includes(role(u)),
    );
  const choices = (list) =>
    list.map((u) => (
      <option key={u.id} value={u.id}>
        {u.name}
        {u.role ? ` · ${u.role}` : ""}
      </option>
    ));
  return (
    <section className="max-w-4xl space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">Surgical consignment setup</h2>
      <p>
        Enable only the departments where surgery is performed. Surgeons see
        this limited list. Set the responsible nurse and receiving warehouse
        once; staff and authorization are assigned automatically.
      </p>
      <p className="text-sm text-slate-600">
        HOD comes from the department’s current organization head, with a unique
        HOD account as fallback. CMO and SCM use their active institute roles.
        Missing or ambiguous assignments block submission until corrected.
        Existing requests keep their recorded team.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {saved && <p role="status">Surgical department setup saved.</p>}
      {!data.configured && (
        <p role="alert">
          Apply complete SQL 053 before configuring surgical departments.
        </p>
      )}
      <div>
        <h3 className="font-semibold">Configured surgical departments</h3>
        {!data.settings.length ? (
          <p className="text-sm">
            No surgical departments configured. Add the departments that should
            appear to surgeons below.
          </p>
        ) : (
          <ul>
            {data.settings.map((s) => (
              <li
                key={s.department_id}
                className="flex items-center justify-between border-b py-2"
              >
                <span>
                  {
                    data.departments.find(
                      (d) => String(d.id) === String(s.department_id),
                    )?.name
                  }{" "}
                  · {s.is_enabled ? "Enabled" : "Disabled"}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => select(String(s.department_id))}
                  className="text-blue-700 underline"
                >
                  Edit{" "}
                  {
                    data.departments.find(
                      (d) => String(d.id) === String(s.department_id),
                    )?.name
                  }
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          Surgical department
          <select
            required
            disabled={busy || !data.configured}
            className={box}
            value={form.department_id}
            onChange={(e) => select(e.target.value)}
          >
            <option value="">Choose department to configure</option>
            {choices(data.departments)}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            disabled={busy || !data.configured}
            checked={form.is_enabled}
            onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
          />{" "}
          Enable surgical requests for this department
        </label>
        <label className="block">
          Responsible department nurse
          <select
            required={form.is_enabled}
            disabled={busy || !data.configured}
            className={box}
            value={form.nurse_id}
            onChange={(e) => setForm({ ...form, nurse_id: e.target.value })}
          >
            <option value="">Choose responsible nurse</option>
            {choices(users)}
          </select>
        </label>
        <label className="block">
          Receiving warehouse
          <select
            required={form.is_enabled}
            disabled={busy || !data.configured}
            className={box}
            value={form.warehouse_id}
            onChange={(e) =>
              setForm({
                ...form,
                warehouse_id: e.target.value,
                receiver_id: "",
              })
            }
          >
            <option value="">Choose receiving warehouse</option>
            {choices(data.warehouses)}
          </select>
        </label>
        <label className="block">
          Responsible warehouse receiver
          <select
            disabled={busy || !data.configured || !form.warehouse_id}
            className={box}
            value={form.receiver_id}
            onChange={(e) => setForm({ ...form, receiver_id: e.target.value })}
          >
            <option value="">
              Resolve automatically from warehouse responsibility
            </option>
            {choices(receivers)}
          </select>
        </label>
        <p className="text-sm text-slate-500">
          Only active warehouse managers/keepers assigned to this warehouse are
          eligible. If more than one is assigned, select the responsible
          receiver here; surgeons never select it.
        </p>
        <details className="rounded border p-3">
          <summary>Section-specific responsible nurses (optional)</summary>
          <p className="my-2 text-sm">
            A section nurse overrides the department nurse when that surgery
            section is chosen.
          </p>
          {form.section_nurses.map((n, index) => (
            <div key={index} className="my-2 flex gap-2">
              <label>
                Section
                <select
                  required
                  aria-label={`Nurse override section ${index + 1}`}
                  value={n.section_id}
                  disabled={busy}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      section_nurses: form.section_nurses.map((v, i) =>
                        i === index ? { ...v, section_id: e.target.value } : v,
                      ),
                    })
                  }
                  className={box}
                >
                  <option value="">Choose section</option>
                  {choices(sections)}
                </select>
              </label>
              <label>
                Responsible nurse
                <select
                  required
                  aria-label={`Section nurse ${index + 1}`}
                  value={n.nurse_id}
                  disabled={busy}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      section_nurses: form.section_nurses.map((v, i) =>
                        i === index ? { ...v, nurse_id: e.target.value } : v,
                      ),
                    })
                  }
                  className={box}
                >
                  <option value="">Choose nurse</option>
                  {choices(users)}
                </select>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setForm({
                    ...form,
                    section_nurses: form.section_nurses.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={busy || !data.configured || !sections.length}
            onClick={() =>
              setForm({
                ...form,
                section_nurses: [
                  ...form.section_nurses,
                  { section_id: "", nurse_id: "" },
                ],
              })
            }
          >
            Add section nurse override
          </button>
        </details>
        <label className="block">
          Setup change reason
          <textarea
            required
            className={box}
            maxLength={2000}
            value={reason}
            disabled={busy || !data.configured}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button
          disabled={
            busy || !data.configured || !form.department_id || !reason.trim()
          }
          className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-40"
        >
          {busy ? "Saving setup…" : "Save surgical department setup"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            load();
            setForm(empty);
            setReason("");
          }}
          className="ml-3 underline"
        >
          Reload setup
        </button>
      </form>
    </section>
  );
}
