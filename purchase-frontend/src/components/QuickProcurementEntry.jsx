import React, { useId, useRef, useEffect } from "react";
import AmountInput from "./ui/AmountInput";
import useUiTranslation from "../utils/useUiTranslation";
import "./QuickProcurementEntry.css";

export default function QuickProcurementEntry({
  itemName,
  remaining,
  form,
  setForm,
  suppliers,
  saving,
  message,
  onSave,
  onCancel,
}) {
  const uiText = useUiTranslation();
  const id = useId();
  const quantityRef = useRef(null);
  useEffect(() => {
    quantityRef.current?.focus();
  }, []);
  const change = (key) => (event) =>
    setForm((old) => ({ ...old, [key]: event.target.value }));
  const quantity = Number(form.event_quantity);
  const validQuantity =
    Number.isInteger(quantity) && quantity > 0 && quantity <= Number(remaining);
  const cost =
    form.unit_cost === "" || form.unit_cost == null
      ? null
      : Number(form.unit_cost);
  const validCost = cost === null || (Number.isFinite(cost) && cost >= 0);
  return (
    <form
      className="quick-procurement"
      aria-label={`${uiText("Register procurement for")} ${itemName}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!saving && validQuantity && validCost) onSave();
      }}
    >
      <div className="quick-procurement-heading">
        <div>
          <h5>{uiText("Record what you purchased")}</h5>
          <p>
            {uiText(
              "Enter the quantity bought in this purchase. Previous purchases stay unchanged.",
            )}
          </p>
        </div>
        <span>
          {uiText("Remaining")}: <strong>{remaining}</strong>
        </span>
      </div>
      <fieldset disabled={saving}>
        <legend className="sr-only">{uiText("Purchase details")}</legend>
        <div className="quick-procurement-fields">
          <label htmlFor={`${id}-quantity`}>
            {uiText("Quantity purchased")}
            <input
              ref={quantityRef}
              id={`${id}-quantity`}
              type="number"
              min="1"
              step="1"
              max={remaining}
              required
              value={form.event_quantity}
              onChange={change("event_quantity")}
              aria-describedby={`${id}-preview`}
            />
          </label>
          <label htmlFor={`${id}-cost`}>
            {uiText("Unit cost (optional)")}
            <AmountInput
              id={`${id}-cost`}
              value={form.unit_cost}
              onChange={change("unit_cost")}
              placeholder={uiText("Leave blank if unknown")}
            />
          </label>
          <button
            type="button"
            className="quick-procurement-remaining"
            onClick={() =>
              setForm((old) => ({ ...old, event_quantity: String(remaining) }))
            }
          >
            {uiText("Use remaining quantity")}
          </button>
        </div>
        {!validQuantity && form.event_quantity !== "" && (
          <p className="quick-procurement-error" role="alert">
            {uiText(
              "Enter a whole number between 1 and the remaining quantity.",
            )}
          </p>
        )}
        {!validCost && (
          <p className="quick-procurement-error" role="alert">
            {uiText("Enter a valid unit cost (zero or above).")}
          </p>
        )}
        <div
          className="quick-procurement-preview"
          id={`${id}-preview`}
          aria-live="polite"
        >
          {validQuantity ? (
            <>
              <strong>{quantity}</strong> {uiText("to record")} ·{" "}
              <strong>{Number(remaining) - quantity}</strong>{" "}
              {uiText("will remain open")}
              {cost !== null && validCost && (
                <>
                  {" "}
                  · {uiText("Entry total")}:{" "}
                  <strong>
                    {(quantity * cost).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </>
              )}
            </>
          ) : (
            uiText("Choose how many units you purchased.")
          )}
        </div>
        <details className="quick-procurement-options">
          <summary>{uiText("Supplier, purchase date and note")}</summary>
          <div className="quick-procurement-fields">
            <label htmlFor={`${id}-supplier`}>
              {uiText("Supplier (optional)")}
              <select
                id={`${id}-supplier`}
                value={form.supplier_id}
                onChange={change("supplier_id")}
              >
                <option value="">{uiText("No supplier selected")}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${id}-date`}>
              {uiText("Procurement date")}
              <input
                id={`${id}-date`}
                type="date"
                value={form.procurement_date}
                onChange={change("procurement_date")}
              />
            </label>
          </div>
          <label htmlFor={`${id}-note`}>
            {uiText("Note (optional)")}
            <textarea
              id={`${id}-note`}
              rows={3}
              value={form.procurement_note}
              onChange={change("procurement_note")}
            />
          </label>
        </details>
      </fieldset>
      {message?.type === "error" && (
        <p className="quick-procurement-error" role="alert">
          {message.text}
        </p>
      )}
      <footer>
        <button type="button" onClick={onCancel} disabled={saving}>
          {uiText("Cancel")}
        </button>
        <button
          type="submit"
          disabled={saving || !validQuantity || !validCost}
          className="quick-procurement-save"
        >
          {saving ? uiText("Saving…") : uiText("Record purchase")}
        </button>
      </footer>
    </form>
  );
}
