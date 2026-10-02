import React, { useState } from 'react';
import { Drill, Plus, X, CheckCircle, Activity, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import useAuthStore from '../store/useAuthStore';

const TREND_DATA = [
  { time:'06:00', depth:0, rpm:0, pressure:0 },
  { time:'07:00', depth:2.4, rpm:120, pressure:45 },
  { time:'08:00', depth:5.1, rpm:115, pressure:48 },
  { time:'09:00', depth:8.2, rpm:118, pressure:52 },
  { time:'10:00', depth:11.5, rpm:110, pressure:55 },
  { time:'11:00', depth:14.1, rpm:108, pressure:50 },
  { time:'12:00', depth:16.8, rpm:112, pressure:47 },
];

const SEED_HOLES = [
  { id:'dh1', holeId:'BH-001', section:'SEC-A Deep Face', targetDepth:20, currentDepth:16.8, diameter:65, status:'drilling', startTime:'06:30', operator:'Rajan Kumar', rpm:112, pressure:47 },
  { id:'dh2', holeId:'BH-002', section:'SEC-A East', targetDepth:18, currentDepth:18, diameter:65, status:'complete', startTime:'05:00', operator:'Deepak Singh', rpm:0, pressure:0 },
  { id:'dh3', holeId:'BH-003', section:'Main Extension', targetDepth:22, currentDepth:0, diameter:65, status:'planned', startTime:'14:00', operator:'Suresh Pal', rpm:0, pressure:0 },
];

const STATUS_META = {
  planned:  { label:'Planned',   color:'text-blue-400',   bg:'bg-blue-900/10',  border:'border-blue-700/30' },
  drilling: { label:'Drilling',  color:'text-amber-400',  bg:'bg-amber-900/10', border:'border-amber-700/30' },
  complete: { label:'Complete',  color:'text-green-400',  bg:'bg-green-900/10', border:'border-green-700/30' },
  abandoned:{ label:'Abandoned', color:'text-red-400',    bg:'bg-red-900/10',   border:'border-red-700/30' },
};

export default function DrillPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [holes, setHoles] = useState(SEED_HOLES);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ holeId:'', section:'', targetDepth:'', diameter:'65', operator:'', startTime:'', status:'planned' });

  function add() {
    if (!form.holeId) return;
    setHoles(h => [...h, { id:'dh'+Date.now(), ...form, targetDepth:parseFloat(form.targetDepth)||0, diameter:parseInt(form.diameter)||65, currentDepth:0, rpm:0, pressure:0 }]);
    setForm({ holeId:'', section:'', targetDepth:'', diameter:'65', operator:'', startTime:'', status:'planned' });
    setShowForm(false);
  }

  const activeDrill = holes.find(h=>h.status==='drilling');

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Drill className="w-5 h-5 text-mine-accent" />
          <h1 className="font-bold text-lg">Blast Hole Drilling Monitor</h1>
          {activeDrill && <span className="badge-warn animate-pulse">Drilling Active</span>}
        </div>
        {isAdmin && <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Add Hole</button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_META).map(([k,m])=>(
          <div key={k} className={`card border ${m.border} text-center`}>
            <div className="metric-label mb-1">{m.label}</div>
            <div className={`text-2xl font-black ${m.color}`}>{holes.filter(h=>h.status===k).length}</div>
          </div>
        ))}
      </div>

      {activeDrill && (
        <div className="card border border-amber-700/30 bg-amber-900/5">
          <div className="section-title mb-3"><Activity className="w-3.5 h-3.5 text-amber-400"/>Live Drilling — {activeDrill.holeId}</div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-mine-deeper rounded-lg p-3 text-center">
              <div className="metric-label mb-1">Depth</div>
              <div className="text-xl font-black text-mine-accent">{activeDrill.currentDepth}<span className="text-xs text-ink-500 ml-1">m</span></div>
              <div className="text-xs text-ink-500">of {activeDrill.targetDepth}m</div>
              <div className="mt-2 h-1.5 rounded-full bg-mine-deeper overflow-hidden border border-mine-border/30">
                <div className="h-full rounded-full bg-amber-400 transition-all" style={{width:`${(activeDrill.currentDepth/activeDrill.targetDepth)*100}%`}} />
              </div>
            </div>
            <div className="bg-mine-deeper rounded-lg p-3 text-center">
              <div className="metric-label mb-1">RPM</div>
              <div className="text-xl font-black text-mine-text">{activeDrill.rpm}</div>
            </div>
            <div className="bg-mine-deeper rounded-lg p-3 text-center">
              <div className="metric-label mb-1">Pressure (bar)</div>
              <div className="text-xl font-black text-mine-cyan">{activeDrill.pressure}</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={TREND_DATA} margin={{top:5,right:10,left:-20,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" tick={{fill:'#475569',fontSize:10}} />
              <YAxis tick={{fill:'#475569',fontSize:10}} />
              <Tooltip contentStyle={{background:'#0e1628',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8}} />
              <Line type="monotone" dataKey="depth" stroke="#f59e0b" strokeWidth={2} dot={false} name="Depth (m)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {showForm && (
        <div className="card border border-mine-border/60 space-y-3">
          <div className="section-title"><Plus className="w-3.5 h-3.5"/>Add Drill Hole</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="metric-label mb-1.5 block">Hole ID</label><input className="input-dark" value={form.holeId} onChange={e=>setForm(f=>({...f,holeId:e.target.value}))} placeholder="e.g. BH-004" /></div>
            <div><label className="metric-label mb-1.5 block">Section</label><input className="input-dark" value={form.section} onChange={e=>setForm(f=>({...f,section:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Target Depth (m)</label><input type="number" className="input-dark" value={form.targetDepth} onChange={e=>setForm(f=>({...f,targetDepth:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Diameter (mm)</label><input type="number" className="input-dark" value={form.diameter} onChange={e=>setForm(f=>({...f,diameter:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Operator</label><input className="input-dark" value={form.operator} onChange={e=>setForm(f=>({...f,operator:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Start Time</label><input type="time" className="input-dark" value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Add</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {holes.map(h=>{
          const sm = STATUS_META[h.status]||STATUS_META.planned;
          const pct = h.targetDepth>0 ? Math.round((h.currentDepth/h.targetDepth)*100) : 0;
          return (
            <div key={h.id} className={`card border ${sm.border} ${sm.bg}`}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-black ${sm.color}`}>{sm.label}</span>
                    <span className="font-mono font-bold text-sm text-mine-text">{h.holeId}</span>
                    <span className="text-xs text-ink-500">{h.section}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-ink-500">
                    <span>Depth: <span className="text-mine-accent font-bold">{h.currentDepth}m</span> / {h.targetDepth}m</span>
                    <span>Ø{h.diameter}mm</span>
                    <span>Operator: {h.operator}</span>
                  </div>
                  {h.status!=='planned' && (
                    <div className="mt-2 h-1.5 rounded-full bg-mine-deeper overflow-hidden border border-mine-border/20">
                      <div className="h-full rounded-full transition-all" style={{width:`${pct}%`, background: pct>=100?'#10b981':'#f59e0b'}} />
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-black text-mine-text">{pct}%</div>
                  <div className="text-xs text-ink-500">complete</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
