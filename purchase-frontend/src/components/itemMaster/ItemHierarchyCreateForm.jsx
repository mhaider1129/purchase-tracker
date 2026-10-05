import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import {
  createGenericItem,
  getItemMasterReferences,
  searchApprovedProducts,
} from "../../api/itemMaster";
import GenericItemSelector from "../requests/GenericItemSelector";

export default function ItemHierarchyCreateForm({ level, onSaved, onClose }) {
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
  });
  const [generic, setGeneric] = useState({ request_mode: "generic_item" });
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getItemMasterReferences()
      .then((data) => {
        if (active) setRefs(data);
      })
      .catch((e) => {
        if (active)
          setError(
            e.response?.data?.message ||
              "Unable to load controlled references.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
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
                {[
                  "general_item",
                  "medication",
                  "medical_supply",
                  "medical_device",
                  "laboratory_item",
                  "maintenance_spare_part",
                  "it_item",
                  "stationery",
                ].map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ")}
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
      {!loading &&
        (!refs.uom.length ||
          (level === "generic" && !refs.categories.length)) && (
          <p className="text-sm text-amber-800">
            Set up categories and UOMs in the reference data tab first.
          </p>
        )}
      <button
        disabled={
          busy || loading || (level !== "generic" && !generic.generic_item_id)
        }
        className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-40"
      >
        {busy ? "Creating…" : "Create governed record"}
      </button>
    </form>
  );
}
