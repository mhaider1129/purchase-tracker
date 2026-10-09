import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Package, CheckCircle2, Paperclip } from "lucide-react";
import RequestAgeBadge from "../workspaces/RequestAgeBadge";
import "./RequestOverviewReview.css";

export default function RequestOverviewReview({
  request,
  summary,
  unfinishedCount,
  onNavigate,
}) {
  const { t } = useTranslation();
  const tr = (key, options) => t(`requestOverviewReview.${key}`, options);
  const updated = request.updated_at ? new Date(request.updated_at) : null;
  const entries = [
    { tab: "Items", Icon: Package, key: "items", count: unfinishedCount },
    {
      tab: "Approvals",
      Icon: CheckCircle2,
      key: "approvals",
      count: summary.pendingApprovals,
    },
    {
      tab: "Documents",
      Icon: Paperclip,
      key: "documents",
      count: summary.attachmentsCount,
    },
  ];
  return (
    <section
      className="request-overview-review"
      aria-labelledby="request-overview-review-title"
    >
      <h2 id="request-overview-review-title">{tr("title")}</h2>
      <p>{tr("hint")}</p>
      <RequestAgeBadge createdAt={request.created_at} />
      <div className="request-overview-review-links">
        {entries.map(({ tab, Icon, key, count }) => (
          <button type="button" key={tab} onClick={() => onNavigate(tab)}>
            <Icon size={18} aria-hidden="true" />
            <span>
              <strong>{tr(key)}</strong>
              <small>{tr(`${key}Count`, { count })}</small>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="request-overview-review-updated">
        {tr("updated")}:{" "}
        {updated && Number.isFinite(updated.getTime())
          ? updated.toLocaleString()
          : tr("unknown")}
      </p>
    </section>
  );
}
