import React, { useState } from 'react';
import { HardHat, Plus, X, CheckCircle, Clock, AlertTriangle, User, Calendar, Shield } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const STATUS_META = {
  active:   { label:'Active',    color:'text-green-400',  bg:'bg-green-900/15',  border:'border-green-700/30' },
  expired:  { label:'Expired',   color:'text-red-400',    bg:'bg-red-900/15',    border:'border-red-700/30' },
  pending:  { label:'Pending',   color:'text-amber-400',  bg:'bg-amber-900/15',  border:'border-amber-700/30' },
  suspended:{ label:'Suspended', color:'text-orange-400', bg:'bg-orange-900/15', border:'border-orange-700/30' },
};

const SEED = [
  { id:'c1', name:'Rajesh Constructions Pvt Ltd', contact:'Rakesh Jain', phone:'9876541234', type:'Civil Works', accessLevel:'Surface Only', entry:'2026-09-01', expiry:'2026-10-01', status:'active', workers:8, inducted:true },
  { id:'c2', name:'ElectroPower Solutions', contact:'Anil Sharma', phone:'9876549876', type:'Electrical', accessLevel:'All Sections', entry:'2026-08-15', expiry:'2026-09-20', status:'expired', workers:3, inducted:true },
  { id:'c3', name:'SafeTech Sensors India', contact:'Pradeep Nair', phone:'9876543333', type:'Equipment Installation', accessLevel:'SEC-A Only', entry:'2026-09-25', expiry:'2026-10-10', status:'pending', workers:2, inducted:false },
  { id:'c4', name:'AquaFlow Pumps Ltd', contact:'Suresh Gupta', phone:'9876544444', type:'Pump Maintenance', accessLevel:'Pump Room', entry:'2026-09-10', expiry:'2026-09-30', status:'active', workers:4, inducted:true },
];

export default function ContractorPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [contractors, setContractors] = useState(SEED);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ name:'', contact:'', phone:'', type:'Civil Works', accessLevel:'Surface Only', entry:'', expiry:'', workers:'', status:'pending', inducted:false });

  function add() {
    if (!form.name) return;
    setContractors(c => [...c, { id:'c'+Date.now(), ...form, workers: parseInt(form.workers)||0 }]);
    setForm({ name:'', contact:'', phone:'', type:'Civil Works', accessLevel:'Surface Only', entry:'', expiry:'', workers:'', status:'pending', inducted:false });
    setShowForm(false);
  }

  function updateStatus(id, status) { setContractors(c => c.map(x => x.id===id ? {...x,status} : x)); }

  const filtered = filter==='all' ? contractors : contractors.filter(c=>c.status===filter);
  const counts = Object.keys(STATUS_META).reduce((a,k)=>({...a,[k]:contractors.filter(c=>c.status===k).length}),{});

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <HardHat className="w-5 h-5 text-mine-cyan" />
          <h1 className="font-bold text-lg">Contractor Access Management</h1>
          {counts.expired>0 && <span className="badge-danger">{counts.expired} expired</span>}
        </div>
        {isAdmin && <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Add Contractor</button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_META).map(([k,m])=>(
          <div key={k} className={`card border ${m.border} text-center cursor-pointer`} onClick={()=>setFilter(k)}>
            <div className="metric-label mb-1">{m.label}</div>
            <div className={`text-2xl font-black ${m.color}`}>{counts[k]||0}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card border border-mine-border/60 space-y-3">
          <div className="section-title"><Plus className="w-3.5 h-3.5"/>New Contractor</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className="metric-label mb-1.5 block">Company Name</label><input className="input-dark" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Contact Person</label><input className="input-dark" value={form.contact} onChange={e=>setForm(f=>({...f,contact:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Phone</label><input className="input-dark" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Work Type</label><input className="input-dark" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Access Level</label>
              <select className="input-dark" value={form.accessLevel} onChange={e=>setForm(f=>({...f,accessLevel:e.target.value}))}>
                {['Surface Only','SEC-A Only','All Sections','Pump Room','Gateway Area'].map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
            <div><label className="metric-label mb-1.5 block">Entry Date</label><input type="date" className="input-dark" value={form.entry} onChange={e=>setForm(f=>({...f,entry:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Expiry Date</label><input type="date" className="input-dark" value={form.expiry} onChange={e=>setForm(f=>({...f,expiry:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">No. of Workers</label><input type="number" className="input-dark" value={form.workers} onChange={e=>setForm(f=>({...f,workers:e.target.value}))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Add</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter==='all'?'bg-mine-accent text-mine-bg':'btn-ghost'}`}>All</button>
        {Object.entries(STATUS_META).map(([k,m])=>(
          <button key={k} onClick={()=>setFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter===k?'bg-mine-accent text-mine-bg':'btn-ghost'}`}>{m.label}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(c=>{
          const sm = STATUS_META[c.status]||STATUS_META.pending;
          return (
            <div key={c.id} className={`card border ${sm.border}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-black ${sm.color}`}>{sm.label}</span>
                    <span className="font-bold text-sm text-mine-text">{c.name}</span>
                    {!c.inducted && <span className="badge-warn text-xs">Not Inducted</span>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-xs text-ink-500">
                    <span className="flex items-center gap-1"><User className="w-3 h-3"/>{c.contact}</span>
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3"/>{c.accessLevel}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>Expires: {c.expiry}</span>
                    <span className="flex items-center gap-1"><HardHat className="w-3 h-3"/>{c.workers} workers</span>
                  </div>
                  <div className="text-xs text-ink-600 mt-1">Type: {c.type} · Phone: {c.phone}</div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 flex-shrink-0">
                    {c.status!=='active' && <button onClick={()=>updateStatus(c.id,'active')} className="btn-ghost text-xs text-green-400">Activate</button>}
                    {c.status!=='suspended' && <button onClick={()=>updateStatus(c.id,'suspended')} className="btn-ghost text-xs text-red-400">Suspend</button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
