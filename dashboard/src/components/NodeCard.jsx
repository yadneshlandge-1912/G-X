import React from 'react';
import { Thermometer, Droplets, Wind, Signal, MapPin, AlertTriangle } from 'lucide-react';
import useMineStore from '../store/useMineStore';

const GAS = {
  SAFE:    { color:'#10b981', label:'SAFE'    },
  CAUTION: { color:'#f59e0b', label:'CAUTION' },
  WARNING: { color:'#f97316', label:'WARNING' },
  DANGER:  { color:'#ef4444', label:'DANGER'  },
};

export default function NodeCard({ nodeId }) {
  const node        = useMineStore(s => s.nodes[nodeId]);
  const setSelected = useMineStore(s => s.setSelectedNode);
  const selected    = useMineStore(s => s.selectedNode);
  const isSelected  = selected === nodeId;

  const online  = node?.online ?? null;   // null=waiting, true=online, false=offline
  const hasSOS  = node?.sos;
  const gas     = GAS[node?.gasLabel] || { color:'#475569', label:'—' };

  const rssi  = node?.rssi ?? -130;
  const bars  = rssi >= -70 ? 5 : rssi >= -85 ? 4 : rssi >= -100 ? 3 : rssi >= -115 ? 2 : 1;

  const borderColor = hasSOS
    ? 'rgba(239,68,68,0.5)'
    : isSelected
      ? 'rgba(245,158,11,0.4)'
      : online === true  ? 'rgba(255,255,255,0.08)'
      : online === null  ? 'rgba(255,255,255,0.06)'
      : 'rgba(255,255,255,0.04)';

  const glowColor = hasSOS
    ? 'rgba(239,68,68,0.15)'
    : isSelected
      ? 'rgba(245,158,11,0.1)'
      : 'transparent';

  return (
    <button
      onClick={() => setSelected(isSelected ? null : nodeId)}
      className="w-full text-left rounded-xl p-3 transition-all duration-200 group"
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)`,
        border: `1px solid ${borderColor}`,
        boxShadow: `0 0 20px ${glowColor}, 0 2px 8px rgba(0,0,0,0.3)`,
        opacity: (online === false && !hasSOS) ? 0.55 : 1,
      }}>

      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className={`dot ${online === true ? (hasSOS ? 'dot-danger' : 'dot-online') : online === null ? 'dot-offline animate-pulse' : 'dot-offline'}`} />
          <span className="text-xs font-bold text-white font-mono">N-{nodeId}</span>
          <span className="text-[10px] text-ink-600">{node?.section || 'SEC-A'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasSOS && (
            <span className="badge badge-danger text-[9px] animate-pulse-glow">SOS</span>
          )}
          {node?.gasLabel && !hasSOS && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background:`${gas.color}14`, color:gas.color, border:`1px solid ${gas.color}28` }}>
              {gas.label}
            </span>
          )}
        </div>
      </div>

      {/* Waiting for first live packet */}
      {online === null && (
        <div className="flex items-center gap-1.5 text-xs text-ink-600 py-1 animate-pulse">
          <Signal className="w-3.5 h-3.5" /> Waiting for signal…
        </div>
      )}

      {/* Offline */}
      {online === false && (
        <div className="flex items-center gap-1.5 text-xs text-ink-600 py-1">
          <AlertTriangle className="w-3.5 h-3.5" /> No signal
        </div>
      )}

      {/* Live metrics */}
      {online === true && node && (
        <>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {/* Temp */}
            <div className="rounded-lg p-2" style={{ background:'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-1 text-[10px] text-ink-600 mb-1">
                <Thermometer className="w-3 h-3" /> Temp
              </div>
              <div className="text-sm font-bold font-mono tabular"
                style={{ color: (node.temperature||0) >= 37 ? '#ef4444' : (node.temperature||0) >= 33 ? '#f97316' : '#93c5fd' }}>
                {node.temperature?.toFixed(1) ?? '—'}°C
              </div>
            </div>

            {/* Humid */}
            <div className="rounded-lg p-2" style={{ background:'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-1 text-[10px] text-ink-600 mb-1">
                <Droplets className="w-3 h-3" /> Humid
              </div>
              <div className="text-sm font-bold font-mono tabular"
                style={{ color: (node.humidity||0) >= 90 ? '#f97316' : '#22d3ee' }}>
                {node.humidity?.toFixed(0) ?? '—'}%
              </div>
            </div>

            {/* Gas */}
            <div className="rounded-lg p-2" style={{ background:'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-1 text-[10px] text-ink-600 mb-1">
                <Wind className="w-3 h-3" /> Gas
              </div>
              <div className="text-sm font-bold font-mono tabular" style={{ color: gas.color }}>
                {node.gasPPM != null ? Math.round(node.gasPPM) : '—'}
                <span className="text-[9px] font-normal text-ink-600 ml-0.5">ppm</span>
              </div>
            </div>

            {/* Signal bars */}
            <div className="rounded-lg p-2" style={{ background:'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-1 text-[10px] text-ink-600 mb-1">
                <Signal className="w-3 h-3" /> RSSI
              </div>
              <div className="flex items-end gap-0.5">
                {[1,2,3,4,5].map(b => (
                  <div key={b} className="w-1.5 rounded-sm transition-all"
                    style={{ height:`${b*3+2}px`, background: b<=bars ? '#10b981' : 'rgba(255,255,255,0.08)' }} />
                ))}
              </div>
            </div>
          </div>

          {/* Location strip */}
          {node.location && (
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] text-ink-500"
              style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
              <MapPin className="w-3 h-3 flex-shrink-0" style={{ color:'#f59e0b' }} />
              <span>~{node.location.distFromGW?.toFixed(0)}m</span>
              <span className="text-ink-600">{node.location.nearest?.id}</span>
              <span className="ml-auto">{node.location.confidence}%</span>
            </div>
          )}
        </>
      )}
    </button>
  );
}
