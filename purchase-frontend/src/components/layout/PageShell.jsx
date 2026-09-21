import React from "react";
import ProcurementPageHeader from "./ProcurementPageHeader";

const PageShell = ({
  title,
  description,
  actions,
  filters,
  kpis,
  children,
  eyebrow,
  icon,
}) => {
  return (
    <div className="procurement-workspace mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <ProcurementPageHeader
        title={title}
        description={description}
        eyebrow={eyebrow}
        icon={icon}
        actions={actions}
      >
        {filters ? (
          <div className="rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
            {filters}
          </div>
        ) : null}
      </ProcurementPageHeader>

      {Array.isArray(kpis) && kpis.length > 0 ? (
        <section
          className="workspace-kpi-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="KPI summary strip"
        >
          {kpis.map((kpi) => (
            <article
              key={kpi.label}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className={`absolute inset-y-0 left-0 w-1 ${kpi.accent || "bg-slate-300"}`}
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {kpi.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                    {kpi.value}
                  </p>
                </div>
                {kpi.icon ? (
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.iconClass || "bg-slate-100 text-slate-600"}`}
                    aria-hidden="true"
                  >
                    {kpi.icon}
                  </span>
                ) : null}
              </div>
              {kpi.helper ? (
                <p className="mt-1 text-xs text-slate-500">{kpi.helper}</p>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      <main className="space-y-6">{children}</main>
    </div>
  );
};

export default PageShell;