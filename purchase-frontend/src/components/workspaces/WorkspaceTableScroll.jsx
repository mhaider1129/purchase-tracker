import React from "react";
import { useTranslation } from "react-i18next";
import { MoveHorizontal } from "lucide-react";

export default function WorkspaceTableScroll({
  children,
  className = "",
  ...props
}) {
  const { t } = useTranslation();
  return (
    <div
      {...props}
      className={`workspace-table-scroll ${className}`}
      tabIndex={0}
      role="region"
      aria-label={t("operationalWorkspace.tableLabel")}
    >
      <p className="workspace-table-hint print:hidden">
        <MoveHorizontal size={15} aria-hidden="true" />
        {t("operationalWorkspace.tableHint")}
      </p>
      {children}
    </div>
  );
}
