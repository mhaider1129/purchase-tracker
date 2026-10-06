import React from "react";
import useWorkspaceTranslation from "./useWorkspaceTranslation";
import { ArrowDownRight } from "lucide-react";

export default function WorkspaceSectionNav({ sections }) {
  const t = useWorkspaceTranslation();
  return (
    <nav
      className="workspace-section-nav print:hidden"
      aria-label={t("operationalWorkspace.jumpTo")}
    >
      <span className="workspace-section-nav-label">
        {t("operationalWorkspace.jumpTo")}
      </span>
      <div>
        {sections.map(({ id, label }) => (
          <a key={id} href={`#${id}`}>
            <ArrowDownRight size={14} aria-hidden="true" />
            {t(`operationalWorkspace.${label}`)}
          </a>
        ))}
      </div>
    </nav>
  );
}
