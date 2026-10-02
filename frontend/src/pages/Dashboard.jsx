import React, { useMemo } from 'react';
import {
  Users, AlertTriangle, Radio, ShieldCheck,
  Thermometer, Droplets, Wind, Activity,
  TrendingUp, TrendingDown, Minus, Signal,
  MapPin, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import NodeCard      from '../components/NodeCard';
import NodeDetail    from '../components/NodeDetail';
import AlertsPanel   from '../components/AlertsPanel';
import GatewayStatus from '../components/GatewayStatus';
import MineMap       from '../components/MineMap';
import useMineStore  from '../store/useMineStore';
import useAuthStore  from '../store/useAuthStore';

/* ── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, accent = '#f59e0b', trend }) {
  return (
    <div className="card card-hover relative overflow-hidden group">
      {/* Accent glow behind */}
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full pointer-events-none transition-opacity duration-300 opacity-30 group-hover:opacity-50"
        style={{ background: `radial-gradient(circle, ${accent}60 0%, transparent 70%)` }} />

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="label mb-2">{label}</div>
          <div className="value tabular" style={{ color: accent }}>{value}</div>
          {sub && <div className="text-xs text-ink-500 mt-1.5">{sub}</div>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background:`${accent}12`, border:`1px solid ${accent}22` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop:'1px solid var(--border-subtle)' }}>
          <div className="progress-track flex-1">
            <div className="progress-fill" style={{ width:`${Math.min(100, trend)}%`, background:`linear-gradient(90deg, ${accent}88, ${accent})` }} />
          </div>
          <span className="text-xs font-mono text-ink-500 tabular">{trend}%</span>
        </div>
      )}
    </div>
  );
}

/* ── Env gauge ───────────────────────────────────────────────────────────── */
function EnvMeter({ label, value, unit, max, threshold, accent, icon: Icon }) {
  const pct    = value != null ? Math.min(100, (value / max) * 100) : 0;
  const isOver = value != null && value > threshold;
  const color  = isOver ? '#ef4444' : accent;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-ink-500">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </div>
        <div className="text-sm font-bold font-mono tabular" style={{ color }}>
          {value != null ? (value < 10 ? value.toFixed(1) : Math.round(value)) : '—'}
          <span className="text-[11px] font-normal text-ink-600 ml-0.5">{unit}</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--border-subtle)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width:`${pct}%`, background:`linear-gradient(90deg, ${color}88, ${color})` }} />
      </div>
      <div className="text-[10px] text-ink-600">Threshold: {threshold} {unit}</div>
    </div>
  );
}

/* ── Node summary row ────────────────────────────────────────────────────── */
/* ── Node summary row ────────────────────────────────────────────────────── */
const NodeRow = React.memo(function NodeRow({ nodeId }) {
  const node   = useMineStore(s => s.nodes[nodeId]);
  const online = node?.online ?? false;

  const gasColor = {
    SAFE:'#10b981', CAUTION:'#f59e0b', WARNING:'#f97316', DANGER:'#ef4444',
  }[node?.gasLabel] || '#475569';

  return (
    <div className="flex items-center gap-3 py-2.5 px-1" style={{ borderBottom:'1px solid var(--border-subtle)' }}>
      <div className={`dot ${online ? 'dot-online' : 'dot-offline'} flex-shrink-0`} />
      <span className="text-xs font-mono text-ink-500 w-12 flex-shrink-0">N-{nodeId}</span>

      {online && node ? (
        <>
          <span className="text-xs font-bold flex-shrink-0" style={{ color: gasColor, width:'3.5rem' }}>
            {node.gasLabel || '—'}
          </span>
          <span className="text-xs text-ink-300 font-mono tabular">
            {node.temperature?.toFixed(1)}°C
          </span>
          <div className="flex-1 mx-2">
            <div className="h-1 rounded-full overflow-hidden" style={{ background:'var(--border-subtle)' }}>
              <div className="h-full rounded-full"
                style={{ width:`${Math.min(100,(node.gasPPM||0)/10)}%`, background:gasColor }} />
            </div>
          </div>
          <span className="text-[11px] font-mono text-ink-500 ml-auto whitespace-nowrap">
            {node.rssi ?? '—'} dBm
          </span>
        </>
      ) : (
        <span className="text-xs text-ink-500 ml-1">No signal</span>
      )}

      {node?.sos && (
        <span className="badge badge-danger text-[10px] ml-1 animate-pulse-glow">SOS</span>
      )}
    </div>
  );
});

/* ── Mini trend chart ────────────────────────────────────────────────────── */
const MiniChart = React.memo(function MiniChart({ data, dataKey, color, label }) {
  if (!data || data.length < 2) return (
    <div className="h-16 flex items-center justify-center text-xs text-ink-500">No data yet</div>
  );
  return (
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={data} margin={{ top:4, right:0, left:0, bottom:0 }}>
        <defs>
          <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.25}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
          fill={`url(#g-${dataKey})`} dot={false} isAnimationActive={false} />
        <Tooltip
          contentStyle={{ background:'var(--bg-dropdown)', border:'1px solid var(--border-card)', borderRadius:'0.5rem', fontSize:'11px', padding:'4px 8px', color:'var(--text-heading)' }}
          itemStyle={{ color:'var(--text-secondary)' }}
          labelFormatter={() => label}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

/* ── Main Dashboard ──────────────────────────────────────────────────────── */
export default function Dashboard() {
  const nodes        = useMineStore(s => s.nodes);
  const alerts       = useMineStore(s => s.alerts);
  const wsStatus     = useMineStore(s => s.wsStatus);
  const selectedNode = useMineStore(s => s.selectedNode);
  const historyNode1 = useMineStore(s => s.history[1]);
  const currentUser  = useAuthStore(s => s.currentUser);

  const onlineNodes  = Object.values(nodes).filter(n => n?.online).length;
  const sosNodes     = Object.values(nodes).filter(n => n?.sos).length;
  const critAlerts   = alerts.filter(a => a.severity === 3).length;
  const onlineList   = Object.values(nodes).filter(n => n?.online && n.gasPPM != null);

  const avgTemp  = onlineList.length ? onlineList.reduce((s,n) => s+(n.temperature||0),0)/onlineList.length : null;
  const maxGas   = onlineList.length ? Math.max(...onlineList.map(n=>n.gasPPM||0)) : null;
  const avgHumid = onlineList.length ? onlineList.reduce((s,n) => s+(n.humidity||0),0)/onlineList.length : null;

  // Combined history for trend charts — last 20 points from node 1 as sample
  const sampleHistory = useMemo(() => (historyNode1 || []).slice(-20), [historyNode1]);

  const mineStatus = sosNodes > 0 ? 'EMERGENCY' : critAlerts > 0 ? 'WARNING' : 'SAFE';
  const statusColor = { EMERGENCY:'#ef4444', WARNING:'#f59e0b', SAFE:'#10b981' }[mineStatus];

  return (
    <div className="p-4 lg:p-5 space-y-4 min-h-0 animate-fade-up">

      {/* ── Greeting bar ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-ink-100">
            Good morning, <span style={{ color:'var(--accent-amber)' }}>{currentUser?.name?.split(' ')[0]}</span> 👋
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})} · SEC-A Mine Control
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="live-badge">
            <div className="dot dot-online" />
            LIVE
          </div>
          <div className="px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background:`${statusColor}12`, border:`1px solid ${statusColor}30`, color:statusColor }}>
            {mineStatus}
          </div>
        </div>
      </div>

      {/* ── Stat strip ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users}       label="Active Miners"
          value={onlineNodes}
          sub={`${5 - onlineNodes} offline`}
          accent={onlineNodes === 5 ? '#10b981' : onlineNodes > 2 ? '#f59e0b' : '#ef4444'}
          trend={onlineNodes * 20} />
        <StatCard icon={AlertTriangle} label="Active Alerts"
          value={alerts.length}
          sub={`${critAlerts} critical`}
          accent={alerts.length === 0 ? '#10b981' : critAlerts > 0 ? '#ef4444' : '#f59e0b'}
          trend={Math.min(100, alerts.length * 10)} />
        <StatCard icon={Radio} label="LoRa Network"
          value={wsStatus === 'connected' ? 'Online' : 'Offline'}
          sub="915 MHz · SF12 · 20 dBm"
          accent={wsStatus === 'connected' ? '#10b981' : '#ef4444'} />
        <StatCard icon={ShieldCheck} label="Mine Safety"
          value={mineStatus}
          sub={sosNodes > 0 ? `${sosNodes} SOS active` : 'All clear'}
          accent={statusColor} />
      </div>

      {/* ── Node detail (selected) ─────────────────────── */}
      {selectedNode && <NodeDetail />}

      {/* ── Main grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Left — node cards */}
        <div className="col-span-12 xl:col-span-2 space-y-2">
          <div className="section-head">
            <Activity className="w-3.5 h-3.5" style={{ color:'#f59e0b' }} />
            Miner Nodes
          </div>
          {[1,2,3,4,5].map(id => <NodeCard key={id} nodeId={id} />)}
        </div>

        {/* Centre — map + env */}
        <div className="col-span-12 xl:col-span-7 space-y-4">
          <MineMap />

          {/* Environment monitoring */}
          <div className="card">
            <div className="section-head">
              <Wind className="w-3.5 h-3.5" style={{ color:'#06b6d4' }} />
              Environmental Safety Monitoring
              <div className="ml-auto live-badge">
                <div className="dot dot-online" /> Live
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <EnvMeter label="Gas (MQ-2)"   value={maxGas}   unit="PPM" max={1500} threshold={300} accent="#a78bfa" icon={Wind} />
              <EnvMeter label="Temperature"  value={avgTemp}  unit="°C"  max={50}   threshold={37}  accent="#fb923c" icon={Thermometer} />
              <EnvMeter label="Humidity"     value={avgHumid} unit="%"   max={100}  threshold={90}  accent="#22d3ee" icon={Droplets} />
              <div className="space-y-2">
                <div className="text-xs text-ink-500">Ventilation</div>
                <div className="text-xl font-black" style={{ color:'#10b981' }}>Nominal</div>
                <div className="text-[10px] text-ink-600">Flow rate: Active</div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--border-subtle)' }}>
                  <div className="h-full rounded-full" style={{ width:'78%', background:'linear-gradient(90deg,#10b98188,#10b981)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Trend chart */}
          {sampleHistory.length > 1 && (
            <div className="card">
              <div className="section-head mb-3">
                <TrendingUp className="w-3.5 h-3.5" style={{ color:'#f59e0b' }} />
                Node 1 — Temperature Trend
              </div>
              <MiniChart data={sampleHistory} dataKey="temp" color="#fb923c" label="Temp °C" />
            </div>
          )}
        </div>

        {/* Right — gateway + summary + alerts */}
        <div className="col-span-12 xl:col-span-3 space-y-4">
          <GatewayStatus />

          {/* Node status list */}
          <div className="card">
            <div className="section-head">
              <Signal className="w-3.5 h-3.5" style={{ color:'#f59e0b' }} />
              Node Status
            </div>
            <div>
              {[1,2,3,4,5].map(id => <NodeRow key={id} nodeId={id} />)}
            </div>
          </div>

          <AlertsPanel compact />
        </div>
      </div>
    </div>
  );
}
