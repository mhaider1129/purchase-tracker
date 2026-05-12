import React from 'react';

const PageShell = ({
  title,
  description,
  actions,
  filters,
  kpis,
  children,
}) => {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {filters ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">{filters}</div> : null}
      </header>

      {Array.isArray(kpis) && kpis.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="KPI summary strip">
          {kpis.map((kpi) => (
            <article key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">{kpi.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{kpi.value}</p>
              {kpi.helper ? <p className="mt-1 text-xs text-slate-500">{kpi.helper}</p> : null}
            </article>
          ))}
        </section>
      ) : null}

      <main className="space-y-6">{children}</main>
    </div>
  );
};

export default PageShell;