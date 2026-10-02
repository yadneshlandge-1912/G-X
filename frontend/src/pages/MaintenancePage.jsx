import React, { useState } from 'react';
import { Wrench, Plus, Calendar, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const STATUS_META = {
  scheduled: { label:'Scheduled', color:'text-blue-400',   bg:'bg-blue-900/15',   border:'border-blue-700/30' },
  overdue:   { label:'Overdue',   color:'text-red-400',    bg:'bg-red-900/15',    border:'border-red-700/30' },
  completed: { label:'Completed', color:'text-green-400',  bg:'bg-green-900/15',  border:'border-green-700/30' },
  inprogress:{ label:'In Progress',color:'text-amber-400', bg:'bg-amber-900/15',  border:'border-amber-700/30' },
};

const SEED = [
  { id:'m1', equipment:'Gateway ESP32 (Heltec v2)', task:'Firmware update & antenna check', due:'2026-10-01', assigned:'Admin', status:'scheduled', priority:'HIGH' },
  { id:'m2', equipment:'Ventilation Fan #1', task:'Belt replacement & bearing lubrication', due:'2026-09-25', assigned:'Maintenance Team', status:'overdue', priority:'CRITICAL' },
  { id:'m3', equipment:'MQ-2 Gas Sensors (All Nodes)', task:'Calibration in fresh air', due:'2026-09-28', assigned:'Vikas Sharma', status:'scheduled', priority:'HIGH' },
  { id:'m4', equipment:'Water Pump #2', task:'Impeller inspection', due:'2026-09-20', assigned:'Maintenance Team', status:'completed', priority:'MEDIUM' },
  { id:'m5', equipment:'Emergency Backup Battery', task:'Load test & charge cycle', due:'2026-10-05', assigned:'Admin', status:'scheduled', priority:'MEDIUM' },
  { id:'m6', equipment:'Node 3 DHT22 Sensor', task:'Replace humidity sensor', due:'2026-09-22', assigned:'Amit Verma', status:'inprogress', priority:'HIGH' },
];

const PRIORITY_COLOR = { CRITICAL:'text-red-400', HIGH:'text-orange-400', MEDIUM:'text-amber-400', LOW:'text-green-400' };

export default function MaintenancePage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [items, setItems] = useState(SEED);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ equipment:'', task:'', due:'', assigned:'', status:'scheduled', priority:'MEDIUM' });

  function add() {
    if (!form.equipment || !form.task) return;
    setItems(i => [...i, { id:'m'+Date.now(), ...form }]);
    setForm({ equipment:'', task:'', due:'', assigned:'', status:'scheduled', priority:'MEDIUM' });
    setShowForm(false);
  }

  function updateStatus(id, status) { setItems(i => i.map(x => x.id===id ? {...x,status} : x)); }

  const filtered = filter==='all' ? items : items.filter(i => i.status===filter);
  const counts = Object.keys(STATUS_META).reduce((a,k) => ({...a,[k]: items.filter(i=>i.status===k).length}),{});

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Wrench className="w-5 h-5 text-mine-accent" />
          <h1 className="font-bold text-lg">Maintenance Scheduler</h1>
          {counts.overdue > 0 && <span className="badge-danger">{counts.overdue} overdue</span>}
        </div>
        {isAdmin && <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Add Task</button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_META).map(([k,m]) => (
          <div key={k} className={`card border ${m.border} text-center cursor-pointer`} onClick={()=>setFilter(k)}>
            <div className="metric-label mb-1">{m.label}</div>
            <div className={`text-2xl font-black ${m.color}`}>{counts[k]||0}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card border border-mine-border/60 space-y-3">
          <div className="section-title"><Plus className="w-3.5 h-3.5"/>New Maintenance Task</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="metric-label mb-1.5 block">Equipment</label><input className="input-dark" value={form.equipment} onChange={e=>setForm(f=>({...f,equipment:e.target.value}))} placeholder="Equipment name" /></div>
            <div><label className="metric-label mb-1.5 block">Task</label><input className="input-dark" value={form.task} onChange={e=>setForm(f=>({...f,task:e.target.value}))} placeholder="Task description" /></div>
            <div><label className="metric-label mb-1.5 block">Due Date</label><input type="date" className="input-dark" value={form.due} onChange={e=>setForm(f=>({...f,due:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Assigned To</label><input className="input-dark" value={form.assigned} onChange={e=>setForm(f=>({...f,assigned:e.target.value}))} placeholder="Person/team" /></div>
            <div><label className="metric-label mb-1.5 block">Priority</label>
              <select className="input-dark" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                {['CRITICAL','HIGH','MEDIUM','LOW'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Add Task</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter==='all'?'bg-mine-accent text-mine-bg':'btn-ghost'}`}>All</button>
        {Object.entries(STATUS_META).map(([k,m]) => (
          <button key={k} onClick={()=>setFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter===k?'bg-mine-accent text-mine-bg':'btn-ghost'}`}>{m.label}</button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(item => {
          const sm = STATUS_META[item.status] || STATUS_META.scheduled;
          return (
            <div key={item.id} className={`card border ${sm.border} flex items-start gap-3 flex-wrap`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-black ${PRIORITY_COLOR[item.priority]}`}>{item.priority}</span>
                  <span className="font-semibold text-sm text-mine-text">{item.equipment}</span>
                  <span className={`badge text-xs ${sm.bg} ${sm.color} border ${sm.border}`}>{sm.label}</span>
                </div>
                <div className="text-xs text-mine-dim mt-1">{item.task}</div>
                <div className="flex items-center gap-3 mt-2 text-xs text-ink-500">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>Due: {item.due}</span>
                  <span className="flex items-center gap-1"><Wrench className="w-3 h-3"/>{item.assigned}</span>
                </div>
              </div>
              {isAdmin && item.status !== 'completed' && (
                <div className="flex gap-2 flex-shrink-0">
                  {item.status !== 'inprogress' && <button onClick={()=>updateStatus(item.id,'inprogress')} className="btn-ghost text-xs">Start</button>}
                  <button onClick={()=>updateStatus(item.id,'completed')} className="btn-ghost text-xs text-green-400">Complete</button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length===0 && <div className="card text-center py-10 text-mine-muted">No tasks found.</div>}
      </div>
    </div>
  );
}
