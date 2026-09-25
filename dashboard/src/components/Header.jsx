import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Map, Bell, History, LogOut,
  HardHat, ShieldCheck, Siren, Settings2,
  User, Users, ClipboardList, Sliders,
  FileWarning, Wrench, Sun, Moon,
  WifiOff, AlertTriangle, Activity, ChevronDown,
} from 'lucide-react';
import useMineStore       from '../store/useMineStore';
import useAuthStore       from '../store/useAuthStore';
import NotificationsPanel from './NotificationsPanel';

/* ── Role config ─────────────────────────────────────────────────────────── */
const ROLE_META = {
  miner:      { label:'Miner',        Icon:HardHat,     accent:'#f59e0b' },
  supervisor: { label:'Supervisor',   Icon:ShieldCheck,  accent:'#38bdf8' },
  rescue:     { label:'Rescue Team',  Icon:Siren,        accent:'#f43f5e' },
  admin:      { label:'Admin',        Icon:Settings2,    accent:'#8b5cf6' },
};

/* ── Per-role nav ────────────────────────────────────────────────────────── */
const NAV = {
  miner: [
    { id:'dashboard', label:'Dashboard', Icon:LayoutDashboard },
    { id:'map',       label:'Map',       Icon:Map },
    { id:'alerts',    label:'Alerts',    Icon:Bell },
    { id:'profile',   label:'Profile',   Icon:User },
  ],
  supervisor: [
    { id:'dashboard', label:'Dashboard', Icon:LayoutDashboard },
    { id:'map',       label:'Map',       Icon:Map },
    { id:'alerts',    label:'Alerts',    Icon:Bell },
    { id:'history',   label:'History',   Icon:History },
    { id:'shiftlog',  label:'Shift Log', Icon:ClipboardList },
    { id:'incidents', label:'Incidents', Icon:FileWarning },
    { id:'equipment', label:'Equipment', Icon:Wrench },
  ],
  rescue: [
    { id:'dashboard', label:'Dashboard', Icon:LayoutDashboard },
    { id:'map',       label:'Map',       Icon:Map },
    { id:'alerts',    label:'Alerts',    Icon:Bell },
    { id:'incidents', label:'Incidents', Icon:FileWarning },
    { id:'shiftlog',  label:'Shift Log', Icon:ClipboardList },
    { id:'equipment', label:'Equipment', Icon:Wrench },
  ],
  admin: [
    { id:'dashboard', label:'Dashboard', Icon:LayoutDashboard },
    { id:'map',       label:'Map',       Icon:Map },
    { id:'alerts',    label:'Alerts',    Icon:Bell },
    { id:'history',   label:'History',   Icon:History },
    { id:'shiftlog',  label:'Shift Log', Icon:ClipboardList },
    { id:'incidents', label:'Incidents', Icon:FileWarning },
    { id:'equipment', label:'Equipment', Icon:Wrench },
    { id:'users',     label:'Users',     Icon:Users },
    { id:'settings',  label:'Settings',  Icon:Sliders },
  ],
};

/* ── Header ──────────────────────────────────────────────────────────────── */
export default function Header() {
  const activePage  = useMineStore(s => s.activePage);
  const setPage     = useMineStore(s => s.setActivePage);
  const alerts      = useMineStore(s => s.alerts);
  const wsStatus    = useMineStore(s => s.wsStatus);
  const sosActive   = useMineStore(s => s.sosActive);

  const currentUser   = useAuthStore(s => s.currentUser);
  const logout        = useAuthStore(s => s.logout);
  const theme         = useAuthStore(s => s.theme);
  const toggleTheme   = useAuthStore(s => s.toggleTheme);
  const notifications = useAuthStore(s => s.notifications);

  const [time,         setTime]         = useState(new Date());
  const [showNotifs,   setShowNotifs]   = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function h(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const hasSOS       = Object.values(sosActive).some(Boolean);
  const connected    = wsStatus === 'connected';
  const unread       = notifications.filter(n => !n.read).length;
  const alertCount   = alerts.length;
  const roleMeta     = ROLE_META[currentUser?.role] || ROLE_META.supervisor;
  const navItems     = NAV[currentUser?.role] || NAV.supervisor;
  const accent       = roleMeta.accent;

  return (
    <header className="relative z-40 flex-shrink-0"
      style={{
        background: 'rgba(3,5,13,0.96)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.4)',
      }}>

      {/* Accent top line */}
      <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}80 50%, transparent 100%)` }} />

      <div className="flex items-center gap-4 px-5 h-14">

        {/* ── Logo ──────────────────────────────────────────────── */}
        <button onClick={() => setPage('dashboard')}
          className="flex items-center gap-2.5 flex-shrink-0 group">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base transition-transform group-hover:scale-105"
              style={{ background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.25)' }}>
              ⛏
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-baseline gap-0.5 leading-none">
              <span className="text-sm font-black text-white">Mine</span>
              <span className="text-sm font-black" style={{ color:'#f59e0b' }}>Guard</span>
            </div>
            <div className="text-[9px] text-ink-600 font-mono tracking-wider">SEC-A · 5 NODES</div>
          </div>
        </button>

        {/* ── Divider ───────────────────────────────────────────── */}
        <div className="h-5 w-px bg-white/5 flex-shrink-0" />

        {/* ── Nav ───────────────────────────────────────────────── */}
        <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none">
          {navItems.map(({ id, label, Icon }) => {
            const isActive = activePage === id;
            const count    = id === 'alerts' ? alertCount : 0;
            return (
              <button key={id} onClick={() => setPage(id)}
                className="nav-item flex-shrink-0 relative"
                style={isActive ? {
                  color: accent,
                  background: `${accent}14`,
                  boxShadow: `0 0 0 1px ${accent}30`,
                } : {}}>
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{label}</span>
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Right strip ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* SOS pill */}
          {hasSOS && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-red-300"
              style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', animation:'sos-pulse 1s ease-in-out infinite' }}>
              <AlertTriangle className="w-3.5 h-3.5" /> SOS
            </div>
          )}

          {/* Connection */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono"
            style={connected
              ? { background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', color:'#34d399' }
              : { background:'rgba(239,68,68,0.08)',  border:'1px solid rgba(239,68,68,0.2)',  color:'#f87171' }}>
            {connected
              ? <><div className="dot dot-online" /><span className="hidden sm:inline">Live</span></>
              : <><WifiOff className="w-3 h-3" /><span className="hidden sm:inline">Offline</span></>}
          </div>

          {/* Clock */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-ink-500"
            style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <Activity className="w-3 h-3" style={{ color:'#f59e0b' }} />
            <span className="tabular">{time.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</span>
          </div>

          {/* Theme */}
          <button onClick={toggleTheme} className="btn-icon" title="Toggle theme">
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => { setShowNotifs(v => !v); setShowUserMenu(false); }} className="btn-icon relative">
              <Bell className="w-3.5 h-3.5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger-DEFAULT text-white text-[9px] font-bold flex items-center justify-center"
                  style={{ background:'#ef4444' }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}
          </div>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button onClick={() => { setShowUserMenu(v => !v); setShowNotifs(false); }}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl transition-all duration-150 hover:bg-white/5"
              style={{ border:'1px solid rgba(255,255,255,0.07)' }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm"
                style={{ background:`${accent}18`, border:`1px solid ${accent}28` }}>
                {currentUser?.avatar || '👤'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-ink-200 leading-none">
                  {currentUser?.name?.split(' ')[0]}
                </div>
                <div className="text-[10px] font-mono leading-none mt-0.5" style={{ color: accent }}>
                  {roleMeta.label}
                </div>
              </div>
              <ChevronDown className={`w-3 h-3 text-ink-600 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-11 w-56 rounded-xl overflow-hidden z-50 animate-scale-in"
                style={{ background:'#0a0f1e', border:'1px solid rgba(255,255,255,0.09)', boxShadow:'0 24px 64px rgba(0,0,0,0.6)' }}>

                {/* Identity */}
                <div className="px-4 py-3.5" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{currentUser?.avatar}</span>
                    <div>
                      <div className="text-sm font-semibold text-white">{currentUser?.name}</div>
                      <div className="text-[11px] text-ink-500 font-mono">@{currentUser?.username}</div>
                      <div className="text-[11px] font-semibold mt-0.5" style={{ color: accent }}>
                        {roleMeta.label} · {currentUser?.badge}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                {[
                  { id:'profile',  label:'My Profile',  Icon:User    },
                  { id:'settings', label:'Settings',     Icon:Sliders },
                  ...(currentUser?.role === 'admin' ? [{ id:'users', label:'Manage Users', Icon:Users }] : []),
                ].map(({ id, label, Icon: I }) => (
                  <button key={id} onClick={() => { setPage(id); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink-400 hover:text-ink-100 hover:bg-white/5 transition-colors">
                    <I className="w-4 h-4" /> {label}
                  </button>
                ))}

                {/* Theme */}
                <button onClick={toggleTheme}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink-400 hover:text-ink-100 hover:bg-white/5 transition-colors">
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>

                <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }} />

                {/* Logout */}
                <button onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
