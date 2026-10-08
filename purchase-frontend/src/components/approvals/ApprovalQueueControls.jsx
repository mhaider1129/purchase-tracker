import React from "react";
import { useTranslation } from "react-i18next";
import { getApprovalQueueStatus } from "../../utils/approvalQueue";
import "./ApprovalQueueControls.css";

export default function ApprovalQueueControls({
  requests,
  value,
  onChange,
  urgency,
  onUrgencyChange,
  sort,
  onSortChange,
}) {
  const { t } = useTranslation();
  const tr = (key, fallback) => t(`approvalQueueEnhancements.${key}`, fallback);
  const counts = {
    all: requests.length,
    pending: requests.filter(
      (request) => getApprovalQueueStatus(request) === "pending",
    ).length,
    hold: requests.filter(
      (request) => getApprovalQueueStatus(request) === "on hold",
    ).length,
  };
  return (
    <section
      className="approval-queue-controls"
      aria-label={tr("queueViews", "Approval queue views")}
    >
      <div className="approval-queue-lanes">
        {[
          ["all", tr("all", "All requests")],
          ["pending", tr("pending", "Awaiting decision")],
          ["hold", tr("hold", "On hold")],
        ].map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={value === key}
            onClick={() => onChange(key)}
          >
            <span>{label}</span>
            <strong>{counts[key]}</strong>
          </button>
        ))}
      </div>
      <div className="approval-queue-shortcuts">
        <button
          type="button"
          aria-pressed={urgency === "urgent"}
          onClick={() =>
            onUrgencyChange(urgency === "urgent" ? "all" : "urgent")
          }
        >
          {tr("urgent", "Urgent only")}
        </button>
        <button
          type="button"
          aria-pressed={sort === "oldest"}
          onClick={() => onSortChange(sort === "oldest" ? "newest" : "oldest")}
        >
          {tr("oldest", "Longest waiting first")}
        </button>
        <p>
          {tr(
            "priorityHelp",
            "Urgent requests appear first. Dates order requests within each priority; missing dates appear last.",
          )}
        </p>
      </div>
    </section>
  );
}
