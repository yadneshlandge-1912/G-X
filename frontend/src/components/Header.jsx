import React, { useState, useEffect, useRef } from 'react';
import {
  Bell, LogOut, HardHat, ShieldCheck, Siren, Settings2,
  User, Users, Sliders, Sun, Moon,
  WifiOff, AlertTriangle, Activity, ChevronDown,
} from 'lucide-react';
import useMineStore  from '../store/useMineStore';
import useAuthStore  from '../store/useAuthStore';
import NotificationsPanel from './NotificationsPanel';

const ROLE_META = {
  miner:      { label:'Miner',       accent:'#f59e0b' },
  supervisor: { label:'Supervisor',  accent:'#38bdf8' },
  rescue:     { label:'Rescue Team', accent:'#f43f5e' },
  admin:      { label:'Admin',       accent:'#8b5cf6' },
};

export default function Header() {
  const setPage       = useMineStore(s => s.setActivePage);
  const wsStatus      = useMineStore(s => s.wsStatus);
  const hasSOS        = useMineStore(s => Object.values(s.sosActive).some(Boolean));
  const currentUser   = useAuthStore(s => s.currentUser);
  const logout        = useAuthStore(s => s.logout);
  const theme         = useAuthStore(s => s.theme);
  const toggleTheme   = useAuthStore(s => s.toggleTheme);
  const notifications = useAuthStore(s => s.notifications);

  const [time,         setTime]         = useState(new Date());
  const [showNotifs,   setShowNotifs]   = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    function h(e) { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const connected  = wsStatus === 'connected';
  const unread     = notifications.filter(n => !n.read).length;
  const roleMeta   = ROLE_META[currentUser?.role] || ROLE_META.supervisor;
  const accent     = roleMeta.accent;

  return (
    <header className="relative z-40 flex-shrink-0 transition-colors duration-200"
      style={{ background:'var(--bg-header)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-header)', boxShadow:'var(--shadow-card)' }}>

      <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background:linear-gradient(90deg, transparent 0%, 80 50%, transparent 100%) }} />

      <div className="flex items-center gap-3 px-4 h-13" style={{height:'3.25rem'}}>

        {/* Page title area */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono text-mine-muted hidden sm:block">SEC-A Mine · Jharia Coalfield</div>
        </div>

        {/* Right strip */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {hasSOS && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-red-500"
              style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', animation:'sos-pulse 1s ease-in-out infinite' }}>
              <AlertTriangle className="w-3.5 h-3.5" /> SOS ACTIVE
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono"
            style={connected
              ? { background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', color:'#10b981' }
              : { background:'rgba(239,68,68,0.08)',  border:'1px solid rgba(239,68,68,0.2)',  color:'#ef4444' }}>
            {connected ? <><div className="dot dot-online" /><span className="hidden sm:inline">Live</span></> : <><WifiOff className="w-3 h-3" /><span className="hidden sm:inline">Offline</span></>}
          </div>

          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-ink-500"
            style={{ background:'var(--bg-card-nested)', border:'1px solid var(--border-subtle)' }}>
            <Activity className="w-3 h-3" style={{ color:'var(--accent-amber)' }} />
            <span className="tabular">{time.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</span>
          </div>

          <button onClick={toggleTheme} className="btn-icon" title="Toggle theme">
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          <div className="relative">
            <button onClick={() => { setShowNotifs(v => !v); setShowUserMenu(false); }} className="btn-icon relative">
              <Bell className="w-3.5 h-3.5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ background:'#ef4444' }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}
          </div>

          <div className="relative" ref={userMenuRef}>
            <button onClick={() => { setShowUserMenu(v => !v); setShowNotifs(false); }}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl transition-all duration-150 hover:bg-mine-border/30"
              style={{ border:'1px solid var(--border-subtle)' }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background:${accent}18, border:1px solid 28 }}>
                {currentUser?.avatar || '??'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-ink-200 leading-none">{currentUser?.name?.split(' ')[0]}</div>
                <div className="text-[10px] font-mono leading-none mt-0.5" style={{ color: accent }}>{roleMeta.label}</div>
              </div>
              <ChevronDown className={w-3 h-3 text-ink-600 transition-transform } />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-11 w-56 rounded-xl overflow-hidden z-50 animate-scale-in"
                style={{ background:'var(--bg-dropdown)', border:'1px solid var(--border-card)', boxShadow:'var(--shadow-dropdown)' }}>
                <div className="px-4 py-3.5" style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{currentUser?.avatar}</span>
                    <div>
                      <div className="text-sm font-semibold text-ink-100">{currentUser?.name}</div>
                      <div className="text-[11px] text-ink-500 font-mono">@{currentUser?.username}</div>
                      <div className="text-[11px] font-semibold mt-0.5" style={{ color: accent }}>{roleMeta.label} · {currentUser?.badge}</div>
                    </div>
                  </div>
                </div>
                {[
                  { id:'profile',  label:'My Profile', Icon:User    },
                  { id:'settings', label:'Settings',    Icon:Sliders },
                  ...(currentUser?.role === 'admin' ? [{ id:'users', label:'Manage Users', Icon:Users }] : []),
                ].map(({ id, label, Icon: I }) => (
                  <button key={id} onClick={() => { setPage(id); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink-400 hover:text-ink-100 hover:bg-mine-border/30 transition-colors">
                    <I className="w-4 h-4" /> {label}
                  </button>
                ))}
                <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink-400 hover:text-ink-100 hover:bg-mine-border/30 transition-colors">
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
                <div style={{ borderTop:'1px solid var(--border-subtle)' }} />
                <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
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
