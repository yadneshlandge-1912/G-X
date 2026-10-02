import React, { useState, useEffect } from 'react';
import { Cloud, Wind, Thermometer, Droplets, Eye, AlertTriangle, Sun, CloudRain, CloudSnow, Zap } from 'lucide-react';

const CONDITIONS = [
  { id:1, time:'06:00', temp:28, humid:72, wind:12, visibility:'Good', condition:'Partly Cloudy', icon:'⛅', alert:false },
  { id:2, time:'08:00', temp:31, humid:68, wind:15, visibility:'Good', condition:'Sunny', icon:'☀️', alert:false },
  { id:3, time:'10:00', temp:34, humid:65, wind:18, visibility:'Moderate', condition:'Hot & Sunny', icon:'🌤️', alert:true },
  { id:4, time:'12:00', temp:37, humid:62, wind:20, visibility:'Moderate', condition:'Very Hot', icon:'☀️', alert:true },
  { id:5, time:'14:00', temp:36, humid:64, wind:22, visibility:'Good', condition:'Partly Cloudy', icon:'⛅', alert:false },
  { id:6, time:'16:00', temp:33, humid:70, wind:16, visibility:'Good', condition:'Cloudy', icon:'☁️', alert:false },
  { id:7, time:'18:00', temp:30, humid:75, wind:10, visibility:'Good', condition:'Overcast', icon:'☁️', alert:false },
];

const ALERTS = [
  { id:1, type:'Heat Warning', message:'Surface temp exceeds 37°C — limit outdoor exposure for shaft workers', severity:3, time:'10:00' },
  { id:2, type:'Wind Advisory', message:'Wind speed 22 km/h — secure loose materials at pit head', severity:2, time:'14:00' },
];

function StatCard({ icon: Icon, label, value, unit, color, bg }) {
  return (
    <div className="card flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div>
        <div className="metric-label">{label}</div>
        <div className="text-2xl font-black" style={{ color }}>{value}<span className="text-sm font-normal text-ink-500 ml-1">{unit}</span></div>
      </div>
    </div>
  );
}

export default function WeatherPage() {
  const [now, setNow] = useState(CONDITIONS[1]);
  useEffect(() => {
    const t = setInterval(() => {
      setNow(prev => {
        const idx = CONDITIONS.findIndex(c => c.id === prev.id);
        return CONDITIONS[(idx + 1) % CONDITIONS.length];
      });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Cloud className="w-5 h-5 text-mine-cyan" />
        <h1 className="font-bold text-lg">Surface Weather Monitor</h1>
        <span className="badge-info">Live</span>
      </div>

      {/* Current conditions */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(59,130,246,0.05))' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="text-6xl">{now.icon}</div>
            <div>
              <div className="text-4xl font-black text-white">{now.temp}°C</div>
              <div className="text-mine-dim">{now.condition}</div>
              <div className="text-xs text-ink-500 mt-1">Updated {now.time} — Jharia Surface Station</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-mine-deeper rounded-lg p-3 text-center">
              <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{now.humid}%</div>
              <div className="text-xs text-ink-500">Humidity</div>
            </div>
            <div className="bg-mine-deeper rounded-lg p-3 text-center">
              <Wind className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{now.wind} km/h</div>
              <div className="text-xs text-ink-500">Wind</div>
            </div>
            <div className="bg-mine-deeper rounded-lg p-3 text-center">
              <Eye className="w-4 h-4 text-green-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{now.visibility}</div>
              <div className="text-xs text-ink-500">Visibility</div>
            </div>
            <div className="bg-mine-deeper rounded-lg p-3 text-center">
              <Zap className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{now.alert ? 'YES' : 'NO'}</div>
              <div className="text-xs text-ink-500">Alert</div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {ALERTS.length > 0 && (
        <div className="space-y-2">
          {ALERTS.map(a => (
            <div key={a.id} className="card border border-orange-700/30 bg-orange-900/10 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-orange-300">{a.type} — {a.time}</div>
                <div className="text-xs text-mine-dim mt-0.5">{a.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hourly forecast */}
      <div className="card">
        <div className="section-title mb-3"><Thermometer className="w-3.5 h-3.5" /> Today's Hourly Forecast</div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead><tr><th>Time</th><th>Condition</th><th>Temp</th><th>Humidity</th><th>Wind</th><th>Visibility</th><th>Mine Impact</th></tr></thead>
            <tbody>
              {CONDITIONS.map(c => (
                <tr key={c.id} style={{ background: c.alert ? 'rgba(249,115,22,0.05)' : 'transparent' }}>
                  <td className="font-mono">{c.time}</td>
                  <td>{c.icon} {c.condition}</td>
                  <td className="font-mono">{c.temp}°C</td>
                  <td className="font-mono">{c.humid}%</td>
                  <td className="font-mono">{c.wind} km/h</td>
                  <td>{c.visibility}</td>
                  <td>{c.alert ? <span className="badge-warn">Monitor</span> : <span className="badge-safe">Normal</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
