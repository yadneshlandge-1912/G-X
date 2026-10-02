import React, { useState, useEffect } from 'react';
import { Thermometer, Wind } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import useMineStore from '../store/useMineStore';

const SAFE_MAX = 1000;
const DANGER_MAX = 5000;

export default function CO2MonitorPage() {
  const nodes = useMineStore(s => s.nodes);
  const [history, setHistory] = useState(() =>
    Array.from({length:20},(_,i) => ({ t:`-${20-i}m`, co2: Math.round(400+Math.random()*200) }))
  );

  useEffect(() => {
    const t = setInterval(() => {
      setHistory(h => [...h.slice(-19), { t:'now', co2: Math.round(400+Math.random()*250) }]);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const readings = [1,2,3,4,5].map(id => ({
    nodeId: id,
    co2: nodes[id] ? Math.round(350 + (nodes[id].gasPPM||0)*0.4 + Math.random()*100) : null,
    online: nodes[id]?.online,
  }));

  const maxCO2 = Math.max(600, ...readings.filter(r=>r.co2).map(r=>r.co2));
  const statusColor = maxCO2>DANGER_MAX ? '#ef4444' : maxCO2>SAFE_MAX ? '#f59e0b' : '#10b981';
  const statusLabel = maxCO2>DANGER_MAX ? 'DANGER' : maxCO2>SAFE_MAX ? 'CAUTION' : 'SAFE';

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3"><Thermometer className="w-5 h-5 text-mine-cyan"/><h1 className="font-bold text-lg">CO₂ Monitor</h1></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card"><div className="metric-label mb-1">Peak CO₂</div><div className="text-2xl font-black font-mono" style={{color:statusColor}}>{maxCO2}<span className="text-xs font-normal ml-1">ppm</span></div></div>
        <div className="card"><div className="metric-label mb-1">OSHA Limit</div><div className="text-2xl font-black text-mine-muted">1,000<span className="text-xs font-normal ml-1">ppm</span></div></div>
        <div className="card"><div className="metric-label mb-1">Status</div><div className="text-xl font-black" style={{color:statusColor}}>{statusLabel}</div></div>
        <div className="card"><div className="metric-label mb-1">Nodes Live</div><div className="text-2xl font-black text-mine-blue">{readings.filter(r=>r.online).length}</div></div>
      </div>
      <div className="card">
        <div className="section-head mb-3"><Wind className="w-3.5 h-3.5" style={{color:'#06b6d4'}}/>CO₂ Trend (ppm)</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={history}>
            <XAxis dataKey="t" tick={{fill:'var(--text-dim)',fontSize:10}}/>
            <YAxis tick={{fill:'var(--text-dim)',fontSize:10}} domain={[0,'auto']}/>
            <Tooltip contentStyle={{background:'var(--bg-dropdown)',border:'1px solid var(--border-card)',borderRadius:'8px',fontSize:'12px',color:'var(--text-heading)'}}/>
            <ReferenceLine y={SAFE_MAX} stroke="#f59e0b" strokeDasharray="4 2" label={{value:'OSHA Limit',fill:'#f59e0b',fontSize:9}}/>
            <Area type="monotone" dataKey="co2" stroke="#06b6d4" fill="rgba(6,182,212,0.1)" strokeWidth={2} dot={false} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {readings.map(r => (
          <div key={r.nodeId} className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-ink-100">Node N-{r.nodeId}</span>
              <span className={`badge ${r.online?'badge-safe':'badge-offline'}`}>{r.online?'Online':'Offline'}</span>
            </div>
            {r.co2 && r.online ? (
              <>
                <div className="text-2xl font-black font-mono" style={{color:r.co2>SAFE_MAX?'#f59e0b':'#10b981'}}>{r.co2}<span className="text-xs font-normal ml-1">ppm</span></div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{background:'var(--border-subtle)'}}>
                  <div className="h-full rounded-full" style={{width:`${Math.min(100,(r.co2/DANGER_MAX)*100)}%`,background:r.co2>SAFE_MAX?'linear-gradient(90deg,#f97316,#ef4444)':'linear-gradient(90deg,#10b98188,#10b981)'}}/>
                </div>
              </>
            ) : <div className="text-mine-muted text-sm py-2">No data</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
