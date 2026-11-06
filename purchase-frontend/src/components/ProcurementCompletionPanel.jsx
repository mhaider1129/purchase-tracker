import React from "react";
import useUiTranslation from "../utils/useUiTranslation";
// Compare API decimal strings without rounding large or fractional quantities.
const greaterQuantity = (left = "0", right = "0") => {
  if (
    !/^\d+(?:\.\d+)?$/.test(String(left)) ||
    !/^\d+(?:\.\d+)?$/.test(String(right))
  )
    return false;
  const [a, af = ""] = String(left).split("."),
    [b, bf = ""] = String(right).split(".");
  const scale = Math.max(af.length, bf.length);
  const normalizedA = (a + af.padEnd(scale, "0")).replace(/^0+/, "") || "0";
  const normalizedB = (b + bf.padEnd(scale, "0")).replace(/^0+/, "") || "0";
  return (
    normalizedA.length > normalizedB.length ||
    (normalizedA.length === normalizedB.length && normalizedA > normalizedB)
  );
};
export default function ProcurementCompletionPanel({
  completion,
  onAcknowledge,
  submitting = false,
}) {
  const text = useUiTranslation();
  if (!completion)
    return (
      <p role="status">
        {text("Verified completion information is unavailable.")}
      </p>
    );
  const stages = [
    ["procurement_complete", "Procurement committed"],
    ["receipt_complete", "Receiving accepted"],
    ["fulfillment_complete", "Department fulfillment verified"],
    ["requester_acknowledgment_complete", "Requester acknowledgment"],
  ];
  return (
    <section
      className="my-4 space-y-3 rounded-xl border bg-white p-4 dark:bg-slate-900"
      aria-label={text("Verified completion dimensions")}
    >
      <h2 className="font-semibold">
        {text("Verified completion dimensions")}
      </h2>
      <p className="text-sm">
        {text(
          "Ordering, receiving, department fulfillment and payment are separate stages. A status label or invoice does not prove fulfillment.",
        )}
      </p>
      <p className="text-sm">
        {text(
          "Technical acceptance does not make quarantined stock available. Warehouse intake does not establish department fulfillment.",
        )}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map(([key, label]) => (
          <div key={key} role="group" aria-label={text(label)}>
            <dt className="text-sm text-slate-600">{text(label)}</dt>
            <dd className="font-semibold">
              {text(
                completion[key]
                  ? "Verified"
                  : key === "receipt_complete" && completion.partially_received
                    ? "Partially accepted"
                    : key === "fulfillment_complete" &&
                        completion.partially_fulfilled
                      ? "Partially fulfilled"
                      : "Pending evidence",
              )}
            </dd>
          </div>
        ))}
      </dl>
      {typeof completion.financial_complete === "boolean" && (
        <p>
          {text("Financial completion")}:{" "}
          {text(
            completion.financial_complete
              ? "Verified"
              : "Open or unverified obligations",
          )}
        </p>
      )}
      {completion.legacy_completion_without_fulfillment && (
        <p role="note" className="text-amber-800">
          {text(
            "The historical completion label is preserved. Current fulfillment evidence is incomplete.",
          )}
        </p>
      )}
      {completion.evidence_gap && (
        <p role="alert">
          {text(
            "Inconsistent sources or an unsupported UOM/service policy require review.",
          )}
        </p>
      )}
      {completion.terminal && (
        <p>
          {text(
            "This request is cancelled or rejected. Evidence does not reopen it.",
          )}
        </p>
      )}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[
                "Demand line",
                "Required",
                "Ordered",
                "Delivered",
                "Quality accepted",
                "Pending inspection",
                "Accepted awaiting availability",
                "Available accepted",
                "Rejected",
                "Quarantined",
                "Warehouse issued",
                "Fulfilled",
              ].map((label) => (
                <th key={label} className="p-2 text-start">
                  {text(label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {completion.items.map((line) => (
              <tr key={`${line.line_kind}:${line.line_id}`}>
                <td>
                  #{line.line_id} {line.uom || text("Inventory unit")}
                  {onAcknowledge &&
                    line.eligible &&
                    !line.unsupported_policy &&
                    !line.evidence_conflict &&
                    [
                      line.accepted_quantity,
                      line.warehouse_issued_quantity,
                      line.fulfilled_quantity,
                    ].some((value) =>
                      greaterQuantity(
                        value,
                        line.requester_acknowledged_quantity || "0",
                      ),
                    ) && (
                      <button
                        type="button"
                        disabled={submitting}
                        className="ml-2 rounded border p-2"
                        onClick={() => onAcknowledge(line)}
                      >
                        {text("Confirm physical receipt")}
                      </button>
                    )}
                </td>
                {[
                  "quantity",
                  "ordered_quantity",
                  "delivered_quantity",
                  "technically_accepted_quantity",
                  "pending_inspection_quantity",
                  "accepted_pending_release_quantity",
                  "accepted_quantity",
                  "rejected_quantity",
                  "quarantined_quantity",
                  "warehouse_issued_quantity",
                  "fulfilled_quantity",
                ].map((key) => (
                  <td key={key} className="p-2" dir="ltr">
                    {line[key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
