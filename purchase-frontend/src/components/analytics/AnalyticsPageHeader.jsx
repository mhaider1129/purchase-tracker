import React from 'react';

const AnalyticsPageHeader = ({ eyebrow, title, description, icon: Icon, actions, meta = [] }) => (
  <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl sm:px-8">
    <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" aria-hidden="true" />
    <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" aria-hidden="true" />
    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <div className="mb-4 flex items-center gap-3">
          {Icon && <span className="rounded-xl border border-white/10 bg-white/10 p-2.5"><Icon className="h-5 w-5" aria-hidden="true" /></span>}
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">{eyebrow}</p>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{description}</p>
        {meta.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{meta.map(item => <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{item}</span>)}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  </header>
);

export default AnalyticsPageHeader;