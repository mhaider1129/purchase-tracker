/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { fixedAssetsApi as api } from "../../api/fixedAssets";
import { hasPermission } from "../../utils/permissions";
import {
  ArrowRight,
  Building2,
  MapPin,
  MoveRight,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
const types = [
  "CAMPUS",
  "BUILDING",
  "FLOOR",
  "DEPARTMENT_AREA",
  "SECTION_AREA",
  "ROOM",
  "STORE",
  "WORKSHOP",
  "EXTERNAL",
  "OTHER",
];
const movementTypes = [
  "PERMANENT_TRANSFER",
  "TEMPORARY_LOAN",
  "MAINTENANCE_TRANSFER",
  "EXTERNAL_MAINTENANCE",
  "STORAGE_TRANSFER",
  "DISPOSAL_TRANSFER",
  "LOCATION_CORRECTION",
];
const returnable = new Set([
  "TEMPORARY_LOAN",
  "MAINTENANCE_TRANSFER",
  "EXTERNAL_MAINTENANCE",
]);
const msg = (e) => e.response?.data?.message || e.message;

export function Locations({ user }) {
  const [rows, setRows] = useState([]),
    [query, setQuery] = useState({}),
    [form, setForm] = useState(null),
    [reparenting, setReparenting] = useState(null),
    [collapsed, setCollapsed] = useState(new Set()),
    [error, setError] = useState("");
  const can = hasPermission(user, "fixed-assets.manage-locations"),
    load = () =>
      api
        .locations(query)
        .then(setRows)
        .catch((e) => setError(msg(e)));
  useEffect(() => {
    load();
  }, [query]);
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.saveLocation(form.id, form);
      setForm(null);
      load();
    } catch (e) {
      setError(msg(e));
    }
  };
  const reparent = async (e) => {
    e.preventDefault();
    try {
      await api.reparentLocation(
        reparenting.id,
        reparenting.parentLocationId || null,
      );
      setReparenting(null);
      load();
    } catch (e) {
      setError(msg(e));
    }
  };
  const toggle = async (x) => {
    try {
      await api.setLocationActive(x.id, !x.is_active);
      load();
    } catch (e) {
      setError(msg(e));
    }
  };
  const toggleNode = (id) =>
    setCollapsed((old) => {
      const next = new Set(old);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const hasChildren = (id) =>
    rows.some((x) => String(x.parent_location_id) === String(id));
  const tree = (parent = null, depth = 0) =>
    rows
      .filter(
        (x) => String(x.parent_location_id || "") === String(parent || ""),
      )
      .map((x) => (
        <React.Fragment key={x.id}>
          <div
            role="treeitem"
            aria-selected="false"
            aria-expanded={hasChildren(x.id) ? !collapsed.has(x.id) : undefined}
            className="flex flex-wrap items-center gap-3 border-t border-slate-100 p-3 text-sm first:border-t-0 hover:bg-cyan-50/50"
            style={{ paddingLeft: 12 + depth * 24 }}
          >
            <button
              aria-label={`${collapsed.has(x.id) ? "Expand" : "Collapse"} ${x.name}`}
              disabled={!hasChildren(x.id)}
              onClick={() => toggleNode(x.id)}
            >
              {hasChildren(x.id) ? (collapsed.has(x.id) ? "▸" : "▾") : "•"}
            </button>
            <b className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
              {x.code}
            </b>
            <span className="font-semibold text-slate-900">{x.name}</span>
            <small className="text-slate-500">{x.display_path}</small>
            <span className="rounded-full bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">
              {x.location_type?.replaceAll("_", " ")}
            </span>
            <span>{x.department_name || x.section_name || ""}</span>
            <span className="text-slate-500">
              {x.asset_count} active assets
            </span>
            <span
              className={`rounded-full px-2 py-1 text-xs font-bold ${x.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
            >
              {x.is_active ? "Active" : "Inactive"}
            </span>
            {can && (
              <>
                <button
                  className="ml-auto font-semibold text-cyan-700 hover:underline"
                  onClick={() =>
                    setForm({
                      id: x.id,
                      code: x.code,
                      name: x.name,
                      locationType: x.location_type,
                      parentLocationId: x.parent_location_id || "",
                      departmentId: x.department_id || "",
                      sectionId: x.section_id || "",
                      isActive: x.is_active,
                    })
                  }
                >
                  Edit
                </button>
                <button
                  className="font-semibold text-cyan-700 hover:underline"
                  onClick={() =>
                    setReparenting({
                      id: x.id,
                      name: x.name,
                      parentLocationId: x.parent_location_id || "",
                    })
                  }
                >
                  Reparent
                </button>
                <button
                  className="font-semibold text-slate-600 hover:underline"
                  onClick={() => toggle(x)}
                >
                  {x.is_active ? "Deactivate" : "Activate"}
                </button>
              </>
            )}
          </div>
          {!collapsed.has(x.id) && tree(x.id, depth + 1)}
        </React.Fragment>
      ));
  const parentOptions = (current) =>
    rows.filter((x) => x.is_active && x.id !== current);
  const openCreate = () => {
    setError("");
    setForm({
      locationType: rows.length ? "ROOM" : "CAMPUS",
      isActive: true,
    });
  };
  const control =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 md:p-6">
        <div>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
            <Building2 size={21} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Physical Asset Locations
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Build the governed campus, building, room, store, and external
            location hierarchy used by registration and movements.
          </p>
        </div>
        {can && (
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-cyan-800"
            onClick={openCreate}
          >
            <Plus size={18} /> Add physical location
          </button>
        )}
      </div>
      <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 md:grid-cols-[minmax(260px,1fr)_220px_180px] md:p-5">
        <label className="relative">
          <Search
            className="absolute left-3 top-3.5 text-slate-400"
            size={17}
          />
          <input
            className={`${control} pl-10`}
            aria-label="Search locations"
            placeholder="Search code, name or path"
            onChange={(e) => setQuery({ ...query, search: e.target.value })}
          />
        </label>
        <select
          className={control}
          aria-label="Location type"
          onChange={(e) => setQuery({ ...query, type: e.target.value })}
        >
          <option value="">All location types</option>
          {types.map((x) => (
            <option key={x} value={x}>
              {x.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select
          className={control}
          aria-label="Location activity"
          onChange={(e) => setQuery({ ...query, active: e.target.value })}
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      {error && (
        <p
          role="alert"
          className="mx-5 mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      {form && (
        <form
          aria-label={
            form.id ? "Edit physical location" : "Create physical location"
          }
          onSubmit={save}
          className="m-4 rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/70 to-white p-5 shadow-sm md:m-5 md:p-6"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                {form.id ? "Edit physical location" : "Add physical location"}
              </h3>
              <p className="text-sm text-slate-500">
                Codes must be unique. Choose a parent to place this location in
                the hierarchy.
              </p>
            </div>
            <button
              aria-label="Close location form"
              type="button"
              onClick={() => setForm(null)}
              className="rounded-lg p-2 text-slate-500 hover:bg-white"
            >
              <X size={19} />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Location code
              <input
                className={`${control} mt-1`}
                aria-label="Location code"
                required
                placeholder="e.g. CAMPUS-01"
                value={form.code || ""}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Location name
              <input
                className={`${control} mt-1`}
                aria-label="Location name"
                required
                placeholder="e.g. Main Campus"
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Location type
              <select
                className={`${control} mt-1`}
                aria-label="Location form type"
                value={form.locationType}
                onChange={(e) =>
                  setForm({ ...form, locationType: e.target.value })
                }
              >
                {types.map((x) => (
                  <option value={x} key={x}>
                    {x.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Parent location
              <select
                className={`${control} mt-1`}
                aria-label="Parent location"
                value={form.parentLocationId || ""}
                onChange={(e) =>
                  setForm({ ...form, parentLocationId: e.target.value })
                }
              >
                <option value="">No parent (root location)</option>
                {parentOptions(form.id).map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.display_path || x.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white"
              type="button"
              onClick={() => setForm(null)}
            >
              Cancel
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-800">
              {form.id ? "Save changes" : "Create location"}
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
      )}
      {reparenting && (
        <form
          role="dialog"
          aria-label="Reparent location"
          onSubmit={reparent}
          className="grid gap-2 bg-slate-50 p-4"
        >
          <b>Move {reparenting.name}</b>
          <select
            aria-label="New parent location"
            value={reparenting.parentLocationId}
            onChange={(e) =>
              setReparenting({
                ...reparenting,
                parentLocationId: e.target.value,
              })
            }
          >
            <option value="">Root</option>
            {parentOptions(reparenting.id).map((x) => (
              <option value={x.id} key={x.id}>
                {x.display_path || x.name}
              </option>
            ))}
          </select>
          <button>Move location</button>
          <button type="button" onClick={() => setReparenting(null)}>
            Cancel
          </button>
        </form>
      )}
      {!rows.length && !form ? (
        <div className="m-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-cyan-700 shadow-sm">
            <MapPin size={23} />
          </div>
          <h3 className="mt-4 font-bold text-slate-900">
            No physical locations configured
          </h3>
          <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">
            Create the first campus or site. You can then add buildings, floors,
            rooms, stores, workshops, and external destinations beneath it.
          </p>
          {can ? (
            <button
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white hover:bg-cyan-800"
              onClick={openCreate}
            >
              <Plus size={18} />
              Create first location
            </button>
          ) : (
            <p className="mt-4 text-sm font-semibold text-amber-700">
              You need the physical-location management permission to add
              locations.
            </p>
          )}
        </div>
      ) : (
        <div
          role="tree"
          className="m-5 overflow-hidden rounded-xl border border-slate-200"
        >
          {tree()}
        </div>
      )}
    </section>
  );
}
const actions = {
  DRAFT: ["submit", "cancel"],
  PENDING_APPROVAL: ["approve", "reject", "cancel"],
  APPROVED: ["dispatch", "cancel"],
  IN_TRANSIT: ["receive"],
};
export function Movements({ user, initialAssetId }) {
  const preselected = initialAssetId;
  const [rows, setRows] = useState([]),
    [locations, setLocations] = useState([]),
    [departments, setDepartments] = useState([]),
    [assets, setAssets] = useState([]),
    [assetSearch, setAssetSearch] = useState(""),
    [filters, setFilters] = useState({}),
    [form, setForm] = useState(
      preselected
        ? { movementType: "PERMANENT_TRANSFER", assetId: String(preselected) }
        : null,
    ),
    [detail, setDetail] = useState(null),
    [error, setError] = useState(""),
    can = hasPermission(user, "fixed-assets.move");
  const load = () =>
    api
      .movementList(filters)
      .then(setRows)
      .catch((e) => setError(msg(e)));
  useEffect(() => {
    load();
  }, [filters]);
  useEffect(() => {
    api
      .locations({ active: true })
      .then(setLocations)
      .catch((e) =>
        setError(`Governed locations could not be loaded: ${msg(e)}`),
      );
    api
      .departments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);
  useEffect(() => {
    if (form)
      api
        .list({ search: assetSearch, limit: 20 })
        .then((x) => setAssets(x.data || []))
        .catch((e) => setError(msg(e)));
  }, [assetSearch, !!form]);
  const create = async (e) => {
    e.preventDefault();
    try {
      await api.move(form.assetId, form);
      setForm(null);
      load();
    } catch (e) {
      setError(msg(e));
    }
  };
  const act = async (a, x) => {
    if (
      a === "receive" &&
      !window.confirm(
        "Receiving this movement will update the asset's authoritative physical location.",
      )
    )
      return;
    try {
      a === "initiate return"
        ? await api.initiateReturn(x.id)
        : await api.transitionMovement(x.id, a);
      load();
    } catch (e) {
      setError(msg(e));
    }
  };
  const permitted = (a) =>
    ["approve", "reject"].includes(a)
      ? hasPermission(user, "fixed-assets.manage")
      : a === "receive"
        ? hasPermission(user, "fixed-assets.verify")
        : can;
  const eligibleLocations =
    form?.movementType === "EXTERNAL_MAINTENANCE"
      ? locations.filter((x) => x.location_type === "EXTERNAL")
      : form?.movementType === "MAINTENANCE_TRANSFER"
        ? locations.filter((x) => x.location_type === "WORKSHOP")
        : locations;
  const rowActions = (x) => [
    ...(actions[x.status] || []),
    ...(x.status === "RECEIVED" && returnable.has(x.movement_type)
      ? ["initiate return"]
      : []),
  ];
  const control =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 md:p-6">
        <div>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
            <MoveRight size={21} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Asset Movements</h2>
          <p className="mt-1 text-sm text-slate-500">
            Track controlled transfers from request through receipt. Receipt is
            the authoritative location event.
          </p>
        </div>
        {can && !form && (
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-cyan-800"
            onClick={() => setForm({ movementType: "PERMANENT_TRANSFER" })}
          >
            <Plus size={18} />
            Request movement
          </button>
        )}
      </div>
      <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 md:grid-cols-[minmax(260px,1fr)_220px_260px] md:p-5">
        <label className="relative">
          <Search
            className="absolute left-3 top-3.5 text-slate-400"
            size={17}
          />
          <input
            className={`${control} pl-10`}
            aria-label="Search movements"
            placeholder="Search reference, asset or description"
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </label>
        <select
          className={control}
          aria-label="Movement status"
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All statuses</option>
          {Object.keys(actions).map((x) => (
            <option key={x}>{x.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select
          className={control}
          aria-label="Movement type filter"
          onChange={(e) =>
            setFilters({ ...filters, movementType: e.target.value })
          }
        >
          <option value="">All movement types</option>
          {[...movementTypes, "RETURN"].map((x) => (
            <option key={x} value={x}>
              {x.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p
          role="alert"
          className="mx-5 mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      {form && (
        <form
          onSubmit={create}
          className="m-4 rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/70 to-white p-5 shadow-sm md:m-5 md:p-6"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">New movement request</h3>
              <p className="text-sm text-slate-500">
                Choose the asset and its governed destination.
              </p>
            </div>
            <button
              aria-label="Close movement form"
              type="button"
              onClick={() => setForm(null)}
              className="rounded-lg p-2 text-slate-500 hover:bg-white"
            >
              <X size={19} />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Find an asset
              <input
                className={`${control} mt-1`}
                aria-label="Search assets for movement"
                value={assetSearch}
                placeholder="Asset number, serial, maker or model"
                onChange={(e) => setAssetSearch(e.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Asset
              <select
                className={`${control} mt-1`}
                aria-label="Asset"
                required
                value={form.assetId || ""}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
              >
                <option value="">Select an asset</option>
                {assets.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.asset_number} — {x.description}
                  </option>
                ))}
                {preselected &&
                  !assets.some((x) => String(x.id) === String(preselected)) && (
                    <option value={preselected}>Selected asset</option>
                  )}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Movement type
              <select
                className={`${control} mt-1`}
                aria-label="Movement type"
                value={form.movementType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    movementType: e.target.value,
                    toLocationId: "",
                    toDepartmentId: "",
                    expectedReturnAt: "",
                  })
                }
              >
                {movementTypes.map((x) => (
                  <option key={x} value={x}>
                    {x.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Governed destination
              <select
                className={`${control} mt-1`}
                aria-label="Destination location"
                required
                value={form.toLocationId || ""}
                onChange={(e) =>
                  setForm({ ...form, toLocationId: e.target.value })
                }
              >
                <option value="">
                  {eligibleLocations.length
                    ? "Select governed destination"
                    : "No eligible governed locations"}
                </option>
                {eligibleLocations.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.display_path || x.name}
                  </option>
                ))}
              </select>
              {!eligibleLocations.length && (
                <span className="mt-2 flex items-center gap-1 text-xs font-normal text-amber-700">
                  <MapPin size={14} />
                  No eligible location exists.{" "}
                  <Link
                    className="font-semibold underline"
                    to="/fixed-assets/locations"
                  >
                    Manage locations
                  </Link>
                </span>
              )}
            </label>
            {form.movementType === "PERMANENT_TRANSFER" && (
              <label className="text-sm font-semibold text-slate-700">
                Responsible department
                <select
                  className={`${control} mt-1`}
                  aria-label="Destination department"
                  value={form.toDepartmentId || ""}
                  onChange={(e) =>
                    setForm({ ...form, toDepartmentId: e.target.value })
                  }
                >
                  <option value="">Keep current department</option>
                  {departments.map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {["TEMPORARY_LOAN", "EXTERNAL_MAINTENANCE"].includes(
              form.movementType,
            ) && (
              <label className="text-sm font-semibold text-slate-700">
                Expected return
                <input
                  className={`${control} mt-1`}
                  aria-label="Expected return"
                  required
                  type="datetime-local"
                  value={form.expectedReturnAt || ""}
                  onChange={(e) =>
                    setForm({ ...form, expectedReturnAt: e.target.value })
                  }
                />
              </label>
            )}
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">
              Reason
              <textarea
                className={`${control} mt-1 min-h-24 resize-y`}
                placeholder="Explain why this movement is required"
                aria-label="Movement reason"
                required
                value={form.reason || ""}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white"
              type="button"
              onClick={() => setForm(null)}
            >
              Cancel
            </button>
            <button
              disabled={!eligibleLocations.length}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Create draft
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {[
                "Reference",
                "Asset",
                "Type",
                "From",
                "To",
                "Requester",
                "Requested",
                "Expected",
                "Received",
                "Status",
                "Actions",
              ].map((x) => (
                <th
                  className="whitespace-nowrap px-4 py-3 font-semibold"
                  key={x}
                >
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr
                className="cursor-pointer border-t border-slate-100 hover:bg-cyan-50/50"
                key={x.id}
                onClick={() => setDetail(x)}
              >
                <td className="px-4 py-3 font-bold text-cyan-800">MV-{x.id}</td>
                <td className="px-4 py-3">
                  <span className="block font-semibold">{x.asset_number}</span>
                  <small className="text-slate-500">
                    {x.asset_description}
                  </small>
                </td>
                <td className="px-4 py-3">
                  {x.movement_type?.replaceAll("_", " ")}
                </td>
                <td className="px-4 py-3">{x.from_location_name || "—"}</td>
                <td className="px-4 py-3">{x.to_location_name || "—"}</td>
                <td className="px-4 py-3">{x.requester_name || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {x.requested_at}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {x.expected_return_at || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {x.received_at || "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {x.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {rowActions(x)
                    .filter(permitted)
                    .map((a) => (
                      <button
                        className="mr-2 font-semibold text-cyan-700 hover:underline"
                        key={a}
                        onClick={(e) => {
                          e.stopPropagation();
                          act(a, x);
                        }}
                      >
                        {a}
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="p-10 text-center text-sm text-slate-500">
            No movements match the current filters.
          </div>
        )}
      </div>
      {detail && (
        <aside className="m-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-bold">Movement MV-{detail.id}</h3>
          <p className="mt-1 text-sm text-slate-600">
            Requested {detail.requested_at} → Approved{" "}
            {detail.approved_at || "pending"} → Dispatched{" "}
            {detail.dispatched_at || "pending"} → Received{" "}
            {detail.received_at || "pending"}
          </p>
        </aside>
      )}
    </section>
  );
}