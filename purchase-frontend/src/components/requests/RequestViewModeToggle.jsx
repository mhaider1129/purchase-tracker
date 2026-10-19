import "./RequestViewModeToggle.css";
import { List, LayoutGrid } from "lucide-react";
import React from "react";
import { REQUEST_VIEW_MODES } from "../../hooks/usePersistedRequestViewMode";

const RequestViewModeToggle = ({
  value,
  onChange,
  title = "Request view",
  description = "Use summary view to scan compact request cards, or detailed view to show request metadata up front.",
  detailedLabel = "Detailed",
  summaryLabel = "Summary",
  ariaLabel = "Request view mode",
  className = "",
}) => {
  const renderOption = (mode, label) => {
    const Icon = mode === REQUEST_VIEW_MODES.detailed ? LayoutGrid : List;
    const isActive = value === mode;

    return (
      <button
        type="button"
        className="request-view-option"
        onClick={() => onChange(mode)}
        aria-pressed={isActive}
      >
        <Icon size={16} aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className={`request-view-toolbar ${className}`}>
      <div>
        <p className="request-view-title">{title}</p>
        {description && (
          <p className="request-view-description">{description}</p>
        )}
      </div>
      <div className="request-view-options" role="group" aria-label={ariaLabel}>
        {renderOption(REQUEST_VIEW_MODES.detailed, detailedLabel)}
        {renderOption(REQUEST_VIEW_MODES.summary, summaryLabel)}
      </div>
    </div>
  );
};

export default RequestViewModeToggle;
