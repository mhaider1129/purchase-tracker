import React, { useEffect, useState } from "react";
import GenericItemSelector from "./GenericItemSelector";
import { searchApprovedProducts } from "../../api/itemMaster";
import { hasPermission } from "../../utils/permissions";
import { REQUEST_MODE_STATUS } from "../../utils/requestItemIdentity";

const LABELS = {
  free_text: "Unresolved physical item",
  generic_item: "Catalogued Generic Item",
  generic_item_with_preference: "Generic Item with preferred Product",
  specific_approved_product: "Required approved Product",
  pending_item_creation: "Item Master creation required",
  service: "Service",
  approved_free_text_exception: "Authorized catalog exception",
};

export default function RequestItemIdentityFields({
  value,
  onChange,
  user,
  disabled = false,
}) {
  const mode = value.request_mode || "free_text";
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const productMode = [
    "generic_item_with_preference",
    "specific_approved_product",
  ].includes(mode);
  useEffect(() => {
    let active = true;
    setProducts([]);
    setError("");
    setLoading(false);
    if (!productMode || !value.generic_item_id)
      return () => {
        active = false;
      };
    setLoading(true);
    searchApprovedProducts({
      generic_item_id: value.generic_item_id,
      approval_status: "approved",
      page_size: 100,
    })
      .then((result) => {
        if (active)
          setProducts(
            (result.data || []).filter(
              (p) => p.is_active && p.approval_status === "approved",
            ),
          );
      })
      .catch((e) => {
        if (active)
          setError(
            e.response?.data?.message || "Could not load approved Products",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productMode, value.generic_item_id]);
  const changeMode = (next) =>
    onChange({
      request_mode: next,
      catalog_status: REQUEST_MODE_STATUS[next],
      generic_item_id: null,
      preferred_product_id: null,
      mandatory_product_id: null,
      stocking_policy: next === "service" ? "service" : "non_stock",
      preferred_product_reason: "",
      restriction_justification: "",
      canonical_description_snapshot: null,
      pending_item: null,
    });
  const productKey =
    mode === "specific_approved_product"
      ? "mandatory_product_id"
      : "preferred_product_id";
  return (
    <fieldset disabled={disabled} className="mb-4 space-y-2 rounded border p-3">
      <label className="block text-sm">
        Item identity
        <select
          aria-label="Item identity mode"
          className="ml-2 rounded border p-2"
          value={mode}
          onChange={(e) => changeMode(e.target.value)}
        >
          {Object.entries(LABELS)
            .filter(
              ([key]) =>
                key !== "approved_free_text_exception" ||
                hasPermission(user, "item-master.free-text-exception"),
            )
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
      </label>
      {[
        "generic_item",
        "generic_item_with_preference",
        "specific_approved_product",
        "pending_item_creation",
      ].includes(mode) && (
        <GenericItemSelector
          value={value}
          disabled={disabled}
          onChange={(patch) =>
            onChange({
              ...patch,
              request_mode:
                patch.request_mode === "pending_item_creation"
                  ? "pending_item_creation"
                  : productMode
                    ? mode
                    : patch.request_mode,
              preferred_product_id: null,
              mandatory_product_id: null,
            })
          }
        />
      )}
      {productMode && (
        <label className="block text-sm">
          {LABELS[mode]}
          <select
            aria-label={LABELS[mode]}
            required
            value={value[productKey] || ""}
            disabled={loading || !value.generic_item_id}
            onChange={(e) =>
              onChange({
                [productKey]: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="ml-2 rounded border p-2"
          >
            <option value="">
              {loading
                ? "Loading approved Products…"
                : "Select approved Product"}
            </option>
            {products.map((p) => (
              <option value={p.id} key={p.id}>
                {p.product_name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {mode === "generic_item_with_preference" && (
        <label className="block text-sm">
          Preference reason
          <textarea
            aria-label="Preference reason"
            value={value.preferred_product_reason || ""}
            onChange={(e) =>
              onChange({ preferred_product_reason: e.target.value })
            }
          />
        </label>
      )}
      {["specific_approved_product", "approved_free_text_exception"].includes(
        mode,
      ) && (
        <label className="block text-sm">
          Justification
          <textarea
            required
            aria-label="Identity justification"
            value={value.restriction_justification || ""}
            onChange={(e) =>
              onChange({ restriction_justification: e.target.value })
            }
          />
        </label>
      )}
      {mode === "free_text" && (
        <p className="text-xs text-amber-700">
          This demand requires identity resolution before procurement.
        </p>
      )}
      <label className="block text-sm">
        Required date
        <input
          type="date"
          aria-label="Item required date"
          value={value.required_date || ""}
          onChange={(e) => onChange({ required_date: e.target.value || null })}
        />
      </label>
    </fieldset>
  );
}
