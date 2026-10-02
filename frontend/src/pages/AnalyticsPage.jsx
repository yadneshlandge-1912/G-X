import React from 'react';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';

const WEEKLY = [
  {day:'Mon',gas:3,temp:2,humid:4,rssi:3},{day:'Tue',gas:1,temp:2,humid:2,rssi:3},
  {day:'Wed',gas:5,temp:4,humid:3,rssi:3},{day:'Thu',gas:2,temp:1,humid:1,rssi:2},
  {day:'Fri',gas:2,temp:3,humid:2,rssi:2},{day:'Sat',gas:1,temp:1,humid:1,rssi:1},
  {day:'Sun',gas:1,temp:1,humid:0,rssi:1},
];
const RADAR_DATA = [
  {subject:'Gas Safety',A:88},{subject:'Temperature',A:92},{subject:'Humidity',A:79},
  {subject:'RSSI',A:85},{subject:'Uptime',A:96},{subject:'Response',A:91},
];
const STATS = [
  {label:'Avg Alerts/Day',value:'8.1',trend:'down',color:'#10b981'},
  {label:'Node Uptime',value:'96.4%',trend:'up',color:'#38bdf8'},
  {label:'SOS Events',value:'1',trend:'stable',color:'#ef4444'},
  {label:'Gas Incidents',value:'15',trend:'down',color:'#f59e0b'},
];

export default function AnalyticsPage() {
  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3"><BarChart3 className="w-5 h-5 text-mine-accent"/><h1 className="font-bold text-lg">Analytics</h1></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATS.map(m => (
          <div key={m.label} className="card">
            <div className="metric-label mb-1">{m.label}</div>
            <div className="flex items-end gap-2">
              <div className="text-xl font-black" style={{color:m.color}}>{m.value}</div>
              {m.trend==='up'?<TrendingUp className="w-4 h-4 text-red-400 mb-0.5"/>:m.trend==='down'?<TrendingDown className="w-4 h-4 text-green-400 mb-0.5"/>:null}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <div className="section-head mb-3"><BarChart3 className="w-3.5 h-3.5" style={{color:'#f59e0b'}}/>Weekly Alert Volume by Type</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={WEEKLY}>
              <XAxis dataKey="day" tick={{fill:'var(--text-dim)',fontSize:10}}/>
              <YAxis tick={{fill:'var(--text-dim)',fontSize:10}}/>
              <Tooltip contentStyle={{background:'var(--bg-dropdown)',border:'1px solid var(--border-card)',borderRadius:'8px',color:'var(--text-heading)',fontSize:'11px'}}/>
              <Bar dataKey="gas" stackId="a" fill="#a78bfa" name="Gas"/>
              <Bar dataKey="temp" stackId="a" fill="#f97316" name="Temp"/>
              <Bar dataKey="humid" stackId="a" fill="#38bdf8" name="Humid"/>
              <Bar dataKey="rssi" stackId="a" fill="#6b7280" name="RSSI" radius={[4,4,0,0]}/>
              <Legend wrapperStyle={{fontSize:'11px'}}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="section-head mb-3"><BarChart3 className="w-3.5 h-3.5" style={{color:'#38bdf8'}}/>Safety Radar</div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="var(--border-subtle)"/>
              <PolarAngleAxis dataKey="subject" tick={{fill:'var(--text-dim)',fontSize:9}}/>
              <Radar dataKey="A" stroke="#38bdf8" fill="rgba(56,189,248,0.15)" strokeWidth={2}/>
              <Tooltip contentStyle={{background:'var(--bg-dropdown)',border:'1px solid var(--border-card)',borderRadius:'8px',color:'var(--text-heading)',fontSize:'11px'}}/>
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
