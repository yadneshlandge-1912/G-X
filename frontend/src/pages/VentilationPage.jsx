import React, { useState, useEffect } from 'react';
import { Wind, ToggleLeft, ToggleRight } from 'lucide-react';
const FANS=[{id:1,name:'Main Intake Fan',location:'Portal Entry',rpm:1450,flow:18000,status:true,temp:28},{id:2,name:'Section A Exhaust',location:'SEC-A Return',rpm:1200,flow:14000,status:true,temp:31},{id:3,name:'Section B Booster',location:'SEC-B Mid',rpm:980,flow:10000,status:true,temp:30},{id:4,name:'Emergency Exhaust',location:'Emergency Exit',rpm:0,flow:0,status:false,temp:26}];
export default function VentilationPage() {
  const [fans,setFans]=useState(FANS);
  const [airQuality,setAirQuality]=useState(94);
  useEffect(()=>{const t=setInterval(()=>setAirQuality(q=>Math.max(80,Math.min(100,q+(Math.random()*4-2)))),4000);return()=>clearInterval(t);},[]);
  const toggle=(id)=>setFans(f=>f.map(fan=>fan.id===id?{...fan,status:!fan.status,rpm:fan.status?0:fan.rpm||1200,flow:fan.status?0:fan.flow||12000}:fan));
  const airColor=airQuality>90?'#10b981':airQuality>80?'#f59e0b':'#ef4444';
  return (<div className="p-4 space-y-4 animate-fade-in">
    <div className="flex items-center gap-3"><Wind className="w-5 h-5 text-mine-blue"/><h1 className="font-bold text-lg">Ventilation Control</h1></div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="card"><div className="metric-label mb-1">Air Quality</div><div className="text-2xl font-black" style={{color:airColor}}>{airQuality.toFixed(0)}%</div></div>
      <div className="card"><div className="metric-label mb-1">Active Fans</div><div className="text-2xl font-black text-green-400">{fans.filter(f=>f.status).length}</div></div>
      <div className="card"><div className="metric-label mb-1">Airflow m³/h</div><div className="text-2xl font-black text-mine-blue">{fans.filter(f=>f.status).reduce((s,f)=>s+f.flow,0).toLocaleString()}</div></div>
      <div className="card"><div className="metric-label mb-1">Avg Temp</div><div className="text-2xl font-black text-orange-400">{(fans.reduce((s,f)=>s+f.temp,0)/fans.length).toFixed(1)}°C</div></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fans.map(fan=>(<div key={fan.id} className="card">
        <div className="flex items-start justify-between mb-3">
          <div><div className="font-bold text-sm text-ink-100">{fan.name}</div><div className="text-xs text-mine-muted">{fan.location}</div></div>
          <button onClick={()=>toggle(fan.id)}>{fan.status?<ToggleRight className="w-8 h-8 text-green-400"/>:<ToggleLeft className="w-8 h-8 text-mine-muted"/>}</button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-mine-deeper rounded-lg p-2"><div className="metric-label text-[10px] mb-0.5">RPM</div><div className="text-xs font-bold font-mono text-mine-blue">{fan.rpm}</div></div>
          <div className="bg-mine-deeper rounded-lg p-2"><div className="metric-label text-[10px] mb-0.5">Flow</div><div className="text-xs font-bold font-mono" style={{color:fan.status?'#38bdf8':'#475569'}}>{fan.flow.toLocaleString()}</div></div>
          <div className="bg-mine-deeper rounded-lg p-2"><div className="metric-label text-[10px] mb-0.5">Temp</div><div className="text-xs font-bold font-mono" style={{color:fan.temp>32?'#f97316':'#10b981'}}>{fan.temp}°C</div></div>
        </div>
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{background:'var(--border-subtle)'}}><div className="h-full rounded-full transition-all duration-1000" style={{width:fan.status?'100%':'0%',background:'linear-gradient(90deg,#38bdf888,#38bdf8)'}}/></div>
      </div>))}
    </div>
  </div>);
}
