import React from "react";
import useWorkspaceTranslation from "./useWorkspaceTranslation";

export default function ApprovalDecisionSummary({ requestIds, decisions }) {
  const t = useWorkspaceTranslation();
  const rejected = requestIds.filter(
    (id) => decisions[id] === "Rejected",
  ).length;
  const approved = requestIds.length - rejected;
  return (
    <div className="approval-decision-summary" role="status" aria-live="polite">
      <span>
        {t("operationalWorkspace.inSummary")}:{" "}
        <strong>{requestIds.length}</strong>
      </span>
      <span>
        {t("operationalWorkspace.toApprove")}: <strong>{approved}</strong>
      </span>
      <span>
        {t("operationalWorkspace.toReject")}: <strong>{rejected}</strong>
      </span>
    </div>
  );
}
