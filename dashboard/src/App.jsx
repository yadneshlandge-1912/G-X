import React, { useEffect } from 'react';
import Header          from './components/Header';
import Dashboard       from './pages/Dashboard';
import MapPage         from './pages/MapPage';
import AlertsPage      from './pages/AlertsPage';
import HistoryPage     from './pages/HistoryPage';
import ProfilePage     from './pages/ProfilePage';
import UsersPage       from './pages/UsersPage';
import ShiftLogPage    from './pages/ShiftLogPage';
import SettingsPage    from './pages/SettingsPage';
import IncidentReportPage from './pages/IncidentReportPage';
import EquipmentPage   from './pages/EquipmentPage';
import AuthRouter      from './pages/auth/AuthRouter';
import useMineStore    from './store/useMineStore';
import useAuthStore    from './store/useAuthStore';

// ── Page renderer ────────────────────────────────────────────────────────────
function PageContent({ activePage }) {
  switch (activePage) {
    case 'dashboard': return <Dashboard />;
    case 'map':       return <MapPage />;
    case 'alerts':    return <AlertsPage />;
    case 'history':   return <HistoryPage />;
    case 'profile':   return <ProfilePage />;
    case 'users':     return <UsersPage />;
    case 'shiftlog':  return <ShiftLogPage />;
    case 'settings':  return <SettingsPage />;
    case 'incidents': return <IncidentReportPage />;
    case 'equipment': return <EquipmentPage />;
    default:          return <Dashboard />;
  }
}

// ── Inner app (shown after login) ────────────────────────────────────────────
function AppShell() {
  const activePage  = useMineStore(s => s.activePage);
  const sosActive   = useMineStore(s => s.sosActive);
  const theme       = useAuthStore(s => s.theme);
  const currentUser = useAuthStore(s => s.currentUser);
  const connectWS   = useMineStore(s => s.connectWS);
  const wsRef       = useMineStore(s => s.wsRef);
  const pushNotif   = useAuthStore(s => s.pushNotification);

  const hasSOS = Object.values(sosActive).some(Boolean);

  // Connect WebSocket once when app shell mounts
  useEffect(() => {
    if (!wsRef) connectWS();
  }, []);

  // Apply theme class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', theme === 'light');
  }, [theme]);

  // SOS audio + notification
  useEffect(() => {
    if (!hasSOS) return;
    // Push in-app notification
    pushNotif({ title: '🚨 SOS ALERT', message: 'Emergency signal received from a miner node!', type: 'danger' });
    // Web Audio beep
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.setValueAtTime(0,   ctx.currentTime + 0.6);
      osc.start(); osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }, [hasSOS]);

  return (
    <div className={`min-h-screen flex flex-col bg-mine-bg bg-grid-sm ${theme === 'light' ? 'light-mode' : ''}`}>
      <Header />

      {/* Global SOS banner */}
      {hasSOS && (
        <div
          className="flex items-center justify-center gap-3 py-2.5 text-sm font-bold tracking-widest animate-pulse-red z-50"
          style={{ background: 'linear-gradient(90deg, #7f1d1d, #991b1b, #7f1d1d)' }}
        >
          <span className="text-2xl">🚨</span>
          <span className="text-white">SOS SIGNAL ACTIVE — EMERGENCY RESPONSE REQUIRED</span>
          <span className="text-2xl">🚨</span>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 overflow-auto">
        <PageContent activePage={activePage} />
      </main>

      {/* Footer */}
      <footer className="border-t border-mine-border bg-mine-panel/80 px-6 py-2 flex items-center justify-between text-xs text-mine-muted backdrop-blur-sm flex-wrap gap-2">
        <span className="font-mono">MineGuard · CoalMine LoRa+AI Platform v2.0 · SEC-A · 5 Nodes</span>
        <span className="font-mono hidden sm:inline">LoRa 915 MHz · SF12 · Offline-First · DGMS-aligned</span>
        <span className="font-mono">
          Logged in: <span className="text-mine-dim">{currentUser?.name}</span>
          {' '}· <span className="text-mine-accent">{currentUser?.role}</span>
        </span>
      </footer>
    </div>
  );
}

// ── Root — wraps AppShell in AuthRouter ─────────────────────────────────────
export default function App() {
  return (
    <AuthRouter>
      <AppShell />
    </AuthRouter>
  );
}
