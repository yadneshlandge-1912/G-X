import React from 'react';
import { Radio, Database, Cpu, Activity, Wifi, WifiOff, AlertTriangle, CheckCircle } from 'lucide-react';
import useMineStore from '../store/useMineStore';

function Tile({ icon: Icon, label, value, accent = '#94a3b8' }) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1"
      style={{ background:'var(--bg-card-nested)', border:'1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-1.5 text-[10px] text-ink-500 uppercase tracking-wide font-semibold">
        <Icon className="w-3 h-3" />{label}
      </div>
      <div className="text-lg font-black font-mono tabular" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function GatewayStatus() {
  const wsStatus  = useMineStore(s => s.wsStatus);
  const nodes     = useMineStore(s => s.nodes);
  const stats     = useMineStore(s => s.stats);
  const gwInfo    = useMineStore(s => s.gatewayInfo);

  const online    = Object.values(nodes).filter(n => n?.online).length;
  const sosCount  = Object.values(nodes).filter(n => n?.sos).length;
  const connected = wsStatus === 'connected';

  // Determine receiver hardware status from gateway info broadcast by backend
  const hwConnected = gwInfo?.connected === true;
  const hwSimMode   = gwInfo?.simMode   === true;
  const hwPort      = gwInfo?.port;
  const hwPkts      = gwInfo?.packetCount ?? 0;

  // If gwInfo is null — backend hasn't sent a status yet (waiting for hardware)
  const hwStatus = hwConnected
    ? 'connected'
    : hwSimMode
      ? 'simulation'
      : 'waiting';

  const loraConfig = [
    { k:'Frequency', v:'915 MHz'        },
    { k:'SF',        v:'12 (max range)' },
    { k:'Bandwidth', v:'125 kHz'        },
    { k:'Coding',    v:'CR 4/8'         },
    { k:'TX Power',  v:'20 dBm'         },
    { k:'Sync Word', v:'0xF3 (private)' },
  ];

  return (
    <div className="card space-y-3">

      {/* ── Receiver hardware status banner ─────────────────── */}
      {hwStatus === 'connected' && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)' }}>
          <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color:'#10b981' }} />
          <div>
            <div className="text-sm font-bold" style={{ color:'#10b981' }}>
              ✅ Receiver Connected
            </div>
            <div className="text-xs text-ink-500 font-mono mt-0.5">
              Port: {hwPort} · {hwPkts} packets received
            </div>
          </div>
        </div>
      )}

      {hwStatus === 'simulation' && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.2)' }}>
          <Activity className="w-5 h-5 flex-shrink-0" style={{ color:'#38bdf8' }} />
          <div>
            <div className="text-sm font-bold" style={{ color:'#38bdf8' }}>
              🔵 Simulation Mode
            </div>
            <div className="text-xs text-ink-500 mt-0.5">
              Fake data — no hardware connected
            </div>
          </div>
        </div>
      )}

      {hwStatus === 'waiting' && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)' }}>
          <WifiOff className="w-5 h-5 flex-shrink-0" style={{ color:'#f59e0b' }} />
          <div>
            <div className="text-sm font-bold" style={{ color:'#f59e0b' }}>
              ⏸ Waiting for Receiver
            </div>
            <div className="text-xs text-ink-500 mt-0.5">
              Plug in the gateway ESP32 &amp; set SERIAL_PORT in .env
            </div>
          </div>
        </div>
      )}

      {/* ── Section header ─────────────────────────────────── */}
      <div className="section-head" style={{ marginBottom: 0 }}>
        <Radio className="w-3.5 h-3.5" style={{ color:'#f59e0b' }} />
        Gateway Status
        <div className="ml-auto">
          <div className={`dot ${connected ? 'dot-online' : 'dot-danger'}`} />
        </div>
      </div>

      {/* ── Stats tiles ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <Tile icon={Cpu}      label="Online Nodes"
          value={`${online} / 5`}
          accent={online === 5 ? '#10b981' : online > 2 ? '#f59e0b' : '#ef4444'} />
        <Tile icon={Activity} label="SOS Active"
          value={sosCount > 0 ? `${sosCount} !!` : 'None'}
          accent={sosCount > 0 ? '#ef4444' : '#10b981'} />
        <Tile icon={Database} label="Readings / 1h"
          value={stats?.total_readings ?? '—'} />
        <Tile icon={Wifi}     label="Avg Temp"
          value={stats?.avg_temp ? `${stats.avg_temp.toFixed(1)}°C` : '—'} />
      </div>

      {/* ── LoRa config ────────────────────────────────────── */}
      <div className="rounded-xl p-3"
        style={{ background:'var(--bg-card-nested)', border:'1px solid var(--border-subtle)' }}>
        <div className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider mb-2">
          LoRa RF Config
        </div>
        <div className="space-y-1.5">
          {loraConfig.map(({ k, v }) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="text-ink-500">{k}</span>
              <span className="font-mono text-ink-300 font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* No-hardware notice — only shown when truly waiting */}
      {hwStatus === 'waiting' && (
        <div className="text-xs text-ink-600 leading-relaxed px-1">
          No alerts or sensor data will appear until the gateway ESP32 receiver
          is connected via USB and <code className="text-ink-400">SERIAL_PORT</code> is
          set in <code className="text-ink-400">backend_py/.env</code>.
        </div>
      )}
    </div>
  );
}

export default React.memo(GatewayStatus);
