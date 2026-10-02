import React, { useState, useEffect } from 'react';
import { Droplets, Activity, AlertTriangle, Gauge } from 'lucide-react';

const PUMPS = [
  { id:1, name:'Main Dewatering Pump', location:'Level -80m', capacity:'2400 L/min', status:'RUNNING', efficiency:92, temp:68, vibration:0.8 },
  { id:2, name:'Secondary Pump A',     location:'Level -60m', capacity:'1200 L/min', status:'RUNNING', efficiency:88, temp:72, vibration:1.1 },
  { id:3, name:'Secondary Pump B',     location:'Level -60m', capacity:'1200 L/min', status:'STANDBY', efficiency:0,  temp:34, vibration:0.0 },
  { id:4, name:'Sump Pump North',      location:'SEC-A Sump', capacity:'800 L/min',  status:'RUNNING', efficiency:95, temp:65, vibration:0.6 },
  { id:5, name:'Emergency Pump',       location:'Surface',    capacity:'3000 L/min', status:'STANDBY', efficiency:0,  temp:28, vibration:0.0 },
];

const STATUS_META = {
  RUNNING: { badge:'badge-safe',    label:'Running',  dot:'dot-online' },
  STANDBY: { badge:'badge-info',    label:'Standby',  dot:'dot-offline' },
  FAULT:   { badge:'badge-danger',  label:'FAULT',    dot:'dot-danger' },
};

export default function WaterPumpPage() {
  const [pumps, setPumps] = useState(PUMPS);
  const [totalFlow, setTotalFlow] = useState(4400);

  useEffect(() => {
    const t = setInterval(() => setTotalFlow(f => f + Math.floor(Math.random()*40-20)), 3000);
    return () => clearInterval(t);
  }, []);

  const running = pumps.filter(p => p.status==='RUNNING').length;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3"><Droplets className="w-5 h-5 text-mine-blue"/><h1 className="font-bold text-lg">Water Pump Status</h1></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card"><div className="metric-label mb-1">Active Pumps</div><div className="text-2xl font-black text-green-400">{running}</div></div>
        <div className="card"><div className="metric-label mb-1">Total Flow</div><div className="text-2xl font-black text-mine-blue">{totalFlow.toLocaleString()}<span className="text-xs font-normal text-mine-muted ml-1">L/min</span></div></div>
        <div className="card"><div className="metric-label mb-1">Water Level</div><div className="text-2xl font-black text-mine-cyan">Normal</div></div>
        <div className="card"><div className="metric-label mb-1">Alerts</div><div className="text-2xl font-black text-green-400">0</div></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pumps.map(pump => {
          const sm = STATUS_META[pump.status] || STATUS_META.STANDBY;
          return (
            <div key={pump.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-sm text-ink-100">{pump.name}</div>
                  <div className="text-xs text-mine-muted">{pump.location}</div>
                </div>
                <span className={`badge ${sm.badge}`}>{sm.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-mine-deeper rounded-lg p-2">
                  <div className="metric-label text-[10px] mb-0.5">Capacity</div>
                  <div className="text-xs font-bold text-mine-blue">{pump.capacity}</div>
                </div>
                <div className="bg-mine-deeper rounded-lg p-2">
                  <div className="metric-label text-[10px] mb-0.5">Efficiency</div>
                  <div className="text-xs font-bold" style={{color:pump.efficiency>85?'#10b981':pump.efficiency>0?'#f97316':'#475569'}}>{pump.efficiency}%</div>
                </div>
                <div className="bg-mine-deeper rounded-lg p-2">
                  <div className="metric-label text-[10px] mb-0.5">Temp</div>
                  <div className="text-xs font-bold" style={{color:pump.temp>75?'#ef4444':pump.temp>65?'#f97316':'#10b981'}}>{pump.temp}°C</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
