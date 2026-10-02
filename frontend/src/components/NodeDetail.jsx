import React from 'react';
import { X, MapPin, Radio } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import useMineStore from '../store/useMineStore';

const CHART_LINES = [
  { key: 'temp',  name: 'Temp °C',   color: '#f97316', yId: 'left' },
  { key: 'humid', name: 'Humidity %', color: '#38bdf8', yId: 'left' },
  { key: 'gas',   name: 'Gas PPM',   color: '#a78bfa', yId: 'right' },
  { key: 'rssi',  name: 'RSSI dBm',  color: '#6b7280', yId: 'right' },
];

export default function NodeDetail() {
  const selectedNode = useMineStore(s => s.selectedNode);
  const setSelected  = useMineStore(s => s.setSelectedNode);
  const node         = useMineStore(s => s.nodes[selectedNode]);
  const history      = useMineStore(s => s.history[selectedNode] || []);

  if (!selectedNode || !node) return null;

  return (
    <div className="card animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radio className="text-mine-accent w-5 h-5" />
          <h2 className="font-bold text-lg">Node {selectedNode} — Detail</h2>
          <span className="text-mine-muted text-sm">{node.section || 'SEC-A'}</span>
        </div>
        <button
          onClick={() => setSelected(null)}
          className="text-mine-muted hover:text-mine-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Trend chart */}
      <div className="mb-4">
        <div className="metric-label mb-2">Live Sensor Trends (last {history.length} readings)</div>
        {history.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis yAxisId="left"  tick={{ fill: 'var(--text-dim)', fontSize: 10 }} domain={['auto', 'auto']} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-dropdown)', border: '1px solid var(--border-card)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-heading)' }}
                labelStyle={{ color: 'var(--text-muted)' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--text-muted)' }} />
              {CHART_LINES.map(l => (
                <Line
                  key={l.key}
                  yAxisId={l.yId}
                  type="monotone"
                  dataKey={l.key}
                  stroke={l.color}
                  name={l.name}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-mine-muted text-sm text-center py-8">
            Accumulating data... ({history.length} / 3 readings needed)
          </div>
        )}
      </div>

      {/* Location detail */}
      {node.location && (
        <div className="bg-mine-deeper border border-mine-border rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="text-mine-accent w-4 h-4" />
            <span className="font-semibold text-sm">Location Estimate (Agent 2)</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="metric-label">Position (x, y)</div>
              <div className="font-bold text-mine-accent">
                {node.location.position?.x?.toFixed(1)}m, {node.location.position?.y?.toFixed(1)}m
              </div>
            </div>
            <div>
              <div className="metric-label">Distance from Gateway</div>
              <div className="font-bold">{node.location.distFromGW?.toFixed(1) ?? '--'}m</div>
            </div>
            <div>
              <div className="metric-label">Nearest Anchor</div>
              <div className="font-bold">{node.location.nearest?.id ?? '--'}</div>
            </div>
            <div>
              <div className="metric-label">Depth Underground</div>
              <div className="font-bold">{node.location.depth ?? '--'}m</div>
            </div>
            <div>
              <div className="metric-label">Confidence</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-mine-border rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-mine-accent transition-all"
                    style={{ width: `${node.location.confidence ?? 0}%` }}
                  />
                </div>
                <span className="text-xs">{node.location.confidence ?? 0}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Anomalies */}
      {node.anomalies?.length > 0 && (
        <div className="bg-orange-900/20 border border-orange-800 rounded-xl p-3">
          <div className="text-orange-400 font-semibold text-sm mb-2">⚠ Anomalies Detected</div>
          {node.anomalies.map((a, i) => (
            <div key={i} className="text-xs text-orange-300 mb-1">
              • {a.type}: {JSON.stringify(a)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
