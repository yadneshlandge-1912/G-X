import React, { useState } from 'react';
import {
  HardHat, ShieldCheck, Siren, Settings2,
  Radio, MapPin, Bell, Wifi, ChevronRight,
  AlertTriangle, Clock,
} from 'lucide-react';
import useMineStore from '../store/useMineStore';

const ROLES = [
  {
    id: 'miner',
    label: 'Miner',
    Icon: HardHat,
    desc: 'View your safety status and send SOS',
    color: 'amber',
    border: 'border-mine-accent/40 hover:border-mine-accent',
    bg: 'hover:bg-amber-900/20',
    iconBg: 'bg-amber-900/40',
    iconColor: 'text-mine-accent',
    glow: 'hover:shadow-glow-amber',
  },
  {
    id: 'supervisor',
    label: 'Supervisor',
    Icon: ShieldCheck,
    desc: 'Monitor miners and mine operations',
    color: 'blue',
    border: 'border-mine-blue/40 hover:border-mine-blue',
    bg: 'hover:bg-blue-900/20',
    iconBg: 'bg-blue-900/40',
    iconColor: 'text-mine-blue',
    glow: 'hover:shadow-glow-blue',
  },
  {
    id: 'rescue',
    label: 'Rescue Team',
    Icon: Siren,
    desc: 'Respond to emergencies and manage rescue',
    color: 'red',
    border: 'border-red-500/40 hover:border-red-500',
    bg: 'hover:bg-red-900/20',
    iconBg: 'bg-red-900/40',
    iconColor: 'text-red-400',
    glow: 'hover:shadow-glow-red',
  },
  {
    id: 'admin',
    label: 'Admin',
    Icon: Settings2,
    desc: 'Manage system settings and users',
    color: 'purple',
    border: 'border-mine-purple/40 hover:border-mine-purple',
    bg: 'hover:bg-purple-900/20',
    iconBg: 'bg-purple-900/40',
    iconColor: 'text-mine-purple',
    glow: 'hover:shadow-glow-cyan',
  },
];

const FEATURES = [
  { Icon: Radio,  label: 'Real-time Monitoring' },
  { Icon: MapPin, label: 'Location Tracking' },
  { Icon: Wifi,   label: 'LoRa Communication' },
  { Icon: Bell,   label: 'Emergency Alerts' },
];

export default function LoginPage() {
  const [selected, setSelected] = useState(null);
  const setRole = useMineStore(s => s.setRole);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  function handleContinue() {
    if (!selected) return;
    setRole(selected);
  }

  function handleSOS() {
    setRole('miner');
  }

  return (
    <div className="min-h-screen flex overflow-hidden relative bg-mine-deeper">

      {/* ── Background grid ───────────────────────────── */}
      <div className="absolute inset-0 bg-grid-sm opacity-60 pointer-events-none" />

      {/* ── Left panel — hero ─────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[55%] relative overflow-hidden p-12">

        {/* Mine tunnel atmosphere */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Deep tunnel vignette */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 70% 60% at 60% 50%, rgba(30,15,0,0.4) 0%, rgba(5,8,16,0.95) 100%)',
            }}
          />
          {/* Tunnel arch lines */}
          {[0.3, 0.5, 0.7].map((s, i) => (
            <div
              key={i}
              className="absolute border border-mine-accent/5 rounded-full"
              style={{
                width: `${s * 100}%`,
                height: `${s * 140}%`,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
          {/* Orange light glow from deep tunnel */}
          <div
            className="absolute"
            style={{
              width: '300px', height: '300px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(180,80,0,0.25) 0%, transparent 70%)',
              top: '40%', left: '55%',
              transform: 'translate(-50%,-50%)',
            }}
          />
          {/* Rail track lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 800 600">
            <line x1="340" y1="600" x2="420" y2="300" stroke="#f59e0b" strokeWidth="2"/>
            <line x1="460" y1="600" x2="430" y2="300" stroke="#f59e0b" strokeWidth="2"/>
            {[320,340,360,380,400,420].map((y,i) => (
              <line key={i} x1="330" y1={y + 200} x2="475" y2={y + 200 - i*6} stroke="#f59e0b" strokeWidth="1.5"/>
            ))}
          </svg>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-lg bg-amber-900/50 border border-mine-accent/40 flex items-center justify-center">
                <span className="text-mine-accent font-black text-lg leading-none">⛏</span>
              </div>
              <div className="absolute -inset-1 rounded-lg bg-mine-accent/10 blur-sm" />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-white font-black text-2xl tracking-tight">MINE</span>
                <span className="text-mine-accent font-black text-2xl tracking-tight">GUARD</span>
              </div>
              <div className="text-mine-muted text-xs tracking-widest">Smart Coal Miner Safety & Emergency Response System</div>
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-5xl font-black text-white leading-tight mb-2">
              Safer Miners.<br />
              <span className="text-mine-accent text-glow-amber">Stronger Tomorrow.</span>
            </h1>
            <p className="text-mine-dim text-base leading-relaxed max-w-sm">
              Real-time monitoring · Long-range LoRa communication · Faster emergency response · Safer mines
            </p>
          </div>

          {/* Feature pills */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(({ Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 bg-mine-panel/60 border border-mine-border rounded-lg px-3 py-2.5 backdrop-blur-sm"
              >
                <div className="w-7 h-7 rounded-md bg-amber-900/40 border border-mine-accent/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-mine-accent" />
                </div>
                <span className="text-mine-dim text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10">
          <p className="text-mine-muted text-xs italic">— Because every miner matters...</p>
        </div>
      </div>

      {/* ── Right panel — login card ───────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">

        {/* Top-right nav links */}
        <div className="absolute top-6 right-8 hidden lg:flex items-center gap-6 text-xs text-mine-muted">
          <span className="hover:text-mine-dim cursor-pointer transition-colors">Technology</span>
          <span className="text-mine-border">|</span>
          <span className="hover:text-mine-dim cursor-pointer transition-colors">Safety</span>
          <span className="text-mine-border">|</span>
          <span className="hover:text-mine-dim cursor-pointer transition-colors">Sustainability</span>
        </div>

        <div className="w-full max-w-md animate-fade-in">

          {/* Card */}
          <div
            className="rounded-2xl border border-mine-border overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, #0d1220 0%, #080c14 100%)',
              boxShadow: '0 0 60px rgba(0,0,0,0.6), 0 0 120px rgba(245,158,11,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {/* Card header */}
            <div className="px-7 pt-7 pb-5 border-b border-mine-border/60">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-md bg-mine-accent/20 flex items-center justify-center">
                  <ShieldCheck className="w-3 h-3 text-mine-accent" />
                </div>
                <span className="text-mine-muted text-xs font-medium tracking-widest uppercase">Welcome to</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-white font-black text-3xl">MINE</span>
                <span className="text-mine-accent font-black text-3xl text-glow-amber">GUARD</span>
              </div>
              <p className="text-mine-muted text-sm mt-1">Please select your role to continue</p>
            </div>

            {/* Role selector */}
            <div className="px-7 py-5 grid grid-cols-2 gap-3">
              {ROLES.map((role) => {
                const isSelected = selected === role.id;
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelected(role.id)}
                    className={`
                      relative flex flex-col items-center text-center gap-2.5 p-4 rounded-xl border transition-all duration-200
                      ${role.border} ${role.bg} ${role.glow}
                      ${isSelected
                        ? `${role.iconBg} border-opacity-100`
                        : 'border-mine-border/60 bg-transparent'}
                    `}
                    style={isSelected ? {
                      boxShadow: role.color === 'amber' ? '0 0 20px rgba(245,158,11,0.2)' :
                                 role.color === 'blue'  ? '0 0 20px rgba(59,130,246,0.2)' :
                                 role.color === 'red'   ? '0 0 20px rgba(239,68,68,0.2)' :
                                                          '0 0 20px rgba(167,139,250,0.2)',
                    } : {}}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-mine-accent flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-mine-bg" />
                      </div>
                    )}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${role.iconBg}`}>
                      <role.Icon className={`w-5 h-5 ${role.iconColor}`} />
                    </div>
                    <div>
                      <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-mine-dim'}`}>
                        {role.label.toUpperCase()}
                      </div>
                      <div className="text-mine-muted text-xs leading-tight mt-0.5">{role.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="px-7 pb-7 space-y-3">
              <button
                onClick={handleContinue}
                disabled={!selected}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-200
                  ${selected
                    ? 'btn-primary cursor-pointer'
                    : 'bg-mine-border/40 text-mine-muted cursor-not-allowed'}`}
              >
                CONTINUE
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-mine-border/60" />
                <span className="text-mine-muted text-xs">OR</span>
                <div className="flex-1 h-px bg-mine-border/60" />
              </div>

              <button
                onClick={handleSOS}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  boxShadow: '0 0 20px rgba(239,68,68,0.4)',
                }}
              >
                <AlertTriangle className="w-4 h-4" />
                EMERGENCY SOS
                <span className="text-red-200 text-xs font-normal">— Need immediate help? Click here.</span>
              </button>
            </div>

            {/* Card footer status strip */}
            <div className="px-7 py-3 border-t border-mine-border/60 flex items-center justify-between bg-mine-deeper/50">
              <div className="flex items-center gap-1.5">
                <div className="dot-online" />
                <span className="text-mine-muted text-xs">LoRa Network <span className="text-green-400 font-semibold">ONLINE</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="dot-online" />
                <span className="text-mine-muted text-xs">Mine Safety System <span className="text-green-400 font-semibold">ACTIVE</span></span>
              </div>
              <div className="flex items-center gap-1 text-mine-muted text-xs">
                <Clock className="w-3 h-3" />
                <span>{timeStr}</span>
              </div>
            </div>
          </div>

          {/* Below-card tagline */}
          <p className="text-center text-mine-muted text-xs mt-5 italic">
            Technology for a safer tomorrow.
          </p>
        </div>
      </div>
    </div>
  );
}
