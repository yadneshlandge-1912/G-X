import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Radio } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function SeismicPage() {
  const [data, setData] = useState(() =>
    Array.from({length:60},(_,i)=>({ t:i, v: +(0.02+(Math.random()-0.5)*0.08).toFixed(3) }))
  );
  const [events] = useState([
    { time:'18:32:14', magnitude:0.8, depth:'12m', location:'SEC-A', type:'Micro' },
    { time:'17:10:05', magnitude:1.2, depth:'22m', location:'SEC-B', type:'Minor' },
    { time:'14:55:33', magnitude:0.4, depth:'8m',  location:'SEC-A', type:'Micro' },
  ]);

  useEffect(() => {
    const t = setInterval(() => {
      setData(d => {
        const last = d[d.length-1];
        return [...d.slice(-59), { t: last.t+1, v: +(0.02+(Math.random()-0.5)*0.09).toFixed(3) }];
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const latest = Math.abs(data[data.length-1]?.v || 0);
  const riskColor = latest>0.06 ? '#ef4444' : latest>0.04 ? '#f59e0b' : '#10b981';

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3"><Activity className="w-5 h-5 text-mine-purple"/><h1 className="font-bold text-lg">Seismic Monitor</h1></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card"><div className="metric-label mb-1">Ground Motion</div><div className="text-xl font-black font-mono" style={{color:riskColor}}>{latest.toFixed(3)} g</div></div>
        <div className="card"><div className="metric-label mb-1">Events Today</div><div className="text-2xl font-black text-mine-purple">{events.length}</div></div>
        <div className="card"><div className="metric-label mb-1">Max Magnitude</div><div className="text-2xl font-black text-orange-400">1.2</div></div>
        <div className="card"><div className="metric-label mb-1">Risk Level</div><div className="text-xl font-black text-green-400">LOW</div></div>
      </div>
      <div className="card">
        <div className="section-head mb-3"><Radio className="w-3.5 h-3.5" style={{color:'#8b5cf6'}}/>Live Seismograph (real-time)</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <XAxis dataKey="t" hide/>
            <YAxis domain={[-0.15,0.15]} tick={{fill:'var(--text-dim)',fontSize:10}}/>
            <Tooltip contentStyle={{background:'var(--bg-dropdown)',border:'1px solid var(--border-card)',borderRadius:'8px',fontSize:'11px',color:'var(--text-heading)'}} formatter={v=>[v+' g','Motion']}/>
            <ReferenceLine y={0.08} stroke="#ef4444" strokeDasharray="3 3" label={{value:'WARN',fill:'#ef4444',fontSize:9}}/>
            <ReferenceLine y={-0.08} stroke="#ef4444" strokeDasharray="3 3"/>
            <ReferenceLine y={0} stroke="var(--border-subtle)" strokeDasharray="1 4"/>
            <Line type="monotone" dataKey="v" stroke="#8b5cf6" dot={false} strokeWidth={1.5} isAnimationActive={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <div className="section-head mb-3"><AlertTriangle className="w-3.5 h-3.5" style={{color:'#f59e0b'}}/>Recent Events</div>
        <table className="data-table w-full">
          <thead><tr><th>Time</th><th>Magnitude</th><th>Depth</th><th>Location</th><th>Type</th></tr></thead>
          <tbody>
            {events.map((e,i) => (
              <tr key={i}>
                <td className="font-mono text-xs">{e.time}</td>
                <td><span className="font-bold" style={{color:e.magnitude>1?'#f97316':'#f59e0b'}}>{e.magnitude}</span></td>
                <td className="text-mine-muted text-xs">{e.depth}</td>
                <td><span className="badge-info text-xs">{e.location}</span></td>
                <td><span className="text-xs text-mine-dim">{e.type}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
