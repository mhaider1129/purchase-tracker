import React, { useMemo } from 'react';

const GuidedWorkflowPanel = ({ title, subtitle, steps = [], storageKey, onCompleteStep }) => {
  const completedSteps = useMemo(() => {
    if (!storageKey) return [];
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  const completionCount = steps.filter((step) => completedSteps.includes(step.id)).length;
  const progress = steps.length > 0 ? Math.round((completionCount / steps.length) * 100) : 0;

  const handleToggle = (stepId) => {
    if (!storageKey || !onCompleteStep) return;
    const next = completedSteps.includes(stepId)
      ? completedSteps.filter((id) => id !== stepId)
      : [...completedSteps, stepId];
    localStorage.setItem(storageKey, JSON.stringify(next));
    onCompleteStep(next);
  };

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-indigo-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-indigo-700">{subtitle}</p> : null}
        </div>
        <p className="text-sm font-semibold text-indigo-800">{completionCount}/{steps.length} complete</p>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((step) => {
          const done = completedSteps.includes(step.id);
          return (
            <li key={step.id} className="rounded-md border border-indigo-100 bg-white p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={done} onChange={() => handleToggle(step.id)} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{step.title}</span>
                  {step.tip ? <span className="mt-1 block text-xs text-slate-600">Tip: {step.tip}</span> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default GuidedWorkflowPanel;