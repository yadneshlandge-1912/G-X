import React, { useState } from 'react';
import { Trash2, Plus, X, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import useAuthStore from '../store/useAuthStore';

const WASTE_TYPES = ['Overburden','Tailings','Coal Dust','Chemical Waste','Metal Scrap','General Waste'];
const WEEKLY_DATA = [
  { day:'Mon', overburden:120, tailings:45, other:20 },
  { day:'Tue', overburden:135, tailings:50, other:18 },
  { day:'Wed', overburden:110, tailings:40, other:22 },
  { day:'Thu', overburden:150, tailings:55, other:25 },
  { day:'Fri', overburden:130, tailings:48, other:19 },
  { day:'Sat', overburden:90,  tailings:30, other:10 },
  { day:'Sun', overburden:40,  tailings:15, other:5  },
];

const SEED_LOG = [
  { id:'w1', date:'2026-09-26', type:'Overburden', quantity:130, unit:'tonnes', disposal:'Dump Site A', handler:'Deepak Singh', compliant:true },
  { id:'w2', date:'2026-09-26', type:'Chemical Waste', quantity:25, unit:'litres', disposal:'Licensed Contractor', handler:'Admin', compliant:true },
  { id:'w3', date:'2026-09-25', type:'Tailings', quantity:45, unit:'tonnes', disposal:'Tailings Pond B', handler:'Suresh Pal', compliant:true },
  { id:'w4', date:'2026-09-24', type:'Coal Dust', quantity:8, unit:'tonnes', disposal:'Reclaimed', handler:'Rajan Kumar', compliant:false, note:'Disposal method not per SOP-011' },
];

export default function WasteManagePage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [log, setLog] = useState(SEED_LOG);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date:'', type:'Overburden', quantity:'', unit:'tonnes', disposal:'', handler: currentUser?.name||'', compliant:true, note:'' });

  function add() {
    if (!form.date || !form.type) return;
    setLog(l => [{ id:'w'+Date.now(), ...form, quantity:parseFloat(form.quantity)||0 }, ...l]);
    setForm({ date:'', type:'Overburden', quantity:'', unit:'tonnes', disposal:'', handler: currentUser?.name||'', compliant:true, note:'' });
    setShowForm(false);
  }

  const totalToday = log.filter(l=>l.date===new Date().toISOString().slice(0,10)).reduce((s,l)=>s+l.quantity,0)||130;
  const nonCompliant = log.filter(l=>!l.compliant).length;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Trash2 className="w-5 h-5 text-green-400" />
          <h1 className="font-bold text-lg">Waste Management</h1>
          {nonCompliant>0 && <span className="badge-danger">{nonCompliant} non-compliant</span>}
        </div>
        {isAdmin && <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Log Waste</button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card text-center"><div className="metric-label mb-1">Today's Waste</div><div className="text-2xl font-black text-mine-accent">{totalToday}<span className="text-xs text-ink-500 ml-1">t</span></div></div>
        <div className="card text-center"><div className="metric-label mb-1">Compliance</div><div className="text-2xl font-black text-green-400">{Math.round((log.filter(l=>l.compliant).length/log.length)*100)}%</div></div>
        <div className="card text-center"><div className="metric-label mb-1">Non-Compliant</div><div className="text-2xl font-black text-red-400">{nonCompliant}</div></div>
      </div>

      <div className="card">
        <div className="section-title mb-3">Weekly Waste Generation (tonnes)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={WEEKLY_DATA} margin={{top:5,right:10,left:-20,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="day" tick={{fill:'#475569',fontSize:11}} />
            <YAxis tick={{fill:'#475569',fontSize:11}} />
            <Tooltip contentStyle={{background:'#0e1628',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8}} />
            <Bar dataKey="overburden" fill="#f59e0b" name="Overburden" radius={[2,2,0,0]} />
            <Bar dataKey="tailings" fill="#6366f1" name="Tailings" radius={[2,2,0,0]} />
            <Bar dataKey="other" fill="#10b981" name="Other" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {showForm && (
        <div className="card border border-mine-border/60 space-y-3">
          <div className="section-title"><Plus className="w-3.5 h-3.5"/>Log Waste Disposal</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="metric-label mb-1.5 block">Date</label><input type="date" className="input-dark" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Waste Type</label><select className="input-dark" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{WASTE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><label className="metric-label mb-1.5 block">Quantity</label><input type="number" className="input-dark" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Unit</label><select className="input-dark" value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}><option>tonnes</option><option>litres</option><option>kg</option><option>cubic m</option></select></div>
            <div><label className="metric-label mb-1.5 block">Disposal Method/Site</label><input className="input-dark" value={form.disposal} onChange={e=>setForm(f=>({...f,disposal:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Handler</label><input className="input-dark" value={form.handler} onChange={e=>setForm(f=>({...f,handler:e.target.value}))} /></div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.compliant} onChange={e=>setForm(f=>({...f,compliant:e.target.checked}))} className="w-4 h-4 accent-green-500" />
            <span className="text-sm text-mine-dim">Disposal complies with DGMS/CPCB regulations</span>
          </label>
          <div className="flex gap-2">
            <button onClick={add} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Save</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="section-title mb-3">Waste Disposal Log</div>
        <table className="data-table w-full">
          <thead><tr><th>Date</th><th>Type</th><th>Quantity</th><th>Disposal</th><th>Handler</th><th>Compliant</th></tr></thead>
          <tbody>{log.map(r=>(
            <tr key={r.id}>
              <td className="font-mono text-xs">{r.date}</td>
              <td>{r.type}</td>
              <td className="font-bold text-mine-accent">{r.quantity} {r.unit}</td>
              <td className="text-xs">{r.disposal}</td>
              <td>{r.handler}</td>
              <td>{r.compliant ? <span className="badge-safe">Yes</span> : <span className="badge-danger">No</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
