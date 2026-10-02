import React, { useEffect } from 'react';
import Sidebar               from './components/Sidebar';
import Dashboard             from './pages/Dashboard';
import MapPage               from './pages/MapPage';
import AlertsPage            from './pages/AlertsPage';
import HistoryPage           from './pages/HistoryPage';
import ProfilePage           from './pages/ProfilePage';
import UsersPage             from './pages/UsersPage';
import ShiftLogPage          from './pages/ShiftLogPage';
import SettingsPage          from './pages/SettingsPage';
import IncidentReportPage    from './pages/IncidentReportPage';
import EquipmentPage         from './pages/EquipmentPage';
import AttendancePage        from './pages/AttendancePage';
import WorkPermitPage        from './pages/WorkPermitPage';
import SafetyChecklistPage   from './pages/SafetyChecklistPage';
import PowerMonitorPage      from './pages/PowerMonitorPage';
import WaterPumpPage         from './pages/WaterPumpPage';
import VentilationPage       from './pages/VentilationPage';
import SeismicPage           from './pages/SeismicPage';
import CO2MonitorPage        from './pages/CO2MonitorPage';
import AnalyticsPage         from './pages/AnalyticsPage';
import ExportPage            from './pages/ExportPage';
import SafetyScorePage       from './pages/SafetyScorePage';
import EmergencyContactsPage from './pages/EmergencyContactsPage';
import TrainingPage          from './pages/TrainingPage';
import InventoryPage         from './pages/InventoryPage';
// ── 20 new pages ──────────────────────────────────────────────────────────────
import WeatherPage           from './pages/WeatherPage';
import NoticeboardPage       from './pages/NoticeboardPage';
import SOPPage               from './pages/SOPPage';
import MaintenancePage       from './pages/MaintenancePage';
import FuelPage              from './pages/FuelPage';
import MedicalPage           from './pages/MedicalPage';
import FireDrillPage         from './pages/FireDrillPage';
import CommunicationPage     from './pages/CommunicationPage';
import ProductionPage        from './pages/ProductionPage';
import BlastingPage          from './pages/BlastingPage';
import WasteManagePage       from './pages/WasteManagePage';
import PermitToWorkPage      from './pages/PermitToWorkPage';
import InspectionPage        from './pages/InspectionPage';
import RewardsPage           from './pages/RewardsPage';
import HazardMapPage         from './pages/HazardMapPage';
import MusterPage            from './pages/MusterPage';
import DrillPage             from './pages/DrillPage';
import ChemicalPage          from './pages/ChemicalPage';
import ContractorPage        from './pages/ContractorPage';
// ─────────────────────────────────────────────────────────────────────────────
import AuthRouter            from './pages/auth/AuthRouter';
import useMineStore          from './store/useMineStore';
import useAuthStore          from './store/useAuthStore';

function PageContent({ activePage }) {
  switch (activePage) {
    // ── Core ────────────────────────────────────────────
    case 'dashboard':    return <Dashboard />;
    case 'map':          return <MapPage />;
    case 'alerts':       return <AlertsPage />;
    case 'noticeboard':  return <NoticeboardPage />;
    case 'weather':      return <WeatherPage />;
    case 'comms':        return <CommunicationPage />;
    // ── Operations ──────────────────────────────────────
    case 'history':      return <HistoryPage />;
    case 'attendance':   return <AttendancePage />;
    case 'shiftlog':     return <ShiftLogPage />;
    case 'production':   return <ProductionPage />;
    case 'inspection':   return <InspectionPage />;
    case 'muster':       return <MusterPage />;
    // ── Safety ──────────────────────────────────────────
    case 'incidents':    return <IncidentReportPage />;
    case 'workpermit':   return <WorkPermitPage />;
    case 'permitwork':   return <PermitToWorkPage />;
    case 'checklist':    return <SafetyChecklistPage />;
    case 'sop':          return <SOPPage />;
    case 'hazardmap':    return <HazardMapPage />;
    case 'firedrill':    return <FireDrillPage />;
    case 'medical':      return <MedicalPage />;
    case 'rewards':      return <RewardsPage />;
    // ── Monitoring ──────────────────────────────────────
    case 'equipment':    return <EquipmentPage />;
    case 'maintenance':  return <MaintenancePage />;
    case 'power':        return <PowerMonitorPage />;
    case 'waterpump':    return <WaterPumpPage />;
    case 'ventilation':  return <VentilationPage />;
    case 'seismic':      return <SeismicPage />;
    case 'co2':          return <CO2MonitorPage />;
    case 'fuel':         return <FuelPage />;
    // ── Mining Ops ──────────────────────────────────────
    case 'blasting':     return <BlastingPage />;
    case 'drilling':     return <DrillPage />;
    case 'chemical':     return <ChemicalPage />;
    case 'waste':        return <WasteManagePage />;
    // ── Reports ─────────────────────────────────────────
    case 'analytics':    return <AnalyticsPage />;
    case 'export':       return <ExportPage />;
    case 'safetyscore':  return <SafetyScorePage />;
    // ── Admin ───────────────────────────────────────────
    case 'users':        return <UsersPage />;
    case 'contacts':     return <EmergencyContactsPage />;
    case 'training':     return <TrainingPage />;
    case 'inventory':    return <InventoryPage />;
    case 'contractor':   return <ContractorPage />;
    case 'settings':     return <SettingsPage />;
    // ── Personal ────────────────────────────────────────
    case 'profile':      return <ProfilePage />;
    default:             return <Dashboard />;
  }
}

function AppShell() {
  const activePage  = useMineStore(s => s.activePage);
  const setPage     = useMineStore(s => s.setActivePage);
  const hasSOS      = useMineStore(s => Object.values(s.sosActive || {}).some(Boolean));
  const theme       = useAuthStore(s => s.theme);
  const currentUser = useAuthStore(s => s.currentUser);
  const connectWS   = useMineStore(s => s.connectWS);
  const wsRef       = useMineStore(s => s.wsRef);
  const pushNotif   = useAuthStore(s => s.pushNotification);

  // Mobile sidebar state
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  // Close sidebar when page changes on mobile
  React.useEffect(() => { setMobileSidebarOpen(false); }, [activePage]);

  useEffect(() => { if (!wsRef) connectWS(); }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', theme === 'light');
    document.documentElement.classList.toggle('dark', theme !== 'light');
  }, [theme]);

  useEffect(() => {
    if (!hasSOS) return;
    pushNotif({ title: 'SOS ALERT', message: 'Emergency signal received from a miner node!', type: 'danger' });
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.6);
      osc.start(); osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }, [hasSOS]);

  return (
    <div
      className="flex overflow-hidden"
      style={{
        background: 'var(--bg-base, #03050d)',
        color: 'var(--text-primary, #e2e8f0)',
        /* 100dvh — dynamic viewport height, works correctly on Android Chrome */
        height: '100dvh',
        /* Fallback for older browsers */
        minHeight: '-webkit-fill-available',
      }}
    >
      {/* ── Mobile sidebar overlay ── */}
      {mobileSidebarOpen && (
        <div
          className="sidebar-overlay md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Left sidebar ─────────────────────────────────
          Desktop: always visible
          Mobile: slides in as a drawer over content      */}
      <div
        className="flex-shrink-0 transition-transform duration-300 ease-in-out md:relative md:translate-x-0"
        style={{
          position: mobileSidebarOpen ? 'fixed' : undefined,
          top: 0, left: 0, bottom: 0,
          zIndex: mobileSidebarOpen ? 50 : undefined,
          transform: mobileSidebarOpen ? 'translateX(0)' : undefined,
        }}
      >
        <Sidebar onClose={() => setMobileSidebarOpen(false)} />
      </div>

      {/* ── Right side: content stack ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Mobile top bar (hamburger + page title) ── */}
        <div
          className="flex md:hidden items-center gap-3 px-4 flex-shrink-0"
          style={{
            height: '3.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(6,10,20,0.98)',
          }}
        >
          {/* Hamburger button */}
          <button
            onClick={() => setMobileSidebarOpen(v => !v)}
            className="tap-target rounded-lg flex-shrink-0"
            style={{ color: '#94a3b8', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', width: 44, height: 44 }}
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          {/* GuardianX brand */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-black text-sm" style={{ color: '#f1f5f9' }}>
              Guardian<span style={{ color: '#f59e0b' }}>X</span>
            </span>
            <span className="text-xs font-mono truncate" style={{ color: '#475569' }}>SEC-A</span>
          </div>

          {/* Live indicator — right side */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {hasSOS && (
              <div className="text-xs font-bold text-red-400 animate-pulse">SOS</div>
            )}
          </div>
        </div>

        {/* SOS banner — always visible on mobile too */}
        {hasSOS && (
          <div
            className="flex items-center justify-center gap-2 py-2.5 text-xs font-bold tracking-widest flex-shrink-0 z-50 animate-pulse"
            style={{ background: 'linear-gradient(90deg, #7f1d1d, #991b1b, #7f1d1d)', color: '#fff' }}
          >
            <span>SOS SIGNAL ACTIVE — EMERGENCY RESPONSE REQUIRED</span>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth-mobile">
          <PageContent activePage={activePage} />
        </main>

        {/* Footer — hidden on mobile to save space */}
        <footer
          className="hidden sm:flex flex-shrink-0 px-4 py-2 items-center justify-between text-xs flex-wrap gap-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,10,20,0.95)', color: '#475569' }}
        >
          <span className="font-mono">GuardianX · CoalMine LoRa+AI v2.0 · SEC-A · 5 Nodes</span>
          <span className="font-mono hidden sm:inline">LoRa 915 MHz · SF12 · DGMS-aligned</span>
          <span className="font-mono">
            <span style={{ color: '#94a3b8' }}>{currentUser?.name}</span>
            {' · '}<span style={{ color: '#f59e0b', fontWeight: 700 }}>{currentUser?.role}</span>
          </span>
        </footer>

        {/* Mobile bottom nav — 5 most-used pages */}
        <nav
          className="flex md:hidden flex-shrink-0 border-t"
          style={{
            borderColor: 'rgba(255,255,255,0.07)',
            background: 'rgba(6,10,20,0.98)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {[
            { id:'dashboard', label:'Dashboard', icon:(
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            )},
            { id:'map',       label:'Map', icon:(
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
              </svg>
            )},
            { id:'alerts',    label:'Alerts', icon:(
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            )},
            { id:'incidents', label:'Incidents', icon:(
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            )},
            { id:'profile',   label:'Profile', icon:(
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            )},
          ].map(item => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 tap-target py-2 transition-colors"
                style={{ color: active ? '#f59e0b' : '#475569', minHeight: 56 }}
              >
                {item.icon}
                <span className="text-[9px] font-semibold">{item.label}</span>
                {active && (
                  <span
                    className="absolute bottom-0 rounded-t-full"
                    style={{ width: 28, height: 3, background: '#f59e0b' }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthRouter>
      <AppShell />
    </AuthRouter>
  );
}
