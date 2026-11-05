import React from "react";
import useUiTranslation from "../utils/useUiTranslation";
export const categoryLabels = {
  awaiting_approval: "Awaiting approval",
  awaiting_procurement: "Awaiting procurement",
  procurement_in_progress: "Procurement in progress",
  awaiting_delivery: "Awaiting delivery",
  partially_received: "Partially received",
  awaiting_technical_acceptance: "Awaiting technical acceptance",
  awaiting_fulfillment: "Awaiting department fulfillment",
  partially_fulfilled: "Partially fulfilled",
  fully_fulfilled: "Fully fulfilled",
  cancelled_rejected: "Cancelled or rejected",
  evidence_review: "Requires evidence review",
};
export function CompletionBadge({ completion }) {
  const text = useUiTranslation();
  return (
    <span
      className="inline-block rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs text-blue-900"
      title={text("Current canonical completion")}
    >
      {text(
        categoryLabels[completion?.category] ||
          "Verified completion unavailable",
      )}
    </span>
  );
}
export default function CompletionReportingSummary({ report }) {
  const text = useUiTranslation();
  if (report?.basis !== "canonical_completion_v1")
    return <p role="status">{text("Verified completion unavailable")}</p>;
  return (
    <section
      className="my-4 rounded-xl border bg-white p-4"
      aria-label={text("Canonical completion reporting")}
    >
      <h2 className="font-semibold">
        {text("Canonical completion reporting")}
      </h2>
      <p className="text-sm">
        {text(
          "Current authorized request cohort. Ordering, accepted receiving and department fulfillment are separate measures.",
        )}
      </p>
      <dl className="mt-3 grid gap-3 md:grid-cols-4">
        {[
          ["eligible_requests", "Approved eligible requests"],
          ["procurement_complete_requests", "Procurement committed"],
          ["receipt_complete_requests", "Receiving accepted"],
          ["fulfilled_requests", "Department fulfillment verified"],
          ["stock_ready_requests", "Stock ready for issue"],
          [
            "legacy_unverified_requests",
            "Historical completion without verified fulfillment",
          ],
        ].map(([key, label]) => (
          <div key={key}>
            <dt>{text(label)}</dt>
            <dd className="font-semibold">{report[key] ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <p>
        {text("Verified fulfillment rate")}:{" "}
        {report.fulfillment_rate == null
          ? "—"
          : `${Number(report.fulfillment_rate).toFixed(1)}%`}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {Object.entries(report.categories || {}).map(([key, count]) => (
          <span key={key}>
            {text(categoryLabels[key] || "Requires evidence review")}: {count}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs">
        {text(
          "Monthly figures use request creation cohorts in UTC. Historical archive rates are not fulfillment rates.",
        )}
      </p>
    </section>
  );
}
