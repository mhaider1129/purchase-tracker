import React from "react";
import { useTranslation } from "react-i18next";
import { CircleArrowRight, LockKeyhole, Pencil } from "lucide-react";
import RequestAgeBadge from "../workspaces/RequestAgeBadge";
import "./RequestTrackingBrief.css";

export default function RequestTrackingBrief({
  request,
  stage,
  canEdit,
  compact = false,
}) {
  const { t } = useTranslation();
  const tr = (key, fallback) => t(`openRequestTracking.${key}`, fallback);
  return (
    <section
      className={`request-tracking-brief ${compact ? "request-tracking-brief--compact" : ""}`}
      aria-label={tr("tracking", "Request tracking summary")}
    >
      <div className="request-tracking-stage">
        <CircleArrowRight size={16} aria-hidden="true" />
        <strong>{stage}</strong>
      </div>
      <RequestAgeBadge createdAt={request.created_at} />
      {request.next_required_action && <p>{request.next_required_action}</p>}
      <div className="request-tracking-edit">
        {canEdit ? (
          <Pencil size={13} aria-hidden="true" />
        ) : (
          <LockKeyhole size={13} aria-hidden="true" />
        )}
        <span>
          {canEdit
            ? tr(
                "editable",
                "Editing available before approval activity starts.",
              )
            : tr(
                "locked",
                "Editing locked. Follow approvals and procurement in the workspace.",
              )}
        </span>
      </div>
    </section>
  );
}
