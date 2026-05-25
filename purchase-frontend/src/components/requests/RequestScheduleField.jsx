import React from 'react';

const RequestScheduleField = ({ value, onChange, disabled }) => (
  <div>
    <label className="block font-semibold mb-1">Schedule submission (optional)</label>
    <input
      type="datetime-local"
      className="w-full p-2 border rounded"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
    <p className="text-xs text-gray-500 mt-1">Leave empty to submit immediately.</p>
  </div>
);

export default RequestScheduleField;