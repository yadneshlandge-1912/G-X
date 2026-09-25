import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import useMineStore from '../store/useMineStore';
import { History } from 'lucide-react';

const METRICS = [
  { key: 'temp',  name: 'Temperature (°C)', color: '#f97316' },
  { key: 'humid', name: 'Humidity (%)',      color: '#38bdf8' },
  { key: 'gas',   name: 'Gas PPM',          color: '#a78bfa' },
  { key: 'rssi',  name: 'RSSI (dBm)',       color: '#6b7280' },
];

export default function HistoryPage() {
  const [selectedMetric, setSelectedMetric] = useState('temp');
  const history = useMineStore(s => s.history);

  const NODE_COLORS = ['#f59e0b', '#22c55e', '#38bdf8', '#a78bfa', '#f97316'];

  // Build combined dataset: one entry per timestamp, keyed by node
  const allTs = new Set();
  for (let n = 1; n <= 5; n++) {
    (history[n] || []).forEach(h => allTs.add(h.ts));
  }
  const sorted = Array.from(allTs).sort();

  // For each timestamp, find closest reading per node (within 5s)
  const combined = sorted.slice(-60).map(ts => {
    const pt = { ts, label: new Date(ts).toLocaleTimeString() };
    for (let n = 1; n <= 5; n++) {
      const closest = (history[n] || []).reduce((best, h) => {
        return Math.abs(h.ts - ts) < Math.abs((best?.ts ?? Infinity) - ts) ? h : best;
      }, null);
      if (closest && Math.abs(closest.ts - ts) < 10000) {
        pt[`n${n}`] = closest[selectedMetric];
      }
    }
    return pt;
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <History className="text-mine-accent w-5 h-5" />
        <h1 className="font-bold text-lg">Sensor History</h1>
        <span className="text-mine-muted text-sm">Live rolling window (last 60 readings)</span>

        <div className="ml-auto flex gap-2">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setSelectedMetric(m.key)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors
                ${selectedMetric === m.key
                  ? 'bg-mine-accent text-mine-bg'
                  : 'text-mine-muted hover:text-mine-text bg-mine-border'}`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-node combined chart */}
      <div className="card">
        <div className="metric-label mb-3">
          All 5 Nodes — {METRICS.find(m => m.key === selectedMetric)?.name}
        </div>
        {combined.length > 1 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={combined} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} interval={Math.floor(combined.length / 8)} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {[1, 2, 3, 4, 5].map((n, i) => (
                <Line
                  key={n}
                  type="monotone"
                  dataKey={`n${n}`}
                  name={`Node ${n}`}
                  stroke={NODE_COLORS[i]}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-mine-muted py-16">
            Accumulating data — need at least 2 readings
          </div>
        )}
      </div>

      {/* Per-node mini charts */}
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((nid, i) => {
          const data = (history[nid] || []).slice(-20);
          return (
            <div key={nid} className="card">
              <div className="text-xs font-bold mb-2" style={{ color: NODE_COLORS[i] }}>NODE {nid}</div>
              {data.length > 1 ? (
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={data}>
                    <Line
                      type="monotone"
                      dataKey={selectedMetric}
                      stroke={NODE_COLORS[i]}
                      dot={false}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #1f2937', fontSize: '10px' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-mine-muted text-xs text-center py-4">No data</div>
              )}
              <div className="text-xs text-mine-muted mt-1 text-center">
                {data[data.length - 1]?.[selectedMetric]?.toFixed(1) ?? '--'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
