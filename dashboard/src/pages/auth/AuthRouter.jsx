/**
 * AuthRouter — controls the full authentication flow
 * role_pick → role-specific login → app
 */
import React, { useState } from 'react';
import { ChevronRight, Radio, Zap, Shield, MapPin, Activity } from 'lucide-react';
import useAuthStore    from '../../store/useAuthStore';
import MinerLogin      from './MinerLogin';
import SupervisorLogin from './SupervisorLogin';
import RescueLogin     from './RescueLogin';
import AdminLogin      from './AdminLogin';

const ROLES = [
  {
    id: 'login_miner',
    label: 'Miner',
    sub: 'Field worker — wearable node',
    emoji: '⛏',
    accent: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
    border: 'rgba(245,158,11,0.25)',
    bg: 'rgba(245,158,11,0.06)',
  },
  {
    id: 'login_supervisor',
    label: 'Supervisor',
    sub: 'Operations control centre',
    emoji: '📋',
    accent: '#38bdf8',
    glow: 'rgba(56,189,248,0.12)',
    border: 'rgba(56,189,248,0.2)',
    bg: 'rgba(56,189,248,0.05)',
  },
  {
    id: 'login_rescue',
    label: 'Rescue Team',
    sub: 'Emergency response unit',
    emoji: '🦺',
    accent: '#f43f5e',
    glow: 'rgba(244,63,94,0.15)',
    border: 'rgba(244,63,94,0.25)',
    bg: 'rgba(244,63,94,0.06)',
  },
  {
    id: 'login_admin',
    label: 'System Admin',
    sub: 'Full access — restricted',
    emoji: '🛡️',
    accent: '#8b5cf6',
    glow: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.2)',
    bg: 'rgba(139,92,246,0.05)',
  },
];

const STATS = [
  { icon: Radio,    value: '915 MHz', label: 'LoRa Band'   },
  { icon: Zap,      value: 'SF12',    label: 'Spreading'   },
  { icon: Shield,   value: 'DGMS',    label: 'Compliant'   },
  { icon: MapPin,   value: 'SEC-A',   label: 'Mine Section'},
];

function RolePicker() {
  const setAuthStep = useAuthStore(s => s.setAuthStep);
  const [hovered, setHovered] = useState(null);

  return (
    <div className="min-h-screen bg-surface-950 flex overflow-hidden relative">
      {/* Background layers */}
      <div className="absolute inset-0 bg-grid-sm pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245,158,11,0.08) 0%, transparent 60%)' }} />

      {/* ── Left hero ──────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[54%] relative p-14 overflow-hidden">

        {/* Decorative mine tunnel SVG */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg className="absolute bottom-0 right-0 w-full h-full opacity-[0.035]"
            viewBox="0 0 600 700" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="300" cy="350" rx="280" ry="340" stroke="#f59e0b" strokeWidth="1.5"/>
            <ellipse cx="300" cy="350" rx="200" ry="250" stroke="#f59e0b" strokeWidth="1"/>
            <ellipse cx="300" cy="350" rx="120" ry="160" stroke="#f59e0b" strokeWidth="0.75"/>
            <line x1="260" y1="700" x2="300" y2="350" stroke="#f59e0b" strokeWidth="1.5"/>
            <line x1="340" y1="700" x2="300" y2="350" stroke="#f59e0b" strokeWidth="1.5"/>
            {[0,60,120,180,240].map((y,i) => (
              <line key={i} x1={250 - i*2} y1={700 - y} x2={350 + i*2} y2={700 - y}
                stroke="#f59e0b" strokeWidth="1"/>
            ))}
          </svg>
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 40% 60%, rgba(245,158,11,0.06) 0%, transparent 70%)' }} />
        </div>

        {/* Logo */}
        <div className="relative z-10 mb-auto">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.08))', border: '1px solid rgba(245,158,11,0.3)' }}>
                ⛏
              </div>
              <div className="absolute -inset-1 rounded-xl blur-md opacity-30"
                style={{ background: 'rgba(245,158,11,0.4)' }} />
            </div>
            <div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl font-black text-white tracking-tight">Mine</span>
                <span className="text-xl font-black tracking-tight" style={{ color: '#f59e0b' }}>Guard</span>
              </div>
              <div className="text-[10px] font-mono text-ink-600 tracking-[0.12em] uppercase">Coal Mine Safety Platform</div>
            </div>
          </div>
        </div>

        {/* Hero headline */}
        <div className="relative z-10 my-auto space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div className="dot dot-online animate-pulse-glow" />
              <span className="text-xs font-semibold" style={{ color: '#f59e0b' }}>5-Node Network Online</span>
            </div>

            <h1 className="text-[3.25rem] font-black leading-[1.05] text-white mb-4">
              Safer miners.{' '}
              <span className="block text-glow-amber" style={{ color: '#f59e0b' }}>
                Smarter mines.
              </span>
            </h1>
            <p className="text-base text-ink-500 leading-relaxed max-w-sm">
              Real-time LoRa monitoring, AI-powered anomaly detection and instant emergency response — built for Indian coal mines.
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 max-w-xs">
            {STATS.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white font-mono">{value}</div>
                  <div className="text-[10px] text-ink-600">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10 mt-auto">
          <p className="text-xs text-ink-600 italic">— Because every miner comes home safe.</p>
        </div>
      </div>

      {/* ── Right — role picker ─────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12 relative">

        {/* Vertical divider */}
        <div className="hidden lg:block absolute left-0 top-12 bottom-12 w-px"
          style={{ background: 'linear-gradient(180deg,transparent,rgba(255,255,255,0.06),transparent)' }} />

        <div className="w-full max-w-sm animate-fade-up">

          {/* Card */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>

            {/* Card header */}
            <div className="px-7 pt-7 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
              <p className="text-sm text-ink-500">Select your role to access your dashboard</p>
            </div>

            {/* Role list */}
            <div className="p-4 space-y-2">
              {ROLES.map((role) => (
                <button key={role.id}
                  onMouseEnter={() => setHovered(role.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setAuthStep(role.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 group text-left"
                  style={{
                    background: hovered === role.id ? role.bg : 'transparent',
                    border: `1px solid ${hovered === role.id ? role.border : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: hovered === role.id ? `0 0 20px ${role.glow}` : 'none',
                  }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{ background: role.bg, border: `1px solid ${role.border}` }}>
                    {role.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{role.label}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{role.sub}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-600 transition-all duration-200 group-hover:translate-x-0.5"
                    style={{ color: hovered === role.id ? role.accent : undefined }} />
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-7 py-3 flex items-center justify-between"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
              <div className="flex items-center gap-1.5">
                <div className="dot dot-online" />
                <span className="text-[11px] text-ink-500">LoRa Network <span className="text-emerald-400 font-semibold">Active</span></span>
              </div>
              <span className="text-[11px] text-ink-600 font-mono">v2.0 · DGMS</span>
            </div>
          </div>

          <p className="text-center text-xs text-ink-600 mt-5">
            Authorised personnel only · All sessions are logged
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthRouter({ children }) {
  const authStep    = useAuthStore(s => s.authStep);
  const currentUser = useAuthStore(s => s.currentUser);
  const setAuthStep = useAuthStore(s => s.setAuthStep);

  // If a valid session exists in localStorage (page refresh / return visit),
  // skip the login flow entirely and go straight to the app.
  if (currentUser) {
    // Sync authStep so it's consistent with the stored session
    if (authStep !== 'app') setAuthStep('app');
    return children;
  }

  switch (authStep) {
    case 'role_pick':        return <RolePicker />;
    case 'login_miner':      return <MinerLogin />;
    case 'login_supervisor': return <SupervisorLogin />;
    case 'login_rescue':     return <RescueLogin />;
    case 'login_admin':      return <AdminLogin />;
    case 'app':              return children;
    default:                 return <RolePicker />;
  }
}
