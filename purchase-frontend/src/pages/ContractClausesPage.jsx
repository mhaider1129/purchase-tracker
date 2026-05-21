import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

export default function ContractClausesPage(){
const [rows,setRows]=useState([]);const [q,setQ]=useState('');const [title,setTitle]=useState('');const [content,setContent]=useState('');
const load=()=>api.get('/contract-clauses').then(r=>setRows(r.data||[])); useEffect(()=>{load();},[]);
const filtered=useMemo(()=>rows.filter(r=>(`${r.clause_title} ${r.clause_type||''}`).toLowerCase().includes(q.toLowerCase())),[rows,q]);
const create=async()=>{if(!title||!content)return;await api.post('/contract-clauses',{clause_title:title,clause_content:content,clause_type:'General',language:'en'});setTitle('');setContent('');load();};
return <div className='space-y-4 p-4'><h1 className='text-xl font-semibold'>Clause Library</h1><input className='w-full rounded border px-3 py-2' placeholder='Search clauses' value={q} onChange={e=>setQ(e.target.value)}/><div className='grid gap-2 md:grid-cols-2'><input className='rounded border px-3 py-2' placeholder='Clause title' value={title} onChange={e=>setTitle(e.target.value)}/><input className='rounded border px-3 py-2' placeholder='Clause content' value={content} onChange={e=>setContent(e.target.value)}/></div><button className='rounded bg-blue-600 px-3 py-2 text-white' onClick={create}>Add Clause</button><div className='space-y-2'>{filtered.map(r=><div key={r.id} className='rounded border p-3'><div className='font-medium'>{r.clause_title}</div><div className='text-xs text-gray-500'>v{r.clause_version} · {r.clause_type||'General'}</div><p className='text-sm mt-2'>{r.clause_content}</p></div>)}</div></div>;
}