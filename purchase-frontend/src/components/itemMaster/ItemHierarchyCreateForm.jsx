import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import {
  createGenericItem,
  initializeItemMasterReferences,
  getItemMasterReferences,
  searchApprovedProducts,
} from "../../api/itemMaster";
import GenericItemSelector from "../requests/GenericItemSelector";
import ReferenceDataEditor from "./ReferenceDataEditor";
import { ITEM_TYPES } from '../../constants/itemTypes';

export default function ItemHierarchyCreateForm({
  level,
  onSaved,
  onClose,
  canMaintainReferences = false,
  initialValues = {},
}) {
  const [refs, setRefs] = useState({
    categories: [],
    uom: [],
    manufacturers: [],
  });
  const [form, setForm] = useState({
    item_type: "general_item",
    package_quantity: "1",
    conversion_factor: "1",
    currency: "USD",
    ...initialValues,
  });
  const [generic, setGeneric] = useState({ request_mode: "generic_item" });
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [referenceError, setReferenceError] = useState("");
  const [referenceRevision, setReferenceRevision] = useState(0);
  const [editingReference, setEditingReference] = useState(null);
  const [referenceNotice, setReferenceNotice] = useState('');
  const initialize = async () => {
    setBusy(true); setReferenceNotice(''); setError('');
    try {
      const {created}=await initializeItemMasterReferences();
      setReferenceNotice(`${created} standard references added. Existing and inactive references were preserved.`);
      setReferenceRevision(value=>value+1);
    } catch(e) { setError(e.response?.data?.message || 'Unable to set up standard lists.'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setReferenceError("");
    getItemMasterReferences()
      .then((data) => {
        if (active) setRefs(data);
      })
      .catch((e) => {
        if (active)
          setReferenceError(
            e.response?.data?.message ||
              "Unable to load controlled references.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [referenceRevision]);
  useEffect(() => {
    let active = true;
    if (level === "catalog")
      api
        .get("/suppliers")
        .then(({ data }) => {
          if (active)
            setSuppliers(Array.isArray(data) ? data : data.suppliers || []);
        })
        .catch(() => {
          if (active) setError("Unable to load suppliers.");
        });
    return () => {
      active = false;
    };
  }, [level]);
  useEffect(() => {
    let active = true;
    setProducts([]);
    if (level === "catalog" && generic.generic_item_id)
      searchApprovedProducts({
        generic_item_id: generic.generic_item_id,
        page_size: 100,
      })
        .then((data) => {
          if (active)
            setProducts(
              (data.data || []).filter(
                (row) => row.is_active && row.approval_status === "approved",
              ),
            );
        })
        .catch(() => {
          if (active) setError("Unable to load approved Products.");
        });
    return () => {
      active = false;
    };
  }, [level, generic.generic_item_id]);
  const field = (key, label, type = "text", required = true) => (
    <label className="block text-sm font-medium" key={key}>
      {label}
      <input
        className="mt-1 w-full rounded-lg border p-2.5"
        type={type}
        required={required}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "any" : undefined}
        value={form[key] || ""}
        onChange={(event) =>
          setForm((previous) => ({ ...previous, [key]: event.target.value }))
        }
      />
    </label>
  );
  const select = (key, label, rows) => (
    <label className="block text-sm font-medium" key={key}>
      {label}
      <select
        required
        className="mt-1 w-full rounded-lg border p-2.5"
        value={form[key] || ""}
        onChange={(event) =>
          setForm((previous) => ({ ...previous, [key]: event.target.value }))
        }
      >
        <option value="">Select {label.toLowerCase()}</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.code ? `${row.code} · ` : ""}
            {row.name || row.product_name}
          </option>
        ))}
      </select>
    </label>
  );
  const save = async (event) => {
    event.preventDefault();
    if (busy || loading || referenceError || editingReference) return;
    setBusy(true);
    setError("");
    try {
      let created;
      if (level === "generic") {
        const category = refs.categories.find(
          (row) => String(row.id) === String(form.category_id),
        );
        const uom = refs.uom.find(
          (row) => String(row.id) === String(form.inventory_uom_id),
        );
        if (!category || !uom)
          throw new Error(
            "Select an active category and inventory UOM before creating the draft.",
          );
        created = await createGenericItem({
          ...form,
          category: category?.name,
          base_uom_id: uom?.id,
          base_uom: uom?.code,
          inventory_uom: uom?.code,
        });
      } else if (level === "products") {
        const manufacturer = refs.manufacturers.find(
          (row) => String(row.id) === String(form.manufacturer_id),
        );
        const uom = refs.uom.find(
          (row) => String(row.id) === String(form.product_uom_id),
        );
        const { data } = await api.post("/item-master/foundation/products", {
          ...form,
          generic_item_id: generic.generic_item_id,
          manufacturer: manufacturer?.name,
          product_uom: uom?.code,
        });
        created = data;
      } else {
        const { data } = await api.post(
          "/item-master/foundation/supplier-catalog",
          form,
        );
        created = data;
      }
      await onSaved(created);
    } catch (e) {
      setError(
        e.response?.data?.message ||
          e.response?.data?.error ||
          e.message ||
          "Unable to create governed item.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={save}
      className="my-4 space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-5"
    >
      <div className="flex justify-between">
        <h3 className="font-bold">
          Create{" "}
          {level === "generic"
            ? "Generic Item draft"
            : level === "products"
              ? "Product for approval"
              : "Supplier Catalog offer"}
        </h3>
        <button type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
      <p className="text-sm text-slate-600">
        {level === "generic"
          ? "Creates normalized master data. Complete review → validation → approval → active to make this item available to requests. Base and inventory UOM use the same controlled unit."
          : level === "products"
            ? "Choose an active Generic Item. New products require approval before request or supplier catalog selection."
            : "Select an approved Product and describe the supplier purchasing unit and conversion explicitly."}
      </p>
      {level !== "generic" && (
        <GenericItemSelector
          value={generic}
          allowPendingCreation={false}
          disabled={busy}
          onChange={(patch) => {
            setGeneric((previous) => ({ ...previous, ...patch }));
            setForm((previous) => ({ ...previous, approved_product_id: "" }));
          }}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {level === "generic" ? (
          <>
            {field("item_code", "Internal item code")}
            {field("generic_name", "Generic name")}
            {field("canonical_description", "Canonical description")}
            {select("category_id", "Category", refs.categories)}
            <label className="text-sm font-medium">
              Item type
              <select
                className="mt-1 w-full rounded-lg border p-2.5"
                value={form.item_type}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    item_type: event.target.value,
                  }))
                }
              >
                {ITEM_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            {select("inventory_uom_id", "Inventory UOM", refs.uom)}
          </>
        ) : level === "products" ? (
          <>
            {field("product_name", "Product name")}
            {select("manufacturer_id", "Manufacturer", refs.manufacturers)}
            {field("manufacturer_part_number", "Manufacturer part number")}
            {select("product_uom_id", "Product UOM", refs.uom)}
            {field(
              "package_quantity",
              "Generic base units per Product unit",
              "number",
            )}
          </>
        ) : (
          <>
            {select("approved_product_id", "Approved Product", products)}
            {select("supplier_id", "Supplier", suppliers)}
            {field("supplier_item_code", "Supplier item code")}
            {select("purchasing_uom_id", "Purchasing UOM", refs.uom)}
            {field(
              "conversion_factor",
              "Product units per purchasing unit",
              "number",
            )}
            {field("unit_price", "Unit price", "number", false)}
            {field("currency", "Currency")}
          </>
        )}
      </div>
      {level === "generic" && (
        <div className="flex flex-wrap gap-4">
          {[
            "batch_controlled",
            "expiry_controlled",
            "serial_controlled",
            "is_sterile",
            "is_proprietary",
          ].map((key) => (
            <label className="text-sm" key={key}>
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    [key]: event.target.checked,
                  }))
                }
              />{" "}
              {key.replaceAll("_", " ")}
            </label>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      <div className="space-y-3 rounded-lg border bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm">Controlled reference data</strong>
          <button
            type="button"
            disabled={busy || loading || Boolean(editingReference)}
            onClick={() => setReferenceRevision((value) => value + 1)}
            className="text-sm text-blue-700 underline"
          >
            Refresh reference lists
          </button>
        </div>
        {canMaintainReferences && <button type="button" onClick={initialize} disabled={busy || loading || Boolean(editingReference)} className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-40">Set up standard lists</button>}
        {referenceNotice && <p role="status" className="text-sm text-green-800">{referenceNotice}</p>}
        {loading && (
          <p role="status" className="text-sm">
            Loading reference lists…
          </p>
        )}
        {referenceError && (
          <p role="alert" className="text-sm text-red-700">
            {referenceError} Reference lists could not be loaded. Check Item
            Master view access, then refresh.
          </p>
        )}
        {!loading && !referenceError && (
          <p className="text-sm text-slate-600">
            {refs.categories.length} active categories · {refs.uom.length}{" "}
            active UOMs · {refs.manufacturers.length} active manufacturers
          </p>
        )}
        {!loading &&
          !referenceError &&
          (!refs.uom.length ||
            (level === "generic" && !refs.categories.length) ||
            (level === "products" && !refs.manufacturers.length)) && (
            <p className="text-sm text-amber-800">
              Required reference data is missing. Add it here or ask a reference
              maintainer to set it up, then refresh. Your item draft stays in
              this form.
            </p>
          )}
        {canMaintainReferences ? (
          <div className="flex flex-wrap gap-3">
            {(level === "generic"
              ? ["categories", "uom"]
              : level === "products"
                ? ["manufacturers", "uom"]
                : ["uom"]
            ).map((type) => (
              <button
                key={type}
                type="button"
                disabled={busy || loading || Boolean(editingReference)}
                className="text-sm text-blue-700 underline"
                onClick={() => setEditingReference(type)}
              >
                Add{" "}
                {type === "categories"
                  ? "category"
                  : type === "uom"
                    ? "UOM"
                    : "manufacturer"}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600">
            Adding references requires item-master.references-maintain
            permission.
          </p>
        )}
        {editingReference && (
          <ReferenceDataEditor
            key={editingReference}
            type={editingReference}
            onClose={() => setEditingReference(null)}
            onCreated={(created) => {
              const key =
                editingReference === "categories"
                  ? "category_id"
                  : editingReference === "manufacturers"
                    ? "manufacturer_id"
                    : level === "generic"
                      ? "inventory_uom_id"
                      : level === "products"
                        ? "product_uom_id"
                        : "purchasing_uom_id";
              setForm((previous) => ({
                ...previous,
                [key]: String(created.id),
              }));
              setEditingReference(null);
              setReferenceRevision((value) => value + 1);
            }}
          />
        )}
      </div>
      <button
        disabled={
          busy ||
          loading ||
          Boolean(referenceError) ||
          Boolean(editingReference) ||
          !refs.uom.length ||
          (level === "generic" &&
            (!form.category_id ||
              !form.inventory_uom_id ||
              !refs.categories.some(
                (row) => String(row.id) === String(form.category_id),
              ) ||
              !refs.uom.some(
                (row) => String(row.id) === String(form.inventory_uom_id),
              ))) ||
          (level === "products" && !refs.manufacturers.length) ||
          (level !== "generic" && !generic.generic_item_id)
        }
        className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-40"
      >
        {busy ? "Creating…" : "Create governed record"}
      </button>
    </form>
  );
}
