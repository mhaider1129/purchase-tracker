import React from "react";
import { useTranslation } from "react-i18next";
import "./RequestItemsFocus.css";
export default function RequestItemsFocus({
  items,
  counts,
  value,
  onChange,
  visibleCount,
  filtered,
  onReset,
}) {
  const { t } = useTranslation();
  const tr = (key, options) => t(`requestItemsFocus.${key}`, options);
  return (
    <div className="request-items-focus print:hidden">
      <div
        role="group"
        aria-label={tr("views")}
        className="request-items-focus-options"
      >
        {["all", "remaining", "identity"].map((key) => (
          <button
            type="button"
            key={key}
            aria-pressed={value === key}
            onClick={() => onChange(key)}
          >
            {tr(key)} <span>{key === "all" ? items.length : counts[key]}</span>
          </button>
        ))}
      </div>
      <div className="request-items-focus-summary">
        <p role="status">
          {tr("showing", { visible: visibleCount, total: items.length })}
        </p>
        {filtered && (
          <button type="button" onClick={onReset}>
            {tr("reset")}
          </button>
        )}
      </div>
    </div>
  );
}
