import React from 'react';
import { Zap, Battery, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const LOADS = [
  { name:'Ventilation Fans', kw:45, max:60, status:'OK' },
  { name:'Conveyor System',  kw:32, max:50, status:'OK' },
  { name:'Water Pumps',      kw:28, max:35, status:'WARN' },
  { name:'Lighting Network', kw:12, max:20, status:'OK' },
  { name:'LoRa Gateway',     kw:0.5,max:2,  status:'OK' },
  { name:'CCTV System',      kw:3,  max:5,  status:'OK' },
];

const HOURLY = [
  {h:'06:00',kw:68},{h:'07:00',kw:89},{h:'08:00',kw:112},{h:'09:00',kw:120},
  {h:'10:00',kw:118},{h:'11:00',kw:115},{h:'12:00',kw:98},{h:'13:00',kw:105},
  {h:'14:00',kw:119},{h:'15:00',kw:121},{h:'16:00',kw:107},{h:'17:00',kw:88},
  {h:'18:00',kw:72},
];

const total = LOADS.reduce((s,l)=>s+l.kw,0);

export default function PowerMonitorPage() {
  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3"><Zap className="w-5 h-5 text-mine-accent"/><h1 className="font-bold text-lg">Power Monitor</h1></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Draw',   value:`${total.toFixed(1)} kW`,  color:'#f59e0b', icon:Zap },
          { label:'Peak Today',   value:'124.3 kW', color:'#f97316', icon:TrendingUp },
          { label:'Daily kWh',    value:'856 kWh',  color:'#38bdf8', icon:Battery },
          { label:'Grid Status',  value:'NOMINAL',  color:'#10b981', icon:AlertTriangle },
        ].map(m => (
          <div key={m.label} className="card">
            <div className="metric-label mb-1">{m.label}</div>
            <div className="text-xl font-black" style={{color:m.color}}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-head mb-3"><Zap className="w-3.5 h-3.5" style={{color:'#f59e0b'}}/>Hourly Consumption (kW)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={HOURLY}>
            <XAxis dataKey="h" tick={{fill:'var(--text-dim)',fontSize:10}} />
            <YAxis tick={{fill:'var(--text-dim)',fontSize:10}} />
            <Tooltip contentStyle={{background:'var(--bg-dropdown)',border:'1px solid var(--border-card)',borderRadius:'8px',color:'var(--text-heading)',fontSize:'12px'}} />
            <Bar dataKey="kw" radius={[4,4,0,0]}>
              {HOURLY.map((e,i) => <Cell key={i} fill={e.kw>115?'#f97316':'#f59e0b'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="section-head mb-3"><Battery className="w-3.5 h-3.5" style={{color:'#38bdf8'}}/>Load Distribution</div>
        <div className="space-y-3">
          {LOADS.map(l => {
            const pct = Math.round((l.kw/l.max)*100);
            const color = pct>90?'#ef4444':pct>75?'#f97316':'#10b981';
            return (
              <div key={l.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-mine-dim">{l.name}</span>
                  <span className="font-mono font-bold" style={{color}}>{l.kw} / {l.max} kW ({pct}%)</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{background:'var(--border-subtle)'}}>
                  <div className="h-full rounded-full transition-all duration-700" style={{width:`${pct}%`,background:`linear-gradient(90deg,${color}88,${color})`}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
