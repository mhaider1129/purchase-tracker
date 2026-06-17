import React from 'react';
import { hasPermission } from '../../utils/permissions';

export const URGENT_REQUEST_PERMISSION = 'requests.mark-urgent-on-submit';

const UrgentRequestToggle = ({ user, checked, onChange, disabled = false }) => {
  if (!hasPermission(user, URGENT_REQUEST_PERMISSION)) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
        />
        <span>
          <span className="block font-semibold">Mark this request as urgent</span>
          <span className="mt-1 block text-sm text-amber-800">
            Use only for time-sensitive requests that require priority attention during approval and procurement.
          </span>
        </span>
      </label>
    </div>
  );
};

export default UrgentRequestToggle;