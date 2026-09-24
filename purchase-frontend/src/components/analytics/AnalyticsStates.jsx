import React from 'react';
import { AlertTriangle, BarChart3, Loader2 } from 'lucide-react';

export const AnalyticsLoading = ({ label = 'Loading analytics…' }) => (
  <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
    <Loader2 className="mb-3 h-7 w-7 animate-spin text-blue-600" aria-hidden="true" />
    <p className="font-medium">{label}</p>
  </div>
);

export const AnalyticsError = ({ message, onRetry }) => (
  <div role="alert" className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
    <AlertTriangle className="mb-3 h-8 w-8 text-rose-600" aria-hidden="true" />
    <h2 className="font-semibold text-rose-950">Analytics could not be loaded</h2>
    <p className="mt-1 text-sm text-rose-700">{message}</p>
    {onRetry && <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">Try again</button>}
  </div>
);

export const EmptyChart = ({ label = 'No data for this period' }) => (
  <div className="flex h-64 flex-col items-center justify-center text-slate-400">
    <BarChart3 className="mb-2 h-7 w-7" aria-hidden="true" /><p className="text-sm">{label}</p>
  </div>
);