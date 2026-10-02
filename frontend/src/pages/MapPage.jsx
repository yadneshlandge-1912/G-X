import React from 'react';
import MineMap      from '../components/MineMap';
import useMineStore from '../store/useMineStore';
import { Satellite, MapPin, Wifi, Clock } from 'lucide-react';

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const GAS_COLOUR = {
  SAFE:    'text-emerald-400',
  CAUTION: 'text-amber-400',
  WARNING: 'text-orange-400',
  DANGER:  'text-red-400',
};

export default function MapPage() {
  const nodes = useMineStore(s => s.nodes);

  const online  = Object.values(nodes).filter(n => n?.online).length;
  const hasGPS  = Object.values(nodes).filter(n => n?.location?.gpsLat).length;

  return (
    <div className="p-4 space-y-4 animate-fade-up">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Satellite className="w-5 h-5" style={{ color: 'var(--accent-amber)' }} />
          <div>
            <h1 className="font-bold text-lg text-ink-100">Live Satellite Map</h1>
            <p className="text-xs text-ink-500 mt-0.5">
              ESRI World Imagery · SEC-A Mine · Jharia Coalfield, Jharkhand
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold badge-safe"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Wifi className="w-3.5 h-3.5" />
            {online} / 5 Online
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold badge-cyan"
            style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <MapPin className="w-3.5 h-3.5" />
            {hasGPS} GPS Fix{hasGPS !== 1 ? 'es' : ''}
          </div>
        </div>
      </div>

      {/* Satellite map */}
      <MineMap />

      {/* Node status table */}
      <div className="card">
        <div className="section-head">
          <MapPin className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
          Miner Position Table
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Node</th>
                <th>Status</th>
                <th>Temperature</th>
                <th>Humidity</th>
                <th>Gas PPM</th>
                <th>Gas Level</th>
                <th>RSSI</th>
                <th>GPS Lat</th>
                <th>GPS Lon</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(nid => {
                const node    = nodes[nid];
                const online  = node?.online ?? false;
                const gasCol  = GAS_COLOUR[node?.gasLabel] || 'text-ink-400';
                const gpsLat  = node?.location?.gpsLat;
                const gpsLon  = node?.location?.gpsLon;

                return (
                  <tr key={nid}>
                    {/* Node ID */}
                    <td>
                      <div className="flex items-center gap-2">
                         <div className={`dot ${online ? 'dot-online' : 'dot-offline'}`} />
                        <span className="font-bold text-ink-100 font-mono">N-{nid}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`badge ${online ? 'badge-safe' : 'badge-neutral'}`}>
                        {online ? 'Online' : 'Offline'}
                      </span>
                      {node?.sos && (
                        <span className="badge badge-danger ml-1 animate-pulse-glow">SOS</span>
                      )}
                    </td>

                    {/* Sensors */}
                    <td className="font-mono tabular">
                      {node?.temperature != null ? `${node.temperature.toFixed(1)} °C` : '—'}
                    </td>
                    <td className="font-mono tabular">
                      {node?.humidity != null ? `${node.humidity.toFixed(0)} %` : '—'}
                    </td>
                    <td className="font-mono tabular">
                      {node?.gasPPM != null ? `${Math.round(node.gasPPM)}` : '—'}
                    </td>
                    <td>
                      {node?.gasLabel
                        ? <span className={`font-bold text-xs ${gasCol}`}>{node.gasLabel}</span>
                        : '—'}
                    </td>

                    {/* Signal */}
                    <td className="font-mono tabular">
                      {node?.rssi != null ? `${node.rssi} dBm` : '—'}
                    </td>

                    {/* GPS */}
                    <td className="font-mono tabular text-xs">
                      {gpsLat != null
                        ? <span className="text-mine-cyan">{gpsLat.toFixed(5)}</span>
                        : <span className="text-ink-600">No fix</span>}
                    </td>
                    <td className="font-mono tabular text-xs">
                      {gpsLon != null
                        ? <span className="text-mine-cyan">{gpsLon.toFixed(5)}</span>
                        : <span className="text-ink-600">No fix</span>}
                    </td>

                    {/* Last seen */}
                    <td>
                      <div className="flex items-center gap-1 text-xs text-ink-500">
                        <Clock className="w-3 h-3" />
                        {timeAgo(node?.lastSeen)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* GPS note */}
        <div className="mt-3 px-1 text-xs text-ink-600">
          💡 GPS coordinates appear automatically when node firmware sends a valid fix.
          Without GPS hardware, nodes are shown at estimated positions near the mine centre.
        </div>
      </div>
    </div>
  );
}
