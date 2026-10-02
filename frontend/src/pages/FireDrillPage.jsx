import React, { useState } from 'react';
import { Flame, Plus, CheckCircle, Clock, Calendar, Users, X, AlertTriangle } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const SEED = [
  { id:'d1', date:'2026-09-15', type:'Full Evacuation Drill', duration:8, participants:12, allAccountedFor:true, issues:'Node 3 SOS test failed — button stuck', conductor:'Vikas Sharma', result:'PASS' },
  { id:'d2', date:'2026-08-20', type:'Gas Leak Simulation', duration:5, participants:10, allAccountedFor:true, issues:'None', conductor:'Arjun Meena', result:'PASS' },
  { id:'d3', date:'2026-07-10', type:'Fire Emergency Drill', duration:12, participants:11, allAccountedFor:false, issues:'Node 5 miner (Mohan Das) did not reach muster point in time', conductor:'Vikas Sharma', result:'FAIL' },
];

export default function FireDrillPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [drills, setDrills] = useState(SEED);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date:'', type:'Full Evacuation Drill', duration:'', participants:'', allAccountedFor:true, issues:'', conductor: currentUser?.name||'', result:'PASS' });

  function add() {
    if (!form.date || !form.type) return;
    setDrills(d => [{ id:'d'+Date.now(), ...form, duration: parseInt(form.duration)||0, participants: parseInt(form.participants)||0 }, ...d]);
    setForm({ date:'', type:'Full Evacuation Drill', duration:'', participants:'', allAccountedFor:true, issues:'', conductor: currentUser?.name||'', result:'PASS' });
    setShowForm(false);
  }

  const nextDue = new Date(); nextDue.setDate(nextDue.getDate() + 30);

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Flame className="w-5 h-5 text-orange-400" />
          <h1 className="font-bold text-lg">Fire Drill Records</h1>
          <span className="badge-info">{drills.length} drills conducted</span>
        </div>
        {isAdmin && <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Log Drill</button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card text-center"><div className="metric-label mb-1">Total Drills</div><div className="text-2xl font-black text-mine-accent">{drills.length}</div></div>
        <div className="card text-center"><div className="metric-label mb-1">Passed</div><div className="text-2xl font-black text-green-400">{drills.filter(d=>d.result==='PASS').length}</div></div>
        <div className="card text-center"><div className="metric-label mb-1">Failed</div><div className="text-2xl font-black text-red-400">{drills.filter(d=>d.result==='FAIL').length}</div></div>
        <div className="card text-center border border-amber-700/30"><div className="metric-label mb-1">Next Drill Due</div><div className="text-sm font-bold text-amber-400">{nextDue.toLocaleDateString('en-IN')}</div></div>
      </div>

      {showForm && (
        <div className="card border border-mine-border/60 space-y-3">
          <div className="section-title"><Flame className="w-3.5 h-3.5 text-orange-400"/>Log Fire Drill</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="metric-label mb-1.5 block">Date</label><input type="date" className="input-dark" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Drill Type</label>
              <select className="input-dark" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {['Full Evacuation Drill','Gas Leak Simulation','Fire Emergency Drill','SOS Button Test','Medical Emergency Drill'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="metric-label mb-1.5 block">Duration (min)</label><input type="number" className="input-dark" value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Participants</label><input type="number" className="input-dark" value={form.participants} onChange={e=>setForm(f=>({...f,participants:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Conducted By</label><input className="input-dark" value={form.conductor} onChange={e=>setForm(f=>({...f,conductor:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Result</label>
              <select className="input-dark" value={form.result} onChange={e=>setForm(f=>({...f,result:e.target.value}))}>
                <option>PASS</option><option>FAIL</option>
              </select>
            </div>
            <div className="sm:col-span-2"><label className="metric-label mb-1.5 block">Issues Observed</label><input className="input-dark" value={form.issues} onChange={e=>setForm(f=>({...f,issues:e.target.value}))} placeholder="Any issues found..." /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Save Record</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {drills.map(d => (
          <div key={d.id} className={`card border ${d.result==='FAIL'?'border-red-700/30 bg-red-900/5':'border-green-700/20'}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-black px-2 py-0.5 rounded ${d.result==='PASS'?'bg-green-900/30 text-green-400':'bg-red-900/30 text-red-400'}`}>{d.result}</span>
                  <span className="font-semibold text-sm text-mine-text">{d.type}</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-ink-500 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{d.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{d.duration} min</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3"/>{d.participants} participants</span>
                  <span>Conducted by: {d.conductor}</span>
                </div>
                {d.issues && d.issues!=='None' && (
                  <div className="flex items-start gap-2 mt-2 text-xs text-orange-300">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5"/>
                    <span>{d.issues}</span>
                  </div>
                )}
              </div>
              {!d.allAccountedFor && <span className="badge-danger flex-shrink-0">Not all accounted</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
