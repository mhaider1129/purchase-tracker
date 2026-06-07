import React from 'react';
import { REQUEST_VIEW_MODES } from '../../hooks/usePersistedRequestViewMode';

const RequestViewModeToggle = ({
  value,
  onChange,
  title = 'Request view',
  description = 'Use summary view to scan compact request cards, or detailed view to show request metadata up front.',
  detailedLabel = 'Detailed',
  summaryLabel = 'Summary',
  ariaLabel = 'Request view mode',
  className = '',
}) => {
  const renderOption = (mode, label) => {
    const isActive = value === mode;

    return (
      <button
        type="button"
        className={`rounded px-3 py-1.5 text-sm font-medium ${
          isActive
            ? 'bg-white text-blue-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
        onClick={() => onChange(mode)}
        aria-pressed={isActive}
      >
        {label}
      </button>
    );
  };

  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <div
        className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1"
        role="group"
        aria-label={ariaLabel}
      >
        {renderOption(REQUEST_VIEW_MODES.detailed, detailedLabel)}
        {renderOption(REQUEST_VIEW_MODES.summary, summaryLabel)}
      </div>
    </div>
  );
};

export default RequestViewModeToggle;