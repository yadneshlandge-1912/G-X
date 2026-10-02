import React, { useState } from 'react';
import { Zap, Plus, X, CheckCircle, AlertTriangle, Clock, Shield } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const STATUS_META = {
  planned:  { label:'Planned',   color:'text-blue-400',   bg:'bg-blue-900/15',  border:'border-blue-700/30' },
  cleared:  { label:'Cleared',   color:'text-green-400',  bg:'bg-green-900/15', border:'border-green-700/30' },
  complete: { label:'Completed', color:'text-mine-muted', bg:'bg-mine-deeper',  border:'border-mine-border/30' },
  cancelled:{ label:'Cancelled', color:'text-red-400',    bg:'bg-red-900/10',   border:'border-red-700/20' },
};

const SEED = [
  { id:'b1', date:'2026-09-26', time:'10:00', section:'SEC-A Deep Face', shots:12, charge:'ANFO 200kg', clearRadius:200, responsible:'Amit Verma', approvedBy:'Vikas Sharma', status:'complete', preGas:180, postGas:220, notes:'Normal blast, no misfires' },
  { id:'b2', date:'2026-09-27', time:'09:00', section:'SEC-A East Branch', shots:8, charge:'ANFO 140kg', clearRadius:150, responsible:'Suresh Pal', approvedBy:'Vikas Sharma', status:'planned', preGas:null, postGas:null, notes:'' },
  { id:'b3', date:'2026-09-25', time:'14:00', section:'Main Tunnel Ext.', shots:15, charge:'ANFO 250kg', clearRadius:250, responsible:'Rajan Kumar', approvedBy:'Priya Nair', status:'complete', preGas:160, postGas:280, notes:'Gas spike after blast — ventilated for 45 min' },
];

export default function BlastingPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [blasts, setBlasts] = useState(SEED);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date:'', time:'', section:'', shots:'', charge:'', clearRadius:'150', responsible:'', approvedBy:'', status:'planned', notes:'' });

  function add() {
    if (!form.date || !form.section) return;
    setBlasts(b => [...b, { id:'b'+Date.now(), ...form, shots:parseInt(form.shots)||0, clearRadius:parseInt(form.clearRadius)||150, preGas:null, postGas:null }]);
    setForm({ date:'', time:'', section:'', shots:'', charge:'', clearRadius:'150', responsible:'', approvedBy:'', status:'planned', notes:'' });
    setShowForm(false);
  }

  function updateStatus(id, status) { setBlasts(b => b.map(x => x.id===id ? {...x,status} : x)); }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-orange-400" />
          <h1 className="font-bold text-lg">Blasting Schedule & Safety</h1>
          {blasts.filter(b=>b.status==='planned').length>0 && <span className="badge-warn">{blasts.filter(b=>b.status==='planned').length} planned</span>}
        </div>
        {isAdmin && <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Schedule Blast</button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_META).map(([k,m])=>(
          <div key={k} className={`card border ${m.border} text-center`}>
            <div className="metric-label mb-1">{m.label}</div>
            <div className={`text-2xl font-black ${m.color}`}>{blasts.filter(b=>b.status===k).length}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card border border-orange-700/30 bg-orange-900/5 space-y-3">
          <div className="section-title"><AlertTriangle className="w-3.5 h-3.5 text-orange-400"/>Schedule New Blast</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="metric-label mb-1.5 block">Date</label><input type="date" className="input-dark" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Time</label><input type="time" className="input-dark" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Section</label><input className="input-dark" value={form.section} onChange={e=>setForm(f=>({...f,section:e.target.value}))} placeholder="Mine section" /></div>
            <div><label className="metric-label mb-1.5 block">Number of Shots</label><input type="number" className="input-dark" value={form.shots} onChange={e=>setForm(f=>({...f,shots:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Explosive Charge</label><input className="input-dark" value={form.charge} onChange={e=>setForm(f=>({...f,charge:e.target.value}))} placeholder="e.g. ANFO 200kg" /></div>
            <div><label className="metric-label mb-1.5 block">Clear Radius (m)</label><input type="number" className="input-dark" value={form.clearRadius} onChange={e=>setForm(f=>({...f,clearRadius:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Responsible Person</label><input className="input-dark" value={form.responsible} onChange={e=>setForm(f=>({...f,responsible:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Approved By</label><input className="input-dark" value={form.approvedBy} onChange={e=>setForm(f=>({...f,approvedBy:e.target.value}))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Schedule</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {blasts.map(b=>{
          const sm = STATUS_META[b.status]||STATUS_META.planned;
          return (
            <div key={b.id} className={`card border ${sm.border} ${sm.bg}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-black ${sm.color}`}>{sm.label}</span>
                    <span className="font-bold text-sm text-mine-text">{b.section}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-xs text-ink-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{b.date} {b.time}</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3"/>{b.shots} shots · {b.charge}</span>
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3"/>Clear {b.clearRadius}m</span>
                    <span>By: {b.responsible}</span>
                  </div>
                  {b.notes && <div className="text-xs text-ink-500 mt-1">{b.notes}</div>}
                  {(b.preGas||b.postGas) && (
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-ink-400">Pre-blast gas: <span className="font-bold text-mine-text">{b.preGas} PPM</span></span>
                      <span className="text-ink-400">Post-blast gas: <span className="font-bold text-mine-text">{b.postGas} PPM</span></span>
                    </div>
                  )}
                </div>
                {isAdmin && b.status==='planned' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={()=>updateStatus(b.id,'cleared')} className="btn-ghost text-xs text-green-400">Clear</button>
                    <button onClick={()=>updateStatus(b.id,'cancelled')} className="btn-ghost text-xs text-red-400">Cancel</button>
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
