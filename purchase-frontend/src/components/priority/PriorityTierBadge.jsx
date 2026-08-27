import React from 'react';

const styles = { P0: 'bg-red-100 text-red-800', P1: 'bg-orange-100 text-orange-800', P2: 'bg-amber-100 text-amber-800', P3: 'bg-blue-100 text-blue-800', P4: 'bg-slate-100 text-slate-700' };

export default function PriorityTierBadge({ tier }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${styles[tier] || styles.P4}`}>{tier}</span>;
}