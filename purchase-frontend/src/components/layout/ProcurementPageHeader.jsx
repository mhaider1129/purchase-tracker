import React from "react";
import { BriefcaseBusiness } from "lucide-react";

/** Shared heading for the request and approval workspaces. */
const ProcurementPageHeader = ({
  title,
  description,
  eyebrow = "Procurement workspace",
  icon: Icon = BriefcaseBusiness,
  actions,
  children,
}) => (
  <header className="procurement-workspace-header relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-7 text-white shadow-xl shadow-slate-950/10 sm:px-8">
    <div
      className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl"
      aria-hidden="true"
    />
    <div
      className="pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-indigo-400/10 blur-3xl"
      aria-hidden="true"
    />
    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-blue-200 shadow-inner sm:flex">
          <Icon size={24} aria-hidden="true" />
        </span>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
            {eyebrow}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
    {children ? <div className="relative mt-6">{children}</div> : null}
  </header>
);

export default ProcurementPageHeader;