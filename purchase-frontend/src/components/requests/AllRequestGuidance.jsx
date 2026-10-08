import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowRightCircle, UserRound } from "lucide-react";
import RequestAgeBadge from "../workspaces/RequestAgeBadge";
import { isCompletedRequestStatus } from "../../utils/requestStatus";
import "./AllRequestGuidance.css";

export function getRequestGuidanceKey(request) {
  const status = String(request.status || "")
    .trim()
    .toLowerCase();
  if (isCompletedRequestStatus(status)) return "completed";
  if (["cancelled", "canceled", "rejected"].includes(status)) return "closed";
  if (["on hold", "on_hold"].includes(status)) return "held";
  if (request.current_approver_role) return "approval";
  if (
    [
      "approved",
      "assigned",
      "partially procured",
      "technical_inspection_pending",
    ].includes(status)
  ) {
    const assigned =
      request.assigned_user_name ||
      request.assigned_to ||
      request.split_assignees?.length;
    return assigned ? "procurement" : "unassigned";
  }
  return "review";
}

export default function AllRequestGuidance({ request, step, assignedDisplay }) {
  const { t } = useTranslation();
  const tr = (key) => t(`allRequestGuidance.${key}`);
  const guidance = getRequestGuidanceKey(request);
  // Terminal requests must not display a stale action supplied by the server.
  const nextAction =
    !["closed", "completed"].includes(guidance) &&
    typeof request.next_required_action === "string" &&
    request.next_required_action.trim();
  return (
    <section className="all-request-guidance" aria-label={tr("title")}>
      <div className="all-request-guidance-step">
        <ArrowRightCircle size={17} aria-hidden="true" />
        <div>
          <span className="all-request-guidance-label">{tr("step")}</span>
          <strong>{step}</strong>
          {request.current_approver_role &&
            request.current_approval_level != null &&
            !["closed", "completed"].includes(guidance) && (
              <span>
                {tr("level")} {request.current_approval_level}
              </span>
            )}
        </div>
      </div>
      <div className="all-request-guidance-assignment">
        <UserRound size={17} aria-hidden="true" />
        <div>
          <span className="all-request-guidance-label">{tr("assigned")}</span>
          <strong>
            {assignedDisplay ||
              tr(request.assigned_to ? "assignedUnknown" : "notAssigned")}
          </strong>
        </div>
      </div>
      <RequestAgeBadge createdAt={request.created_at} />
      <p className="all-request-guidance-action">
        {nextAction || tr(guidance)}
      </p>
    </section>
  );
}
