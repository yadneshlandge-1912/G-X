import React, { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Package, Calendar, Plus, X, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import useAuthStore from '../store/useAuthStore';

const DAILY = [
  { date:'Sep 20', target:450, actual:423, shift:'Morning' },
  { date:'Sep 21', target:450, actual:467, shift:'Morning' },
  { date:'Sep 22', target:450, actual:398, shift:'Evening' },
  { date:'Sep 23', target:450, actual:441, shift:'Morning' },
  { date:'Sep 24', target:450, actual:482, shift:'Evening' },
  { date:'Sep 25', target:450, actual:415, shift:'Night' },
  { date:'Sep 26', target:450, actual:459, shift:'Morning' },
];

const SHIFT_LOG = [
  { id:'p1', date:'2026-09-26', shift:'Morning', operator:'Rajan Kumar', section:'SEC-A', tonnes:180, trucks:6, notes:'Normal operations' },
  { id:'p2', date:'2026-09-26', shift:'Evening', operator:'Deepak Singh', section:'SEC-A', tonnes:155, trucks:5, notes:'Delay due to pump maintenance' },
  { id:'p3', date:'2026-09-26', shift:'Night',   operator:'Mohan Das', section:'SEC-A', tonnes:124, trucks:4, notes:'Reduced capacity — gas caution' },
];

export default function ProductionPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [log, setLog] = useState(SHIFT_LOG);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date:'', shift:'Morning', operator:'', section:'SEC-A', tonnes:'', trucks:'', notes:'' });

  const totalToday = SHIFT_LOG.reduce((s,r)=>s+r.tonnes,0);
  const targetToday = 450;
  const pct = Math.round(totalToday/targetToday*100);
  const weekAvg = Math.round(DAILY.reduce((s,d)=>s+d.actual,0)/DAILY.length);

  function add() {
    if (!form.date || !form.tonnes) return;
    setLog(l => [{ id:'p'+Date.now(), ...form, tonnes:parseInt(form.tonnes)||0, trucks:parseInt(form.trucks)||0 }, ...l]);
    setForm({ date:'', shift:'Morning', operator:'', section:'SEC-A', tonnes:'', trucks:'', notes:'' });
    setShowForm(false);
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-mine-accent" />
          <h1 className="font-bold text-lg">Coal Production Tracker</h1>
        </div>
        {isAdmin && <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Log Production</button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card text-center"><div className="metric-label mb-1">Today's Output</div><div className="text-2xl font-black text-mine-accent">{totalToday}<span className="text-xs text-ink-500 ml-1">tonnes</span></div></div>
        <div className="card text-center"><div className="metric-label mb-1">Target</div><div className="text-2xl font-black text-mine-text">{targetToday}<span className="text-xs text-ink-500 ml-1">tonnes</span></div></div>
        <div className="card text-center"><div className="metric-label mb-1">Achievement</div><div className={`text-2xl font-black ${pct>=100?'text-green-400':'text-amber-400'}`}>{pct}%</div></div>
        <div className="card text-center"><div className="metric-label mb-1">7-Day Avg</div><div className="text-2xl font-black text-mine-cyan">{weekAvg}<span className="text-xs text-ink-500 ml-1">t/day</span></div></div>
      </div>

      <div className="card">
        <div className="section-title mb-3"><BarChart3 className="w-3.5 h-3.5"/>7-Day Production vs Target</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={DAILY} margin={{ top:5, right:10, left:-20, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill:'#475569', fontSize:11 }} />
            <YAxis tick={{ fill:'#475569', fontSize:11 }} />
            <Tooltip contentStyle={{ background:'#0e1628', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8 }} />
            <Bar dataKey="target" fill="rgba(255,255,255,0.08)" name="Target" radius={[3,3,0,0]} />
            <Bar dataKey="actual" fill="#f59e0b" name="Actual" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {showForm && (
        <div className="card border border-mine-border/60 space-y-3">
          <div className="section-title"><Plus className="w-3.5 h-3.5"/>Log Shift Production</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="metric-label mb-1.5 block">Date</label><input type="date" className="input-dark" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Shift</label><select className="input-dark" value={form.shift} onChange={e=>setForm(f=>({...f,shift:e.target.value}))}><option>Morning</option><option>Evening</option><option>Night</option></select></div>
            <div><label className="metric-label mb-1.5 block">Operator</label><input className="input-dark" value={form.operator} onChange={e=>setForm(f=>({...f,operator:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Tonnes Produced</label><input type="number" className="input-dark" value={form.tonnes} onChange={e=>setForm(f=>({...f,tonnes:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Truck Trips</label><input type="number" className="input-dark" value={form.trucks} onChange={e=>setForm(f=>({...f,trucks:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Notes</label><input className="input-dark" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Save</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="section-title mb-3"><Calendar className="w-3.5 h-3.5"/>Shift Production Log</div>
        <table className="data-table w-full">
          <thead><tr><th>Date</th><th>Shift</th><th>Operator</th><th>Section</th><th>Tonnes</th><th>Trucks</th><th>Notes</th></tr></thead>
          <tbody>
            {log.map(r => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.date}</td>
                <td><span className="badge-info">{r.shift}</span></td>
                <td>{r.operator}</td>
                <td>{r.section}</td>
                <td className="font-bold text-mine-accent">{r.tonnes} t</td>
                <td>{r.trucks}</td>
                <td className="text-xs text-ink-500">{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
