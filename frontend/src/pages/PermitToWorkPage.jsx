import React, { useState } from 'react';
import { FileCheck, Plus, X, CheckCircle, AlertTriangle, Clock, User } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const PERMIT_TYPES = ['Hot Work (Welding/Cutting)','Confined Space Entry','Electrical Isolation','Working at Height','Excavation/Ground Breaking','Chemical Handling','Explosive Handling'];
const STATUS_META = {
  pending:  { label:'Pending Approval', color:'text-amber-400',  bg:'bg-amber-900/10',  border:'border-amber-700/30' },
  active:   { label:'Active',           color:'text-green-400',  bg:'bg-green-900/10',  border:'border-green-700/30' },
  expired:  { label:'Expired',          color:'text-red-400',    bg:'bg-red-900/10',    border:'border-red-700/30' },
  cancelled:{ label:'Cancelled',        color:'text-mine-muted', bg:'bg-mine-deeper',   border:'border-mine-border/30' },
  completed:{ label:'Completed',        color:'text-blue-400',   bg:'bg-blue-900/10',   border:'border-blue-700/30' },
};

const SEED = [
  { id:'ptw1', permitNo:'PTW-2026-041', type:'Hot Work (Welding/Cutting)', section:'Gateway Area', requester:'Maintenance Team', approver:'Vikas Sharma', issued:'2026-09-26 08:00', expires:'2026-09-26 17:00', status:'active', hazards:'Fire, fumes', precautions:'Fire extinguisher on-site, gas check before work' },
  { id:'ptw2', permitNo:'PTW-2026-040', type:'Electrical Isolation', section:'Pump Room', requester:'ElectroPower Solutions', approver:'Admin', issued:'2026-09-25 09:00', expires:'2026-09-25 16:00', status:'completed', hazards:'Electric shock', precautions:'LOTO applied, voltage tested' },
  { id:'ptw3', permitNo:'PTW-2026-042', type:'Confined Space Entry', section:'Water Sump', requester:'Arjun Meena', approver:'', issued:'', expires:'', status:'pending', hazards:'Low oxygen, toxic gas', precautions:'Gas test required, rescue team standby' },
];

export default function PermitToWorkPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [permits, setPermits] = useState(SEED);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type:'Hot Work (Welding/Cutting)', section:'', requester: currentUser?.name||'', hazards:'', precautions:'', expires:'' });

  const nextNo = `PTW-2026-${String(permits.length+43).padStart(3,'0')}`;

  function add() {
    if (!form.type || !form.section) return;
    setPermits(p => [...p, { id:'ptw'+Date.now(), permitNo:nextNo, ...form, approver:'', issued:'', status:'pending' }]);
    setForm({ type:'Hot Work (Welding/Cutting)', section:'', requester: currentUser?.name||'', hazards:'', precautions:'', expires:'' });
    setShowForm(false);
  }

  function approve(id) {
    setPermits(p => p.map(x => x.id===id ? { ...x, status:'active', approver: currentUser?.name||'Supervisor', issued: new Date().toLocaleString() } : x));
  }

  function close(id) { setPermits(p => p.map(x => x.id===id ? {...x, status:'completed'} : x)); }

  const active = permits.filter(p=>p.status==='active').length;
  const pending = permits.filter(p=>p.status==='pending').length;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileCheck className="w-5 h-5 text-mine-blue" />
          <h1 className="font-bold text-lg">Permit to Work</h1>
          {pending>0 && <span className="badge-warn">{pending} pending</span>}
          {active>0 && <span className="badge-safe">{active} active</span>}
        </div>
        <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Request Permit</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {Object.entries(STATUS_META).map(([k,m])=>(
          <div key={k} className={`card border ${m.border} text-center py-2`}>
            <div className="metric-label mb-0.5 text-xs">{m.label}</div>
            <div className={`text-xl font-black ${m.color}`}>{permits.filter(p=>p.status===k).length}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card border border-blue-700/30 bg-blue-900/5 space-y-3">
          <div className="section-title"><FileCheck className="w-3.5 h-3.5 text-blue-400"/>New Permit Request — {nextNo}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="metric-label mb-1.5 block">Work Type</label><select className="input-dark" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{PERMIT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><label className="metric-label mb-1.5 block">Section/Location</label><input className="input-dark" value={form.section} onChange={e=>setForm(f=>({...f,section:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Requested By</label><input className="input-dark" value={form.requester} onChange={e=>setForm(f=>({...f,requester:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Work Expiry</label><input type="datetime-local" className="input-dark" value={form.expires} onChange={e=>setForm(f=>({...f,expires:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Identified Hazards</label><input className="input-dark" value={form.hazards} onChange={e=>setForm(f=>({...f,hazards:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Safety Precautions</label><input className="input-dark" value={form.precautions} onChange={e=>setForm(f=>({...f,precautions:e.target.value}))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Submit Request</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {permits.map(p=>{
          const sm = STATUS_META[p.status]||STATUS_META.pending;
          return (
            <div key={p.id} className={`card border ${sm.border} ${sm.bg}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-ink-500">{p.permitNo}</span>
                    <span className={`text-xs font-black ${sm.color}`}>{sm.label}</span>
                    <span className="font-bold text-sm text-mine-text">{p.type}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 mt-2 text-xs text-ink-500">
                    <span>📍 {p.section}</span>
                    <span><User className="w-3 h-3 inline mr-1"/>{p.requester}</span>
                    {p.issued && <span><Clock className="w-3 h-3 inline mr-1"/>Issued: {p.issued}</span>}
                    {p.approver && <span>Approved by: {p.approver}</span>}
                  </div>
                  {p.hazards && <div className="text-xs mt-1"><span className="text-red-400 font-semibold">Hazards:</span> {p.hazards}</div>}
                  {p.precautions && <div className="text-xs mt-0.5"><span className="text-green-400 font-semibold">Precautions:</span> {p.precautions}</div>}
                </div>
                {isAdmin && p.status==='pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={()=>approve(p.id)} className="btn-ghost text-xs text-green-400">Approve</button>
                    <button onClick={()=>setPermits(ps=>ps.map(x=>x.id===p.id?{...x,status:'cancelled'}:x))} className="btn-ghost text-xs text-red-400">Reject</button>
                  </div>
                )}
                {isAdmin && p.status==='active' && (
                  <button onClick={()=>close(p.id)} className="btn-ghost text-xs text-blue-400 flex-shrink-0">Close Permit</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
