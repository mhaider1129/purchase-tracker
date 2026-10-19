import React from "react";
import { useTranslation } from "react-i18next";
import "../../styles/RequestLists.css";
export default function UrgentRequestBadge({ urgent }) {
  const { t } = useTranslation();
  return urgent ? (
    <span className="request-urgent-indicator">
      {t("common.urgent", { defaultValue: "Urgent" })}
    </span>
  ) : null;
}
