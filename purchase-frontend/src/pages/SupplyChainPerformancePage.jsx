import React, { useEffect, useState } from 'react';
import { getPerformanceDashboard } from '../api/procurementPerformance';

export const SECTIONS = ['Executive Overview','Procurement Demand','Current Pipeline','Complexity Mix','Workload','Commercial Performance','Sourcing Performance','International Procurement','Cycle-Time Analysis','Buyer Workload','Pending Root Causes','Strategic / Hard-to-Source Cases'];
const Metric = ({ label, metric }) => <div className="rounded border p-3"><dt className="text-sm text-gray-500">{label}</dt><dd className="text-xl font-semibold">{metric?.status === 'not_available' || metric?.coverage !== 'FULL' ? 'Not available' : metric?.value}</dd>{metric?.reason && <small>{metric.reason}</small>}</div>;

export default function SupplyChainPerformancePage() {
  const [filters,setFilters]=useState({}); const [data,setData]=useState(null); const [error,setError]=useState('');
  useEffect(()=>{ let active=true; getPerformanceDashboard(filters).then(r=>active&&setData(r.data)).catch(()=>active&&setError('Performance data is unavailable.')); return()=>{active=false}; },[filters]);
  return <main className="space-y-6 p-6"><header><h1 className="text-2xl font-bold">Supply Chain Performance &amp; Workload</h1><p>PWU describes capacity and portfolio complexity; it is not an employee ranking.</p></header>
    <label>Date from <input aria-label="Date from" type="date" onChange={e=>setFilters(x=>({...x,date_from:e.target.value}))}/></label>
    {error && <div role="alert">{error}</div>}
    {SECTIONS.map(section=><section key={section} aria-label={section}><h2 className="text-xl font-semibold">{section}</h2>
      {section==='Executive Overview' && <Metric label="Requested items" metric={data?.metrics?.requested_items}/>} 
      {section==='Complexity Mix' && <div>{data?.complexity?.map(x=><span key={x.class}>Class {x.class}: {x.count} </span>)}</div>}
      {section==='Buyer Workload' && <div>{data?.buyers?.map(x=><p key={x.buyer_id}>{x.buyer_name}: {x.workload_units} PWU</p>)}</div>}
      {section==='Pending Root Causes' && <div>{data?.pending?.map(x=><p key={x.root_cause}>{x.root_cause}: {x.count}</p>)}</div>}
      {section==='Strategic / Hard-to-Source Cases' && <div>{data?.highlights?.map(x=><p key={x.case_id}>{x.summary}</p>)}</div>}
    </section>)}</main>;
}