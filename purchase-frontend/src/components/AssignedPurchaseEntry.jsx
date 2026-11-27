import React, { useEffect, useRef, useState } from "react";
import axios from "../api/axios";
import AmountInput from "./ui/AmountInput";
import "./AssignedPurchaseEntry.css";
const remaining = (item) =>
  Math.max(
    0,
    Number(
      item.remaining_quantity ??
        Number(item.quantity) - Number(item.purchased_quantity || 0),
    ),
  );
const eligible = (item) =>
  item.supports_procurement_events !== false &&
  remaining(item) > 0 &&
  ![
    "fully_procured",
    "unable_to_procure",
    "purchased",
    "completed",
    "not_procured",
    "canceled",
    "cancelled",
  ].includes(String(item.procurement_status || "").toLowerCase());
export default function AssignedPurchaseEntry({ requestId, items, onUpdate }) {
  const active = items.filter(eligible);
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      active.map((item) => [
        item.id,
        {
          selected: true,
          quantity: String(remaining(item)),
          cost: item.unit_cost ?? "",
        },
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [results, setResults] = useState({});
  const [error, setError] = useState("");
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [note, setNote] = useState("");
  const update = (id, key, value) =>
    setDrafts((old) => ({ ...old, [id]: { ...old[id], [key]: value } }));
  const selected = active.filter((item) => drafts[item.id]?.selected);
  const valid =
    selected.length > 0 &&
    selected.every((item) => {
      const d = drafts[item.id];
      return (
        Number.isInteger(Number(d.quantity)) &&
        Number(d.quantity) > 0 &&
        Number(d.quantity) <= remaining(item) &&
        String(d.cost).trim() !== "" &&
        Number.isFinite(Number(d.cost)) &&
        Number(d.cost) >= 0
      );
    });
  const total = selected.reduce(
    (sum, item) =>
      sum +
      (Number(drafts[item.id].quantity) * Number(drafts[item.id].cost) || 0),
    0,
  );
  const submit = async (event) => {
    event.preventDefault();
    if (busy.current || locked || !valid) return;
    busy.current = true;
    setSaving(true);
    setLocked(true);
    setError("");
    try {
      for (const item of selected) {
        if (!alive.current) return;
        const d = drafts[item.id];
        try {
          const response = await axios.post(
            `/requests/${requestId}/items/${item.id}/procurement-events`,
            {
              event_quantity: Number(d.quantity),
              unit_cost: Number(d.cost),
              procurement_date: date || null,
              procurement_note: note || null,
              supplier_id: item.supplier_id || null,
            },
          );
          if (response.data?.requires_scm_approval) {
            setResults((old) => ({
              ...old,
              [item.id]: "Awaiting SCM approval",
            }));
            setError(
              "This entry needs SCM approval. Reload quantities before recording more purchases.",
            );
            return;
          }
          setResults((old) => ({ ...old, [item.id]: "Saved" }));
        } catch (err) {
          setResults((old) => ({ ...old, [item.id]: "Check before retrying" }));
          setError(
            `${item.item_name}: ${err.response?.data?.message || "The save could not be confirmed."} Earlier successful purchases remain saved. Reload quantities before trying again.`,
          );
          return;
        }
      }
      await onUpdate();
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  if (!active.length) return null;
  return (
    <form
      className="assigned-purchase-entry"
      aria-label="Record request purchases"
      onSubmit={submit}
    >
      <header>
        <h3>Record purchased items</h3>
        <p>
          Enter quantities and required unit costs below, then save once.
          Uncheck items you did not purchase. Zero is accepted for items
          supplied at no charge.
        </p>
      </header>
      <fieldset disabled={saving || locked}>
        <legend className="sr-only">Purchased quantities and costs</legend>
        <div
          className="assigned-purchase-scroll"
          role="region"
          aria-label="Purchase entry items"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Include</th>
                <th>Item / remaining</th>
                <th>Quantity purchased</th>
                <th>Unit cost (required)</th>
                <th>Entry total</th>
              </tr>
            </thead>
            <tbody>
              {active.map((item) => {
                const d = drafts[item.id] || {};
                return (
                  <tr key={item.id}>
                    <td>
                      <input
                        aria-label={`Include ${item.item_name}`}
                        type="checkbox"
                        checked={Boolean(d.selected)}
                        onChange={(e) =>
                          update(item.id, "selected", e.target.checked)
                        }
                      />
                    </td>
                    <td>
                      <strong>{item.item_name}</strong>
                      <small>
                        {remaining(item)} remaining ·{" "}
                        {item.purchased_quantity || 0} already purchased
                      </small>
                    </td>
                    <td>
                      <input
                        aria-label={`Quantity purchased for ${item.item_name}`}
                        type="number"
                        min="1"
                        step="1"
                        max={remaining(item)}
                        required={d.selected}
                        disabled={!d.selected}
                        value={d.quantity ?? ""}
                        onChange={(e) =>
                          update(item.id, "quantity", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <AmountInput
                        aria-label={`Unit cost for ${item.item_name}`}
                        required={d.selected}
                        disabled={!d.selected}
                        value={d.cost ?? ""}
                        placeholder="Required"
                        onChange={(e) =>
                          update(item.id, "cost", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      {d.selected && String(d.cost ?? "").trim() !== ""
                        ? (
                            Number(d.quantity) * Number(d.cost) || 0
                          ).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <details>
          <summary>Purchase date and note</summary>
          <label>
            Purchase date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Purchase note
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </details>
      </fieldset>
      {Object.keys(results).length > 0 && (
        <ul aria-label="Purchase save results">
          {active
            .filter((item) => results[item.id])
            .map((item) => (
              <li key={item.id}>
                {item.item_name}: {results[item.id]}
              </li>
            ))}
        </ul>
      )}
      {error && <p role="status">{error}</p>}
      <footer>
        <p>
          {selected.length} items selected · Entry total:{" "}
          <strong>
            {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </strong>
        </p>
        {locked ? (
          <button type="button" disabled={saving} onClick={onUpdate}>
            Reload quantities
          </button>
        ) : (
          <button type="submit" disabled={saving || !valid}>
            {saving
              ? "Saving purchases…"
              : "Save purchased quantities and costs"}
          </button>
        )}
      </footer>
    </form>
  );
}
