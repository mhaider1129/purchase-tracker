import React from "react";
import { useTranslation } from "react-i18next";
import { Clock3 } from "lucide-react";

export function getRequestAgeDays(value, now = Date.now()) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now - timestamp) / 86400000));
}

export default function RequestAgeBadge({ createdAt }) {
  const { t } = useTranslation();
  const days = getRequestAgeDays(createdAt);
  if (days === null) return null;
  return (
    <span className="request-age-badge">
      <Clock3 size={13} aria-hidden="true" />
      {t("operationalWorkspace.requestAge", { count: days })}
    </span>
  );
}
