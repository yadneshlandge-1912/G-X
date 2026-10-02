import React, { useState } from 'react';
import { AlertTriangle, MapPin, Plus, X, CheckCircle, Eye } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const HAZARD_TYPES = [
  { id:'gas',       label:'Gas Pocket',          color:'#ef4444', icon:'💨' },
  { id:'water',     label:'Water Inrush Risk',    color:'#3b82f6', icon:'💧' },
  { id:'roof',      label:'Unstable Roof',        color:'#f97316', icon:'⚠️' },
  { id:'electrical',label:'Electrical Hazard',    color:'#f59e0b', icon:'⚡' },
  { id:'slip',      label:'Slip/Trip Hazard',     color:'#8b5cf6', icon:'🚧' },
  { id:'fire',      label:'Fire Risk Zone',       color:'#ef4444', icon:'🔥' },
];

const SEED_HAZARDS = [
  { id:'h1', type:'gas', section:'SEC-A Deep Face (Node 4)', location:'100m east of Node 4', severity:'HIGH', reported:'2026-09-15', reportedBy:'Vikas Sharma', status:'active', description:'Methane seepage detected at junction. Gas levels 400-600 PPM intermittently.' },
  { id:'h2', type:'roof', section:'East Branch (Node 3)', location:'75m from Node 3', severity:'MEDIUM', reported:'2026-09-10', reportedBy:'Priya Nair', status:'active', description:'Roof fracture observed. Support pillars installed but area needs monitoring.' },
  { id:'h3', type:'water', section:'Main Tunnel (Node 2)', location:'Near pump station', severity:'LOW', reported:'2026-09-01', reportedBy:'Admin', status:'monitoring', description:'Minor seepage through tunnel wall. Pump capacity adequate.' },
  { id:'h4', type:'electrical', section:'Gateway Area', location:'Panel board junction', severity:'MEDIUM', reported:'2026-08-20', reportedBy:'Maintenance', status:'resolved', description:'Exposed wiring near gateway panel. Fixed and taped.' },
];

const SEVERITY_COLOR = { HIGH:'text-red-400', MEDIUM:'text-amber-400', LOW:'text-green-400' };
const STATUS_COLOR   = { active:'badge-danger', monitoring:'badge-warn', resolved:'badge-safe' };

export default function HazardMapPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [hazards, setHazards] = useState(SEED_HAZARDS);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ type:'gas', section:'', location:'', severity:'MEDIUM', description:'' });

  function add() {
    if (!form.section) return;
    setHazards(h => [...h, { id:'h'+Date.now(), ...form, reported: new Date().toISOString().slice(0,10), reportedBy: currentUser?.name||'Unknown', status:'active' }]);
    setForm({ type:'gas', section:'', location:'', severity:'MEDIUM', description:'' });
    setShowForm(false);
  }

  function resolve(id) { setHazards(h => h.map(x => x.id===id ? {...x,status:'resolved'} : x)); }

  const filtered = filter==='all' ? hazards : hazards.filter(h => h.status===filter);
  const active = hazards.filter(h=>h.status==='active').length;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h1 className="font-bold text-lg">Hazard Zone Registry</h1>
          {active>0 && <span className="badge-danger">{active} active</span>}
        </div>
        {isAdmin && <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Report Hazard</button>}
      </div>

      {/* Hazard type legend */}
      <div className="card">
        <div className="section-title mb-2">Hazard Types</div>
        <div className="flex flex-wrap gap-2">
          {HAZARD_TYPES.map(t=>(
            <div key={t.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold"
              style={{background:`${t.color}15`, border:`1px solid ${t.color}30`, color:t.color}}>
              {t.icon} {t.label}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center border border-red-700/30"><div className="metric-label mb-1">Active</div><div className="text-2xl font-black text-red-400">{hazards.filter(h=>h.status==='active').length}</div></div>
        <div className="card text-center border border-amber-700/30"><div className="metric-label mb-1">Monitoring</div><div className="text-2xl font-black text-amber-400">{hazards.filter(h=>h.status==='monitoring').length}</div></div>
        <div className="card text-center border border-green-700/30"><div className="metric-label mb-1">Resolved</div><div className="text-2xl font-black text-green-400">{hazards.filter(h=>h.status==='resolved').length}</div></div>
      </div>

      {showForm && (
        <div className="card border border-red-700/30 bg-red-900/5 space-y-3">
          <div className="section-title"><AlertTriangle className="w-3.5 h-3.5 text-red-400"/>Report New Hazard</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="metric-label mb-1.5 block">Hazard Type</label>
              <select className="input-dark" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {HAZARD_TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div><label className="metric-label mb-1.5 block">Severity</label>
              <select className="input-dark" value={form.severity} onChange={e=>setForm(f=>({...f,severity:e.target.value}))}>
                <option>HIGH</option><option>MEDIUM</option><option>LOW</option>
              </select>
            </div>
            <div><label className="metric-label mb-1.5 block">Section</label><input className="input-dark" value={form.section} onChange={e=>setForm(f=>({...f,section:e.target.value}))} placeholder="Mine section" /></div>
            <div><label className="metric-label mb-1.5 block">Exact Location</label><input className="input-dark" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="Describe location" /></div>
            <div className="sm:col-span-2"><label className="metric-label mb-1.5 block">Description</label><textarea className="input-dark w-full" rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn-danger flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>Report</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {['all','active','monitoring','resolved'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter===f?'bg-mine-accent text-mine-bg':'btn-ghost'}`}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(h=>{
          const ht = HAZARD_TYPES.find(t=>t.id===h.type)||HAZARD_TYPES[0];
          return (
            <div key={h.id} className="card border border-mine-border/40">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 flex-1">
                  <div className="text-2xl flex-shrink-0">{ht.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-black ${SEVERITY_COLOR[h.severity]}`}>{h.severity}</span>
                      <span className="font-bold text-sm text-mine-text">{ht.label}</span>
                      <span className={`${STATUS_COLOR[h.status]} text-xs`}>{h.status.toUpperCase()}</span>
                    </div>
                    <div className="text-xs text-mine-dim mt-1 flex items-center gap-1"><MapPin className="w-3 h-3"/>{h.section} · {h.location}</div>
                    <div className="text-xs text-mine-dim mt-1">{h.description}</div>
                    <div className="text-xs text-ink-600 mt-1">Reported by {h.reportedBy} on {h.reported}</div>
                  </div>
                </div>
                {isAdmin && h.status!=='resolved' && (
                  <button onClick={()=>resolve(h.id)} className="btn-ghost text-xs text-green-400 flex-shrink-0"><CheckCircle className="w-3.5 h-3.5 mr-1"/>Resolve</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
