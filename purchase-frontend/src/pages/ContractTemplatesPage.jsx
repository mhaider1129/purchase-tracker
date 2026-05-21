import React, { useEffect, useState } from 'react';
import api from '../api/axios';

export default function ContractTemplatesPage(){
  const [rows,setRows]=useState([]);const [name,setName]=useState('');
  const load=()=>api.get('/contract-templates').then(r=>setRows(r.data||[]));
  useEffect(()=>{load();},[]);
  const create=async()=>{if(!name.trim())return;await api.post('/contract-templates',{template_name:name,default_sections:{},default_clauses:[],default_alert_rules:{}});setName('');load();};
  const duplicate=async(r)=>{await api.post('/contract-templates',{...r,template_name:`${r.template_name} (Copy)`});load();};
  const toggle=async(r)=>{await api.patch(`/contract-templates/${r.id}`,{is_active:!r.is_active});load();};
  return <div className='space-y-4 p-4'><h1 className='text-xl font-semibold'>Contract Templates</h1><div className='flex gap-2'><input className='rounded border px-3 py-2' value={name} onChange={e=>setName(e.target.value)} placeholder='Template name'/><button className='rounded bg-blue-600 px-3 py-2 text-white' onClick={create}>Create</button></div><div className='space-y-2'>{rows.map(r=><div key={r.id} className='flex items-center justify-between rounded border p-3'><div><div className='font-medium'>{r.template_name}</div><div className='text-xs text-gray-500'>{r.contract_category||'General'} · {r.is_active?'Active':'Inactive'}</div></div><div className='flex gap-2'><button className='rounded border px-2 py-1 text-xs' onClick={()=>duplicate(r)}>Duplicate</button><button className='rounded border px-2 py-1 text-xs' onClick={()=>toggle(r)}>{r.is_active?'Deactivate':'Activate'}</button></div></div>)}</div></div>;
}