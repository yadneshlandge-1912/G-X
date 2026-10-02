import React, { useState } from 'react';
import { Fuel, Plus, X, CheckCircle, TrendingDown, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import useAuthStore from '../store/useAuthStore';

const WEEKLY = [
  { day:'Mon', diesel:180, petrol:20 },
  { day:'Tue', diesel:210, petrol:15 },
  { day:'Wed', diesel:195, petrol:18 },
  { day:'Thu', diesel:220, petrol:22 },
  { day:'Fri', diesel:175, petrol:12 },
  { day:'Sat', diesel:160, petrol:10 },
  { day:'Sun', diesel:90,  petrol:5  },
];

const SEED_LOG = [
  { id:'f1', date:'2026-09-26', equipment:'Ventilation Fan Generator', type:'Diesel', litres:85, cost:8500, operator:'Vikas Sharma', odometer:'-' },
  { id:'f2', date:'2026-09-26', equipment:'Water Pump #1', type:'Diesel', litres:40, cost:4000, operator:'Maintenance', odometer:'-' },
  { id:'f3', date:'2026-09-25', equipment:'Emergency Generator', type:'Diesel', litres:60, cost:6000, operator:'Admin', odometer:'-' },
];

const TANK_CAPACITY = 2000;
const CURRENT_LEVEL = 820;

export default function FuelPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [log, setLog] = useState(SEED_LOG);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date:'', equipment:'', type:'Diesel', litres:'', cost:'', operator: currentUser?.name||'' });

  function add() {
    if (!form.equipment || !form.litres) return;
    setLog(l => [{ id:'f'+Date.now(), ...form, litres:parseInt(form.litres)||0, cost:parseInt(form.cost)||0, odometer:'-' }, ...l]);
    setForm({ date:'', equipment:'', type:'Diesel', litres:'', cost:'', operator: currentUser?.name||'' });
    setShowForm(false);
  }

  const pct = Math.round(CURRENT_LEVEL/TANK_CAPACITY*100);
  const levelColor = pct>50?'#10b981':pct>20?'#f59e0b':'#ef4444';

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Fuel className="w-5 h-5 text-amber-400" />
          <h1 className="font-bold text-lg">Fuel Consumption Tracker</h1>
          {pct<25 && <span className="badge-danger">Tank Low!</span>}
        </div>
        {isAdmin && <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Log Fuel</button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card text-center">
          <div className="metric-label mb-1">Tank Level</div>
          <div className="text-2xl font-black" style={{color:levelColor}}>{pct}%</div>
          <div className="text-xs text-ink-500">{CURRENT_LEVEL}L / {TANK_CAPACITY}L</div>
          <div className="mt-2 h-2 rounded-full bg-mine-deeper overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{width:`${pct}%`, background:levelColor}}/>
          </div>
        </div>
        <div className="card text-center"><div className="metric-label mb-1">Today's Usage</div><div className="text-2xl font-black text-mine-accent">{log.filter(l=>l.date===new Date().toISOString().slice(0,10)).reduce((s,l)=>s+l.litres,0)||185}<span className="text-xs text-ink-500 ml-1">L</span></div></div>
        <div className="card text-center"><div className="metric-label mb-1">This Week</div><div className="text-2xl font-black text-mine-text">{WEEKLY.reduce((s,d)=>s+d.diesel+d.petrol,0)}<span className="text-xs text-ink-500 ml-1">L</span></div></div>
        <div className="card text-center"><div className="metric-label mb-1">Est. Days Left</div><div className="text-2xl font-black text-mine-cyan">{Math.round(CURRENT_LEVEL/185)}<span className="text-xs text-ink-500 ml-1">days</span></div></div>
      </div>

      <div className="card">
        <div className="section-title mb-3">Weekly Fuel Consumption (Litres)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={WEEKLY} margin={{top:5,right:10,left:-20,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="day" tick={{fill:'#475569',fontSize:11}} />
            <YAxis tick={{fill:'#475569',fontSize:11}} />
            <Tooltip contentStyle={{background:'#0e1628',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8}} />
            <Bar dataKey="diesel" fill="#f59e0b" name="Diesel" radius={[3,3,0,0]} />
            <Bar dataKey="petrol" fill="#06b6d4" name="Petrol" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {showForm && (
        <div className="card border border-mine-border/60 space-y-3">
          <div className="section-title"><Plus className="w-3.5 h-3.5"/>Log Fuel Issue</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="metric-label mb-1.5 block">Date</label><input type="date" className="input-dark" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Equipment</label><input className="input-dark" value={form.equipment} onChange={e=>setForm(f=>({...f,equipment:e.target.value}))} placeholder="Equipment name" /></div>
            <div><label className="metric-label mb-1.5 block">Fuel Type</label><select className="input-dark" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option>Diesel</option><option>Petrol</option></select></div>
            <div><label className="metric-label mb-1.5 block">Litres</label><input type="number" className="input-dark" value={form.litres} onChange={e=>setForm(f=>({...f,litres:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Cost (₹)</label><input type="number" className="input-dark" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Issued By</label><input className="input-dark" value={form.operator} onChange={e=>setForm(f=>({...f,operator:e.target.value}))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Save</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="section-title mb-3">Fuel Issue Log</div>
        <table className="data-table w-full">
          <thead><tr><th>Date</th><th>Equipment</th><th>Type</th><th>Litres</th><th>Cost</th><th>Issued By</th></tr></thead>
          <tbody>{log.map(r=>(
            <tr key={r.id}>
              <td className="font-mono text-xs">{r.date}</td>
              <td>{r.equipment}</td>
              <td><span className="badge-info">{r.type}</span></td>
              <td className="font-bold text-mine-accent">{r.litres}L</td>
              <td className="font-mono">₹{r.cost.toLocaleString()}</td>
              <td>{r.operator}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
