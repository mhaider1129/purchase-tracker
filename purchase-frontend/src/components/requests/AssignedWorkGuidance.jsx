import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ClipboardList } from "lucide-react";
import RequestAgeBadge from "../workspaces/RequestAgeBadge";
import "./AssignedWorkGuidance.css";

const useLabels = () => {
  const { t } = useTranslation();
  return (key, fallback, options = {}) =>
    t(`assignedWorkEnhancements.${key}`, {
      defaultValue: fallback,
      ...options,
    });
};

export function AssignedWorkViews({
  requests,
  completionStates,
  value,
  onChange,
  urgency,
  onUrgencyChange,
}) {
  const tr = useLabels();
  const ready = requests.filter(
    (request) => completionStates[request.id]?.canComplete,
  ).length;
  const views = [
    ["all", tr("all", "All assigned"), requests.length],
    ["ready", tr("ready", "Ready to complete"), ready],
    [
      "needs_attention",
      tr("attention", "Needs attention"),
      requests.length - ready,
    ],
  ];
  return (
    <section
      className="assigned-work-views"
      aria-label={tr("views", "Assigned work views")}
    >
      <div>
        {views.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            onClick={() => onChange(key)}
          >
            <span>{label}</span>
            <strong>{count}</strong>
          </button>
        ))}
      </div>
      <footer>
        <button
          type="button"
          aria-pressed={urgency === "urgent"}
          onClick={() =>
            onUrgencyChange(urgency === "urgent" ? "all" : "urgent")
          }
        >
          {tr("urgent", "Urgent only")}
        </button>
        <p>
          {tr(
            "countsHelp",
            "Counts cover all assigned requests. Search and other filters can narrow each view.",
          )}
        </p>
      </footer>
    </section>
  );
}

export default function AssignedWorkGuidance({ request, completionState }) {
  const tr = useLabels();
  const summary = request.status_summary || {};
  const total = Math.max(0, Number(summary.total_items) || 0);
  const finalized = Math.min(
    total,
    Math.max(
      0,
      (Number(summary.purchased_count) || 0) +
        (Number(summary.not_procured_count) || 0),
    ),
  );
  const ready = completionState.canComplete;
  return (
    <section
      className={`assigned-work-guidance ${ready ? "assigned-work-guidance--ready" : ""}`}
      aria-label={tr("nextSteps", "Completion checklist")}
    >
      <div className="assigned-work-guidance-heading">
        {ready ? (
          <CheckCircle2 size={18} aria-hidden="true" />
        ) : (
          <ClipboardList size={18} aria-hidden="true" />
        )}
        <h3>
          {ready
            ? tr("readyHeading", "Ready for completion")
            : tr("nextHeading", "Before completing this request")}
        </h3>
        <RequestAgeBadge
          createdAt={request.created_at || request.requested_at}
        />
      </div>
      {ready ? (
        <p>
          {tr(
            "readyHelp",
            "Item checks and recorded cost are complete. Use Mark Request as Completed to finish.",
          )}
        </p>
      ) : (
        <ul>
          {completionState.missingCost && (
            <li>
              {tr("missingCost", "Record and save the request total cost.")}
            </li>
          )}
          {completionState.incompleteItems && (
            <li>
              {tr(
                "incompleteItems",
                "Review item statuses and recorded quantities; finalize any outstanding items.",
              )}
            </li>
          )}
        </ul>
      )}
      {total > 0 && (
        <p className="assigned-work-finalized">
          {tr("finalized", "{{finalized}} of {{total}} items finalized", {
            finalized,
            total,
          })}
        </p>
      )}
    </section>
  );
}
